"use client";

import { AlignLeft, ArrowRightLeft, CalendarClock, Check, FolderKanban, Hand, Tent } from "lucide-react";
import { Avatar, PriorityChip } from "@/components/ui";
import { useStore } from "@/lib/data/store";
import type { Task } from "@/lib/types";
import { cn, dueLabel } from "@/lib/utils";

/** Картын өнгөт туяа — яаралтай байдлаар (дууссан бол ногоон) */
const TINT: Record<Task["priority"] | "done", string> = {
  urgent: "from-rose-500/20",
  high: "from-orange-400/18",
  medium: "from-sky-400/15",
  low: "from-zinc-400/10",
  done: "from-emerald-400/18",
};

export function TaskCard({
  task,
  onOpen,
  overlay,
  showStatus,
  hideProject,
}: {
  task: Task;
  onOpen?: (t: Task) => void;
  overlay?: boolean;
  showStatus?: boolean;
  /** Төслийн хуудсан дотор төслийн нэрийг давтахгүй */
  hideProject?: boolean;
}) {
  const { me, profileById, campById, deptById, projectById, updateTask } = useStore();
  const done = task.status === "done";
  const due = dueLabel(task.due_date);
  const overdue = !done && due?.tone === "overdue";
  const camp = task.camp_id ? campById.get(task.camp_id) : undefined;
  const from = task.from_department_id ? deptById.get(task.from_department_id) : undefined;
  const to = task.department_id ? deptById.get(task.department_id) : undefined;
  const project = !hideProject && task.project_id ? projectById.get(task.project_id) : undefined;

  return (
    <article
      onClick={() => !overlay && onOpen?.(task)}
      className={cn(
        "raised group relative cursor-grab overflow-hidden rounded-[1.25rem] p-3.5 transition select-none",
        overdue && "ring-1 ring-red-500/60",
        !overlay && "hover:-translate-y-0.5",
        done && "opacity-70",
      )}
    >
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent", TINT[done ? "done" : task.priority])} />
      <div className="relative flex items-start gap-2">
        <button
          title={done ? "Дахин нээх" : "Дууссан болгох"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            void updateTask(task.id, { status: done ? "todo" : "done" });
          }}
          className={cn(
            "mt-px flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition",
            done ? "border-transparent bg-[#c6f36b] text-neutral-900" : "border-zinc-300 text-transparent hover:border-emerald-500 hover:text-emerald-500",
          )}
        >
          <Check size={11} strokeWidth={3} />
        </button>
        <h4 className={cn("flex-1 text-sm leading-snug font-medium text-zinc-900", done && "text-zinc-400 line-through")}>
          {task.title}
        </h4>
      </div>

      {from && (
        <div className="relative mt-2 flex items-center gap-1 truncate text-[11px] font-medium text-sky-700">
          <ArrowRightLeft size={11} className="shrink-0" />
          <span className="truncate">
            {from.name} → {to?.name ?? "?"}
          </span>
        </div>
      )}

      {project && (
        <div className="relative mt-2 flex items-center gap-1 truncate text-[11px] font-medium" style={{ color: project.color }}>
          <FolderKanban size={11} className="shrink-0" />
          <span className="truncate">{project.name}</span>
        </div>
      )}

      {camp && (
        <div className="relative mt-2 flex items-center gap-1 truncate text-xs text-zinc-500">
          <Tent size={12} className="shrink-0 text-zinc-400" />
          <span className="truncate">{camp.name}</span>
        </div>
      )}

      {task.tags.length > 0 && (
        <div className="relative mt-2 flex flex-wrap gap-1">
          {task.tags.map((t) => (
            <span key={t} className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-medium text-zinc-600">
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="relative mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <PriorityChip priority={task.priority} />
        {showStatus && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium whitespace-nowrap text-zinc-600">
            {{ todo: "Хийх", in_progress: "Хийж байна", review: "Шалгах", done: "Дууссан" }[task.status]}
          </span>
        )}
        {due && !done && (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px] font-medium whitespace-nowrap",
              due.tone === "overdue" && "text-red-600",
              due.tone === "today" && "text-orange-600",
              due.tone === "soon" && "text-zinc-600",
              due.tone === "later" && "text-zinc-400",
            )}
          >
            <CalendarClock size={12} />
            {due.text}
          </span>
        )}
        {task.description && <AlignLeft size={12} className="text-zinc-300" />}
        {!task.assignee_id && me && !done ? (
          <button
            title="Энэ ажлыг би хариуцъя"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              void updateTask(task.id, { assignee_id: me.id });
            }}
            className="ml-auto inline-flex h-6 cursor-pointer items-center gap-1 rounded-full bg-neutral-900 px-2.5 text-[11px] font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
          >
            <Hand size={11} /> Би авъя
          </button>
        ) : (
          <Avatar profile={task.assignee_id ? profileById.get(task.assignee_id) : null} size={22} className="ml-auto" />
        )}
      </div>
    </article>
  );
}
