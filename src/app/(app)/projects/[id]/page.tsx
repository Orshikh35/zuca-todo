"use client";

import { ArrowLeft, CalendarClock, Check, Columns3, FolderKanban, List, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { CardTitle } from "@/components/bento";
import { Board, type BoardColumn } from "@/components/board";
import { ProjectModal } from "@/components/projects/project-modal";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskModal, type TaskDraft } from "@/components/tasks/task-modal";
import { Avatar, Button, Card, Empty, PriorityChip, Segmented, Select } from "@/components/ui";
import { PROJECT_STATUSES, STATUSES } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { canEditProject, isAdmin } from "@/lib/permissions";
import { pctTone } from "@/lib/plan";
import type { Task, TaskStatus } from "@/lib/types";
import { cn, dueLabel, isOverdue } from "@/lib/utils";

const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-zinc-400",
  in_progress: "bg-brand-500",
  review: "bg-amber-500",
  done: "bg-emerald-500",
};

export default function ProjectPage() {
  return (
    <Suspense>
      <ProjectInner />
    </Suspense>
  );
}

function ProjectInner() {
  const { id } = useParams<{ id: string }>();
  const { ready, me, projectById, tasks, profiles, profileById, projectProgress, createTask, updateTask, updateProject } = useStore();
  const project = projectById.get(id);
  // Анхдагч нь Kanban самбар; сүүлд сонгосон харагдацыг санана
  const [view, setView] = useState<"list" | "board">(() => {
    try {
      return localStorage.getItem("project-view") === "list" ? "list" : "board";
    } catch {
      return "board";
    }
  });
  const [editing, setEditing] = useState(false);
  const [modal, setModal] = useState<{ task?: Task | null; draft?: TaskDraft } | null>(null);
  const [quick, setQuick] = useState({ title: "", assignee_id: "", due_date: "" });

  useEffect(() => {
    try {
      localStorage.setItem("project-view", view);
    } catch {}
  }, [view]);

  const items = useMemo(() => tasks.filter((t) => t.project_id === id), [tasks, id]);

  const getColumn = useCallback((t: Task) => t.status, []);
  const onMove = useCallback(
    (t: Task, to: string, position: number) => void updateTask(t.id, { status: to as TaskStatus, position }),
    [updateTask],
  );

  if (!project) {
    return ready ? (
      <Card className="mt-6">
        <Empty icon={<FolderKanban size={30} />} title="Төсөл олдсонгүй" hint="Устгагдсан эсвэл холбоос буруу байна" />
        <div className="pb-6 text-center">
          <Link href="/projects" className="text-sm font-medium text-brand-600 hover:underline">
            ← Төслүүд рүү буцах
          </Link>
        </div>
      </Card>
    ) : null;
  }

  const prog = projectProgress(project.id);
  const tone = pctTone(prog.pct);
  const st = PROJECT_STATUSES.find((s) => s.id === project.status)!;
  const owner = project.owner_id ? profileById.get(project.owner_id) : undefined;
  const due = project.status !== "done" ? dueLabel(project.due_date) : null;
  const overdue = items.filter((t) => isOverdue(t.due_date, t.status === "done")).length;
  const byStatus = STATUSES.map((s) => ({ ...s, count: items.filter((t) => t.status === s.id).length }));
  // Ажилтанд RLS-ээр бусдын ажил харагдахгүй — тоо нь зөрөхөд тайлбарлана
  const hidden = !isAdmin(me) ? Math.max(0, prog.total - items.length) : 0;

  const people = Array.from(new Set(items.map((t) => t.assignee_id ?? "")))
    .map((pid) => {
      const mine = items.filter((t) => (t.assignee_id ?? "") === pid);
      const done = mine.filter((t) => t.status === "done").length;
      return { profile: pid ? profileById.get(pid) : null, total: mine.length, done };
    })
    .sort((a, b) => b.total - a.total);

  const sorted = [...items].sort(
    (a, b) =>
      Number(a.status === "done") - Number(b.status === "done") ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      a.position - b.position,
  );

  async function addQuick() {
    const title = quick.title.trim();
    if (!title || !project) return;
    const assignee = quick.assignee_id ? profileById.get(quick.assignee_id) : undefined;
    await createTask({
      title,
      project_id: project.id,
      assignee_id: quick.assignee_id || null,
      department_id: assignee?.department_id ?? null,
      camp_id: project.camp_id,
      due_date: quick.due_date || null,
      planned_month: quick.due_date ? quick.due_date.slice(0, 7) : null,
      position: Date.now(),
      source: "manual",
    });
    setQuick((q) => ({ ...q, title: "" }));
  }

  const columns: BoardColumn[] = STATUSES.map((s) => ({ id: s.id, label: s.label, dot: STATUS_DOT[s.id] }));

  return (
    <>
      <Link href="/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900">
        <ArrowLeft size={15} /> Төслүүд
      </Link>

      {/* ── Толгой: нэр, явц % ── */}
      <section className="glass relative mb-5 overflow-hidden rounded-[1.75rem] p-6 sm:p-7">
        <div className="pointer-events-none absolute inset-0 opacity-[0.13]" style={{ background: `linear-gradient(135deg, ${project.color}, transparent 70%)` }} />
        <div className="relative flex flex-wrap items-start gap-6">
          <div className="min-w-0 flex-[1_1_320px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold", st.chip)}>{st.label}</span>
              {(project.start_date || project.due_date) && (
                <span className={cn("inline-flex items-center gap-1 text-xs", due?.tone === "overdue" ? "font-medium text-red-600" : "text-zinc-500")}>
                  <CalendarClock size={12} />
                  {project.start_date ?? "…"} → {project.due_date ?? "…"}
                  {due && ` · ${due.text}`}
                </span>
              )}
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-[2.25rem] sm:leading-[1.15]">{project.name}</h1>
            {project.description && <p className="mt-1.5 max-w-2xl text-sm text-zinc-600">{project.description}</p>}
            <div className="mt-3 flex items-center gap-2 text-sm text-zinc-600">
              {owner ? (
                <>
                  <Avatar profile={owner} size={24} /> {owner.full_name} <span className="text-zinc-400">· хариуцагч</span>
                </>
              ) : (
                <span className="text-zinc-400">Хариуцагчгүй</span>
              )}
            </div>
          </div>

          <div className="flex flex-[1_1_260px] flex-col gap-3">
            <div className="flex items-end gap-2">
              <span className={cn("tabular text-6xl font-semibold tracking-tight", prog.pct != null && tone.text)}>{prog.pct == null ? "—" : `${prog.pct}%`}</span>
              <span className="mb-2 text-sm text-zinc-500">хаагдлаа</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-zinc-100">
              <div className="h-full rounded-full transition-all" style={{ width: `${prog.pct ?? 0}%`, background: project.color }} />
            </div>
            <div className="text-sm text-zinc-600">
              <b className="tabular text-zinc-900">{prog.done}</b> / {prog.total} ажил дууссан
              {overdue > 0 && <span className="font-medium text-red-600"> · {overdue} хэтэрсэн</span>}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={() => setModal({ draft: { project_id: project.id, camp_id: project.camp_id } })}>
                <Plus size={14} /> Ажил нэмэх
              </Button>
              {canEditProject(me, project) && (
                <Button size="sm" onClick={() => setEditing(true)}>
                  <Pencil size={13} /> Засах
                </Button>
              )}
              {canEditProject(me, project) && project.status !== "done" && prog.total > 0 && prog.done === prog.total && (
                <Button size="sm" onClick={() => void updateProject(project.id, { status: "done" })}>
                  <Check size={14} /> Төслийг хаах
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ── Төлөв, хүн тус бүр ── */}
      <div className="mb-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="p-5">
          <CardTitle title="Төлөвөөр" sub="Ажил бүр аль шатандаа явж байна" />
          <div className="mt-4 grid grid-cols-4 gap-2">
            {byStatus.map((s) => (
              <div key={s.id} className="rounded-2xl bg-zinc-100 p-3 text-center">
                <div className="tabular text-2xl font-semibold">{s.count}</div>
                <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-zinc-500">
                  <span className={cn("size-1.5 rounded-full", STATUS_DOT[s.id])} />
                  {s.label}
                </div>
              </div>
            ))}
          </div>
          {/* Төлөв бүрийн хэсэгчилсэн мөр */}
          <div className="mt-4 flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-100">
            {byStatus.map((s) =>
              s.count ? <div key={s.id} className={STATUS_DOT[s.id]} style={{ width: `${(s.count / Math.max(1, items.length)) * 100}%` }} title={`${s.label}: ${s.count}`} /> : null,
            )}
          </div>
        </Card>
        <Card className="p-5">
          <CardTitle title="Хүн тус бүр" sub="Хэн хэдэн ажлаа хаасан" />
          <ul className="mt-3 space-y-2.5">
            {people.map(({ profile, total, done }) => (
              <li key={profile?.id ?? "none"} className="flex items-center gap-2.5">
                <Avatar profile={profile} size={26} />
                <Link
                  href={profile ? `/calendar?who=${profile.id}` : "#"}
                  className="w-28 truncate text-sm hover:underline"
                  title={profile ? "Календарь нээх" : undefined}
                >
                  {profile?.full_name ?? "Хариуцагчгүй"}
                </Link>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
                  <div className="h-full rounded-full" style={{ width: `${(done / total) * 100}%`, background: project.color }} />
                </div>
                <span className="tabular w-10 text-right text-xs text-zinc-500">
                  {done}/{total}
                </span>
              </li>
            ))}
            {!people.length && <li className="text-sm text-zinc-400">Одоогоор ажил алга</li>}
          </ul>
        </Card>
      </div>

      {/* ── Хурдан нэмэх ── */}
      <form
        className="glass mb-4 flex flex-wrap items-center gap-2 rounded-[1.5rem] p-2"
        onSubmit={(e) => {
          e.preventDefault();
          void addQuick();
        }}
      >
        <Plus size={16} className="ml-2 text-zinc-400" />
        <input
          className="min-w-0 flex-[1_1_220px] bg-transparent px-1 py-2 text-sm outline-none placeholder:text-zinc-400"
          placeholder="Ажил нэмэх… (Enter)"
          value={quick.title}
          onChange={(e) => setQuick((q) => ({ ...q, title: e.target.value }))}
        />
        <Select className="field h-9 w-auto rounded-full py-0 text-sm" value={quick.assignee_id} onChange={(e) => setQuick((q) => ({ ...q, assignee_id: e.target.value }))}>
          <option value="">Хариуцагчгүй</option>
          {profiles
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
        </Select>
        <input
          type="date"
          className="field h-9 w-auto rounded-full py-0 text-sm"
          value={quick.due_date}
          onChange={(e) => setQuick((q) => ({ ...q, due_date: e.target.value }))}
        />
        <Button type="submit" variant="primary" size="sm" disabled={!quick.title.trim()}>
          Нэмэх
        </Button>
      </form>

      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-medium tracking-tight">
          Ажлууд <sup className="text-xs text-zinc-500">{items.length}</sup>
        </h2>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { id: "board", label: "Самбар", icon: <Columns3 size={14} /> },
            { id: "list", label: "Жагсаалт", icon: <List size={14} /> },
          ]}
        />
      </div>

      {hidden > 0 && (
        <p className="mb-3 text-xs text-zinc-500">Бусдад оноогдсон {hidden} ажил танд харагдахгүй ч явцын % -д тооцогдсон.</p>
      )}

      {view === "list" ? (
        <Card className="divide-y divide-zinc-100 overflow-hidden">
          {sorted.map((t) => (
            <TaskRow key={t.id} task={t} onOpen={() => setModal({ task: t })} />
          ))}
          {!sorted.length && <Empty icon={<FolderKanban size={28} />} title="Ажил нэмээгүй байна" hint="Дээрх мөрөнд бичээд Enter дарна" />}
        </Card>
      ) : (
        <Board
          columns={columns}
          items={items}
          getColumn={getColumn}
          onMove={onMove}
          columnWidth="w-[300px] xl:w-[calc((100%-3rem)/4)] xl:min-w-[270px]"
          renderCard={(t, { overlay }) => <TaskCard task={t} overlay={overlay} hideProject onOpen={(x) => setModal({ task: x })} />}
          renderColumnFooter={(col) => (
            <QuickAdd
              onAdd={(title) =>
                void createTask({
                  title,
                  status: col as TaskStatus,
                  project_id: project.id,
                  camp_id: project.camp_id,
                  assignee_id: me?.id ?? null,
                  department_id: me?.department_id ?? null,
                  position: Date.now(),
                  source: "manual",
                })
              }
            />
          )}
        />
      )}

      <ProjectModal open={editing} project={project} onClose={() => setEditing(false)} />
      {modal && <TaskModal open task={modal.task} draft={modal.draft} onClose={() => setModal(null)} />}
    </>
  );
}

