import { todayIn } from "@/lib/agent/digest";
import { adminClient, appUrl, errorResponse, loadSnapshot } from "@/lib/server/context";
import { deliverDigest, logRuns, type Channel, type DeliveryResult } from "@/lib/server/deliver";
import { housekeeping } from "@/lib/server/housekeeping";
import { safeEqual } from "@/lib/server/telegram-link";

export const maxDuration = 300;

/**
 * Өглөө бүр (vercel.json → 23:00 UTC = 07:00 Улаанбаатар) бүх идэвхтэй ажилтанд
 * өдрийн ажлыг AI-аар цэгцэлж имэйл + Telegram-аар илгээнэ.
 * Гараар: curl -H "Authorization: Bearer $CRON_SECRET" https://.../api/cron/daily
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const date = todayIn();
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    const force = new URL(req.url).searchParams.get("force") === "1";
    if (!force && process.env.DIGEST_WEEKENDS !== "1" && (weekday === 0 || weekday === 6)) {
      return Response.json({ skipped: "weekend", date });
    }

    const sb = adminClient();
    const snap = await loadSnapshot(sb);
    const withAi = process.env.AGENT_AI_DIGEST !== "0";
    const people = snap.profiles.filter(
      (p) => p.active && ((p.notify_email && p.email) || (p.notify_telegram && p.telegram_chat_id)),
    );

    const results: DeliveryResult[] = [];
    for (let i = 0; i < people.length; i += 3) {
      const batch = await Promise.all(
        people.slice(i, i + 3).map((person) => {
          const channels: Channel[] = [];
          if (person.notify_email && person.email) channels.push("email");
          if (person.notify_telegram && person.telegram_chat_id) channels.push("telegram");
          return deliverDigest({ snap, person, channels, withAi, appUrl: appUrl(req), date });
        }),
      );
      batch.forEach((b) => results.push(...b.results));
    }
    await logRuns(sb, results);
    // Автомат ажил үүсгэх + #Ерөнхий сувагт товчоо (чатын схем v5 байхгүй бол алгасна)
    const auto = await housekeeping(sb, date).catch((e: Error) => ({ error: e.message }));
    return Response.json({ date, sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, auto, results });
  } catch (e) {
    return errorResponse(e);
  }
}
