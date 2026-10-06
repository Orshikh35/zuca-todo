/**
 * Чатын мессежийг AI-аар боловсруулах урсгал:
 * мессеж → shouldProcess → runAgent (ажил үүсгэх/шинэчлэх) → AI хариу мессеж + ai_state.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayIn } from "../agent/digest";
import type { Channel, Department, Message, Profile, Task } from "../types";
import { aiConfigured } from "./ai";
import { runAgent, type AgentResult, type CampLite, type ChatLine } from "./chat-agent";

const MENTION = /(^|[\s(])@(ai|zuca|туслах|бот)(?=$|[\s,.:;!?)])/iu;
export const isMentioned = (text: string) => MENTION.test(text);

/** Энэ мессежийг AI уншиж ажил болгох эсэх */
export function shouldProcess(channel: Pick<Channel, "ai_mode" | "kind">, msg: Pick<Message, "body" | "author_kind">) {
  if (!aiConfigured()) return false;
  if (msg.author_kind === "ai" || msg.author_kind === "system") return false;
  if (channel.ai_mode === "off") return false;
  const mentioned = isMentioned(msg.body);
  if (channel.ai_mode === "mention") return mentioned;
  if (mentioned || channel.kind === "inbox" || msg.author_kind === "external") return true;
  // «за», «баярлалаа», «ок» зэрэг богино хариуг алгасна
  return msg.body.trim().length >= 12;
}

export interface AgentContext {
  people: Profile[];
  departments: Department[];
  camps: CampLite[];
  /** Явагдаж буй төслүүд (v7 схемгүй бол хоосон) */
  projects: { id: string; name: string }[];
  load: Map<string, number>;
}

export async function loadAgentContext(sb: SupabaseClient): Promise<AgentContext> {
  const [p, d, c, t, pj] = await Promise.all([
    sb.from("profiles").select("*").eq("active", true),
    sb.from("departments").select("*").order("position"),
    sb.from("camps").select("id,name,aimag,stage,owner_id").order("name"),
    sb.from("tasks").select("assignee_id").neq("status", "done"),
    sb.from("projects").select("id,name").neq("status", "done").order("position"),
  ]);
  const err = [p, d, c, t].find((x) => x.error)?.error;
  if (err) throw new Error(err.message);
  const load = new Map<string, number>();
  for (const row of t.data as { assignee_id: string | null }[]) {
    if (row.assignee_id) load.set(row.assignee_id, (load.get(row.assignee_id) ?? 0) + 1);
  }
  // projects-ийн алдааг тоохгүй — схем v7 ажиллуулаагүй ч чат ажилласаар байна
  const projects = (pj.data ?? []) as { id: string; name: string }[];
  return { people: p.data as Profile[], departments: d.data as Department[], camps: c.data as CampLite[], projects, load };
}

export function authorLabel(m: Pick<Message, "author_kind" | "author_id" | "author_name">, byId: Map<string, Profile>) {
  if (m.author_kind === "ai") return "ZUCA AI";
  if (m.author_kind === "system") return m.author_name || "ZUCA Ops";
  if (m.author_kind === "external") return m.author_name || "Гадаад эх үүсвэр";
  return (m.author_id && byId.get(m.author_id)?.full_name) || m.author_name || "Тодорхойгүй";
}

function fallbackText(res: AgentResult) {
  const parts: string[] = [];
  if (res.created.length) parts.push(`✅ ${res.created.length} ажил бүртгэлээ.`);
  if (res.updated.length) parts.push(`✏️ ${res.updated.length} ажил шинэчиллээ.`);
  if (res.proposals.length) parts.push(`💡 ${res.proposals.length} ажил санал болголоо — батална уу.`);
  return parts.join(" ");
}

/**
 * Нэг мессежийг боловсруулна. Алдаа шидэхгүй — ai_state-д тэмдэглэнэ.
 * @param invoker AI-г дуудсан хүн (RLS: AI хариу түүний нэрээр бичигдэнэ). Intake/cron үед null.
 */
