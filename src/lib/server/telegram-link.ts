import { createHmac, timingSafeEqual } from "node:crypto";

const secret = () => process.env.TELEGRAM_WEBHOOK_SECRET || process.env.CRON_SECRET || "";

const sign = (profileId: string) => createHmac("sha256", secret()).update(profileId).digest("base64url").slice(0, 12);

/** /start параметр: "<profile uuid>_<hmac>" — хүн өөр хүний бүртгэлд Telegram-аа холбож чадахгүй */
export function linkToken(profileId: string) {
  if (!secret()) throw new Error("TELEGRAM_WEBHOOK_SECRET тохируулаагүй");
  return `${profileId}_${sign(profileId)}`;
}

export function verifyLinkToken(token: string): string | null {
  const i = token.lastIndexOf("_");
  if (i < 0 || !secret()) return null;
  const id = token.slice(0, i);
  const a = Buffer.from(token.slice(i + 1));
  const b = Buffer.from(sign(id));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
