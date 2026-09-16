"use client";

import { AlignLeft, CalendarClock, Check, Tent } from "lucide-react";
import { Avatar, PriorityChip } from "@/components/ui";
import { useStore } from "@/lib/data/store";
import type { Task } from "@/lib/types";
import { cn, dueLabel } from "@/lib/utils";

const edge: Record<Task["priority"], string> = {
  urgent: "before:bg-red-500",
  high: "before:bg-orange-400",
  medium: "before:bg-sky-400",
  low: "before:bg-zinc-300",
};

export function TaskCard({
  task,
  onOpen,
  overlay,
  showStatus,
}: {
  task: Task;
  onOpen?: (t: Task) => void;
  overlay?: boolean;
  showStatus?: boolean;
}) {
  const { profileById, campById, updateTask } = useStore();
  const done = task.status === "done";
  const due = dueLabel(task.due_date);
  const overdue = !done && due?.tone === "overdue";
  const camp = task.camp_id ? campById.get(task.camp_id) : undefined;

  return (
    <article
      onClick={() => !overlay && onOpen?.(task)}
      className={cn(
        "group relative cursor-grab overflow-hidden rounded-xl border bg-white p-3 pl-3.5 shadow-card transition select-none",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
        edge[task.priority],
        overdue ? "border-red-200" : "border-zinc-200/80",
        !overlay && "hover:-translate-y-px hover:border-zinc-300 hover:shadow-md",
        done && "bg-zinc-50/80",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          title={done ? "Дахин нээх" : "Дууссан болгох"}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            void updateTask(task.id, { status: done ? "todo" : "done" });
          }}
          className={cn(
            "mt-0.5 flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border transition",
            done ? "border-emerald-500 bg-emerald-500 text-white" : "border-zinc-300 text-transparent hover:border-emerald-500 hover:text-emerald-500",
          )}
        >
          <Check size={10} strokeWidth={3} />
        </button>
        <h4 className={cn("flex-1 text-[13.5px] leading-snug font-medium text-zinc-900", done && "text-zinc-400 line-through")}>
          {task.title}
        </h4>
      </div>

      {camp && (
        <div className="mt-2 flex items-center gap-1 truncate text-xs text-zinc-500">
          <Tent size={12} className="shrink-0 text-zinc-400" />
          <span className="truncate">{camp.name}</span>
        </div>
      )}

      {task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((t) => (
            <span key={t} className="rounded bg-zinc-100 px-1.5 py-px text-[10.5px] font-medium text-zinc-600">
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <PriorityChip priority={task.priority} />
        {showStatus && (
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-zinc-600">
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
        <Avatar profile={task.assignee_id ? profileById.get(task.assignee_id) : null} size={22} className="ml-auto" />
      </div>
    </article>
  );
}
