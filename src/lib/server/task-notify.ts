/**
 * Шинэ ажил үүсэх эсвэл хүнд шилжих үед хариуцагчид Telegram-аар шууд мэдэгдэнэ.
 * «▶️ Эхлүүлэх / ✅ Дууссан» товчоор bot дотроос төлөвийг нь өөрчилж болно (webhook → callback_query).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { prettyDate, shiftDate, todayIn } from "../agent/digest";
import type { Task } from "../types";
import { sendTelegram, telegramConfigured } from "./notify";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const PRIO: Record<Task["priority"], string> = { urgent: "🔴 Яаралтай", high: "🟠 Өндөр", medium: "🔵 Дунд", low: "⚪ Бага" };

function dueText(due: string) {
  const today = todayIn();
  if (due === today) return "өнөөдөр";
  if (due === shiftDate(today, 1)) return "маргааш";
  if (due < today) return `${prettyDate(due)} (хэтэрсэн)`;
  return prettyDate(due);
}

export function taskButtons(taskId: string, status: Task["status"]) {
  const row = [];
  if (status === "todo") row.push({ text: "▶️ Эхлүүлэх", callback_data: `t:in_progress:${taskId}` });
  if (status !== "done") row.push({ text: "✅ Дууссан", callback_data: `t:done:${taskId}` });
  const keyboard: Record<string, string>[][] = row.length ? [row] : [];
  const app = process.env.APP_URL?.replace(/\/$/, "");
  if (app?.startsWith("https://")) keyboard.push([{ text: "Системд нээх", url: `${app}/tasks?task=${taskId}` }]);
  return { inline_keyboard: keyboard };
}

export async function notifyAssignee(
  sb: SupabaseClient,
  task: Task,
  opts: { actorId?: string | null; actorName?: string | null; reason?: "created" | "assigned" } = {},
) {
  try {
    if (!telegramConfigured() || !task.assignee_id || task.assignee_id === opts.actorId || task.status === "done") return false;
    const { data: p } = await sb
      .from("profiles")
      .select("telegram_chat_id, notify_telegram, active")
      .eq("id", task.assignee_id)
      .maybeSingle();
    if (!p?.telegram_chat_id || !p.notify_telegram || !p.active) return false;

    let camp: string | null = null;
    if (task.camp_id) {
      const { data } = await sb.from("camps").select("name").eq("id", task.camp_id).maybeSingle();
      camp = (data?.name as string | undefined) ?? null;
    }
    const meta = [PRIO[task.priority], task.due_date && `⏰ ${dueText(task.due_date)}`, camp && `⛺ ${esc(camp)}`].filter(Boolean).join(" · ");
    const L = [opts.reason === "assigned" ? "👉 <b>Танд ажил шилжүүллээ</b>" : "🆕 <b>Танд шинэ ажил</b>", "", esc(task.title), meta];
    if (task.description) L.push("", `<i>${esc(task.description.slice(0, 500))}</i>`);
    if (opts.actorName) L.push("", `Өгсөн: ${esc(opts.actorName)}`);
    await sendTelegram(p.telegram_chat_id as string, L.join("\n"), { reply_markup: taskButtons(task.id, task.status) });
    return true;
  } catch (e) {
    console.error("notifyAssignee", e);
    return false;
  }
}
