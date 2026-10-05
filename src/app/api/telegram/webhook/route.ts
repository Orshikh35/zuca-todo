import { buildDigest, digestTelegram, todayIn } from "@/lib/agent/digest";
import { aiConfigured, organizeDay } from "@/lib/server/ai";
import { agentForProfile } from "@/lib/server/chat";
import { adminClient, appUrl, loadSnapshot } from "@/lib/server/context";
import { sendTelegram } from "@/lib/server/notify";
import { safeEqual, verifyLinkToken } from "@/lib/server/telegram-link";

export const maxDuration = 120;

const HELP = `<b>Боломжит командууд</b>
/today — өнөөдрийн ажил
/plan — AI-аар өдрөө цэгцлэх
/report <i>текст</i> — өнөөдрийн тайлан илгээх
/id — энэ чатын ID

Эсвэл энгийнээр бичээрэй — жишээ нь <i>«Батад маргааш Хөх тэнгэр зуслантай холбогдох ажил өг»</i>. AI ажлыг ZUCA Ops-д шууд бүртгэнэ.`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

interface Update {
  message?: { chat: { id: number }; text?: string; from?: { first_name?: string } };
}

/** Telegram bot webhook. /api/telegram/setup-оор бүртгэнэ. */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || !safeEqual(req.headers.get("x-telegram-bot-api-secret-token") ?? "", secret)) {
    return new Response("unauthorized", { status: 401 });
  }
  const update = (await req.json().catch(() => ({}))) as Update;
  const msg = update.message;
  if (!msg?.text) return new Response("ok");

  const chatId = String(msg.chat.id);
  const [cmdRaw, ...rest] = msg.text.trim().split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase();
  const arg = rest.join(" ");
  const reply = (text: string) => sendTelegram(chatId, text).catch((e) => console.error("telegram reply", e));

  try {
    const sb = adminClient();

    if (cmd === "/start" && arg) {
      const profileId = verifyLinkToken(arg);
      if (!profileId) {
        await reply("Холбох код буруу эсвэл хуучирсан байна. Системийн «AI туслах» хэсгээс дахин холбоно уу.");
        return new Response("ok");
      }
      // Өөр хүн энэ чатыг өмнө нь холбосон бол салгана
      await sb.from("profiles").update({ telegram_chat_id: null }).eq("telegram_chat_id", chatId);
      const { data, error } = await sb
        .from("profiles")
        .update({ telegram_chat_id: chatId, notify_telegram: true })
        .eq("id", profileId)
        .select("full_name")
        .single();
      if (error || !data) await reply("Бүртгэл олдсонгүй.");
      else await reply(`✅ ${data.full_name}, Telegram амжилттай холбогдлоо. Өглөө бүр өнөөдрийн ажлаа эндээс авна.\n\n${HELP}`);
      return new Response("ok");
    }

    if (cmd === "/id" || cmd === "/start") {
      await reply(`Энэ чатын ID: <code>${chatId}</code>\n\nСистемийн «AI туслах» хэсгээс «Telegram холбох» товч дарж холбоно уу.\n\n${HELP}`);
      return new Response("ok");
    }

    const { data: me } = await sb.from("profiles").select("*").eq("telegram_chat_id", chatId).maybeSingle();
    if (!me) {
      await reply(`Энэ чат ямар ч ажилтантай холбогдоогүй байна. Чатын ID: <code>${chatId}</code>`);
      return new Response("ok");
    }
    const date = todayIn();

    if (cmd === "/today" || cmd === "/plan") {
      const snap = await loadSnapshot(sb);
      const person = snap.profiles.find((p) => p.id === me.id)!;
      let plan = null;
      if (cmd === "/plan") {
        if (!aiConfigured()) await reply("AI тохируулаагүй байна — энгийн жагсаалтыг илгээлээ.");
        else {
          await reply("🤖 Өдрийг тань цэгцэлж байна…");
          plan = await organizeDay(snap, person, date).catch(() => null);
        }
      }
      await reply(digestTelegram(buildDigest(snap, person, date, plan), appUrl(req)));
      return new Response("ok");
    }

    if (cmd === "/report") {
      if (!arg) {
        await reply("Жишээ: <code>/report Гэрээ 2-ыг байгууллаа, маркетингийн төлөвлөгөө бичлээ</code>");
        return new Response("ok");
      }
      const { data: existing } = await sb.from("daily_reports").select("id, done").eq("profile_id", me.id).eq("date", date).maybeSingle();
      const res = existing
        ? await sb.from("daily_reports").update({ done: `${existing.done}\n${arg}` }).eq("id", existing.id)
        : await sb.from("daily_reports").insert({ profile_id: me.id, date, done: arg });
      await reply(res.error ? `Алдаа: ${res.error.message}` : "✍️ Өнөөдрийн тайланд нэмэгдлээ.");
      return new Response("ok");
    }

    // Команд биш энгийн текст → AI агент ажлыг бүртгэнэ / асуултад хариулна
    if (!cmd.startsWith("/") && aiConfigured()) {
      const res = await agentForProfile(sb, me, msg.text.trim(), "telegram");
      const L: string[] = [];
      if (res.reply) L.push(esc(res.reply));
      if (res.created.length) {
        const { data: people } = await sb.from("profiles").select("id, full_name");
        const name = new Map((people ?? []).map((p: { id: string; full_name: string }) => [p.id, p.full_name]));
        L.push("", `<b>✅ Бүртгэсэн ажил (${res.created.length})</b>`);
        res.created.forEach((t) =>
          L.push(`• ${esc(t.title)}${t.assignee_id ? ` — ${esc(name.get(t.assignee_id) ?? "")}` : ""}${t.due_date ? `, <i>${t.due_date}</i>` : ""}`),
        );
      }
      if (res.updated.length) L.push("", `✏️ ${res.updated.length} ажил шинэчиллээ.`);
      await reply(L.join("\n").trim() || "👍 Ойлголоо — бүртгэх ажил олдсонгүй.");
      return new Response("ok");
    }

    await reply(HELP);
  } catch (e) {
    console.error("telegram webhook", e);
    await reply("Уучлаарай, алдаа гарлаа. Дахин оролдоно уу.");
  }
  return new Response("ok");
}
