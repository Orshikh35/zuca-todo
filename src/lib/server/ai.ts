import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { planInput, type OrgSnapshot } from "../agent/digest";
import { AgentPlanSchema, type AgentPlan } from "../agent/schema";
import type { Profile } from "../types";

export const AI_MODEL = process.env.AGENT_MODEL || "claude-opus-5-5";
export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
export const anthropic = () => (client ??= new Anthropic());

// Тогтмол system prompt — prompt cache-д тохиромжтой байлгахын тулд огноо, нэр оруулахгүй
const SYSTEM = `Та бол Монгол байгууллагын дотоод удирдлагын системийн AI туслах. Ажилтны нээлттэй ажлуудыг хараад өнөөдрийн ажлын өдрийг цэгцэлж өгнө.

Зарчим:
- Хугацаа хэтэрсэн, өнөөдөр дуусах, яаралтай, өөр хэлтсээс ирсэн хүсэлтийг эхэнд тавь. Батлах хүсэлт хүлээгдэж байвал түүнийг бас дурд.
- focus: өнөөдөр бодитоор хийж болох 3-6 ажил, хийх дарааллаар. Ажлын өдөр 09:00-18:00, 12:00-13:00 цайны цаг. Том ажлыг өглөө, жижгийг үдээс хойш.
- suggestions: зөвхөн үнэхээр хэрэгтэй үед. Хугацаа нь бодитой биш бол reschedule, ач холбогдол нь буруу бол reprioritize, хэт ачаалалтай бол reassign (зөвхөн colleagues жагсаалтын id), хэт том бол split, хийгдээд дууссан бололтой бол close. task_id нь заавал өгөгдсөн жагсаалтын id байна.
- risks: хугацаа тулсан, саад болж буй, өчигдрийн тайлан дахь blockers зэрэг.
- Бүх текстийг монгол хэлээр, товч, тодорхой бич. Ажлын нэрийг өөрчлөхгүй. Байхгүй ажил зохиохгүй.`;

export class AgentError extends Error {}

/** Нэг хүний өнөөдрийн ажлыг Claude-оор цэгцэлнэ */
export async function organizeDay(snap: OrgSnapshot, person: Profile, date: string): Promise<AgentPlan> {
  if (!aiConfigured()) throw new AgentError("ANTHROPIC_API_KEY тохируулаагүй байна");
  const input = planInput(snap, person, date);
  if (!input.tasks.length && !input.approvals_waiting_for_me.length) {
    return { summary: "Танд одоогоор нээлттэй ажил алга. Шинэ ажил төлөвлөх эсвэл багтаа туслах сайхан өдөр.", focus: [], suggestions: [], risks: [] };
  }

  let res;
  try {
    res = await anthropic().beta.messages.parse({
      model: AI_MODEL,
      max_tokens: 16000,
      // Opus 5.5-ийн анхдагч effort нь medium — өдөр тутмын төлөвлөлтөд хангалттай
      output_config: { effort: "medium", format: betaZodOutputFormat(AgentPlanSchema) },
      // Safety classifier татгалзвал server талд өөр model-оор автоматаар дахин оролдоно
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `Ажилтны өгөгдөл (JSON):\n${JSON.stringify(input)}` }],
    });
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new AgentError("ANTHROPIC_API_KEY буруу байна");
    if (e instanceof Anthropic.RateLimitError) throw new AgentError("AI хүсэлтийн хязгаарт хүрлээ, түр хүлээгээд дахин оролдоно уу");
    if (e instanceof Anthropic.APIError) throw new AgentError(`AI алдаа (${e.status}): ${e.message}`);
    throw e;
  }

  if (res.stop_reason === "refusal") throw new AgentError("AI энэ хүсэлтэд хариулахаас татгалзлаа");
  const plan = res.parsed_output;
  if (!plan) throw new AgentError("AI-ийн хариуг уншиж чадсангүй");

  // Байхгүй id руу заасан саналыг хасна
  const ids = new Set(input.tasks.map((t) => t.id));
  const people = new Set(input.colleagues.map((c) => c.id));
  plan.suggestions = plan.suggestions.filter((s) => ids.has(s.task_id) && (s.action !== "reassign" || people.has(s.assignee_id)));
  plan.focus = plan.focus.map((f) => ({ ...f, task_id: ids.has(f.task_id) ? f.task_id : "" }));
  return plan;
}
