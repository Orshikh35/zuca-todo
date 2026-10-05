import { buildDigest, digestTelegram, todayIn } from "@/lib/agent/digest";
import { aiConfigured, organizeDay } from "@/lib/server/ai";
import { agentForProfile } from "@/lib/server/chat";
import { adminClient, appUrl, loadSnapshot } from "@/lib/server/context";
import { sendTelegram, telegramApi } from "@/lib/server/notify";
import { taskButtons } from "@/lib/server/task-notify";
import { safeEqual, verifyLinkToken } from "@/lib/server/telegram-link";

export const maxDuration = 120;

const HELP = `<b>Боломжит командууд</b>
/today — өнөөдрийн ажил
/plan — AI-аар өдрөө цэгцлэх
/id — энэ чатын ID

Эсвэл энгийнээр бичээрэй — жишээ нь <i>«Батад маргааш Хөх тэнгэр зуслантай холбогдох ажил өг»</i>. AI ажлыг ZUCA Ops-д шууд бүртгэнэ.`;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

interface Update {
  message?: {
    chat: { id: number; type?: string };
    text?: string;
    from?: { id?: number; first_name?: string };
    /** «📱 Утасны дугаараа илгээх» товчоор ирсэн */
    contact?: { phone_number: string; user_id?: number; first_name?: string };
  };
  /** Ажлын мэдэгдэл дээрх «▶️ Эхлүүлэх / ✅ Дууссан» товч */
  callback_query?: { id: string; from: { id: number }; data?: string; message?: { chat: { id: number }; message_id: number } };
}

