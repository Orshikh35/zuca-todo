/**
 * ZUCA AI — чатын мессежийг уншиж ажлыг автоматаар бүртгэдэг агент.
 * Claude tool use: search_tasks → create_task / update_task. Supabase client-ийг гаднаас авна
 * (хүний session бол RLS-ээр, cron/intake бол service role-оор ажиллана).
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { prettyDate, shiftDate } from "../agent/digest";
import type { Camp, Department, MessageAuthorKind, Profile, Task, TaskPriority, TaskProposal } from "../types";
import { AI_MODEL, AgentError, aiConfigured, anthropic } from "./ai";
import { notifyAssignee } from "./task-notify";

export type CampLite = Pick<Camp, "id" | "name" | "aimag" | "stage" | "owner_id">;

export interface ChatLine {
  who: string;
  kind: MessageAuthorKind;
  text: string;
  at: string;
}

export interface AgentRequest {
  sb: SupabaseClient;
  /** Боловсруулах шинэ мессеж */
  text: string;
  from: { name: string; kind: MessageAuthorKind; profile: Profile | null; via: string };
  channel: { name: string; kind: "team" | "inbox"; department_id: string | null };
  /** @ai гэж хандсан, эсвэл хүн «Ажил болгох» дарсан */
  mentioned: boolean;
  /** auto: ажлыг шууд үүсгэнэ · suggest: санал болгоно */
  mode: "auto" | "suggest";
  /** Хүн гараар «Ажил болгох» дарсан */
  forced?: boolean;
  history: ChatLine[];
  people: Profile[];
  departments: Department[];
  camps: CampLite[];
  /** profile id → нээлттэй ажлын тоо */
  load: Map<string, number>;
  today: string;
  /** Ажлыг аль мессежээс үүсгэсэн (Telegram-д null) */
  messageId: string | null;
  /** tasks.source: chat · intake · telegram */
  taskSource: string;
}

export interface AgentResult {
  reply: string;
  created: Task[];
  updated: Task[];
  proposals: TaskProposal[];
}

