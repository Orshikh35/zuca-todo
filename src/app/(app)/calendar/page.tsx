"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarDays, ChevronLeft, ChevronRight, Inbox, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { pillField } from "@/components/bento";
import { TaskModal, type TaskDraft } from "@/components/tasks/task-modal";
import { Avatar, Button, Card, PageHeader, Select } from "@/components/ui";
import { PRIORITIES } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { isAdmin } from "@/lib/permissions";
import { addMonths, currentMonthKey, monthLabel, parseMonth } from "@/lib/plan";
import type { Task } from "@/lib/types";
import { addDays, cn, isOverdue, toISODate, todayISO } from "@/lib/utils";

const WEEKDAYS = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];
const MAX_PER_DAY = 3;
/** «Хугацаагүй» самбар руу чирвэл хугацааг арилгана */
const NO_DATE = "nodate";

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarInner />
    </Suspense>
  );
}

function CalendarInner() {
  const { me, tasks, profiles, profileById, projects, updateTask } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const admin = isAdmin(me);
  // Ажилтан зөвхөн өөрийн календарийг харна; админ хэнийг ч, эсвэл бүх багийг
  const who = admin ? params.get("who") ?? me?.id ?? "" : me?.id ?? "";
  const [month, setMonth] = useState(currentMonthKey());
  const [project, setProject] = useState("");
  const [modal, setModal] = useState<{ task?: Task | null; draft?: TaskDraft } | null>(null);
  const [dragging, setDragging] = useState<Task | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const person = who && who !== "all" ? profileById.get(who) : null;
  const mine = useMemo(
    () => tasks.filter((t) => (who === "all" || t.assignee_id === who) && (!project || t.project_id === project)),
    [tasks, who, project],
  );

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of mine) {
      if (!t.due_date) continue;
      const list = m.get(t.due_date) ?? [];
      list.push(t);
      m.set(t.due_date, list);
    }
    const rank = Object.fromEntries(PRIORITIES.map((p, i) => [p.id, i]));
    for (const list of m.values()) list.sort((a, b) => Number(a.status === "done") - Number(b.status === "done") || rank[a.priority] - rank[b.priority]);
    return m;
  }, [mine]);

  const undated = mine.filter((t) => !t.due_date && t.status !== "done");
  const overdue = mine.filter((t) => isOverdue(t.due_date, t.status === "done"));

  // Даваа гарагаас эхэлсэн 7 хоногийн сүлжээ
  const { year, month: m } = parseMonth(month);
  const first = new Date(year, m - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, m, 0).getDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const start = addDays(first, -offset);
  const days = Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
  const today = todayISO();

  const inMonth = mine.filter((t) => t.due_date?.startsWith(month));
  const doneInMonth = inMonth.filter((t) => t.status === "done").length;

  function onDragStart(e: DragStartEvent) {
    setDragging(tasks.find((t) => t.id === e.active.id) ?? null);
  }
  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const t = tasks.find((x) => x.id === e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;
    if (!t || !over) return;
    const date = over === NO_DATE ? null : over;
    if (date === t.due_date) return;
    void updateTask(t.id, { due_date: date, planned_month: date ? date.slice(0, 7) : t.planned_month });
  }

  const newOn = (date: string) =>
    setModal({ draft: { due_date: date, planned_month: date.slice(0, 7), assignee_id: who && who !== "all" ? who : me?.id ?? null, project_id: project || null } });

  return (
    <>
      <PageHeader
        title="Календарь"
        subtitle={
          who === "all" ? "Бүх багийн ажил хугацаагаараа" : person ? `${person.full_name}-ийн ажил хугацаагаараа` : "Ажил хугацаагаараа"
        }
        actions={
          <>
            {admin && (
              <Select className={pillField} value={who} onChange={(e) => router.replace(`/calendar?who=${e.target.value}`)}>
                <option value="all">Бүх баг</option>
                {profiles
                  .filter((p) => p.active)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name}
                      {p.id === me?.id ? " (би)" : ""}
                    </option>
                  ))}
              </Select>
            )}
            {projects.length > 0 && (
              <Select className={pillField} value={project} onChange={(e) => setProject(e.target.value)}>
                <option value="">Бүх төсөл</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
          </>
        }
      />

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
          <Card className="min-w-0 p-3 sm:p-5">
            {/* Сар солих */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {person && <Avatar profile={person} size={32} />}
              <h2 className="text-xl font-semibold tracking-tight">{monthLabel(month, true)}</h2>
              <span className="text-xs text-zinc-500">
                · {inMonth.length} ажил, {doneInMonth} дууссан
              </span>
              <div className="ml-auto flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, -1))} aria-label="Өмнөх сар">
                  <ChevronLeft size={16} />
                </Button>
                <Button size="sm" onClick={() => setMonth(currentMonthKey())}>
                  Өнөөдөр
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setMonth(addMonths(month, 1))} aria-label="Дараагийн сар">
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>

            {/* ── Сарын сүлжээ (таблет, компьютер) ── */}
            <div className="hidden sm:block">
              <div className="grid grid-cols-7 gap-1.5 pb-1.5">
                {WEEKDAYS.map((d, i) => (
                  <div key={d} className={cn("px-2 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase", i >= 5 && "text-zinc-300")}>
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {days.map((d) => {
                  const iso = toISODate(d);
                  const list = byDay.get(iso) ?? [];
                  const open = expanded === iso;
                  return (
                    <DayCell
                      key={iso}
                      iso={iso}
                      day={d.getDate()}
                      outside={d.getMonth() !== m - 1}
                      isToday={iso === today}
                      weekend={d.getDay() === 0 || d.getDay() === 6}
                      onAdd={() => newOn(iso)}
                    >
                      {(open ? list : list.slice(0, MAX_PER_DAY)).map((t) => (
                        <TaskChip key={t.id} task={t} showAvatar={who === "all"} onOpen={() => setModal({ task: t })} />
                      ))}
                      {list.length > MAX_PER_DAY && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(open ? null : iso);
                          }}
                          className="cursor-pointer px-1.5 text-left text-[11px] font-medium text-zinc-500 hover:text-zinc-900"
                        >
                          {open ? "Хураах" : `+${list.length - MAX_PER_DAY} бусад`}
                        </button>
                      )}
                    </DayCell>
                  );
                })}
              </div>
            </div>

            {/* ── Гар утас: өдрөөр жагсаалт ── */}
            <div className="space-y-3 sm:hidden">
              {days
                .filter((d) => d.getMonth() === m - 1 && byDay.has(toISODate(d)))
                .map((d) => {
                  const iso = toISODate(d);
                  return (
                    <div key={iso}>
                      <div className={cn("mb-1 text-xs font-semibold", iso === today ? "text-brand-600" : "text-zinc-500")}>
                        {d.getMonth() + 1}/{d.getDate()} · {WEEKDAYS[(d.getDay() + 6) % 7]}
                        {iso === today && " · Өнөөдөр"}
                      </div>
                      <div className="space-y-1">
                        {byDay.get(iso)!.map((t) => (
                          <TaskChip key={t.id} task={t} showAvatar={who === "all"} onOpen={() => setModal({ task: t })} large />
                        ))}
                      </div>
                    </div>
                  );
                })}
              {!inMonth.length && <p className="py-8 text-center text-sm text-zinc-400">Энэ сард хугацаатай ажил алга</p>}
            </div>
          </Card>

          {/* ── Хажуугийн самбар: хэтэрсэн, хугацаагүй ── */}
          <div className="space-y-4">
            {overdue.length > 0 && (
              <Card className="p-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-red-600">Хэтэрсэн · {overdue.length}</h3>
                <div className="space-y-1">
                  {overdue.map((t) => (
                    <TaskChip key={t.id} task={t} showDate showAvatar={who === "all"} onOpen={() => setModal({ task: t })} large />
                  ))}
                </div>
              </Card>
            )}
            <NoDatePanel>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <Inbox size={14} className="text-zinc-400" /> Хугацаагүй · {undated.length}
                </h3>
                <button
                  onClick={() => setModal({ draft: { assignee_id: who && who !== "all" ? who : me?.id ?? null, project_id: project || null } })}
                  className="grid size-7 cursor-pointer place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
                  aria-label="Ажил нэмэх"
                >
                  <Plus size={15} />
                </button>
              </div>
              <p className="mb-2 text-[11px] text-zinc-500">Календарийн өдөр рүү чирж хугацаа тавина</p>
              <div className="space-y-1">
                {undated.map((t) => (
                  <TaskChip key={t.id} task={t} showAvatar={who === "all"} onOpen={() => setModal({ task: t })} large />
                ))}
                {!undated.length && <p className="py-3 text-center text-xs text-zinc-400">Бүх ажил хугацаатай 👍</p>}
              </div>
            </NoDatePanel>
          </div>
        </div>

        <DragOverlay dropAnimation={null}>{dragging && <TaskChip task={dragging} overlay large />}</DragOverlay>
      </DndContext>

      {!admin && (
        <p className="mt-4 flex items-center gap-1.5 text-xs text-zinc-400">
          <CalendarDays size={13} /> Өөрт оноогдсон ажлууд харагдана
        </p>
      )}

      {modal && <TaskModal open task={modal.task} draft={modal.draft} onClose={() => setModal(null)} />}
    </>
  );
}

