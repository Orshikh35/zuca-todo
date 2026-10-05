/**
 * Өглөө бүрийн автомат ажил (cron): хүн гараар оруулалгүйгээр системд ажил үүсгэж,
 * #Ерөнхий сувагт өдрийн товчоо бичнэ.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { prettyDate, shiftDate } from "../agent/digest";
import { completeness } from "../completeness";
import type { Camp, Channel, Profile, Task } from "../types";

/** Нэг өдөрт автоматаар үүсгэх дээд хэмжээ — самбарыг дүүргэхгүйн тулд */
const MAX_AUTO = 10;

export async function housekeeping(sb: SupabaseClient, date: string) {
  const [c, t, p, ch] = await Promise.all([
    sb.from("camps").select("*"),
    sb.from("tasks").select("*").neq("status", "done"),
    sb.from("profiles").select("*"),
    sb.from("channels").select("*").eq("slug", "general").maybeSingle(),
  ]);
  const err = [c, t, p].find((x) => x.error)?.error;
  if (err) throw new Error(err.message);
  const camps = c.data as Camp[];
  const open = t.data as Task[];
  const people = new Map((p.data as Profile[]).map((x) => [x.id, x]));

  // 1. ZUCA-тай ажиллаж буй (холбогдсон / бүртгэж байна / идэвхтэй) зуслангийн дутуу мэдээлэл → нөхөх ажил
  const hasInfoTask = new Set(open.filter((x) => x.camp_id && x.tags.includes("мэдээлэл")).map((x) => x.camp_id));
  const order: Record<string, number> = { active: 0, onboarding: 1, contacted: 2 };
  const targets = camps
    .filter((x) => x.stage in order && !hasInfoTask.has(x.id))
    .map((x) => ({ camp: x, check: completeness(x) }))
    .filter((x) => !x.check.complete)
    .sort((a, b) => order[a.camp.stage] - order[b.camp.stage] || a.check.score - b.check.score)
    .slice(0, MAX_AUTO);

  const due = shiftDate(date, 3);
  const rows = targets.map(({ camp, check }, i) => ({
    title: `${camp.name}: дутуу мэдээлэл нөхөх`,
    description: `Дутуу (${check.score}%): ${check.missing.map((m) => m.label).join(", ")}\nАвтоматаар үүсгэсэн — зуслангийн мэдээлэл ZUCA дээр бүрэн харагдах ёстой.`,
    priority: camp.stage === "active" ? "urgent" : "high",
    status: "todo",
    camp_id: camp.id,
    assignee_id: camp.owner_id,
    due_date: due,
    planned_month: due.slice(0, 7),
    tags: ["мэдээлэл", "auto"],
    source: "auto",
    position: Date.now() + i,
  }));
  let created: Task[] = [];
  if (rows.length) {
    const ins = await sb.from("tasks").insert(rows).select();
    if (ins.error) throw new Error(ins.error.message);
    created = ins.data as Task[];
  }

  // 2. 3+ хоног хэтэрсэн ажлууд — багт сануулна
  const stale = open
    .filter((x) => x.due_date && x.due_date <= shiftDate(date, -3))
    .sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""));
  const urgent = open.filter((x) => x.priority === "urgent").length;
  const overdue = open.filter((x) => x.due_date && x.due_date < date).length;
  const unassigned = open.filter((x) => !x.assignee_id).length;

  // 3. #Ерөнхий сувагт өглөөний товчоо
  let posted = false;
  const channel = ch.data as Channel | null;
  if (channel) {
    const days = (d: string) => Math.round((Date.parse(date) - Date.parse(d)) / 86_400_000);
    const L = [
      `☀️ Өглөөний мэнд! ${prettyDate(date)}.`,
      `• Нээлттэй ажил: ${open.length + created.length} (яаралтай ${urgent}, хугацаа хэтэрсэн ${overdue}, хариуцагчгүй ${unassigned})`,
    ];
    if (created.length) L.push(`• Дутуу мэдээлэлтэй ${created.length} зусланд нөхөх ажил автоматаар үүсгэлээ.`);
    if (stale.length) {
      L.push("", `⚠️ 3+ хоног хэтэрсэн (${stale.length}):`);
      stale.slice(0, 8).forEach((x) => {
        const who = x.assignee_id ? people.get(x.assignee_id)?.full_name ?? "?" : "хариуцагчгүй";
        L.push(`• ${x.title} — ${who}, ${days(x.due_date!)} хоног`);
      });
      if (stale.length > 8) L.push(`… бас ${stale.length - 8}`);
    }
    const msg = await sb.from("messages").insert({
      channel_id: channel.id,
      author_kind: "system",
      author_name: "ZUCA Ops",
      body: L.join("\n"),
      source: "cron",
      source_ref: `morning-${date}`,
      task_ids: created.map((x) => x.id),
    });
    // 23505 = өнөөдрийн товчоо аль хэдийн бичигдсэн
    posted = !msg.error;
    if (msg.error && msg.error.code !== "23505") console.error("housekeeping post", msg.error.message);
  }
  return { created: created.length, stale: stale.length, posted };
}
