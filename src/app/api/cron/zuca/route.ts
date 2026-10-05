import { adminClient, errorResponse } from "@/lib/server/context";
import { safeEqual } from "@/lib/server/telegram-link";
import { syncZuca } from "@/lib/server/zuca-sync";

export const maxDuration = 300;

/**
 * Орой бүр (vercel.json → 13:00 UTC = 21:00 Улаанбаатар) zuca.mn-ээс зуслан, ээлжийн мэдээллийг татна.
 * Гараар: curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/zuca
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !safeEqual(req.headers.get("authorization") ?? "", `Bearer ${secret}`)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return Response.json(await syncZuca(adminClient()));
  } catch (e) {
    return errorResponse(e);
  }
}
