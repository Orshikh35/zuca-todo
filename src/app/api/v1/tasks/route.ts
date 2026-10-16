import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HttpError, adminClient, errorResponse } from "@/lib/server/context";
import { notifyAssignee } from "@/lib/server/task-notify";
import { safeEqual } from "@/lib/server/telegram-link";
import type { Task } from "@/lib/types";

/**
 * Гадаад системээс (хамтрагч компанийн todo гэх мэт) ZUCA Ops-д ажил шууд үүсгэх API.
 * /api/intake-ээс ялгаатай нь AI-гүй — өгсөн талбараар нь яг тэр чигт нь бүртгэнэ.
 *
 *   POST /api/v1/tasks
 *   Authorization: Bearer <TASKS_API_KEY>      (эсвэл X-API-Key: <TASKS_API_KEY>)
 *   Content-Type: application/json
 *
 *   { "title": "Хөх тэнгэр зуслантай гэрээ байгуулах",   ← заавал
 *     "description": "...", "status": "todo", "priority": "high",
 *     "due_date": "2026-10-20", "assignee_email": "bat@zuca.mn",
 *     "zuca_camp_id": 12, "tags": ["гэрээ"],
 *     "source": "acme", "external_id": "ACME-123" }    ← давхардлаас сэргийлнэ
 *
 * 201 — шинээр үүссэн · 200 { duplicate: true } — ижил source + external_id өмнө нь ирсэн
 * Хариуцагчид Telegram мэдэгдэл очно ("notify": false бол үгүй).
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const opt = <T extends z.ZodTypeAny>(s: T) => s.nullish();

const Body = z.object({
  title: z.string().trim().min(1, "title хоосон байна").max(200),
  description: opt(z.string().max(8000)),
  status: opt(z.enum(["todo", "in_progress", "review", "done"])),
  priority: opt(z.enum(["urgent", "high", "medium", "low"])),
  due_date: opt(z.string().regex(ISO_DATE, "due_date нь YYYY-MM-DD")),
  planned_month: opt(z.string().regex(MONTH, "planned_month нь YYYY-MM")),
  /** Хариуцагч: ZUCA Ops-ийн ажилтны id эсвэл имэйл */
  assignee_id: opt(z.string().uuid()),
  assignee_email: opt(z.string().email()),
  /** Зуслан: ZUCA Ops-ийн id, zuca.mn-ийн id эсвэл яг нэр */
  camp_id: opt(z.string().uuid()),
  zuca_camp_id: opt(z.number().int().positive()),
  camp: opt(z.string().max(200)),
  project_id: opt(z.string().uuid()),
  tags: opt(z.array(z.string().trim().min(1).max(40)).max(20)),
  /** Илгээж буй систем (жишээ нь компанийн нэр) — external_id-тэй хамт давхардал шалгана */
  source: opt(z.string().trim().regex(/^[\w.-]{1,40}$/, "source нь латин үсэг, тоо, - _ . (40 хүртэл)")),
  external_id: opt(z.string().trim().min(1).max(200)),
  notify: opt(z.boolean()),
});

const FIELDS = "id,title,description,status,priority,assignee_id,camp_id,project_id,due_date,planned_month,tags,source,external_ref,created_at";

