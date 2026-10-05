import { z } from "zod";

/** AI туслахын өдрийн төлөвлөгөөний бүтэц (structured output) */
export const AgentPlanSchema = z.object({
  summary: z.string().describe("1-2 өгүүлбэр: өнөөдрийн гол анхаарах зүйл, монголоор"),
  focus: z
    .array(
      z.object({
        task_id: z.string().describe("Жагсаалтад байгаа ажлын id. Шинэ ажил бол хоосон мөр"),
        title: z.string(),
        why: z.string().describe("Яагаад одоо хийх вэ — нэг богино өгүүлбэр"),
        slot: z.string().describe("Санал болгох цаг, жишээ нь '09:00–10:30'. Мэдэхгүй бол хоосон"),
      }),
    )
    .describe("Өнөөдөр хийх ажлууд, хийх дарааллаар (3-6)"),
  suggestions: z
    .array(
      z.object({
        task_id: z.string(),
        action: z.enum(["reprioritize", "reschedule", "reassign", "split", "start", "close"]),
        detail: z.string().describe("Юу өөрчлөх, яагаад — монголоор"),
        priority: z.enum(["urgent", "high", "medium", "low", ""]).describe("reprioritize үед шинэ түвшин, бусад үед хоосон"),
        due_date: z.string().describe("reschedule үед YYYY-MM-DD, бусад үед хоосон"),
        assignee_id: z.string().describe("reassign үед colleagues-ийн id, бусад үед хоосон"),
      }),
    )
    .describe("Ажлыг цэгцлэх санал — нэг товшилтоор хэрэгжүүлж болохуйц. Шаардлагагүй бол хоосон"),
  risks: z.array(z.string()).describe("Эрсдэл, саад, анхаарах зүйл (0-4)"),
});

export type AgentPlan = z.infer<typeof AgentPlanSchema>;
export type AgentSuggestion = AgentPlan["suggestions"][number];