/** Жагсаалтын мөр: тэмдэглэх, гарчиг, хариуцагч, хугацаа */
function TaskRow({ task: t, onOpen }: { task: Task; onOpen: () => void }) {
  const { profileById, updateTask } = useStore();
  const done = t.status === "done";
  const due = dueLabel(t.due_date);
  const st = STATUSES.find((s) => s.id === t.status)!;
  return (
    <div onClick={onOpen} className="flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-zinc-50">
      <button
        title={done ? "Дахин нээх" : "Дууссан болгох"}
        onClick={(e) => {
          e.stopPropagation();
          void updateTask(t.id, { status: done ? "todo" : "done" });
        }}
        className={cn(
          "flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border transition",
          done ? "border-transparent bg-[#c6f36b] text-neutral-900" : "border-zinc-300 text-transparent hover:border-emerald-500 hover:text-emerald-500",
        )}
      >
        <Check size={11} strokeWidth={3} />
      </button>
      <span className={cn("min-w-0 flex-1 truncate text-sm font-medium", done && "text-zinc-400 line-through")}>{t.title}</span>
      {!done && (
        <span className="hidden items-center gap-1 text-[11px] text-zinc-500 sm:inline-flex">
          <span className={cn("size-1.5 rounded-full", STATUS_DOT[t.status])} />
          {st.label}
        </span>
      )}
      {!done && t.priority !== "medium" && <PriorityChip priority={t.priority} compact />}
      {due && !done && (
        <span
          className={cn(
            "w-28 shrink-0 text-right text-[11px] font-medium whitespace-nowrap",
            due.tone === "overdue" ? "text-red-600" : due.tone === "today" ? "text-orange-600" : "text-zinc-500",
          )}
        >
          {due.text}
        </span>
      )}
      <Avatar profile={t.assignee_id ? profileById.get(t.assignee_id) : null} size={24} />
    </div>
  );
}
