import { isAdmin } from "@/lib/permissions";
import { HttpError, adminClient, errorResponse, requireMe } from "@/lib/server/context";
import { syncZuca } from "@/lib/server/zuca-sync";

export const maxDuration = 300;

/** «Одоо шинэчлэх» товч — зөвхөн админ */
export async function POST() {
  try {
    const { me } = await requireMe();
    if (!isAdmin(me)) throw new HttpError(403, "Зөвхөн админ шинэчилнэ");
    return Response.json(await syncZuca(adminClient(), { manual: true, actorName: me.full_name }));
  } catch (e) {
    return errorResponse(e);
  }
}
