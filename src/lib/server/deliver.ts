import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDigest, digestHtml, digestSubject, digestTelegram, digestText, type OrgSnapshot } from "../agent/digest";
import type { AgentPlan } from "../agent/schema";
import type { AgentRun, Profile } from "../types";
import { aiConfigured, organizeDay } from "./ai";
import { emailConfigured, sendEmail, sendTelegram, telegramConfigured } from "./notify";

export type Channel = "email" | "telegram";

export interface DeliveryResult {
  profile_id: string;
  name: string;
  channel: Channel;
  ok: boolean;
  detail: string;
}

/** Нэг хүнд өдрийн товчоо илгээнэ. withAi бол эхлээд Claude-оор цэгцэлнэ. */
export async function deliverDigest(opts: {
  snap: OrgSnapshot;
  person: Profile;
  channels: Channel[];
  withAi: boolean;
  appUrl: string;
  date: string;
  /** Хүний тохиргоог (notify_email/notify_telegram) үл харгалзах — гараар илгээх үед */
  force?: boolean;
}): Promise<{ results: DeliveryResult[]; plan: AgentPlan | null }> {
  const { snap, person, appUrl, date } = opts;
  let plan: AgentPlan | null = null;
  const results: DeliveryResult[] = [];
  const push = (channel: Channel, ok: boolean, detail: string) =>
    results.push({ profile_id: person.id, name: person.full_name, channel, ok, detail });

  if (opts.withAi && aiConfigured()) {
    try {
      plan = await organizeDay(snap, person, date);
    } catch (e) {
      // AI унасан ч энгийн товчоо илгээгдэнэ
      console.error("organizeDay", person.id, e);
    }
  }
  const digest = buildDigest(snap, person, date, plan);

  for (const ch of opts.channels) {
    try {
      if (ch === "email") {
        if (!person.email) throw new Error("имэйл хаяггүй");
        if (!opts.force && !person.notify_email) throw new Error("имэйл мэдэгдэл унтраасан");
        if (!emailConfigured()) throw new Error("SMTP тохируулаагүй");
        await sendEmail(person.email, digestSubject(digest), digestHtml(digest, appUrl), digestText(digest, appUrl));
        push(ch, true, person.email);
      } else {
        if (!person.telegram_chat_id) throw new Error("Telegram холбоогүй");
        if (!opts.force && !person.notify_telegram) throw new Error("Telegram мэдэгдэл унтраасан");
        if (!telegramConfigured()) throw new Error("Telegram bot тохируулаагүй");
        await sendTelegram(person.telegram_chat_id, digestTelegram(digest, appUrl));
        push(ch, true, "илгээгдлээ");
      }
    } catch (e) {
      push(ch, false, e instanceof Error ? e.message : String(e));
    }
  }
  return { results, plan };
}

export async function logRuns(sb: SupabaseClient | null, results: DeliveryResult[]) {
  if (!sb || !results.length) return;
  const rows: Omit<AgentRun, "id" | "created_at">[] = results.map((r) => ({
    profile_id: r.profile_id,
    kind: "digest",
    channel: r.channel,
    ok: r.ok,
    detail: r.detail,
  }));
  const { error } = await sb.from("agent_runs").insert(rows);
  if (error) console.error("agent_runs", error.message);
}
