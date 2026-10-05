import { HttpError, errorResponse, requireMe } from "@/lib/server/context";
import { notifyAssignee } from "@/lib/server/task-notify";
import type { Task } from "@/lib/types";

/** Апп дээр ажил үүсгэх / хүнд оноох үед хариуцагчид Telegram мэдэгдэл явуулна */
export async function POST(req: Request) {
  try {
    const { sb, me } = await requireMe();
    const { task_id, reason } = (await req.json().catch(() => ({}))) as { task_id?: string; reason?: "created" | "assigned" };
    if (!task_id) throw new HttpError(400, "task_id шаардлагатай");
    // RLS — зөвхөн харах эрхтэй ажлын тухай мэдэгдэнэ
    const { data: task } = await sb.from("tasks").select("*").eq("id", task_id).maybeSingle();
    if (!task) throw new HttpError(404, "Ажил олдсонгүй");
    const sent = await notifyAssignee(sb, task as Task, { actorId: me.id, actorName: me.full_name, reason: reason === "assigned" ? "assigned" : "created" });
    return Response.json({ sent });
  } catch (e) {
    return errorResponse(e);
  }
}