function DayCell({
  iso,
  day,
  outside,
  isToday,
  weekend,
  onAdd,
  children,
}: {
  iso: string;
  day: number;
  outside: boolean;
  isToday: boolean;
  weekend: boolean;
  onAdd: () => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: iso });
  return (
    <div
      ref={setNodeRef}
      onClick={onAdd}
      title="Энэ өдөрт ажил нэмэх"
      className={cn(
        "group flex min-h-28 cursor-pointer flex-col gap-1 rounded-2xl p-1.5 transition",
        outside ? "bg-transparent" : weekend ? "bg-zinc-100/60" : "bg-zinc-100",
        isOver && "ring-2 ring-brand-500",
        !isOver && "hover:ring-1 hover:ring-zinc-300",
      )}
    >
      <div className="flex items-center justify-between px-1">
        <span
          className={cn(
            "tabular grid size-6 place-items-center rounded-full text-xs font-medium",
            isToday ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : outside ? "text-zinc-300" : "text-zinc-600",
          )}
        >
          {day}
        </span>
        <Plus size={12} className="text-zinc-400 opacity-0 transition group-hover:opacity-100" />
      </div>
      {children}
    </div>
  );
}

function NoDatePanel({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: NO_DATE });
  return (
    <div ref={setNodeRef} className={cn("glass rounded-[1.75rem] p-4 transition", isOver && "ring-2 ring-brand-500")}>
      {children}
    </div>
  );
}

