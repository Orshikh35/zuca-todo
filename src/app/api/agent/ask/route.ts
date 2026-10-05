import { aiConfigured } from "@/lib/server/ai";
import { agentForProfile } from "@/lib/server/chat";
import { HttpError, errorResponse, requireMe } from "@/lib/server/context";

export const maxDuration = 120;

/** Самбараас AI-д шууд хэлэх: ажил бүртгэх, шинэчлэх, асуултад хариулах */
export async function POST(req: Request) {
  try {
    const { sb, me } = await requireMe();
    if (!aiConfigured()) throw new HttpError(400, "ANTHROPIC_API_KEY тохируулаагүй байна");
    const { text } = (await req.json().catch(() => ({}))) as { text?: string };
    const body = (text ?? "").trim();
    if (!body) throw new HttpError(400, "Хоосон мессеж");
    if (body.length > 4000) throw new HttpError(400, "Мессеж хэт урт байна (4000 тэмдэгтээс ихгүй)");
    const res = await agentForProfile(sb, me, body, "dashboard");
    return Response.json({ reply: res.reply, created: res.created, updated: res.updated });
  } catch (e) {
    return errorResponse(e);
  }
}
