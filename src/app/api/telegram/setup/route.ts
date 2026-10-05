import { HttpError, appUrl, errorResponse, requestContext } from "@/lib/server/context";

/** Bot-ын webhook-ийг энэ сайт руу заана (зөвхөн админ) */
export async function POST(req: Request) {
  try {
    const { me } = await requestContext(await req.json().catch(() => ({})));
    if (me.role !== "admin") throw new HttpError(403, "Зөвхөн админ");
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!token || !secret) throw new HttpError(400, "TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET тохируулна уу");
    const url = `${appUrl(req)}/api/telegram/webhook`;
    if (url.startsWith("http://")) throw new HttpError(400, "Telegram зөвхөн https хаяг руу webhook илгээнэ. APP_URL-ээ шалгана уу");

    const api = (method: string, body: object) =>
      fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => r.json() as Promise<{ ok: boolean; description?: string }>);

    const res = await api("setWebhook", { url, secret_token: secret, allowed_updates: ["message"] });
    if (!res.ok) throw new HttpError(502, `Telegram: ${res.description}`);
    await api("setMyCommands", {
      commands: [
        { command: "today", description: "Өнөөдрийн ажил" },
        { command: "plan", description: "AI-аар өдрөө цэгцлэх" },
        { command: "report", description: "Өдрийн тайлан илгээх" },
        { command: "id", description: "Чатын ID" },
      ],
    });
    return Response.json({ ok: true, url });
  } catch (e) {
    return errorResponse(e);
  }
}