/** Календарь дээрх ажлын жижиг мөр — чирж өөр өдөр рүү зөөнө */
function TaskChip({
  task: t,
  onOpen,
  showAvatar,
  showDate,
  overlay,
  large,
}: {
  task: Task;
  onOpen?: () => void;
  showAvatar?: boolean;
  showDate?: boolean;
  overlay?: boolean;
  large?: boolean;
}) {
  const { projectById, profileById } = useStore();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: t.id, disabled: overlay });
  const done = t.status === "done";
  const late = isOverdue(t.due_date, done);
  const project = t.project_id ? projectById.get(t.project_id) : undefined;
  const prio = PRIORITIES.find((p) => p.id === t.priority)!;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      {...(overlay ? {} : listeners)}
      {...(overlay ? {} : attributes)}
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.();
      }}
      title={`${t.title}${project ? ` · ${project.name}` : ""}`}
      className={cn(
        "raised flex min-w-0 cursor-grab items-center gap-1.5 rounded-lg border-l-[3px] px-1.5 text-left select-none",
        large ? "py-1.5 text-[13px]" : "py-1 text-[11.5px]",
        done && "opacity-50",
        late && "ring-1 ring-red-500/60",
        isDragging && "opacity-30",
        overlay && "shadow-lift cursor-grabbing",
      )}
      style={{ borderLeftColor: project?.color ?? "transparent" }}
    >
      {!project && <span className={cn("size-1.5 shrink-0 rounded-full", prio.dot)} />}
      <span className={cn("min-w-0 flex-1 truncate font-medium", done && "line-through")}>{t.title}</span>
      {showDate && t.due_date && <span className="shrink-0 text-[10.5px] text-red-600">{t.due_date.slice(5)}</span>}
      {showAvatar && <Avatar profile={t.assignee_id ? profileById.get(t.assignee_id) : null} size={16} />}
    </div>
  );
}
