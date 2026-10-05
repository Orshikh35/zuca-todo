import nodemailer, { type Transporter } from "nodemailer";

export const emailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
export const telegramConfigured = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);

let transport: Transporter | null = null;
function mailer() {
  if (!transport) {
    const port = Number(process.env.SMTP_PORT || 465);
    transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transport;
}

export async function sendEmail(to: string, subject: string, html: string, text: string) {
  if (!emailConfigured()) throw new Error("SMTP тохируулаагүй");
  const from = process.env.MAIL_FROM || process.env.SMTP_USER!;
  await mailer().sendMail({ from, to, subject, html, text });
}

export async function sendTelegram(chatId: string, text: string, extra: Record<string, unknown> = {}) {
  if (!telegramConfigured()) throw new Error("TELEGRAM_BOT_TOKEN тохируулаагүй");
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!res.ok || !json.ok) throw new Error(`Telegram: ${json.description ?? res.statusText}`);
}

/** Telegram Bot API-ийн дурын method (answerCallbackQuery, editMessageReplyMarkup гэх мэт) */
export async function telegramApi(method: string, body: Record<string, unknown>) {
  if (!telegramConfigured()) throw new Error("TELEGRAM_BOT_TOKEN тохируулаагүй");
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
  if (!res.ok || !json.ok) throw new Error(`Telegram ${method}: ${json.description ?? res.statusText}`);
  return json;
}
