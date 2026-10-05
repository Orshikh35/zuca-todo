import { HttpError, errorResponse, requestContext } from "@/lib/server/context";
import { linkToken } from "@/lib/server/telegram-link";

/** Нэвтэрсэн хүнд зориулсан t.me/<bot>?start=<token> холбоос */
export async function POST(req: Request) {
  try {
    const { me } = await requestContext(await req.json().catch(() => ({})));
    const bot = process.env.TELEGRAM_BOT_USERNAME;
    if (!bot) throw new HttpError(400, "TELEGRAM_BOT_USERNAME тохируулаагүй");
    return Response.json({ url: `https://t.me/${bot.replace(/^@/, "")}?start=${linkToken(me.id)}` });
  } catch (e) {
    return errorResponse(e);
  }
}
