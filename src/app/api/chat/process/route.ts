import { aiConfigured } from "@/lib/server/ai";
import { processMessage } from "@/lib/server/chat";
import { HttpError, errorResponse, requireMe } from "@/lib/server/context";

export const maxDuration = 120;

/**
 * Дурын мессежийг гараар AI-аар «ажил болгох» эсвэл алдаа гарсныг дахин оролдох.
 * Хүн өөрөө дарсан тул сувгийн горим (mention/suggest)-оос үл хамааран ажлыг шууд бүртгэнэ.
 */
export async function POST(req: Request) {
  try {
    const { sb, me } = await requireMe();
    if (!aiConfigured()) throw new HttpError(400, "ANTHROPIC_API_KEY тохируулаагүй байна");
    const { message_id } = (await req.json().catch(() => ({}))) as { message_id?: string };
    if (!message_id) throw new HttpError(400, "message_id шаардлагатай");
    const res = await processMessage(sb, message_id, { invoker: me, force: true });
    if (!res.ok) throw new HttpError(502, res.error ?? "AI алдаа");
    return Response.json({ created: res.created?.length ?? 0 });
  } catch (e) {
    return errorResponse(e);
  }
}
