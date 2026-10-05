"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Modal, Select } from "@/components/ui";
import { PRIORITIES, STATUSES } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import type { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { cn, relativeTime } from "@/lib/utils";

export interface TaskDraft {
  status?: TaskStatus;
  priority?: TaskPriority;
  camp_id?: string | null;
  title?: string;
  planned_month?: string | null;
  department_id?: string | null;
  from_department_id?: string | null;
  assignee_id?: string | null;
  description?: string | null;
}

export function TaskModal({
  open,
  task,
  draft,
  onClose,
}: {
  open: boolean;
  task?: Task | null;
  draft?: TaskDraft;
  onClose: () => void;
}) {
  const { profiles, camps, departments, me, createTask, updateTask, deleteTask, profileById, deptById, toast } = useStore();
  const [f, setF] = useState(() => init());

  function init() {
    return {
      title: task?.title ?? draft?.title ?? "",
      description: task?.description ?? draft?.description ?? "",
      status: task?.status ?? draft?.status ?? ("todo" as TaskStatus),
      priority: task?.priority ?? draft?.priority ?? ("medium" as TaskPriority),
      assignee_id: task ? task.assignee_id ?? "" : draft?.assignee_id !== undefined ? draft.assignee_id ?? "" : me?.id ?? "",
      department_id: task ? task.department_id ?? "" : draft?.department_id ?? me?.department_id ?? "",
      from_department_id: task?.from_department_id ?? draft?.from_department_id ?? "",
      camp_id: task?.camp_id ?? draft?.camp_id ?? "",
      due_date: task?.due_date ?? "",
      planned_month: task?.planned_month ?? draft?.planned_month ?? "",
      tags: task?.tags.join(", ") ?? "",
    };
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setF(init()), [open, task?.id]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!f.title.trim()) return;
    const payload = {
      title: f.title.trim(),
      description: f.description.trim() || null,
      status: f.status,
      priority: f.priority,
      assignee_id: f.assignee_id || null,
      camp_id: f.camp_id || null,
      department_id: f.department_id || null,
      from_department_id: f.from_department_id && f.from_department_id !== f.department_id ? f.from_department_id : null,
      due_date: f.due_date || null,
      // Сар сонгоогүй ч хугацаатай бол тэр сарын төлөвлөгөөнд орно
      planned_month: f.planned_month || (f.due_date ? f.due_date.slice(0, 7) : null),
      tags: f.tags
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean),
    };
    if (task) {
      await updateTask(task.id, payload);
      toast("Хадгалагдлаа");
    } else {
      await createTask({ ...payload, position: Date.now() });
      toast("Шинэ ажил нэмэгдлээ");
    }
    onClose();
  }

  const sortedCamps = [...camps].sort((a, b) => a.name.localeCompare(b.name, "mn"));

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={task ? "Ажил засах" : "Шинэ ажил"}
      width="max-w-xl"
      footer={
        <>
          {task && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                void deleteTask(task.id);
                onClose();
              }}
            >
              <Trash2 size={15} /> Устгах
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Болих
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!f.title.trim()}>
            {task ? "Хадгалах" : "Нэмэх"} <kbd className="ml-1 rounded bg-white/20 px-1 text-[10px]">⌘↵</kbd>
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void save();
        }}
      >
        <input
          autoFocus
          className="w-full border-0 bg-transparent p-0 text-lg font-semibold outline-none placeholder:text-zinc-300"
          placeholder="Юу хийх вэ?"
          value={f.title}
          onChange={(e) => set("title", e.target.value)}
        />
        <textarea
          className="field min-h-20 resize-y"
          placeholder="Дэлгэрэнгүй тайлбар (заавал биш)"
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
        />

        <div>
          <span className="label">Яаралтай байдал</span>
          <div className="grid grid-cols-4 gap-1.5">
            {PRIORITIES.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => set("priority", p.id)}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition",
                  f.priority === p.id ? cn("ring-2 ring-inset", p.chip, "border-transparent") : "border-zinc-200 text-zinc-500 hover:bg-zinc-50",
                )}
              >
                <span className={cn("size-2 rounded-full", p.dot)} />
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Гүйцэтгэх хэлтэс</label>
            <Select className="field" value={f.department_id} onChange={(e) => set("department_id", e.target.value)}>
              <option value="">— Хэлтэсгүй —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label">Хариуцагч</label>
            <Select
              className="field"
              value={f.assignee_id}
              onChange={(e) => {
                const id = e.target.value;
                const p = profileById.get(id);
                setF((prev) => ({
                  ...prev,
                  assignee_id: id,
                  // Хэлтэс сонгоогүй бол хариуцагчийн хэлтсийг авна
                  department_id: prev.department_id || p?.department_id || "",
                }));
              }}
            >
              <option value="">— Хариуцагчгүй —</option>
              {[...departments.map((d) => ({ id: d.id, name: d.name })), { id: "", name: "Хэлтэсгүй" }].map((g) => {
                const people = profiles.filter(
                  (p) => (p.department_id ?? "") === g.id && (p.active || p.id === task?.assignee_id),
                );
                if (!people.length) return null;
                return (
                  <optgroup key={g.id || "none"} label={g.name}>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                        {p.job_title ? ` · ${p.job_title}` : ""}
                        {p.id === me?.id ? " (би)" : ""}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </Select>
          </div>
          <div>
            <label className="label">Төлөв</label>
            <Select className="field" value={f.status} onChange={(e) => set("status", e.target.value as TaskStatus)}>
              {STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label">Хүсэлт гаргасан хэлтэс</label>
            <Select className="field" value={f.from_department_id} onChange={(e) => set("from_department_id", e.target.value)}>
              <option value="">— Дотоод ажил —</option>
              {departments
                .filter((d) => d.id !== f.department_id)
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <label className="label">Дуусах хугацаа</label>
            <input type="date" className="field" value={f.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </div>
          <div>
            <label className="label">Төлөвлөсөн сар</label>
            <input type="month" className="field" value={f.planned_month} onChange={(e) => set("planned_month", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Холбоотой зуслан</label>
            <Select className="field" value={f.camp_id} onChange={(e) => set("camp_id", e.target.value)}>
              <option value="">— Байхгүй —</option>
              {sortedCamps.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <div>
          <label className="label">Шошго (таслалаар)</label>
          <input className="field" placeholder="маркетинг, гэрээ" value={f.tags} onChange={(e) => set("tags", e.target.value)} />
        </div>

        {f.from_department_id && f.department_id && f.from_department_id !== f.department_id && (
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
            <b>{deptById.get(f.from_department_id)?.name}</b> → <b>{deptById.get(f.department_id)?.name}</b> хэлтэс хоорондын хүсэлт.
            Хүлээн авагч хэлтсийн дарга хариуцагч томилно.
          </p>
        )}

        {task && (
          <p className="text-[11px] text-zinc-400">
            {task.created_by && profileById.get(task.created_by)?.full_name} үүсгэсэн · {relativeTime(task.created_at)} · сүүлд{" "}
            {relativeTime(task.updated_at)} засварласан
          </p>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
