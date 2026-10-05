import { todayIn, type OrgSnapshot } from "@/lib/agent/digest";
import { canNotify } from "@/lib/permissions";
import { AgentError, organizeDay } from "@/lib/server/ai";
import { HttpError, errorResponse, requestContext } from "@/lib/server/context";

/** Нэг хүний өнөөдрийн ажлыг AI-аар цэгцэлж, төлөвлөгөө + санал буцаана */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { person_id?: string; snapshot?: OrgSnapshot; me_id?: string };
    const { me, snap, sb } = await requestContext(body);
    const person = snap.profiles.find((p) => p.id === (body.person_id || me.id));
    if (!person) throw new HttpError(404, "Ажилтан олдсонгүй");
    if (!canNotify(me, person, snap.departments)) throw new HttpError(403, "Энэ хүний ажлыг цэгцлэх эрхгүй");

    const plan = await organizeDay(snap, person, todayIn());
    await sb?.from("agent_runs").insert({ profile_id: person.id, kind: "organize", channel: "preview", ok: true, detail: plan.summary.slice(0, 200) });
    return Response.json({ plan });
  } catch (e) {
    if (e instanceof AgentError) return Response.json({ error: e.message }, { status: 502 });
    return errorResponse(e);
  }
}