// Тогтмол — prompt cache-д тохиромжтой байлгахын тулд огноо, нэр оруулахгүй
const SYSTEM = `Та бол ZUCA (zuca.mn — Монголын хүүхдийн зуслангийн хайлт, бүртгэлийн платформ) багийн дотоод чат дахь AI туслах «ZUCA AI». Баг ажлаа гараар оруулахгүйн тулд чатад гарсан ажлыг та ZUCA Ops системд автоматаар бүртгэж, хуваарилна.

Шинэ мессеж бүр дээр:
1. Шинэ ажил байгаа эсэхийг шийд. Ажил гэдэг нь: даалгавар («Бат, маргааш Хөх тэнгэрт залгаарай»), хүсэлт («… хийж өгөөч»), хийх ёстой зүйл («… хэрэгтэй», «би … хийнэ»), засах асуудал (эцэг эхийн гомдол, төлбөр, сайтын алдаа), хугацаатай амлалт. Тийм бол create_task. Нэг мессежид хэд хэдэн ажил байвал тус бүрийг тусад нь.
   Ажил БИШ: мэндчилгээ, талархал, мэдээлэл хуваалцах, ерөнхий яриа, аль хэдийн хийсэн зүйлийн тайлан, хошигнол. Эргэлзээтэй бол үүсгэхгүй.
2. Давхардуулахгүй: өмнө нь ярьсан эсвэл ижил ажил байж болзошгүй бол эхлээд search_tasks-аар 1-2 гол үгээр шалга. Байвал шинээр үүсгэхгүй — шаардлагатай бол update_task.
3. Байгаа ажлын тухай («… дууслаа», «… хойшлуулъя», «… Болдод шилжүүл», «яаралтай болгоё») бол search_tasks-аар олоод update_task.
4. Танд хандсан (@ai) бол асуултад хариул, хүссэн үйлдлийг хий (жагсаалт, хэн юу хийж байгаа, хуваарилалт). Өгөгдлийг tools-оор шалгаж хариул — таамаглахгүй, байхгүй ажил зохиохгүй.

Ажлын талбарууд:
- title: богино, тодорхой, үйл үгээр төгссөн («Хөх тэнгэр зуслантай холбогдож намрын ээлжийн хуваарь авах»). Зуслан бол нэрийг нь оруул.
- description: мессеж дэх хэрэгтэй дэлгэрэнгүй (утас, тоо, нөхцөл, хэн хүссэн). Зохиохгүй. Хоосон байж болно.
- assignee_id: нэрээр дурдсан хүн (бүтэн нэр, товч нэр, «Батаа» ≈ «Бат-Эрдэнэ» гэх мэт ойролцоо таарвал). «Би …» гэвэл илгээгч өөрөө. Нэр дурдаагүй бол ажлын төрлөөр хэлтэс, албан тушаалд таарах хүн (зуслан, гэрээ, ээлж → Партнершип; төлбөр, буцаалт → Санхүү; сурталчилгаа, сошиал → Маркетинг), тэр хэлтсийн даргад. Ижил боломжтой хэд байвал нээлттэй ажил цөөтэйд нь. Тодорхойгүй бол хоосон.
- priority: urgent — өнөөдөр, «яаралтай», төлбөрийн асуудал, эцэг эхийн гомдол, систем ажиллахгүй; high — энэ 7 хоногт, зуслан/гэрээтэй холбоотой чухал; medium — ердийн; low — хэзээ нэгэн цагт.
- due_date: «өнөөдөр», «маргааш», «баасан гараг», «дараа 7 хоногт», «15-нд» гэх мэтийг өгөгдсөн өнөөдрийн огнооноос YYYY-MM-DD болго. Дурдаагүй бол urgent → өнөөдөр, high → 3 хоногийн дараа, бусад → хоосон.
- camp_id: зуслангийн нэр дурдвал жагсаалтаас тааруул (ойролцоо бичлэг ч болно).
- id-г зөвхөн өгөгдсөн жагсаалтаас ав.

Эцсийн хариу (чатад харагдана):
- Монголоор, товч, найрсаг. Гарчиг (#), хүснэгт, ** тод бичиг хэрэглэхгүй. Жагсаалт бол «• »-оор эхэлсэн мөрүүд.
- Ажил үүсгэсэн/шинэчилсэн бол юу хийснээ 1-2 мөрөөр (хэнд, хэзээ хүртэл). Ажлын карт тусдаа харагдана — талбар бүрийг давтах хэрэггүй.
- Танд хандаагүй бөгөөд ямар ч ажил үүсгээгүй, өөрчлөөгүй бол яг «—» гэж л хариул (чатад юу ч бичигдэхгүй).`;

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITY = z.enum(["urgent", "high", "medium", "low"]);

