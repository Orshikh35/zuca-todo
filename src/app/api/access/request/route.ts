import { HttpError, adminClient, appUrl, errorResponse } from "@/lib/server/context";
import { notifyAdminsOfSignup } from "@/lib/server/access";

/**
 * Бүртгүүлсний дараа login хуудас дуудна (session байхгүй байж болно).
 * Хүлээгдэж буй, мэдэгдээгүй бүртгэл байвал л админуудад нэг удаа мэдэгдэнэ — дахин дуудахад юу ч болохгүй.
 */
export async function POST(req: Request) {
  try {
    const { email } = (await req.json().catch(() => ({}))) as { email?: string };
    const addr = email?.trim();
    if (!addr || !addr.includes("@")) throw new HttpError(400, "email шаардлагатай");

    const sb = adminClient();
    // Нөхцөлтэй update — зэрэг ирсэн хүсэлтүүдээс зөвхөн нэг нь мөрийг «авна»
    const { data: person, error } = await sb
      .from("profiles")
      .update({ access_notified_at: new Date().toISOString() })
      .ilike("email", addr.replace(/[\\%_]/g, "\\$&"))
      .eq("access", "pending")
      .is("access_notified_at", null)
      .not("user_id", "is", null)
      .select("full_name, email")
      .maybeSingle();
    if (error) throw new HttpError(500, error.message);
    if (!person) return Response.json({ ok: true, sent: 0 });

    const sent = await notifyAdminsOfSignup(sb, person, appUrl(req));
    return Response.json({ ok: true, sent });
  } catch (e) {
    return errorResponse(e);
  }
}
