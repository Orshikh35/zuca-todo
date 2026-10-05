import { todayIn, type OrgSnapshot } from "@/lib/agent/digest";
import { canNotify } from "@/lib/permissions";
import { HttpError, appUrl, errorResponse, requestContext } from "@/lib/server/context";
import { deliverDigest, logRuns, type Channel, type DeliveryResult } from "@/lib/server/deliver";

export const maxDuration = 300;

/** Сонгосон хүмүүст өнөөдрийн ажлыг имэйл / Telegram-аар одоо илгээнэ */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      person_ids: string[];
      channels: Channel[];
      with_ai?: boolean;
      snapshot?: OrgSnapshot;
      me_id?: string;
    };
    const { me, snap, sb } = await requestContext(body);
    const channels = (body.channels ?? []).filter((c): c is Channel => c === "email" || c === "telegram");
    if (!channels.length) throw new HttpError(400, "Суваг сонгоно уу");

    const targets = snap.profiles.filter((p) => body.person_ids?.includes(p.id) && p.active);
    if (!targets.length) throw new HttpError(400, "Хүлээн авагч сонгоогүй");
    const denied = targets.find((p) => !canNotify(me, p, snap.departments));
    if (denied) throw new HttpError(403, `${denied.full_name}-д илгээх эрхгүй`);

    const date = todayIn();
    const results: DeliveryResult[] = [];
    // AI дуудлага удаан тул 3-аар зэрэг
    for (let i = 0; i < targets.length; i += 3) {
      const batch = await Promise.all(
        targets.slice(i, i + 3).map((person) =>
          deliverDigest({ snap, person, channels, withAi: !!body.with_ai, appUrl: appUrl(req), date, force: true }),
        ),
      );
      batch.forEach((b) => results.push(...b.results));
    }
    await logRuns(sb, results);
    return Response.json({ results });
  } catch (e) {
    return errorResponse(e);
  }
}