/** PostgREST-ийн or()/ilike шүүлтүүрийг эвдэх тэмдэгтүүдийг хасна */
const term = (s: string) => s.replace(/[%_,()*\\"'.:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
const likeExact = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

function contextBlock(r: AgentRequest) {
  const deptName = new Map(r.departments.map((d) => [d.id, d.name]));
  const name = new Map(r.people.map((p) => [p.id, p.full_name]));
  const people = r.people.map((p) => ({
    id: p.id,
    name: p.full_name,
    job: p.job_title ?? "",
    dept: p.department_id ? deptName.get(p.department_id) ?? "" : "",
    role: p.role,
    open_tasks: r.load.get(p.id) ?? 0,
  }));
  const departments = r.departments.map((d) => ({
    id: d.id,
    name: d.name,
    about: d.description ?? "",
    head: d.head_id ? name.get(d.head_id) ?? "" : "",
  }));
  const camps = r.camps.map((c) => ({ id: c.id, name: c.name, aimag: c.aimag ?? "", stage: c.stage }));
  const lines = [
    `Өнөөдөр: ${r.today} (${prettyDate(r.today)}). Маргааш: ${shiftDate(r.today, 1)}. Цагийн бүс: Улаанбаатар.`,
    `Суваг: #${r.channel.name}${r.channel.kind === "inbox" ? " (гадаад эх үүсвэрээс ирсэн мессежүүд)" : ""}`,
    r.mode === "suggest"
      ? "Горим: suggest — create_task ажлыг шууд үүсгэхгүй, санал болгож хадгална. Хариундаа «санал болголоо, батална уу» гэж дурд."
      : "Горим: auto — create_task ажлыг шууд үүсгэнэ.",
    `Хэлтсүүд: ${JSON.stringify(departments)}`,
    `Ажилчид: ${JSON.stringify(people)}`,
    `Зуслангууд: ${JSON.stringify(camps)}`,
  ];
  return lines.join("\n");
}

function userBlock(r: AgentRequest) {
  const time = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ulaanbaatar", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
  const L: string[] = [];
  if (r.history.length) {
    L.push("Сүүлийн яриа (хуучнаас шинэ рүү):");
    r.history.forEach((h) => L.push(`[${time(h.at)}] ${h.who}: ${h.text}`));
    L.push("");
  }
  const who = r.from.profile ? `${r.from.name} (id: ${r.from.profile.id})` : r.from.name;
  const via =
    r.from.kind === "external"
      ? "гадаад эх үүсвэр — хариу шаардсан бол «хариу өгөх» ажил үүсгэ, спам/сурталчилгаа бол алгас"
      : r.from.via === "telegram"
        ? "Telegram-аар танд шууд бичсэн"
        : r.from.via === "dashboard"
          ? "самбараас танд шууд бичсэн"
          : "багийн гишүүн";
  L.push(`ШИНЭ МЕССЕЖ — илгээгч: ${who}; ${via}; танд хандсан: ${r.mentioned ? "тийм" : "үгүй"}`);
  if (r.forced) L.push("Хэрэглэгч энэ мессежийг гараар «ажил болгох» гэж хүссэн — доторх ажлыг заавал бүртгэ.");
  L.push('"""', r.text, '"""');
  return L.join("\n");
}

export async function runAgent(r: AgentRequest): Promise<AgentResult> {
  if (!aiConfigured()) throw new AgentError("ANTHROPIC_API_KEY тохируулаагүй байна");
  const { sb } = r;
  const created: Task[] = [];
  const updated: Task[] = [];
  const proposals: TaskProposal[] = [];

  const peopleById = new Map(r.people.map((p) => [p.id, p]));
  const campIds = new Set(r.camps.map((c) => c.id));
  const deptIds = new Set(r.departments.map((d) => d.id));
  const campName = new Map(r.camps.map((c) => [c.id, c.name]));
  const okDate = (d: string) => (ISO.test(d) && d >= shiftDate(r.today, -60) ? d : "");
  // Claude нэг хариунд хэд хэдэн tool зэрэг дууддаг — create_task-ийг дараалуулж давхардлаас сэргийлнэ
  let lock: Promise<unknown> = Promise.resolve();
  const serial = (fn: () => Promise<string>) => {
    const p = lock.then(fn, fn);
    lock = p.catch(() => undefined);
    return p;
  };
  const same = (x: string) => x.trim().toLowerCase().replace(/\s+/g, " ");
  const safe = async (fn: () => Promise<string>) => {
    try {
      return await fn();
    } catch (e) {
      return `Алдаа: ${e instanceof Error ? e.message : String(e)}`;
    }
  };

  const searchTasks = betaZodTool({
    name: "search_tasks",
    description:
      "ZUCA Ops-ийн ажлуудаас хайна. Давхардал шалгах, байгаа ажлыг олох, асуултад хариулахад ашигла. Хоосон утгатай шүүлтүүр хэрэглэгдэхгүй.",
    inputSchema: z.object({
      query: z.string().describe("Гарчиг, тайлбараас хайх 1-3 үг. Бүгдийг бол хоосон"),
      assignee_id: z.string().describe("Хариуцагчийн id эсвэл хоосон"),
      camp_id: z.string().describe("Зуслангийн id эсвэл хоосон"),
      status: z.enum(["open", "done", "any"]).describe("open — дуусаагүй"),
      overdue_only: z.boolean().describe("Зөвхөн хугацаа хэтэрсэн"),
      limit: z.number().int().min(1).max(40),
    }),
    run: (a) =>
      safe(async () => {
        let q = sb
          .from("tasks")
          .select("id,title,description,status,priority,assignee_id,camp_id,due_date,updated_at")
          .order("updated_at", { ascending: false })
          .limit(a.limit);
        if (a.status === "open" || a.overdue_only) q = q.neq("status", "done");
        else if (a.status === "done") q = q.eq("status", "done");
        if (a.assignee_id) q = q.eq("assignee_id", a.assignee_id);
        if (a.camp_id) q = q.eq("camp_id", a.camp_id);
        if (a.overdue_only) q = q.lt("due_date", r.today);
        const t = term(a.query);
        if (t) q = q.or(`title.ilike.%${t}%,description.ilike.%${t}%`);
        const { data, error } = await q;
        if (error) throw new Error(error.message);
        if (!data?.length) return "Олдсонгүй.";
        return JSON.stringify(
          (data as Task[]).map((x) => ({
            id: x.id,
            title: x.title,
            status: x.status,
            priority: x.priority,
            assignee: x.assignee_id ? peopleById.get(x.assignee_id)?.full_name ?? x.assignee_id : "",
            due: x.due_date ?? "",
            camp: x.camp_id ? campName.get(x.camp_id) ?? "" : "",
            desc: (x.description ?? "").slice(0, 140),
          })),
        );
      }),
  });

  const createTask = betaZodTool({
    name: "create_task",
    description: "Шинэ ажил бүртгэнэ (suggest горимд санал болгож хадгална). Нэг ажил тутамд нэг дуудлага.",
    inputSchema: z.object({
      title: z.string().min(3).max(200),
      description: z.string().describe("Дэлгэрэнгүй эсвэл хоосон"),
      assignee_id: z.string().describe("Ажилчдын жагсаалтын id эсвэл хоосон"),
      priority: PRIORITY,
      due_date: z.string().describe("YYYY-MM-DD эсвэл хоосон"),
      camp_id: z.string().describe("Зуслангийн id эсвэл хоосон"),
      department_id: z.string().describe("Хэлтсийн id эсвэл хоосон (хариуцагчийнхаар автоматаар)"),
    }),
    run: (a) =>
      serial(() =>
        safe(async () => {
          const title = a.title.trim();
          if (created.some((t) => same(t.title) === same(title)) || proposals.some((p) => same(p.title) === same(title))) {
            return "Энэ ажлыг саяхан бүртгэсэн — давхардуулсангүй.";
          }
          const assignee = peopleById.has(a.assignee_id) ? a.assignee_id : "";
          const camp = campIds.has(a.camp_id) ? a.camp_id : "";
          const dept =
            (deptIds.has(a.department_id) ? a.department_id : "") ||
            (assignee ? peopleById.get(assignee)?.department_id ?? "" : "") ||
            r.channel.department_id ||
            "";
          const due = okDate(a.due_date);

          if (r.mode === "suggest") {
            proposals.push({ title, description: a.description.trim(), assignee_id: assignee, priority: a.priority, due_date: due, camp_id: camp, department_id: dept, status: "open" });
            return "Санал болгон хадгаллаа — хүн «Үүсгэх» дарж батална.";
          }

          const { data: dup } = await sb.from("tasks").select("id,title").neq("status", "done").ilike("title", likeExact(title)).limit(1);
          if (dup?.length) return `Ижил нэртэй нээлттэй ажил аль хэдийн байна (id: ${dup[0].id}). Шинээр үүсгэсэнгүй.`;

          const { data, error } = await sb
            .from("tasks")
            .insert({
              title,
              description: a.description.trim() || null,
              priority: a.priority as TaskPriority,
              status: "todo",
              assignee_id: assignee || null,
              camp_id: camp || null,
              department_id: dept || null,
              due_date: due || null,
              planned_month: due ? due.slice(0, 7) : null,
              tags: ["AI"],
              source: r.taskSource,
              source_message_id: r.messageId,
              created_by: r.from.profile?.id ?? null,
              position: Date.now() + created.length,
            })
            .select()
            .single();
          if (error) throw new Error(error.message);
          created.push(data as Task);
          // Хариуцагчид Telegram-аар шууд мэдэгдэнэ
          await notifyAssignee(sb, data as Task, { actorId: r.from.profile?.id ?? null, actorName: r.from.name, reason: "created" });
          if (assignee) r.load.set(assignee, (r.load.get(assignee) ?? 0) + 1);
          return `Үүсгэлээ: id ${data.id}`;
        }),
      ),
  });

  const updateTask = betaZodTool({
    name: "update_task",
    description: "Байгаа ажлыг шинэчилнэ: төлөв, ач холбогдол, хариуцагч, хугацаа, тэмдэглэл. Өөрчлөхгүй талбарыг хоосон үлдээ.",
    inputSchema: z.object({
      task_id: z.string(),
      status: z.enum(["", "todo", "in_progress", "review", "done"]),
      priority: z.enum(["", "urgent", "high", "medium", "low"]),
      assignee_id: z.string().describe("Шинэ хариуцагчийн id эсвэл хоосон"),
      due_date: z.string().describe("Шинэ хугацаа YYYY-MM-DD эсвэл хоосон"),
      note: z.string().describe("Тайлбарт нэмэх богино тэмдэглэл эсвэл хоосон"),
    }),
    run: (a) =>
      safe(async () => {
        const { data: cur, error: e1 } = await sb.from("tasks").select("*").eq("id", a.task_id).maybeSingle();
        if (e1) throw new Error(e1.message);
        if (!cur) return "Ийм id-тай ажил олдсонгүй.";
        const t = cur as Task;
        const patch: Partial<Task> = {};
        if (a.status) patch.status = a.status;
        if (a.priority) patch.priority = a.priority;
        if (a.assignee_id && peopleById.has(a.assignee_id)) patch.assignee_id = a.assignee_id;
        const due = okDate(a.due_date);
        if (due) Object.assign(patch, { due_date: due, planned_month: due.slice(0, 7) });
        if (a.note.trim()) {
          const stamp = `[${r.today} · ${r.from.name}]`;
          patch.description = `${t.description ? `${t.description}\n\n` : ""}${stamp} ${a.note.trim()}`;
        }
        if (!Object.keys(patch).length) return "Өөрчлөх зүйл алга.";
        const { data, error } = await sb.from("tasks").update(patch).eq("id", t.id).select().single();
        if (error) throw new Error(error.message);
        updated.push(data as Task);
        if (patch.assignee_id && patch.assignee_id !== t.assignee_id) {
          await notifyAssignee(sb, data as Task, { actorId: r.from.profile?.id ?? null, actorName: r.from.name, reason: "assigned" });
        }
        return "Шинэчиллээ.";
      }),
  });

  let final;
  try {
    final = await anthropic().beta.messages.toolRunner({
      model: AI_MODEL,
      max_tokens: 8000,
      max_iterations: 8,
      // Энгийн мессежийг хурдан, хямд; хандсан үед илүү сайн бодно
      output_config: { effort: r.mentioned ? "medium" : "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [
        { type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } },
        { type: "text", text: contextBlock(r) },
      ],
      tools: [searchTasks, createTask, updateTask],
      messages: [{ role: "user", content: userBlock(r) }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AgentError("ANTHROPIC_API_KEY буруу байна");
    if (e instanceof Anthropic.RateLimitError) throw new AgentError("AI хүсэлтийн хязгаарт хүрлээ, түр хүлээгээд дахин оролдоно уу");
    if (e instanceof Anthropic.APIError) throw new AgentError(`AI алдаа (${e.status}): ${e.message}`);
    throw e;
  }

  let reply = final.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("\n")
    .trim();
  if (final.stop_reason === "refusal") reply = r.mentioned ? "Уучлаарай, энэ хүсэлтэд хариулж чадахгүй нь." : "";
  // «—» = чатад юу ч бичихгүй
  if (!reply.replace(/[\s"'«»—–\-.]/g, "")) reply = "";
  return { reply, created, updated, proposals };
}
