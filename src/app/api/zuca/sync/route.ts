import { atLeast } from "@/lib/permissions";
import { HttpError, adminClient, errorResponse, requireMe } from "@/lib/server/context";
import { syncZuca } from "@/lib/server/zuca-sync";

export const maxDuration = 300;

/** «Одоо шинэчлэх» товч — хэлтсийн дарга, удирдлага, админ */
export async function POST() {
  try {
    const { me } = await requireMe();
    if (!atLeast(me, "manager")) throw new HttpError(403, "Зөвхөн менежер, удирдлага шинэчилнэ");
    return Response.json(await syncZuca(adminClient(), { manual: true, actorName: me.full_name }));
  } catch (e) {
    return errorResponse(e);
  }
}
