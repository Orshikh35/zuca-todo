import { HttpError, adminClient, errorResponse } from "@/lib/server/context";
import { safeEqual } from "@/lib/server/telegram-link";
import type { Task } from "@/lib/types";

/**
 * Гадаад систем (хамтрагч компанийн todo гэх мэт) ZUCA Ops-ийн ажлуудыг татаж авах API — зөвхөн унших.
 * Ажлыг ZUCA Ops дээр үүсгэнэ; гадаад систем үүгээр тогтмол татаж өөртөө синк хийнэ.
 *
 *   GET /api/v1/tasks
 *   Authorization: Bearer <TASKS_API_KEY>      (эсвэл X-API-Key: <TASKS_API_KEY>)
 *
 * Query (бүгд заавал биш):
 *   id              — нэг ажил
 *   status          — todo,in_progress,review,done (таслалаар)
 *   updated_since   — ISO огноо/цаг: үүнээс хойш үүссэн/өөрчлөгдсөн ажил (синкэд)
 *   assignee_email  — тухайн ажилтны ажил
 *   project_id, tag — төсөл, шошгоор
 *   limit (1–500, анхдагч 100), offset — хуудаслалт; дараагийн хуудас бол хариунд next_offset
 *
 * Эрэмбэ: updated_at өсөхөөр. Устгасан ажил энд харагдахгүй.
 */

const STATUSES = new Set(["todo", "in_progress", "review", "done"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function authorize(req: Request) {
  // Хуулахад орж ирсэн хоосон зай, хашилт, < > хаалтыг тэвчинэ
  const clean = (v: string | null | undefined) => (v ?? "").trim().replace(/^["'<]+|["'>]+$/g, "");
  const keys = clean(process.env.TASKS_API_KEY)
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  const given = clean((req.headers.get("authorization") ?? "").replace(/^(Bearer\s+)+/i, "")) || clean(req.headers.get("x-api-key"));
  if (!keys.length) throw new HttpError(503, "TASKS_API_KEY тохируулаагүй байна");
  // 401-ийн шалтгааныг тодорхой хэлнэ — гадаад хөгжүүлэгч өөрөө засаж чадахаар
  if (!given) {
    throw new HttpError(
      401,
      "unauthorized: «Authorization: Bearer <түлхүүр>» header ирсэнгүй. https:// ашиглана уу (http:// → https:// шилжихэд header хасагддаг); URL-д түлхүүр тавихгүй.",
    );
  }
  if (!keys.some((k) => safeEqual(given, k))) {
    throw new HttpError(401, "unauthorized: түлхүүр буруу байна («Bearer» нэг удаа, < > хаалтгүй, хоосон зайгүй).");
  }
}

export async function GET(req: Request) {
  try {
    authorize(req);
    const q = new URL(req.url).searchParams;
    const sb = adminClient();

    const id = q.get("id");
    const limit = Math.min(Math.max(Number(q.get("limit")) || 100, 1), 500);
    const offset = Math.max(Number(q.get("offset")) || 0, 0);

    let query = sb.from("tasks").select("*").order("updated_at", { ascending: true }).order("id", { ascending: true });

    if (id) {
      if (!UUID.test(id)) throw new HttpError(400, "id буруу");
      query = query.eq("id", id);
    }
    const status = (q.get("status") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (status.length) {
      const bad = status.find((s) => !STATUSES.has(s));
      if (bad) throw new HttpError(400, `status «${bad}» буруу — todo, in_progress, review, done`);
      query = query.in("status", status);
    }
    const since = q.get("updated_since");
    if (since) {
      if (Number.isNaN(Date.parse(since))) throw new HttpError(400, "updated_since нь ISO огноо (2026-10-16 эсвэл 2026-10-16T09:00:00Z)");
      query = query.gte("updated_at", new Date(since).toISOString());
    }
    const projectId = q.get("project_id");
    if (projectId) {
      if (!UUID.test(projectId)) throw new HttpError(400, "project_id буруу");
      query = query.eq("project_id", projectId);
    }
    const tag = q.get("tag");
    if (tag) query = query.contains("tags", [tag]);
    const email = q.get("assignee_email");
    if (email) {
      const { data: p } = await sb.from("profiles").select("id").ilike("email", email.trim().replace(/[\\%_]/g, (c) => `\\${c}`)).limit(1).maybeSingle();
      if (!p) return Response.json({ tasks: [], count: 0, next_offset: null });
      query = query.eq("assignee_id", p.id);
    }

    // Дараагийн хуудас байгаа эсэхийг мэдэхийн тулд нэгийг илүү авна
    const { data, error } = await query.range(offset, offset + limit);
    if (error) throw new HttpError(500, error.message);
    const rows = (data ?? []) as Task[];
    const page = rows.slice(0, limit);

    if (id && !page.length) throw new HttpError(404, "Ажил олдсонгүй");

    // Хариуцагч, зуслан, төслийн нэрийг нэг дор авна
    const ids = (k: "assignee_id" | "camp_id" | "project_id") => Array.from(new Set(page.map((t) => t[k]).filter((v): v is string => !!v)));
    const [people, camps, projects] = await Promise.all([
      ids("assignee_id").length ? sb.from("profiles").select("id, full_name, email").in("id", ids("assignee_id")) : null,
      ids("camp_id").length ? sb.from("camps").select("id, name, zuca_id").in("id", ids("camp_id")) : null,
      ids("project_id").length ? sb.from("projects").select("id, name").in("id", ids("project_id")) : null,
    ]);
    const byId = <T extends { id: string }>(r: { data: T[] | null } | null) => new Map((r?.data ?? []).map((x) => [x.id, x]));
    const person = byId(people as { data: { id: string; full_name: string; email: string }[] | null } | null);
    const camp = byId(camps as { data: { id: string; name: string; zuca_id: number | null }[] | null } | null);
    const project = byId(projects as { data: { id: string; name: string }[] | null } | null);

    const base = (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
    const tasks = page.map((t) => {
      const a = t.assignee_id ? person.get(t.assignee_id) : undefined;
      const c = t.camp_id ? camp.get(t.camp_id) : undefined;
      const p = t.project_id ? project.get(t.project_id) : undefined;
      return {
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        due_date: t.due_date,
        planned_month: t.planned_month,
        tags: t.tags,
        assignee: a ? { id: a.id, name: a.full_name, email: a.email || null } : null,
        camp: c ? { id: c.id, name: c.name, zuca_id: c.zuca_id } : null,
        project: p ? { id: p.id, name: p.name } : null,
        completed_at: t.completed_at,
        created_at: t.created_at,
        updated_at: t.updated_at,
        url: `${base}/tasks?task=${t.id}`,
      };
    });

    if (id) return Response.json({ task: tasks[0] });
    return Response.json({ tasks, count: tasks.length, next_offset: rows.length > limit ? offset + limit : null });
  } catch (e) {
    return errorResponse(e);
  }
}
