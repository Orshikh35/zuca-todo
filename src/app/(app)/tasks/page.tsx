"use client";

import { AlertTriangle, CheckCircle2, Columns3, Flame, Inbox, Plus, Search, Timer, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CardTitle, Donut, FilterBar, Hero, HeroChip, heroBtn, Pill, pillField, Tile } from "@/components/bento";
import { Board, type BoardColumn } from "@/components/board";
import { QuickAdd } from "@/components/tasks/quick-add";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskModal, type TaskDraft } from "@/components/tasks/task-modal";
import { Avatar, Button, PageHeader, Segmented, Select } from "@/components/ui";
import { PRIORITIES, STATUSES } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import type { Profile, Task, TaskPriority, TaskStatus } from "@/lib/types";
import { isAdmin, taskDeptId } from "@/lib/permissions";
import { addMonths, currentMonthKey, monthLabel } from "@/lib/plan";
import { periodStats } from "@/lib/report";
import { cn, isOverdue, todayISO } from "@/lib/utils";

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
  const { tasks, profiles, departments, profileById, me, updateTask, createTask } = useStore();
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
  // /departments → ?dept=<id>
  const [dept, setDept] = useState<string>(() => params.get("dept") ?? "");
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
    if (params.get("dept")) setDept(params.get("dept")!);
  }, [params]);

  // Telegram-ын «Системд нээх» → /tasks?task=<id> — ажлыг шууд нээнэ
  const opened = useRef<string | null>(null);
  useEffect(() => {
    const id = params.get("task");
    if (!id || opened.current === id) return;
    const t = tasks.find((x) => x.id === id);
    if (t) {
      opened.current = id;
      setModal({ task: t });
    }
  }, [params, tasks]);

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
      if (dept === "cross" ? !t.from_department_id : dept && taskDeptId(t, profileById) !== dept) return false;
      if (month === "none" ? t.planned_month : month && t.planned_month !== month) return false;
      if (overdueOnly && !isOverdue(t.due_date, t.status === "done")) return false;
      if (s && !`${t.title} ${t.description ?? ""} ${t.tags.join(" ")}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [tasks, q, who, prio, overdueOnly, view, month, dept, profileById]);

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

  const admin = isAdmin(me);
  const open = tasks.filter((t) => t.status !== "done");
  // Админ багийн бүх ажлыг, ажилтан өөрийнхийгөө тоолно
  const scope = admin ? tasks : tasks.filter((t) => t.assignee_id === me?.id);
  const scopeOpen = scope.filter((t) => t.status !== "done");
  const unassigned = open.filter((t) => !t.assignee_id).length;
  const urgentCount = scopeOpen.filter((t) => t.priority === "urgent").length;
  const overdueCount = scopeOpen.filter((t) => isOverdue(t.due_date, false)).length;
  const todayCount = scopeOpen.filter((t) => t.due_date === todayISO()).length;
  const week = periodStats(scope, 7);
  const change = week.prevDone ? Math.round(((week.doneCount - week.prevDone) / week.prevDone) * 100) : null;
  const hasFilter = q || who || prio || overdueOnly || month || dept;
  const thisMonth = currentMonthKey();
  const monthOptions = Array.from(new Set([addMonths(thisMonth, -1), thisMonth, addMonths(thisMonth, 1), addMonths(thisMonth, 2), ...tasks.map((t) => t.planned_month).filter((m): m is string => !!m)])).sort();

  return (
    <>
      <PageHeader
        title="Ажлууд"
        subtitle={admin ? "Багийн бүх ажил — чирж төлөв солино" : "Миний болон эзэнгүй ажлууд — чирж төлөв солино"}
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

      {/* Bento товчоо */}
      <div className="mb-5 flex flex-wrap gap-4">
        <Hero
          tone="lavender"
          className="min-w-0 flex-[2.4_1_340px]"
          title={admin ? "Багийн нээлттэй ажил" : "Миний нээлттэй ажил"}
          value={scopeOpen.length}
          unit="ажил"
          chips={
            <>
              <HeroChip active={prio === "urgent"} onClick={() => setPrio(prio === "urgent" ? null : "urgent")}>
                🔥 Яаралтай {urgentCount}
              </HeroChip>
              <HeroChip active={overdueOnly} onClick={() => setOverdueOnly(!overdueOnly)}>
                ⚠️ Хэтэрсэн {overdueCount}
              </HeroChip>
              <HeroChip>⏰ Өнөөдөр {todayCount}</HeroChip>
            </>
          }
          actions={
            <>
              {me && (
                <button onClick={() => setWho(who === me.id ? null : me.id)} className={who === me.id ? heroBtn.light : heroBtn.dark}>
                  {who === me.id ? "Бүх ажил" : "Миний ажлууд"}
                </button>
              )}
              <button onClick={() => setView(view === "status" ? "priority" : "status")} className={heroBtn.light}>
                {view === "status" ? <Flame size={15} /> : <Columns3 size={15} />}
                {view === "status" ? "Яаралтай байдлаар" : "Төлөвөөр"}
              </button>
            </>
          }
        />
        <Tile
          className="flex-[1_1_150px]"
          tint="amber"
          icon={<Inbox size={15} />}
          title="Эзэнгүй ажил"
          value={unassigned}
          caption={admin ? "хариуцагч тавих" : "«Би авъя» гэж авна"}
          onClick={() => setWho(who === "none" ? null : "none")}
          active={who === "none"}
        />
        <Tile
          className="flex-[1_1_150px]"
          tint="violet"
          icon={<Timer size={15} />}
          title="Хийж байна"
          value={scope.filter((t) => t.status === "in_progress").length}
          caption={admin ? "багийн гарт" : "миний гарт"}
        />
        <Tile
          className="flex-[1_1_150px]"
          tint="emerald"
          icon={<CheckCircle2 size={15} />}
          title="Дууссан"
          value={`+${week.doneCount}`}
          caption="энэ 7 хоногт"
          chip={change === null ? null : { text: `${change > 0 ? "+" : ""}${change}%`, tone: change >= 0 ? "good" : "bad" }}
        />
      </div>

      {/* Админ: ажилтан бүрийн явц */}
      {admin && <TeamProgress tasks={tasks} profiles={profiles.filter((p) => p.active)} who={who} onPick={(id) => setWho(who === id ? null : id)} />}

      {/* Шүүлтүүр */}
      <FilterBar>
        <div className="relative shrink-0">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-zinc-400" />
          <input className={cn(pillField, "w-52 pl-9")} placeholder="Хайх…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        <div className="glass flex shrink-0 items-center rounded-full px-1.5 py-1">
          {(admin ? profiles.filter((p) => p.active) : []).map((p) => (
            <button
              key={p.id}
              onClick={() => setWho(who === p.id ? null : p.id)}
              title={p.full_name}
              className={cn(
                "cursor-pointer rounded-full p-0.5 transition",
                who === p.id ? "ring-2 ring-neutral-900 dark:ring-white" : who ? "opacity-40 hover:opacity-100" : "hover:scale-110",
              )}
            >
              <Avatar profile={p} size={24} />
            </button>
          ))}
          {me && (
            <button
              onClick={() => setWho(who === me.id ? null : me.id)}
              className={cn(
                "ml-1 cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium",
                who === me.id ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-zinc-500 hover:bg-zinc-100",
              )}
            >
              Миний
            </button>
          )}
          <button
            onClick={() => setWho(who === "none" ? null : "none")}
            className={cn(
              "cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium",
              who === "none" ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-zinc-500 hover:bg-zinc-100",
            )}
          >
            Эзэнгүй
          </button>
        </div>

        {view === "status" &&
          PRIORITIES.map((p) => (
            <Pill key={p.id} active={prio === p.id} activeClass={p.chip} onClick={() => setPrio(prio === p.id ? null : p.id)}>
              <span className={cn("size-2 rounded-full", p.dot)} />
              {p.label}
            </Pill>
          ))}

        <Select
          className={cn(pillField, month && "border-brand-300 bg-brand-50 text-brand-700")}
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
        </Select>

        {departments.length > 0 && (
          <Select
            className={cn(pillField, dept && "border-brand-300 bg-brand-50 text-brand-700")}
            value={dept}
            onChange={(e) => setDept(e.target.value)}
            title="Хэлтсээр шүүх"
          >
            <option value="">Бүх хэлтэс</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
            <option value="cross">↔ Хэлтэс хоорондын хүсэлт</option>
          </Select>
        )}

        <Pill active={overdueOnly} activeClass="bg-red-50 text-red-700 ring-2 ring-red-300" onClick={() => setOverdueOnly(!overdueOnly)}>
          <AlertTriangle size={13} /> Хугацаа хэтэрсэн
        </Pill>

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
              setDept("");
            }}
          >
            <X size={14} /> Цэвэрлэх
          </Button>
        )}
      </FilterBar>

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
                department_id: dept && dept !== "cross" ? dept : me?.department_id ?? null,
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

/* ─────────── Админ: ажилтан бүрийн гүйцэтгэл (сүүлийн 30 хоног) ─────────── */
function TeamProgress({ tasks, profiles, who, onPick }: { tasks: Task[]; profiles: Profile[]; who: string | null; onPick: (id: string) => void }) {
  const since = Date.now() - 30 * 86_400_000;
  const rows = profiles
    .map((p) => {
      const mine = tasks.filter((t) => t.assignee_id === p.id);
      const openT = mine.filter((t) => t.status !== "done");
      const done = mine.filter((t) => t.status === "done" && t.completed_at && Date.parse(t.completed_at) >= since).length;
      const total = openT.length + done;
      return {
        p,
        open: openT.length,
        doing: openT.filter((t) => t.status === "in_progress" || t.status === "review").length,
        overdue: openT.filter((t) => isOverdue(t.due_date, false)).length,
        done,
        total,
        pct: total ? Math.round((done / total) * 100) : null,
      };
    })
    .sort((a, b) => (b.total ? 1 : 0) - (a.total ? 1 : 0) || (a.pct ?? 101) - (b.pct ?? 101));
  const all = rows.reduce((a, r) => ({ done: a.done + r.done, total: a.total + r.total }), { done: 0, total: 0 });
  const teamPct = all.total ? Math.round((all.done / all.total) * 100) : 0;

  return (
    <section className="glass mb-5 rounded-[1.75rem] p-5 sm:p-6">
      <CardTitle title="Ажилчдын явц" count={rows.length} sub={`Сүүлийн 30 хоног · баг нийт ${teamPct}% (${all.done}/${all.total})`} pill="Дарж шүүнэ" />
      <div className="scroll-thin -mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-1">
        {rows.map((r) => {
          const color = r.pct === null ? "#d4d4d8" : r.pct >= 70 ? "#8fd16a" : r.pct >= 40 ? "#ffb34d" : "#ff6b8b";
          return (
            <button
              key={r.p.id}
              onClick={() => onPick(r.p.id)}
              className={cn(
                "raised flex w-[15.5rem] shrink-0 cursor-pointer items-center gap-3 rounded-[1.25rem] p-3 text-left transition hover:-translate-y-0.5",
                who === r.p.id && "ring-2 ring-neutral-900 dark:ring-white",
              )}
            >
              <Donut
                size={64}
                stroke={7}
                parts={[
                  { label: "done", value: r.done, color },
                  { label: "open", value: r.open, color: "transparent" },
                ]}
                center={<span className="tabular text-[13px] font-semibold">{r.pct === null ? "—" : `${r.pct}%`}</span>}
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <Avatar profile={r.p} size={18} />
                  <span className="truncate text-sm font-medium">{r.p.full_name}</span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-zinc-500">{r.p.job_title || "Ажилтан"}</span>
                <span className="mt-1.5 flex flex-wrap gap-1 text-[10.5px] font-medium">
                  <span className="rounded-full bg-surface-solid px-1.5 py-0.5">
                    {r.done}/{r.total} дууссан
                  </span>
                  {r.doing > 0 && <span className="rounded-full bg-[#c9b8ff] px-1.5 py-0.5 text-neutral-900">{r.doing} хийж буй</span>}
                  {r.overdue > 0 && <span className="rounded-full bg-[#ff7b8f] px-1.5 py-0.5 text-neutral-900">{r.overdue} хэтэрсэн</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
