/**
 * Шинэ ажилтны бүртгэлийг админ батлах урсгал (schema.sql v10):
 * бүртгүүлэх → админуудад имэйл (+ Telegram) → «Баг» хуудаснаас зөвшөөрөх → ажилтанд имэйл.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "../types";
import { emailConfigured, sendEmail, sendTelegram, telegramConfigured } from "./notify";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function mailHtml(title: string, body: string, cta: { label: string; url: string }) {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#171717">
  <div style="font-size:18px;margin-bottom:20px"><b>zuca</b> <span style="color:#a1a1aa">ops</span></div>
  <h2 style="font-size:20px;margin:0 0 12px">${title}</h2>
  <div style="font-size:14px;line-height:1.6;color:#3f3f46">${body}</div>
  <a href="${cta.url}" style="display:inline-block;margin-top:20px;padding:11px 20px;border-radius:999px;background:#171717;color:#fff;text-decoration:none;font-size:14px;font-weight:600">${cta.label}</a>
</div>`;
}

/** Хүлээгдэж буй бүртгэлийн тухай админ бүрт мэдэгдэнэ. Илгээсэн сувгийн тоог буцаана. */
export async function notifyAdminsOfSignup(sb: SupabaseClient, person: Pick<Profile, "full_name" | "email">, appUrl: string) {
  const { data } = await sb
    .from("profiles")
    .select("full_name, email, telegram_chat_id")
    .in("role", ["admin", "director"])
    .eq("access", "approved")
    .eq("active", true);
  const admins = (data ?? []) as Pick<Profile, "full_name" | "email" | "telegram_chat_id">[];
  const url = `${appUrl}/team#access`;
  const who = `${esc(person.full_name)} (${esc(person.email)})`;
  let sent = 0;

  for (const a of admins) {
    try {
      if (a.email && emailConfigured()) {
        await sendEmail(
          a.email,
          `Шинэ ажилтан бүртгүүллээ: ${person.full_name}`,
          mailHtml("Шинэ ажилтан бүртгүүллээ", `<p><b>${who}</b> ZUCA Ops-д бүртгүүлж, нэвтрэх зөвшөөрөл хүсэж байна.</p><p>Танилцаад зөвшөөрөх эсвэл татгалзана уу.</p>`, {
            label: "Бүртгэлийг шалгах",
            url,
          }),
          `${person.full_name} (${person.email}) ZUCA Ops-д бүртгүүлж, нэвтрэх зөвшөөрөл хүсэж байна.\nЗөвшөөрөх: ${url}`,
        );
        sent++;
      }
      if (a.telegram_chat_id && telegramConfigured()) {
        const extra = url.startsWith("https://") ? { reply_markup: { inline_keyboard: [[{ text: "Бүртгэлийг шалгах", url }]] } } : {};
        await sendTelegram(a.telegram_chat_id, `🙋 <b>Шинэ ажилтан бүртгүүллээ</b>\n\n${who}\nНэвтрэх зөвшөөрөл хүсэж байна.`, extra);
        sent++;
      }
    } catch (e) {
      console.error("notifyAdminsOfSignup", a.email, e);
    }
  }
  return sent;
}

/** Админ шийдвэр гаргасны дараа ажилтанд имэйлээр мэдэгдэнэ */
export async function notifyAccessDecision(person: Pick<Profile, "full_name" | "email">, approved: boolean, appUrl: string) {
  if (!person.email || !emailConfigured()) return false;
  try {
    const url = `${appUrl}/login`;
    if (approved) {
      await sendEmail(
        person.email,
        "ZUCA Ops — бүртгэл тань батлагдлаа",
        mailHtml("Бүртгэл тань батлагдлаа", `<p>Сайн байна уу, ${esc(person.full_name)}!</p><p>Админ таны бүртгэлийг зөвшөөрлөө. Одоо системд нэвтэрч болно.</p>`, {
          label: "Нэвтрэх",
          url,
        }),
        `Сайн байна уу, ${person.full_name}! Админ таны бүртгэлийг зөвшөөрлөө. Нэвтрэх: ${url}`,
      );
    } else {
      await sendEmail(
        person.email,
        "ZUCA Ops — бүртгэлийн хүсэлт",
        mailHtml("Бүртгэлийн хүсэлт", `<p>Сайн байна уу, ${esc(person.full_name)}.</p><p>Таны ZUCA Ops-д нэвтрэх хүсэлтийг админ зөвшөөрсөнгүй. Асуух зүйл байвал багийн ахлагчтайгаа холбогдоно уу.</p>`, {
          label: "ZUCA Ops",
          url,
        }),
        `Сайн байна уу, ${person.full_name}. Таны ZUCA Ops-д нэвтрэх хүсэлтийг админ зөвшөөрсөнгүй.`,
      );
    }
    return true;
  } catch (e) {
    console.error("notifyAccessDecision", person.email, e);
    return false;
  }
}
