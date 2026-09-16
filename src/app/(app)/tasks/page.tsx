"use client";

import { AlertTriangle, Columns3, Flame, Plus, Search, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Board, type BoardColumn } from "@/components/board";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskModal, type TaskDraft } from "@/components/tasks/task-modal";
import { Avatar, Button, PageHeader, Segmented } from "@/components/ui";
import { PRIORITIES, STATUSES } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { addMonths, currentMonthKey, monthLabel } from "@/lib/plan";
import { cn, isOverdue } from "@/lib/utils";

type View = "status" | "priority";

const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-zinc-400",
  in_progress: "bg-brand-500",
  review: "bg-amber-500",
  done: "bg-emerald-500",
};

export default function TasksPage() {
  return (
    <Suspense>
      <TasksInner />
    </Suspense>
  );
}

function TasksInner() {
  const { tasks, profiles, me, updateTask, createTask } = useStore();
  const params = useSearchParams();
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem("tasks-view") as View) || "status";
    } catch {
      return "status";
    }
  });
  const [q, setQ] = useState("");
  // /team → "энэ хүний ажлууд" холбоос ?who=<id> (эсвэл ?who=none) -оор ирнэ
  const [who, setWho] = useState<string | null>(() => params.get("who"));
  const [prio, setPrio] = useState<TaskPriority | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  // Төлөвлөгөө хуудаснаас ?month=YYYY-MM (эсвэл none) -оор ирнэ
  const [month, setMonth] = useState<string>(() => params.get("month") ?? "");
  const [modal, setModal] = useState<{ task?: Task | null; draft?: TaskDraft } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("tasks-view", view);
    } catch {}
  }, [view]);

  useEffect(() => {
    setWho(params.get("who"));
    if (params.get("month")) setMonth(params.get("month")!);
  }, [params]);

  // "N" товч — шинэ ажил
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "n" || e.key === "N" || e.key === "т") {
        e.preventDefault();
        setModal({ draft: {} });
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return tasks.filter((t) => {
      if (view === "priority" && t.status === "done") return false;
      if (who === "none" ? t.assignee_id : who && t.assignee_id !== who) return false;
      if (prio && t.priority !== prio) return false;
      if (month === "none" ? t.planned_month : month && t.planned_month !== month) return false;
      if (overdueOnly && !isOverdue(t.due_date, t.status === "done")) return false;
      if (s && !`${t.title} ${t.description ?? ""} ${t.tags.join(" ")}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [tasks, q, who, prio, overdueOnly, view, month]);

  const columns: BoardColumn[] = useMemo(
    () =>
      view === "status"
        ? STATUSES.map((s) => ({ id: s.id, label: s.label, dot: STATUS_DOT[s.id] }))
        : PRIORITIES.map((p) => ({ id: p.id, label: p.label, dot: p.dot, hint: p.id === "urgent" ? "Өнөөдөр анхаарах" : undefined })),
    [view],
  );

  const getColumn = useCallback((t: Task) => (view === "status" ? t.status : t.priority), [view]);

  const onMove = useCallback(
    (t: Task, to: string, position: number) => {
      void updateTask(t.id, view === "status" ? { status: to as TaskStatus, position } : { priority: to as TaskPriority, position });
    },
    [updateTask, view],
  );

  const open = tasks.filter((t) => t.status !== "done");
  const urgentCount = open.filter((t) => t.priority === "urgent").length;
  const overdueCount = open.filter((t) => isOverdue(t.due_date, false)).length;
  const hasFilter = q || who || prio || overdueOnly || month;
  const thisMonth = currentMonthKey();
  const monthOptions = Array.from(new Set([addMonths(thisMonth, -1), thisMonth, addMonths(thisMonth, 1), addMonths(thisMonth, 2), ...tasks.map((t) => t.planned_month).filter((m): m is string => !!m)])).sort();

  return (
    <>
      <PageHeader
        title="Ажлууд"
        subtitle={
          <>
            {open.length} нээлттэй ·{" "}
            <span className="font-medium text-red-600">{urgentCount} яаралтай</span>
            {overdueCount > 0 && <> · <span className="font-medium text-red-600">{overdueCount} хугацаа хэтэрсэн</span></>}
          </>
        }
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { id: "status", label: "Төлөвөөр", icon: <Columns3 size={15} /> },
                { id: "priority", label: "Яаралтай байдлаар", icon: <Flame size={15} /> },
              ]}
            />
            <Button variant="primary" onClick={() => setModal({ draft: { planned_month: month && month !== "none" ? month : null } })}>
              <Plus size={16} /> Шинэ ажил
              <kbd className="ml-1 hidden rounded bg-white/20 px-1 text-[10px] sm:inline">N</kbd>
            </Button>
          </>
        }
      />

      {/* Шүүлтүүр */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-zinc-400" />
          <input className="field h-9 w-56 pl-8" placeholder="Хайх…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="flex items-center rounded-lg bg-white px-1.5 py-1 ring-1 ring-zinc-200">
          {profiles.filter((p) => p.active).map((p) => (
            <button
              key={p.id}
              onClick={() => setWho(who === p.id ? null : p.id)}
              title={p.full_name}
              className={cn(
                "cursor-pointer rounded-full p-0.5 transition",
                who === p.id ? "ring-2 ring-brand-500" : who ? "opacity-40 hover:opacity-100" : "hover:scale-110",
              )}
            >
              <Avatar profile={p} size={24} />
            </button>
          ))}
          {me && (
            <button
              onClick={() => setWho(who === me.id ? null : me.id)}
              className={cn(
                "ml-1 cursor-pointer rounded-md px-2 py-1 text-xs font-medium",
                who === me.id ? "bg-brand-50 text-brand-700" : "text-zinc-500 hover:bg-zinc-100",
              )}
            >
              Миний
            </button>
          )}
        </div>

        {view === "status" && (
          <div className="flex items-center gap-1">
            {PRIORITIES.map((p) => (
              <button
                key={p.id}
                onClick={() => setPrio(prio === p.id ? null : p.id)}
                className={cn(
                  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ring-1 transition",
                  prio === p.id ? cn(p.chip, "ring-2") : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50",
                )}
              >
                <span className={cn("size-2 rounded-full", p.dot)} />
                {p.label}
              </button>
            ))}
          </div>
        )}

        <select
          className={cn("field h-9 w-auto py-0", month && "border-brand-300 bg-brand-50 text-brand-700")}
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          title="Төлөвлөсөн сараар шүүх"
        >
          <option value="">Бүх сар</option>
          {monthOptions.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m, true)}
              {m === thisMonth ? " (энэ сар)" : ""} · {tasks.filter((t) => t.planned_month === m).length}
            </option>
          ))}
          <option value="none">Төлөвлөөгүй · {tasks.filter((t) => !t.planned_month && t.status !== "done").length}</option>
        </select>

        <button
          onClick={() => setOverdueOnly(!overdueOnly)}
          className={cn(
            "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium ring-1 transition",
            overdueOnly ? "bg-red-50 text-red-700 ring-red-300" : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50",
          )}
        >
          <AlertTriangle size={13} /> Хугацаа хэтэрсэн
        </button>

        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setWho(null);
              setPrio(null);
              setOverdueOnly(false);
              setMonth("");
            }}
          >
            <X size={14} /> Цэвэрлэх
          </Button>
        )}
      </div>

      <Board
        columns={columns}
        items={filtered}
        getColumn={getColumn}
        onMove={onMove}
        columnWidth="w-[300px] xl:w-[calc((100%-3rem)/4)] xl:min-w-[270px]"
        renderCard={(t, { overlay }) => (
          <TaskCard task={t} overlay={overlay} showStatus={view === "priority"} onOpen={(task) => setModal({ task })} />
        )}
        renderColumnFooter={(col) => (
          <QuickAdd
            onAdd={(title) =>
              void createTask({
                title,
                position: Date.now(),
                assignee_id: me?.id ?? null,
                planned_month: month && month !== "none" ? month : null,
                ...(view === "status" ? { status: col as TaskStatus } : { priority: col as TaskPriority }),
              })
            }
          />
        )}
      />

      <TaskModal open={!!modal} task={modal?.task} draft={modal?.draft} onClose={() => setModal(null)} />
    </>
  );
}

function QuickAdd({ onAdd }: { onAdd: (title: string) => void }) {
  const [on, setOn] = useState(false);
  const [v, setV] = useState("");
  if (!on) {
    return (
      <button
        onClick={() => setOn(true)}
        className="flex w-full cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-zinc-500 transition hover:bg-white hover:text-zinc-800"
      >
        <Plus size={15} /> Нэмэх
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (v.trim()) onAdd(v.trim());
        setV("");
      }}
    >
      <input
        autoFocus
        className="field"
        placeholder="Гарчиг бичээд Enter…"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => !v && setOn(false)}
        onKeyDown={(e) => e.key === "Escape" && (setV(""), setOn(false))}
      />
    </form>
  );
}
