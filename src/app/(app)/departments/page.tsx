"use client";

import { AlertTriangle, ArrowRight, Building2, Crown, Inbox, Pencil, Plus, Send, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DepartmentModal } from "@/components/org/department-modal";
import { TaskModal, type TaskDraft } from "@/components/tasks/task-modal";
import { Avatar, Button, Card, Drawer, Empty, PageHeader, PriorityChip, Progress } from "@/components/ui";
import { PRIORITY_RANK, ROLES } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { canManageDept, canManageOrg, taskDeptId } from "@/lib/permissions";
import { inRange } from "@/lib/report";
import type { Department, Task } from "@/lib/types";
import { addDays, cn, dueLabel, isOverdue } from "@/lib/utils";

export default function DepartmentsPage() {
  const { departments, profiles, tasks, approvals, me, profileById, deptById } = useStore();
  const [edit, setEdit] = useState<{ dept: Department | null } | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [taskModal, setTaskModal] = useState<{ task?: Task | null; draft?: TaskDraft } | null>(null);

  const since = addDays(new Date(), -30);
  const stats = useMemo(() => {
    const m = new Map<string, { open: number; overdue: number; done30: number; incoming: number; outgoing: number; pending: number; members: number }>();
    for (const d of departments) {
      const own = tasks.filter((t) => taskDeptId(t, profileById) === d.id);
      const o = own.filter((t) => t.status !== "done");
      m.set(d.id, {
        open: o.length,
        overdue: o.filter((t) => isOverdue(t.due_date, false)).length,
        done30: own.filter((t) => inRange(t.completed_at, since)).length,
        incoming: o.filter((t) => t.from_department_id && t.from_department_id !== d.id).length,
        outgoing: tasks.filter((t) => t.status !== "done" && t.from_department_id === d.id).length,
        pending: approvals.filter((a) => a.status === "pending" && a.department_id === d.id).length,
        members: profiles.filter((p) => p.active && p.department_id === d.id).length,
      });
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departments, tasks, approvals, profiles, profileById]);

  // Шатлалаар эрэмбэлнэ: эх → хүүхдүүд
  const tree = useMemo(() => {
    const out: { d: Department; depth: number }[] = [];
    const ids = new Set(departments.map((d) => d.id));
    const walk = (parent: string | null, depth: number) =>
      departments
        .filter((d) => (parent ? d.parent_id === parent : !d.parent_id || !ids.has(d.parent_id)))
        .forEach((d) => {
          out.push({ d, depth });
          walk(d.id, depth + 1);
        });
    walk(null, 0);
    return out;
  }, [departments]);

  const unassigned = profiles.filter((p) => p.active && !p.department_id);
  const matrix = useMemo(
    () =>
      departments.map((from) => ({
        from,
        cells: departments.map((to) =>
          from.id === to.id ? null : tasks.filter((t) => t.status !== "done" && t.from_department_id === from.id && t.department_id === to.id).length,
        ),
      })),
    [departments, tasks],
  );
  const hasCross = matrix.some((r) => r.cells.some((c) => c));
  const opened = open ? departments.find((d) => d.id === open) : null;

  function requestTo(d: Department) {
    setTaskModal({
      draft: {
        department_id: d.id,
        from_department_id: me?.department_id && me.department_id !== d.id ? me.department_id : null,
        assignee_id: d.head_id,
        priority: "medium",
      },
    });
  }

  return (
    <>
      <PageHeader
        title="Хэлтсүүд"
        subtitle={`${departments.length} хэлтэс · ${profiles.filter((p) => p.active).length} ажилтан · байгууллагын бүтэц ба гүйцэтгэл`}
        actions={
          canManageOrg(me) && (
            <Button variant="primary" onClick={() => setEdit({ dept: null })}>
              <Plus size={16} /> Хэлтэс нэмэх
            </Button>
          )
        }
      />

      {unassigned.length > 0 && (
        <Link
          href="/team"
          className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 transition hover:bg-amber-100"
        >
          <AlertTriangle size={16} className="shrink-0" />
          <b className="tabular">{unassigned.length}</b> ажилтан хэлтэст хуваарилагдаагүй: {unassigned.map((p) => p.full_name).join(", ")}
        </Link>
      )}

      {!departments.length ? (
        <Card>
          <Empty icon={<Building2 size={32} />} title="Хэлтэс үүсгээгүй байна" hint="«Хэлтэс нэмэх» дарж байгууллагын бүтцээ оруулна уу" />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {tree.map(({ d, depth }) => {
            const s = stats.get(d.id)!;
            const head = d.head_id ? profileById.get(d.head_id) : null;
            const members = profiles.filter((p) => p.active && p.department_id === d.id);
            const flow = s.done30 + s.open ? Math.round((s.done30 / (s.done30 + s.open)) * 100) : null;
            return (
              <Card key={d.id} className="relative overflow-hidden">
                <span className="absolute inset-y-0 left-0 w-1" style={{ background: d.color }} />
                <button onClick={() => setOpen(d.id)} className="block w-full cursor-pointer p-5 pl-6 text-left hover:bg-zinc-50/60">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-[15px] font-semibold">{d.name}</h2>
                        {d.code && <span className="rounded bg-zinc-100 px-1.5 text-[10px] font-semibold text-zinc-500">{d.code}</span>}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">
                        {depth > 0 && d.parent_id && <span className="text-zinc-400">{deptById.get(d.parent_id)?.name} › </span>}
                        {d.description || "—"}
                      </p>
                    </div>
                    <div className="flex -space-x-1.5">
                      {members.slice(0, 5).map((p) => (
                        <Avatar key={p.id} profile={p} size={24} />
                      ))}
                      {members.length > 5 && <span className="grid size-6 place-items-center rounded-full bg-zinc-100 text-[10px] font-semibold text-zinc-500 ring-2 ring-surface-solid">+{members.length - 5}</span>}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
                    <Crown size={13} className={head ? "text-amber-500" : "text-zinc-300"} />
                    {head ? <span className="font-medium text-zinc-700">{head.full_name}</span> : <span className="text-amber-700">Дарга томилоогүй</span>}
                    <span className="text-zinc-300">·</span>
                    <Users size={13} /> {s.members}
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                    <Mini label="Нээлттэй" value={s.open} />
                    <Mini label="Хэтэрсэн" value={s.overdue} tone={s.overdue ? "text-red-600" : undefined} />
                    <Mini label="Ирсэн хүсэлт" value={s.incoming} tone={s.incoming ? "text-sky-700" : undefined} />
                    <Mini label="Батлах" value={s.pending} tone={s.pending ? "text-amber-700" : undefined} />
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex-1">
                      <Progress value={flow ?? 0} tone={flow == null ? "bg-zinc-200" : flow >= 60 ? "bg-emerald-500" : flow >= 35 ? "bg-amber-500" : "bg-red-500"} />
                    </div>
                    <span className="tabular text-xs text-zinc-500" title="Сүүлийн 30 хоногт дууссан / (дууссан + нээлттэй)">
                      {flow == null ? "—" : `${flow}%`} · 30 хоногт {s.done30} дууссан
                    </span>
                  </div>
                </button>
                <div className="flex items-center gap-1 border-t border-zinc-100 px-4 py-2">
                  <Button size="sm" variant="ghost" onClick={() => requestTo(d)}>
                    <Send size={13} /> Хүсэлт илгээх
                  </Button>
                  <Link href={`/tasks?dept=${d.id}`} className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-zinc-600 hover:bg-zinc-100">
                    Ажлууд <ArrowRight size={12} />
                  </Link>
                  {canManageDept(me, d) && (
                    <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setEdit({ dept: d })}>
                      <Pencil size={13} /> Засах
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {hasCross && (
        <Card className="mt-6">
          <div className="px-5 pt-4 pb-3">
            <h2 className="text-[15px] font-semibold">Хэлтэс хоорондын нээлттэй хүсэлт</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Мөр — хүсэлт гаргасан, багана — гүйцэтгэж буй хэлтэс</p>
          </div>
          <div className="scroll-thin overflow-x-auto px-5 pb-5">
            <table className="text-sm">
              <thead>
                <tr>
                  <th />
                  {departments.map((d) => (
                    <th key={d.id} className="px-2 pb-2 text-xs font-medium text-zinc-500">
                      <span className="inline-flex items-center gap-1">
                        <span className="size-2 rounded-full" style={{ background: d.color }} />
                        {d.code || d.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map(({ from, cells }) => (
                  <tr key={from.id}>
                    <td className="pr-3 text-xs font-medium whitespace-nowrap text-zinc-600">{from.name} →</td>
                    {cells.map((c, i) => (
                      <td key={i} className="p-0.5">
                        <div
                          className={cn(
                            "tabular grid h-9 w-14 place-items-center rounded-md text-xs font-semibold",
                            c == null ? "bg-zinc-50" : c ? "bg-sky-100 text-sky-800" : "text-zinc-300",
                          )}
                          style={c ? { opacity: 0.55 + Math.min(c, 5) * 0.09 } : undefined}
                        >
                          {c == null ? "" : c}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {opened && (
        <DeptDrawer dept={opened} onClose={() => setOpen(null)} onOpenTask={(t) => setTaskModal({ task: t })} onRequest={() => requestTo(opened)} />
      )}
      {edit && <DepartmentModal dept={edit.dept} onClose={() => setEdit(null)} />}
      <TaskModal open={!!taskModal} task={taskModal?.task} draft={taskModal?.draft} onClose={() => setTaskModal(null)} />
    </>
  );
}

function Mini({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 py-2">
      <div className={cn("tabular text-lg leading-none font-semibold", !value && "text-zinc-300", tone)}>{value}</div>
      <div className="mt-1 text-[10px] text-zinc-500">{label}</div>
    </div>
  );
}

function DeptDrawer({
  dept,
  onClose,
  onOpenTask,
  onRequest,
}: {
  dept: Department;
  onClose: () => void;
  onOpenTask: (t: Task) => void;
  onRequest: () => void;
}) {
  const { profiles, tasks, profileById, deptById, departments } = useStore();
  const members = profiles.filter((p) => p.department_id === dept.id && p.active);
  const open = tasks
    .filter((t) => t.status !== "done" && taskDeptId(t, profileById) === dept.id)
    .sort((a, b) => Number(isOverdue(b.due_date, false)) - Number(isOverdue(a.due_date, false)) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
  const incoming = open.filter((t) => t.from_department_id && t.from_department_id !== dept.id);
  const internal = open.filter((t) => !incoming.includes(t));
  const outgoing = tasks.filter((t) => t.status !== "done" && t.from_department_id === dept.id);
  const children = departments.filter((d) => d.parent_id === dept.id);
  const parent = dept.parent_id ? deptById.get(dept.parent_id) : null;

  const row = (t: Task, showDept?: "from" | "to") => {
    const due = dueLabel(t.due_date);
    const other = showDept === "from" ? t.from_department_id : t.department_id;
    return (
      <li key={t.id}>
        <button onClick={() => onOpenTask(t)} className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-zinc-50">
          <PriorityChip priority={t.priority} compact />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm">{t.title}</div>
            {showDept && other && (
              <div className="text-[11px] text-zinc-400">
                {showDept === "from" ? "← " : "→ "}
                {deptById.get(other)?.name}
              </div>
            )}
          </div>
          {due && <span className={cn("text-[11px] whitespace-nowrap", due.tone === "overdue" ? "font-medium text-red-600" : "text-zinc-400")}>{due.text}</span>}
          <Avatar profile={t.assignee_id ? profileById.get(t.assignee_id) : null} size={22} />
        </button>
      </li>
    );
  };

  return (
    <Drawer
      open
      onClose={onClose}
      title={dept.name}
      subtitle={[dept.code, parent && `${parent.name}-д харьяалагдана`, children.length && `${children.length} дэд хэлтэс`].filter(Boolean).join(" · ") || dept.description}
      footer={
        <Button variant="primary" onClick={onRequest}>
          <Send size={15} /> Энэ хэлтэст хүсэлт илгээх
        </Button>
      }
    >
      {dept.description && <p className="mb-5 text-sm text-zinc-600">{dept.description}</p>}

      <Section title={`Ажилчид (${members.length})`}>
        <ul className="grid gap-1 sm:grid-cols-2">
          {members.map((p) => {
            const load = tasks.filter((t) => t.assignee_id === p.id && t.status !== "done").length;
            return (
              <li key={p.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                <Avatar profile={p} size={30} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 truncate text-sm font-medium">
                    {p.full_name}
                    {dept.head_id === p.id && <Crown size={12} className="text-amber-500" />}
                  </div>
                  <div className="truncate text-[11px] text-zinc-400">{p.job_title || ROLES.find((r) => r.id === p.role)?.label}</div>
                </div>
                <Link href={`/tasks?who=${p.id}`} className="tabular text-xs text-zinc-500 hover:text-brand-600">
                  {load} ажил
                </Link>
              </li>
            );
          })}
        </ul>
        {!members.length && <p className="text-sm text-zinc-400">Ажилтан алга — «Ажилчид» хуудаснаас хэлтэст хуваарилна.</p>}
      </Section>

      <Section title={`Ирсэн хүсэлт (${incoming.length})`} icon={<Inbox size={14} />}>
        {incoming.length ? <ul>{incoming.map((t) => row(t, "from"))}</ul> : <p className="text-sm text-zinc-400">Бусад хэлтсээс ирсэн нээлттэй хүсэлт алга</p>}
      </Section>
      <Section title={`Дотоод ажил (${internal.length})`}>
        {internal.length ? <ul>{internal.map((t) => row(t))}</ul> : <p className="text-sm text-zinc-400">Нээлттэй ажил алга</p>}
      </Section>
      <Section title={`Бусад хэлтэст илгээсэн (${outgoing.length})`} icon={<Send size={13} />}>
        {outgoing.length ? <ul>{outgoing.map((t) => row(t, "to"))}</ul> : <p className="text-sm text-zinc-400">Илгээсэн хүсэлт алга</p>}
      </Section>
    </Drawer>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}
