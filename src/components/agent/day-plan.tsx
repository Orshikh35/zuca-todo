"use client";

import { CalendarClock, Check, CircleAlert, Sparkles } from "lucide-react";
import { Button, PriorityChip } from "@/components/ui";
import type { AgentPlan, AgentSuggestion } from "@/lib/agent/schema";
import { PRIORITIES } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Record<AgentSuggestion["action"], string> = {
  reprioritize: "Ач холбогдол",
  reschedule: "Хугацаа",
  reassign: "Шилжүүлэх",
  split: "Хуваах",
  start: "Эхлүүлэх",
  close: "Хаах",
};

/**
 * AI-ийн өдрийн төлөвлөгөө: товч дүгнэлт, дараалал (шууд дуусгаж болно), нэг товшилтын санал, эрсдэл.
 * «AI туслах» хуудас болон самбар хоёулаа ашиглана.
 */
export function DayPlan({
  plan,
  applied,
  onApplied,
  onOpenTask,
  checkable,
  compact,
}: {
  plan: AgentPlan;
  applied: Set<number>;
  onApplied: (i: number) => void;
  onOpenTask: (t: Task) => void;
  /** Дарааллын ажлыг шууд «дууссан» болгох товч */
  checkable?: boolean;
  compact?: boolean;
}) {
  const { tasks, profileById, updateTask, toast } = useStore();

  async function apply(s: AgentSuggestion, i: number) {
    const t = tasks.find((x) => x.id === s.task_id);
    if (!t) return;
    if (s.action === "reprioritize" && s.priority) await updateTask(t.id, { priority: s.priority });
    else if (s.action === "reschedule" && /^\d{4}-\d{2}-\d{2}$/.test(s.due_date)) await updateTask(t.id, { due_date: s.due_date, planned_month: s.due_date.slice(0, 7) });
    else if (s.action === "reassign" && s.assignee_id) await updateTask(t.id, { assignee_id: s.assignee_id });
    else if (s.action === "start") await updateTask(t.id, { status: "in_progress" });
    else if (s.action === "close") await updateTask(t.id, { status: "done" });
    else return onOpenTask(t);
    onApplied(i);
    toast("Санал хэрэгжлээ");
  }

  const focus = plan.focus.map((f) => ({ f, t: tasks.find((x) => x.id === f.task_id) }));
  const doneCount = focus.filter((x) => x.t?.status === "done").length;
  const pending = plan.suggestions.map((s, i) => ({ s, i })).filter(({ i }) => !compact || !applied.has(i));

  return (
    <div className="space-y-5">
      <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
        <Sparkles size={14} className="mr-1.5 inline text-brand-600" />
        {plan.summary}
      </p>

      {focus.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center justify-between text-xs font-semibold tracking-wide text-zinc-500 uppercase">
            Өнөөдрийн дараалал
            {checkable && doneCount > 0 && (
              <span className="tabular font-medium normal-case text-emerald-600">
                {doneCount}/{focus.length} дууссан
              </span>
            )}
          </h3>
          <ol className="space-y-1.5">
            {focus.map(({ f, t }, i) => {
              const done = t?.status === "done";
              return (
                <li key={i} className="flex items-start gap-3 rounded-lg border border-zinc-100 px-3 py-2.5 hover:bg-zinc-50">
                  {checkable && t ? (
                    <button
                      title={done ? "Дахин нээх" : "Дууссан болгох"}
                      onClick={() => void updateTask(t.id, { status: done ? "todo" : "done" })}
                      className={cn(
                        "mt-px grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border transition",
                        done
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-zinc-300 text-[11px] font-semibold text-zinc-500 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600",
                      )}
                    >
                      {done ? <Check size={13} strokeWidth={3} /> : i + 1}
                    </button>
                  ) : (
                    <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white dark:bg-white dark:text-neutral-900">{i + 1}</span>
                  )}
                  <button onClick={() => t && onOpenTask(t)} disabled={!t} className="min-w-0 flex-1 text-left enabled:cursor-pointer">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cn("text-sm font-medium", done && "text-zinc-400 line-through")}>{f.title}</span>
                      {t && !done && <PriorityChip priority={t.priority} compact />}
                    </div>
                    {!(compact && done) && <div className="mt-0.5 text-xs text-zinc-500">{f.why}</div>}
                  </button>
                  {f.slot && (
                    <span className="tabular inline-flex shrink-0 items-center gap-1 text-xs text-zinc-500">
                      <CalendarClock size={12} /> {f.slot}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {pending.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Ажлыг цэгцлэх санал</h3>
          <ul className="space-y-1.5">
            {pending.map(({ s, i }) => {
              const t = tasks.find((x) => x.id === s.task_id);
              const done = applied.has(i);
              return (
                <li key={i} className="flex items-start gap-3 rounded-lg bg-zinc-50 px-3 py-2.5">
                  <span className="mt-0.5 shrink-0 rounded bg-surface px-1.5 py-px text-[10px] font-semibold text-zinc-600 ring-1 ring-zinc-200">{ACTION_LABEL[s.action]}</span>
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="truncate font-medium">{t?.title}</div>
                    <div className="text-xs text-zinc-500">
                      {s.detail}
                      {s.action === "reprioritize" && s.priority && <> → <b>{PRIORITIES.find((p) => p.id === s.priority)?.label}</b></>}
                      {s.action === "reschedule" && s.due_date && <> → <b>{s.due_date}</b></>}
                      {s.action === "reassign" && s.assignee_id && <> → <b>{profileById.get(s.assignee_id)?.full_name}</b></>}
                    </div>
                  </div>
                  <Button size="sm" variant={done ? "ghost" : "secondary"} disabled={done || !t} onClick={() => void apply(s, i)}>
                    {done ? <><Check size={13} /> Хийгдсэн</> : s.action === "split" ? "Нээх" : "Хэрэгжүүлэх"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {plan.risks.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold tracking-wide text-zinc-500 uppercase">Анхаарах</h3>
          <ul className="space-y-1 text-sm text-amber-900">
            {plan.risks.map((r, i) => (
              <li key={i} className="flex gap-2">
                <CircleAlert size={14} className="mt-0.5 shrink-0 text-amber-500" /> {r}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
