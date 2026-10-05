import type { SupabaseClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { processMessage, shouldProcess } from "@/lib/server/chat";
import { HttpError, adminClient, errorResponse } from "@/lib/server/context";
import { safeEqual } from "@/lib/server/telegram-link";
import type { Channel } from "@/lib/types";

export const maxDuration = 120;

/**
 * Гадаад эх үүсвэрээс ажил хүлээн авах webhook — имэйл (Gmail Apps Script), zuca.mn,
 * Facebook, Google Form, Zapier/Make. Мессеж «Ирсэн хүсэлт» сувагт орж, AI ажил болгоно.
 *
 * Auth: `Authorization: Bearer <INTAKE_SECRET>` эсвэл `?key=<INTAKE_SECRET>`
 *
 * Body (JSON) — аль нэг нь:
 *   { "text": "...", "from": "Бат (bat@gmail.com)", "subject": "...", "ref": "давхардал шалгах id", "channel": "inbox",
 *     "zuca_camp_id": 12, "camp": "Хөх тэнгэр" }   ← зуслангийн аль нэг нь байвал AI ажлыг зуслантай холбоно
 *   Supabase Database Webhook: { "type": "INSERT", "table": "bookings", "record": {...}, "old_record": null }
 *   Бусад дурын JSON — бүтнээр нь текст болгоно.
 */
export async function POST(req: Request) {
  try {
    // Хуулахад орж ирсэн хоосон зай, хашилтыг тэвчинэ
    const clean = (v: string | null | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "");
    const secret = clean(process.env.INTAKE_SECRET);
    const url = new URL(req.url);
    const given = clean((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")) || clean(url.searchParams.get("key"));
    if (!secret || !safeEqual(given, secret)) throw new HttpError(401, "unauthorized");

    const raw = await req.text();
    let body: Record<string, unknown> = {};
    try {
      body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      body = { text: raw };
    }
    const { text, from, ref } = normalize(body, url.searchParams.get("source"));
    if (!text.trim()) throw new HttpError(400, "text хоосон байна");

    const sb = adminClient();
    // zuca.mn-ээс зуслангийн ID/нэр ирвэл зусланг танилцуулна — AI ажлыг тэр зуслантай холбоно
    const camp = await campHint(sb, body);
    const fullText = camp ? `${text}\nЗуслан: ${camp}` : text;
    const slug = String(body.channel ?? url.searchParams.get("channel") ?? "inbox");
    const { data: ch, error: chErr } = await sb.from("channels").select("*").eq("slug", slug).maybeSingle();
    if (chErr) throw new HttpError(500, chErr.message);
    if (!ch) throw new HttpError(404, `«${slug}» суваг олдсонгүй`);

    const willProcess = shouldProcess(ch as Channel, { body: fullText, author_kind: "external" });
    const { data: msg, error } = await sb
      .from("messages")
      .insert({
        channel_id: ch.id,
        author_kind: "external",
        author_name: from.slice(0, 120),
        body: fullText.slice(0, 8000),
        source: "intake",
        source_ref: ref,
        ai_state: willProcess ? "pending" : null,
      })
      .select()
      .single();
    if (error?.code === "23505") return Response.json({ ok: true, duplicate: true });
    if (error) throw new HttpError(500, error.message);

    if (willProcess) after(() => processMessage(sb, msg.id));
    return Response.json({ ok: true, message_id: msg.id }, { status: 202 });
  } catch (e) {
    return errorResponse(e);
  }
}

async function campHint(sb: SupabaseClient, b: Record<string, unknown>) {
  const zucaId = Number(b.zuca_camp_id);
  if (Number.isInteger(zucaId) && zucaId > 0) {
    const { data } = await sb.from("camps").select("name").eq("zuca_id", zucaId).maybeSingle();
    if (data?.name) return data.name as string;
  }
  return typeof b.camp === "string" && b.camp.trim() ? b.camp.trim().slice(0, 120) : null;
}

function normalize(b: Record<string, unknown>, sourceParam: string | null) {
  const str = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

  // Supabase Database Webhook (жишээ нь zuca.mn-ийн шинэ бүртгэл, гомдол, зуслангийн өөрчлөлт)
  if (typeof b.table === "string" && typeof b.type === "string" && "record" in b) {
    const rec = (b.record ?? b.old_record ?? {}) as Record<string, unknown>;
    const id = str(rec.id);
    return {
      from: sourceParam || `zuca.mn · ${b.table}`,
      text: `zuca.mn үйл явдал: ${b.table} хүснэгтэд ${b.type}\n${JSON.stringify(rec, null, 1).slice(0, 6000)}`,
      ref: id ? `${b.table}:${b.type}:${id}` : null,
    };
  }

  const text = [str(b.subject) && `Гарчиг: ${str(b.subject)}`, str(b.text ?? b.message ?? b.body)].filter(Boolean).join("\n");
  return {
    from: str(b.from ?? b.sender ?? b.name) || sourceParam || "Гадаад эх үүсвэр",
    text: text || JSON.stringify(b, null, 1).slice(0, 6000),
    ref: str(b.ref ?? b.id ?? b.message_id) || null,
  };
}
