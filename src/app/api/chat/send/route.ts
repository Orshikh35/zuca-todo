import { after } from "next/server";
import { processMessage, shouldProcess } from "@/lib/server/chat";
import { HttpError, errorResponse, requireMe } from "@/lib/server/context";
import type { Channel } from "@/lib/types";

// AI хариуг response-ын дараа (after) боловсруулна — хэрэглэгч хүлээхгүй, хариу realtime-аар ирнэ
export const maxDuration = 120;

/** Сувагт мессеж бичнэ. Ажил агуулж байвал AI автоматаар бүртгэнэ. */
export async function POST(req: Request) {
  try {
    const { sb, me } = await requireMe();
    const body = (await req.json().catch(() => ({}))) as { channel_id?: string; body?: string; reply_to?: string | null };
    const text = (body.body ?? "").trim();
    if (!text) throw new HttpError(400, "Хоосон мессеж");
    if (text.length > 8000) throw new HttpError(400, "Мессеж хэт урт байна (8000 тэмдэгтээс ихгүй)");

    const { data: ch, error: chErr } = await sb.from("channels").select("*").eq("id", body.channel_id ?? "").maybeSingle();
    if (chErr) throw new HttpError(500, chErr.code === "PGRST205" ? "Чатын хүснэгт алга — supabase/schema.sql-ийг дахин ажиллуулна уу" : chErr.message);
    if (!ch) throw new HttpError(404, "Суваг олдсонгүй");

    const willProcess = shouldProcess(ch as Channel, { body: text, author_kind: "user" });
    const { data: msg, error } = await sb
      .from("messages")
      .insert({
        channel_id: ch.id,
        author_id: me.id,
        author_kind: "user",
        body: text,
        reply_to: body.reply_to || null,
        source: "app",
        ai_state: willProcess ? "pending" : null,
      })
      .select()
      .single();
    if (error) throw new HttpError(500, error.message);

    if (willProcess) after(() => processMessage(sb, msg.id, { invoker: me }));
    return Response.json({ message: msg });
  } catch (e) {
    return errorResponse(e);
  }
}
