import { HttpError, appUrl, errorResponse, requireMe } from "@/lib/server/context";
import { notifyAccessDecision } from "@/lib/server/access";
import { isAdmin } from "@/lib/permissions";
import type { Profile } from "@/lib/types";

/** Админ шинэ ажилтны бүртгэлийг зөвшөөрөх / татгалзах. Ажилтанд имэйлээр мэдэгдэнэ. */
export async function POST(req: Request) {
  try {
    const { sb, me } = await requireMe();
    if (!isAdmin(me)) throw new HttpError(403, "Зөвхөн админ бүртгэл батална");
    const { profile_id, decision } = (await req.json().catch(() => ({}))) as { profile_id?: string; decision?: string };
    if (!profile_id || (decision !== "approved" && decision !== "rejected")) throw new HttpError(400, "profile_id, decision шаардлагатай");
    if (profile_id === me.id) throw new HttpError(400, "Өөрийн бүртгэлийг өөрчлөхгүй");

    const approved = decision === "approved";
    // RLS + guard_profile_access trigger давхар шалгана
    const { data, error } = await sb
      .from("profiles")
      .update({ access: decision, active: approved })
      .eq("id", profile_id)
      .select()
      .single();
    if (error) throw new HttpError(400, error.message);

    const person = data as Profile;
    const emailed = await notifyAccessDecision(person, approved, appUrl(req));
    return Response.json({ profile: person, emailed });
  } catch (e) {
    return errorResponse(e);
  }
}