function authorize(req: Request) {
  const clean = (v: string | null | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "");
  const keys = clean(process.env.TASKS_API_KEY)
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const given = clean((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")) || clean(req.headers.get("x-api-key"));
  if (!keys.length) throw new HttpError(503, "TASKS_API_KEY тохируулаагүй байна");
  if (!given || !keys.some((k) => safeEqual(given, k))) throw new HttpError(401, "unauthorized");
}

export async function POST(req: Request) {
  try {
    authorize(req);
    const json = await req.json().catch(() => {
      throw new HttpError(400, "JSON body буруу байна");
    });
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
      return Response.json({ error: "validation", issues }, { status: 422 });
    }
    const b = parsed.data;
    const sb = adminClient();
    const warnings: string[] = [];
    const source = b.source ? `api:${b.source}` : "api";
    const ref = b.external_id ?? null;

    if (ref) {
      const existing = await findByRef(sb, source, ref);
      if (existing) return Response.json({ ok: true, duplicate: true, task: existing, url: taskUrl(req, existing.id) });
    }

    const assignee = await resolveAssignee(sb, b.assignee_id, b.assignee_email, warnings);
    const camp = await resolveCamp(sb, b.camp_id, b.zuca_camp_id, b.camp, warnings);
    const project = await resolveProject(sb, b.project_id, warnings);
    const due = b.due_date ?? null;

    const { data, error } = await sb
      .from("tasks")
      .insert({
        title: b.title,
        description: b.description?.trim() || null,
        status: b.status ?? "todo",
        priority: b.priority ?? "medium",
        assignee_id: assignee,
        camp_id: camp,
        project_id: project,
        due_date: due,
        planned_month: b.planned_month ?? (due ? due.slice(0, 7) : null),
        tags: Array.from(new Set(["API", ...(b.source ? [b.source] : []), ...(b.tags ?? [])])),
        source,
        external_ref: ref,
        position: Date.now(),
      })
      .select(FIELDS)
      .single();

    if (error?.code === "23505" && ref) {
      // Зэрэг ирсэн ижил хүсэлт — нөгөө нь аль хэдийн үүсгэсэн
      const existing = await findByRef(sb, source, ref);
      if (existing) return Response.json({ ok: true, duplicate: true, task: existing, url: taskUrl(req, existing.id) });
    }
    if (error?.code === "42703") throw new HttpError(500, "Supabase-д schema.sql (v11, tasks.external_ref)-г ажиллуулна уу");
    if (error) throw new HttpError(500, error.message);

    const task = data as unknown as Task;
    if (b.notify !== false) await notifyAssignee(sb, task, { actorName: b.source ?? "Гадаад систем", reason: "created" });

    return Response.json({ ok: true, task, url: taskUrl(req, task.id), ...(warnings.length ? { warnings } : {}) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

async function findByRef(sb: SupabaseClient, source: string, ref: string) {
  const { data, error } = await sb.from("tasks").select(FIELDS).eq("source", source).eq("external_ref", ref).limit(1).maybeSingle();
  if (error?.code === "42703") throw new HttpError(500, "Supabase-д schema.sql (v11, tasks.external_ref)-г ажиллуулна уу");
  if (error) throw new HttpError(500, error.message);
  return data as unknown as Task | null;
}

/** Олдохгүй бол ажлыг хариуцагчгүй үүсгээд анхааруулга буцаана (админ хуваарилна) */
async function resolveAssignee(sb: SupabaseClient, id: string | null | undefined, email: string | null | undefined, warnings: string[]) {
  if (!id && !email) return null;
  let q = sb.from("profiles").select("id, active").limit(1);
  q = id ? q.eq("id", id) : q.ilike("email", email!.replace(/[\\%_]/g, (c) => `\\${c}`));
  const { data } = await q.maybeSingle();
  if (!data) {
    warnings.push(`Хариуцагч «${id ?? email}» олдсонгүй — хариуцагчгүй үүслээ`);
    return null;
  }
  if (!data.active) warnings.push(`Хариуцагч «${id ?? email}» идэвхгүй (ажлаас гарсан) байна`);
  return data.id as string;
}

async function resolveCamp(
  sb: SupabaseClient,
  id: string | null | undefined,
  zucaId: number | null | undefined,
  name: string | null | undefined,
  warnings: string[],
) {
  if (!id && !zucaId && !name) return null;
  let q = sb.from("camps").select("id").limit(1);
  if (id) q = q.eq("id", id);
  else if (zucaId) q = q.eq("zuca_id", zucaId);
  else q = q.ilike("name", name!.trim().replace(/[\\%_]/g, (c) => `\\${c}`));
  const { data } = await q.maybeSingle();
  if (!data) warnings.push(`Зуслан «${id ?? zucaId ?? name}» олдсонгүй — зуслангүй үүслээ`);
  return (data?.id as string | undefined) ?? null;
}

async function resolveProject(sb: SupabaseClient, id: string | null | undefined, warnings: string[]) {
  if (!id) return null;
  const { data } = await sb.from("projects").select("id").eq("id", id).maybeSingle();
  if (!data) warnings.push(`Төсөл «${id}» олдсонгүй`);
  return (data?.id as string | undefined) ?? null;
}

function taskUrl(req: Request, id: string) {
  return `${(process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "")}/tasks?task=${id}`;
}