export async function processMessage(
  sb: SupabaseClient,
  messageId: string,
  opts: { invoker?: Profile | null; force?: boolean } = {},
): Promise<{ ok: boolean; reply?: string; created?: Task[]; error?: string }> {
  const setState = async (ai_state: Message["ai_state"]) => {
    const { error } = await sb.from("messages").update({ ai_state }).eq("id", messageId);
    if (error) console.error("ai_state", error.message);
  };

  const { data: msgRow } = await sb.from("messages").select("*").eq("id", messageId).maybeSingle();
  if (!msgRow) return { ok: false, error: "Мессеж олдсонгүй" };
  const msg = msgRow as Message;
  const { data: chRow } = await sb.from("channels").select("*").eq("id", msg.channel_id).maybeSingle();
  if (!chRow) return { ok: false, error: "Суваг олдсонгүй" };
  const channel = chRow as Channel;

  if (!opts.force && !shouldProcess(channel, msg)) {
    if (msg.ai_state === "pending") await setState("skipped");
    return { ok: true };
  }
  if (msg.ai_state !== "pending") await setState("pending");

  const mentioned = !!opts.force || isMentioned(msg.body);
  const replyAuthor = opts.invoker?.id ?? (msg.author_kind === "user" ? msg.author_id : null);
  try {
    const ctx = await loadAgentContext(sb);
    const byId = new Map(ctx.people.map((p) => [p.id, p]));
    const { data: prev } = await sb
      .from("messages")
      .select("*")
      .eq("channel_id", channel.id)
      .lt("created_at", msg.created_at)
      .order("created_at", { ascending: false })
      .limit(12);
    const history: ChatLine[] = ((prev ?? []) as Message[])
      .reverse()
      .map((m) => ({ who: authorLabel(m, byId), kind: m.author_kind, text: m.body.slice(0, 600), at: m.created_at }));

    const res = await runAgent({
      sb,
      text: msg.body,
      from: {
        name: authorLabel(msg, byId),
        kind: msg.author_kind,
        profile: msg.author_kind === "user" && msg.author_id ? byId.get(msg.author_id) ?? null : null,
        via: msg.source,
      },
      channel,
      mentioned,
      forced: opts.force,
      // Хүн гараар дарсан бол санал биш шууд үүсгэнэ
      mode: channel.ai_mode === "suggest" && !opts.force ? "suggest" : "auto",
      history,
      ...ctx,
      today: todayIn(),
      messageId: msg.id,
      taskSource: msg.source === "intake" ? "intake" : "chat",
    });

    const acted = res.created.length + res.updated.length + res.proposals.length > 0;
    if (res.reply || acted) {
      const { error } = await sb.from("messages").insert({
        channel_id: channel.id,
        author_id: replyAuthor,
        author_kind: "ai",
        body: res.reply || fallbackText(res),
        reply_to: msg.id,
        source: "app",
        task_ids: res.created.map((t) => t.id),
        proposals: res.proposals.length ? res.proposals : null,
      });
      if (error) throw new Error(`AI хариу хадгалахад: ${error.message}`);
    }
    await setState(acted || res.reply ? "done" : "skipped");
    return { ok: true, reply: res.reply, created: res.created };
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error("processMessage", messageId, error);
    await setState("error");
    if (mentioned) {
      await sb.from("messages").insert({
        channel_id: channel.id,
        author_id: replyAuthor,
        author_kind: "ai",
        body: `⚠️ Уучлаарай, боловсруулж чадсангүй: ${error}`,
        reply_to: msg.id,
        source: "app",
      });
    }
    return { ok: false, error };
  }
}

/** Сувгаас гадуурх шууд яриа (Telegram, самбар) — нэг хүний нэрээр агент ажиллуулна */
export async function agentForProfile(sb: SupabaseClient, me: Profile, text: string, via: "telegram" | "dashboard") {
  const ctx = await loadAgentContext(sb);
  return runAgent({
    sb,
    text,
    from: { name: me.full_name, kind: "user", profile: me, via },
    channel: { name: via === "telegram" ? "Telegram (хувийн чат)" : "Самбар (хувийн)", kind: "team", department_id: me.department_id },
    mentioned: true,
    mode: "auto",
    history: [],
    ...ctx,
    today: todayIn(),
    messageId: null,
    taskSource: via,
  });
}