/** Утсаар холбох товч — ажилтан Start дараад утсаа хуваалцахад автоматаар холбогдоно */
const ASK_PHONE = {
  reply_markup: {
    keyboard: [[{ text: "📱 Утасны дугаараа илгээх", request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  },
};
const REMOVE_KEYBOARD = { reply_markup: { remove_keyboard: true } };

/** Утасны дугаарыг харьцуулах түлхүүр: зөвхөн цифр, сүүлийн 8 (+976 9911 2233 = 99112233) */
const phoneKey = (s: string | null | undefined) => {
  const d = (s ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : d;
};

/** Telegram bot webhook. /api/telegram/setup-оор бүртгэнэ. */
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || !safeEqual(req.headers.get("x-telegram-bot-api-secret-token") ?? "", secret)) {
    return new Response("unauthorized", { status: 401 });
  }
  const update = (await req.json().catch(() => ({}))) as Update;
  if (update.callback_query) return handleTaskButton(update.callback_query);
  const msg = update.message;
  if (!msg) return new Response("ok");
  const chatId = String(msg.chat.id);
  const isPrivate = !msg.chat.type || msg.chat.type === "private";

  if (msg.contact && isPrivate) return linkByPhone(chatId, msg.contact, msg.from?.id);
  if (!msg.text) return new Response("ok");

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

    if (cmd === "/id") {
      await reply(`Энэ чатын ID: <code>${chatId}</code>`);
      return new Response("ok");
    }

    const { data: me } = await sb.from("profiles").select("*").eq("telegram_chat_id", chatId).maybeSingle();
    if (!me) {
      // Холбогдоогүй бол утсаар нь таньж холбоно
      await sendTelegram(
        chatId,
        isPrivate
          ? "👋 Сайн байна уу! ZUCA Ops-тэй холбогдохын тулд доорх <b>«📱 Утасны дугаараа илгээх»</b> товчийг дарна уу. Таны утас «Ажилчид» хэсэгт бүртгэлтэй байх ёстой."
          : `Энэ групп ZUCA Ops-тэй холбогдоогүй байна. Чатын ID: <code>${chatId}</code>`,
        isPrivate ? ASK_PHONE : {},
      ).catch((e) => console.error("telegram reply", e));
      return new Response("ok");
    }

    if (cmd === "/start") {
      await reply(`👋 ${esc(me.full_name)}, та ZUCA Ops-тэй холбогдсон байна.\n\n${HELP}`);
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

/**
 * Ажилтан утсаа хуваалцахад «Ажилчид» хэсэгт бүртгэлтэй утсаар нь таньж Telegram-ыг холбоно.
 * Олон ажилтан bot-ын холбоос (t.me/<bot>) аваад Start → утас илгээх л хангалттай.
 */
async function linkByPhone(chatId: string, contact: NonNullable<NonNullable<Update["message"]>["contact"]>, fromId?: number) {
  const send = (text: string, extra: Record<string, unknown> = {}) =>
    sendTelegram(chatId, text, extra).catch((e) => console.error("telegram reply", e));
  try {
    // Өөр хүний контактыг илгээж бусдын бүртгэлд холбогдохоос сэргийлнэ
    if (contact.user_id && fromId && contact.user_id !== fromId) {
      await send("Өөрийн утасны дугаарыг доорх товчоор илгээнэ үү.", ASK_PHONE);
      return new Response("ok");
    }
    const key = phoneKey(contact.phone_number);
    const sb = adminClient();
    const { data } = await sb.from("profiles").select("id, full_name, phone, active").not("phone", "is", null);
    const matches = ((data ?? []) as { id: string; full_name: string; phone: string | null; active: boolean }[]).filter(
      (p) => p.active && key.length >= 6 && phoneKey(p.phone) === key,
    );

    if (matches.length !== 1) {
      await send(
        matches.length
          ? `Энэ утас (${key}) хэд хэдэн ажилтанд бүртгэлтэй байна. Админдаа хэлж нэгийг нь засуулна уу.`
          : `Таны утас (${key}) ZUCA Ops-ийн «Ажилчид» хэсэгт бүртгэлгүй байна. Менежертээ утсаа бүртгүүлээд дахин товчийг дарна уу.`,
        ASK_PHONE,
      );
      return new Response("ok");
    }

    const person = matches[0];
    // Өмнө нь энэ чатыг өөр хүнд холбосон бол салгана
    await sb.from("profiles").update({ telegram_chat_id: null }).eq("telegram_chat_id", chatId).neq("id", person.id);
    const { error } = await sb.from("profiles").update({ telegram_chat_id: chatId, notify_telegram: true }).eq("id", person.id);
    if (error) throw new Error(error.message);
    await send(`✅ ${esc(person.full_name)}, Telegram амжилттай холбогдлоо. Өглөө бүр өнөөдрийн ажлаа эндээс авна.\n\n${HELP}`, REMOVE_KEYBOARD);
  } catch (e) {
    console.error("linkByPhone", e);
    await send("Уучлаарай, холбоход алдаа гарлаа. Дахин оролдоно уу.");
  }
  return new Response("ok");
}

const STATUS_DONE_TEXT: Record<string, string> = { in_progress: "▶️ Ажлыг эхлүүллээ", done: "✅ Дууссан гэж тэмдэглэлээ" };

/** Telegram дээрх товчоор ажлын төлөвийг өөрчилнө — зөвхөн хариуцагч эсвэл удирдлага */
async function handleTaskButton(q: NonNullable<Update["callback_query"]>) {
  const answer = (text: string) => telegramApi("answerCallbackQuery", { callback_query_id: q.id, text }).catch(() => undefined);
  try {
    const [kind, status, taskId] = (q.data ?? "").split(":");
    if (kind !== "t" || !taskId || !(status === "in_progress" || status === "done")) {
      await answer("Тодорхойгүй үйлдэл");
      return new Response("ok");
    }
    const chatId = String(q.message?.chat.id ?? q.from.id);
    const sb = adminClient();
    const [{ data: me }, { data: task }] = await Promise.all([
      sb.from("profiles").select("id, role").eq("telegram_chat_id", chatId).maybeSingle(),
      sb.from("tasks").select("id, assignee_id, status").eq("id", taskId).maybeSingle(),
    ]);
    if (!me || !task) {
      await answer(!me ? "Таны Telegram ZUCA Ops-тэй холбогдоогүй байна" : "Ажил олдсонгүй (устгагдсан байж магадгүй)");
      return new Response("ok");
    }
    if (task.assignee_id !== me.id && !["admin", "director"].includes(me.role as string)) {
      await answer("Энэ ажил танд оноогдоогүй байна");
      return new Response("ok");
    }
    const { error } = await sb.from("tasks").update({ status }).eq("id", taskId);
    if (error) throw new Error(error.message);
    await answer(STATUS_DONE_TEXT[status]);
    if (q.message) {
      await telegramApi("editMessageReplyMarkup", {
        chat_id: q.message.chat.id,
        message_id: q.message.message_id,
        reply_markup: taskButtons(taskId, status),
      }).catch(() => undefined);
    }
  } catch (e) {
    console.error("task button", e);
    await answer("Алдаа гарлаа, дахин оролдоно уу");
  }
  return new Response("ok");
}
