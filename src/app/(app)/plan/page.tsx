"use client";

import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, ClipboardList, Download, ExternalLink, LayoutGrid, Plus, Printer } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Board, type BoardColumn } from "@/components/board";
import { TaskCard } from "@/components/tasks/task-card";
import { TaskModal, type TaskDraft } from "@/components/tasks/task-modal";
import { Avatar, Button, Card, PageHeader, Progress, Segmented } from "@/components/ui";
import { STATUSES } from "@/lib/constants";
import { download } from "@/lib/csv";
import { useStore } from "@/lib/data/store";
import {
  MONTH_NAMES,
  QUARTERS,
  currentMonthKey,
  monthKey,
  monthLabel,
  parseMonth,
  pctTone,
  planStats,
  quarterOf,
  tasksInMonths,
  type MonthKey,
} from "@/lib/plan";
import type { Task, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type View = "year" | "quarter" | "month" | "report";

const BACKLOG = "backlog";

const STATUS_DOT: Record<TaskStatus, string> = {
  todo: "bg-zinc-400",
  in_progress: "bg-brand-500",
  review: "bg-amber-500",
  done: "bg-emerald-500",
};

export default function PlanPage() {
  return (
    <Suspense>
      <PlanInner />
    </Suspense>
  );
}

function PlanInner() {
  const { tasks, profiles, me, updateTask, createTask } = useStore();
  const params = useSearchParams();
  const now = currentMonthKey();
  const [view, setView] = useState<View>((params.get("view") as View) || "year");
  const [year, setYear] = useState(() => parseMonth(now).year);
  const [quarter, setQuarter] = useState(() => quarterOf(parseMonth(now).month));
  const [month, setMonth] = useState(() => parseMonth(now).month);
  const [who, setWho] = useState<string | null>(null);
  const [modal, setModal] = useState<{ task?: Task | null; draft?: TaskDraft } | null>(null);

  const yearMonths = useMemo(() => Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1)), [year]);
  const scoped = useMemo(() => (who ? tasks.filter((t) => t.assignee_id === who) : tasks), [tasks, who]);
  const yearTasks = useMemo(() => tasksInMonths(scoped, yearMonths), [scoped, yearMonths]);
  const yearStats = planStats(yearTasks);

  const visibleMonths: MonthKey[] = useMemo(() => {
    if (view === "quarter") return QUARTERS[quarter - 1].months.map((m) => monthKey(year, m));
    if (view === "month") return [monthKey(year, month)];
    return yearMonths;
  }, [view, quarter, month, year, yearMonths]);

  // Жил, улиралд: сарууд = багана. Төлөвлөөгүй нээлттэй ажлууд зүүн талд.
  const planColumns: BoardColumn[] = useMemo(
    () => [
      { id: BACKLOG, label: "Төлөвлөөгүй", hint: "Сар руу чирж төлөвлөнө", dot: "bg-zinc-300" },
      ...visibleMonths.map((k) => ({
        id: k,
        label: monthLabel(k),
        hint: k === now ? "Энэ сар" : k < now ? "Өнгөрсөн" : undefined,
        dot: k === now ? "bg-brand-500" : k < now ? "bg-zinc-400" : "bg-sky-400",
      })),
    ],
    [visibleMonths, now],
  );

  const planItems = useMemo(() => {
    const set = new Set(visibleMonths);
    return scoped.filter((t) => (t.planned_month ? set.has(t.planned_month) : t.status !== "done"));
  }, [scoped, visibleMonths]);

  const getPlanColumn = useCallback((t: Task) => t.planned_month ?? BACKLOG, []);
  const onPlanMove = useCallback(
    (t: Task, to: string, position: number) => {
      void updateTask(t.id, { planned_month: to === BACKLOG ? null : to, position });
    },
    [updateTask],
  );

  // Сарын харагдац: тухайн сарын ажлууд төлөвөөр
  const monthItems = useMemo(() => scoped.filter((t) => t.planned_month === visibleMonths[0]), [scoped, visibleMonths]);
  const statusColumns: BoardColumn[] = useMemo(() => STATUSES.map((s) => ({ id: s.id, label: s.label, dot: STATUS_DOT[s.id] })), []);
  const getStatusColumn = useCallback((t: Task) => t.status, []);
  const onStatusMove = useCallback(
    (t: Task, to: string, position: number) => void updateTask(t.id, { status: to as TaskStatus, position }),
    [updateTask],
  );

  // Жилийн харагдацад энэ сар руу гүйлгэнэ
  useEffect(() => {
    if (view !== "year") return;
    const el = document.querySelector<HTMLElement>(`[data-col="${now}"]`);
    const scroller = el?.parentElement;
    if (el && scroller) scroller.scrollTo({ left: el.offsetLeft - scroller.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [view, year, now]);

  const addTo = (col: string, title: string) =>
    void createTask({
      title,
      position: Date.now(),
      assignee_id: who ?? me?.id ?? null,
      planned_month: col === BACKLOG ? null : col,
    });

  return (
    <>
      <PageHeader
        title="Төлөвлөгөө"
        subtitle="Ажлаа жил, улирал, сараар төлөвлөж, гүйцэтгэлээ хянана"
        actions={
          <>
            <div className="flex items-center rounded-lg bg-white ring-1 ring-zinc-200">
              <button className="cursor-pointer rounded-l-lg p-2 hover:bg-zinc-50" onClick={() => setYear(year - 1)} aria-label="Өмнөх жил">
                <ChevronLeft size={16} />
              </button>
              <span className="tabular px-2 text-sm font-semibold">{year} он</span>
              <button className="cursor-pointer rounded-r-lg p-2 hover:bg-zinc-50" onClick={() => setYear(year + 1)} aria-label="Дараах жил">
                <ChevronRight size={16} />
              </button>
            </div>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { id: "year", label: "Жил", icon: <LayoutGrid size={15} /> },
                { id: "quarter", label: "Улирал", icon: <CalendarRange size={15} /> },
                { id: "month", label: "Сар", icon: <CalendarDays size={15} /> },
                { id: "report", label: "Тайлан", icon: <ClipboardList size={15} /> },
              ]}
            />
            <Button variant="primary" onClick={() => setModal({ draft: { planned_month: view === "month" ? visibleMonths[0] : now } })}>
              <Plus size={16} /> Ажил төлөвлөх
            </Button>
          </>
        }
      />

      {/* Улирлын товч үзүүлэлт */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card className="col-span-2 p-4 lg:col-span-1">
          <div className="text-xs font-medium text-zinc-500">{year} оны төлөвлөгөө</div>
          <div className="mt-1 flex items-baseline gap-1.5">
            <span className={cn("text-3xl font-semibold tracking-tight", pctTone(yearStats.pct).text)}>{yearStats.pct ?? "—"}</span>
            {yearStats.pct != null && <span className="text-sm text-zinc-400">%</span>}
          </div>
          <div className="mt-2">
            <Progress value={yearStats.pct ?? 0} tone={pctTone(yearStats.pct).bar} />
          </div>
          <div className="tabular mt-1.5 text-[11px] text-zinc-500">
            {yearStats.done}/{yearStats.planned} ажил дууссан
          </div>
        </Card>
        {QUARTERS.map((q) => {
          const st = planStats(tasksInMonths(scoped, q.months.map((m) => monthKey(year, m))));
          const isNow = year === parseMonth(now).year && quarterOf(parseMonth(now).month) === q.id;
          const selected = view === "quarter" && quarter === q.id;
          const future = monthKey(year, q.months[0]) > now;
          const tone = future ? { text: "text-sky-700", bar: "bg-sky-400" } : pctTone(st.pct);
          return (
            <button
              key={q.id}
              onClick={() => {
                setQuarter(q.id);
                setView("quarter");
              }}
              className={cn(
                "cursor-pointer rounded-2xl border bg-white p-4 text-left shadow-card transition hover:border-zinc-300",
                selected ? "border-brand-400 ring-4 ring-brand-100" : "border-zinc-200/70",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{q.label}</span>
                {isNow && <span className="rounded-full bg-brand-50 px-1.5 py-px text-[10px] font-semibold text-brand-700">Одоо</span>}
              </div>
              <div className="text-[11px] text-zinc-400">{q.hint}</div>
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex-1">
                  <Progress value={st.pct ?? 0} tone={tone.bar} />
                </div>
                <span className={cn("tabular text-xs font-semibold", tone.text)}>{st.pct == null ? "—" : `${st.pct}%`}</span>
              </div>
              <div className="tabular mt-1 text-[11px] text-zinc-500">
                {st.done}/{st.planned} дууссан
                {st.overdue > 0 && <span className="text-red-600"> · {st.overdue} хэтэрсэн</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Шүүлтүүр: хүн + улирал/сар сонгох */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-lg bg-white px-1.5 py-1 ring-1 ring-zinc-200">
          {profiles
            .filter((p) => p.active)
            .map((p) => (
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
          <span className="px-2 text-xs text-zinc-500">{who ? "Сонгосон хүний төлөвлөгөө" : "Бүх хүн"}</span>
        </div>

        {view === "quarter" && (
          <Segmented
            value={String(quarter)}
            onChange={(v) => setQuarter(Number(v))}
            options={QUARTERS.map((q) => ({ id: String(q.id), label: q.label }))}
          />
        )}
        {(view === "month" || view === "report") && (
          <div className="flex flex-wrap gap-1">
            {MONTH_NAMES.map((name, i) => {
              const k = monthKey(year, i + 1);
              const n = tasksInMonths(scoped, [k]).length;
              return (
                <button
                  key={k}
                  onClick={() => setMonth(i + 1)}
                  className={cn(
                    "tabular h-8 cursor-pointer rounded-lg px-2.5 text-xs font-medium ring-1 transition",
                    month === i + 1 ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-zinc-600 ring-zinc-200 hover:bg-zinc-50",
                    k === now && month !== i + 1 && "ring-brand-300",
                  )}
                >
                  {name.replace(" сар", "")}
                  {n > 0 && <span className={cn("ml-1", month === i + 1 ? "text-white/70" : "text-zinc-400")}>{n}</span>}
                </button>
              );
            })}
          </div>
        )}
        {view === "month" && (
          <Link
            href={`/tasks?month=${visibleMonths[0]}`}
            className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
          >
            Ажлууд самбар дээр нээх <ExternalLink size={12} />
          </Link>
        )}
      </div>

      {view === "report" ? (
        <PlanReport year={year} month={month} scoped={scoped} who={who} />
      ) : view === "month" ? (
        <>
          <MonthHeader monthKey={visibleMonths[0]} items={monthItems} />
          <Board
            columns={statusColumns}
            items={monthItems}
            getColumn={getStatusColumn}
            onMove={onStatusMove}
            columnWidth="w-[300px] xl:w-[calc((100%-3rem)/4)] xl:min-w-[270px]"
            renderCard={(t, { overlay }) => <TaskCard task={t} overlay={overlay} onOpen={(task) => setModal({ task })} />}
            renderColumnFooter={(col) => (
              <QuickAdd
                onAdd={(title) =>
                  void createTask({
                    title,
                    position: Date.now(),
                    status: col as TaskStatus,
                    assignee_id: who ?? me?.id ?? null,
                    planned_month: visibleMonths[0],
                  })
                }
              />
            )}
          />
        </>
      ) : (
        <Board
          columns={planColumns}
          items={planItems}
          getColumn={getPlanColumn}
          onMove={onPlanMove}
          columnWidth={view === "quarter" ? "w-[300px] xl:w-[calc((100%-3rem)/4)] xl:min-w-[270px]" : "w-[272px]"}
          renderColumnMeta={(col, items) => {
            if (col === BACKLOG) return null;
            const st = planStats(items);
            return st.planned ? (
              <span className={cn("tabular text-[11px] font-semibold", col > now ? "text-sky-600" : pctTone(st.pct).text)} title={`${st.done}/${st.planned} дууссан`}>
                {st.pct}%
              </span>
            ) : null;
          }}
          renderCard={(t, { overlay }) => <TaskCard task={t} overlay={overlay} showStatus onOpen={(task) => setModal({ task })} />}
          renderColumnFooter={(col) => <QuickAdd onAdd={(title) => addTo(col, title)} />}
        />
      )}

      <TaskModal open={!!modal} task={modal?.task} draft={modal?.draft} onClose={() => setModal(null)} />
    </>
  );
}

function MonthHeader({ monthKey: k, items }: { monthKey: MonthKey; items: Task[] }) {
  const st = planStats(items);
  const tone = pctTone(st.pct);
  return (
    <Card className="mb-5 flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
      <div>
        <div className="text-xs text-zinc-500">Төлөвлөгөө</div>
        <div className="text-lg font-semibold">{monthLabel(k, true)}</div>
      </div>
      <div className="min-w-48 flex-1">
        <div className="mb-1.5 flex justify-between text-xs">
          <span className="text-zinc-500">Гүйцэтгэл</span>
          <span className={cn("tabular font-semibold", tone.text)}>{st.pct == null ? "—" : `${st.pct}%`}</span>
        </div>
        <Progress value={st.pct ?? 0} tone={tone.bar} />
      </div>
      {[
        ["Төлөвлөсөн", st.planned, ""],
        ["Дууссан", st.done, "text-emerald-700"],
        ["Хийгдэж байна", st.inProgress, "text-brand-600"],
        ["Хугацаа хэтэрсэн", st.overdue, st.overdue ? "text-red-600" : ""],
      ].map(([l, v, c]) => (
        <div key={l as string}>
          <div className="text-xs text-zinc-500">{l}</div>
          <div className={cn("tabular text-xl font-semibold", c as string)}>{v}</div>
        </div>
      ))}
    </Card>
  );
}

/* ─────────── Гүйцэтгэлийн тайлан ─────────── */
function PlanReport({ year, month, scoped, who }: { year: number; month: number; scoped: Task[]; who: string | null }) {
  const { profiles, profileById, campById } = useStore();
  const now = currentMonthKey();
  const mk = monthKey(year, month);
  const monthTasks = tasksInMonths(scoped, [mk]);
  const monthSt = planStats(monthTasks);
  const q = quarterOf(month);
  const quarterSt = planStats(tasksInMonths(scoped, QUARTERS[q - 1].months.map((m) => monthKey(year, m))));
  const yearSt = planStats(tasksInMonths(scoped, Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1))));

  // Төлөвлөөгүй боловч энэ сард дууссан ажил
  const extraDone = scoped.filter((t) => !t.planned_month && t.completed_at?.startsWith(mk));

  const people = [...profiles.filter((p) => p.active), null]
    .map((p) => {
      const own = monthTasks.filter((t) => (p ? t.assignee_id === p.id : !t.assignee_id));
      return { p, ...planStats(own) };
    })
    .filter((r) => r.planned > 0 && (!who || r.p?.id === who));

  function exportCSV() {
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [["Сар", "Улирал", "Төлөвлөсөн", "Дууссан", "Хийгдэж буй", "Хэтэрсэн", "Гүйцэтгэл %"].join(",")];
    QUARTERS.forEach((qq) => {
      qq.months.forEach((m) => {
        const s = planStats(tasksInMonths(scoped, [monthKey(year, m)]));
        lines.push([MONTH_NAMES[m - 1], qq.label, s.planned, s.done, s.inProgress, s.overdue, s.pct ?? ""].map(esc).join(","));
      });
      const s = planStats(tasksInMonths(scoped, qq.months.map((m) => monthKey(year, m))));
      lines.push([`${qq.label} нийт`, "", s.planned, s.done, s.inProgress, s.overdue, s.pct ?? ""].map(esc).join(","));
    });
    lines.push([`${year} он нийт`, "", yearSt.planned, yearSt.done, yearSt.inProgress, yearSt.overdue, yearSt.pct ?? ""].map(esc).join(","));
    lines.push("");
    lines.push([`${monthLabel(mk, true)} — ажлууд`].join(","));
    lines.push(["Ажил", "Төлөв", "Хариуцагч", "Зуслан", "Хугацаа", "Дууссан огноо"].join(","));
    monthTasks.forEach((t) =>
      lines.push(
        [
          t.title,
          STATUSES.find((s) => s.id === t.status)?.label,
          t.assignee_id ? profileById.get(t.assignee_id)?.full_name : "",
          t.camp_id ? campById.get(t.camp_id)?.name : "",
          t.due_date,
          t.completed_at?.slice(0, 10),
        ]
          .map(esc)
          .join(","),
      ),
    );
    download(`zuca-tolovlogoo-${year}.csv`, "﻿" + lines.join("\n"));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-zinc-500">
          Гүйцэтгэл = төлөвлөсөн ажлаас дууссан нь. Ажлыг «Төлөвлөсөн сар»-аар нь тооцно.
        </p>
        <div className="flex gap-2">
          <Button onClick={exportCSV}>
            <Download size={15} /> CSV
          </Button>
          <Button onClick={() => window.print()}>
            <Printer size={15} /> Хэвлэх
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          [monthLabel(mk, true), monthSt],
          [`${year} · ${QUARTERS[q - 1].label}`, quarterSt],
          [`${year} он`, yearSt],
        ].map(([label, st]) => {
          const s = st as ReturnType<typeof planStats>;
          const tone = pctTone(s.pct);
          return (
            <Card key={label as string} className="p-4">
              <div className="text-xs font-medium text-zinc-500">{label as string}</div>
              <div className={cn("mt-1 text-3xl font-semibold tracking-tight", tone.text)}>{s.pct == null ? "—" : `${s.pct}%`}</div>
              <div className="mt-2">
                <Progress value={s.pct ?? 0} tone={tone.bar} />
              </div>
              <div className="tabular mt-1.5 text-[11px] text-zinc-500">
                {s.done}/{s.planned} дууссан · {s.inProgress} хийгдэж буй
                {s.overdue > 0 && <span className="text-red-600"> · {s.overdue} хэтэрсэн</span>}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Жилийн хүснэгт */}
      <Card className="overflow-hidden">
        <div className="px-5 pt-4 pb-3">
          <h2 className="text-[15px] font-semibold">{year} оны гүйцэтгэл — сар, улирлаар</h2>
        </div>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-y border-zinc-100 bg-zinc-50/70 text-xs text-zinc-500">
              <tr>
                <th className="py-2.5 pl-5 text-left font-medium">Хугацаа</th>
                <th className="px-3 text-right font-medium">Төлөвлөсөн</th>
                <th className="px-3 text-right font-medium">Дууссан</th>
                <th className="px-3 text-right font-medium">Хийгдэж буй</th>
                <th className="px-3 text-right font-medium">Хэтэрсэн</th>
                <th className="w-[30%] px-5 text-left font-medium">Гүйцэтгэл</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {QUARTERS.map((qq) => {
                const qs = planStats(tasksInMonths(scoped, qq.months.map((m) => monthKey(year, m))));
                return [
                  ...qq.months.map((m) => {
                    const k = monthKey(year, m);
                    const s = planStats(tasksInMonths(scoped, [k]));
                    return (
                      <Row
                        key={k}
                        label={
                          <span className={cn(k === mk && "font-semibold text-brand-700")}>
                            {MONTH_NAMES[m - 1]}
                            {k === now && <span className="ml-1.5 rounded-full bg-brand-50 px-1.5 text-[10px] font-semibold text-brand-700">Одоо</span>}
                          </span>
                        }
                        s={s}
                        future={k > now}
                      />
                    );
                  }),
                  <Row key={`q${qq.id}`} label={`${qq.label} нийт`} s={qs} strong future={monthKey(year, qq.months[0]) > now} />,
                ];
              })}
              <Row label={`${year} он нийт`} s={yearSt} strong total />
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr_1.3fr]">
        {/* Хүн тус бүр */}
        <Card className="overflow-hidden">
          <div className="px-5 pt-4 pb-3">
            <h2 className="text-[15px] font-semibold">{monthLabel(mk, true)} — хүн тус бүр</h2>
          </div>
          {people.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-zinc-400">Энэ сард төлөвлөсөн ажил алга.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
              {people.map((r) => {
                const tone = pctTone(r.pct);
                return (
                  <li key={r.p?.id ?? "none"} className="flex items-center gap-3 px-5 py-3">
                    <Avatar profile={r.p} size={28} />
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between text-sm">
                        <span className="truncate font-medium">{r.p?.full_name ?? "Хариуцагчгүй"}</span>
                        <span className="tabular text-zinc-500">
                          {r.done}/{r.planned}
                          <span className={cn("ml-2 font-semibold", tone.text)}>{r.pct}%</span>
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <Progress value={r.pct ?? 0} tone={tone.bar} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Ажлын жагсаалт */}
        <Card className="overflow-hidden">
          <div className="px-5 pt-4 pb-3">
            <h2 className="text-[15px] font-semibold">{monthLabel(mk, true)} — ажлууд</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {monthSt.done} дууссан, {monthSt.planned - monthSt.done} үлдсэн
              {extraDone.length > 0 && ` · төлөвлөгөөнөөс гадуур ${extraDone.length} ажил дууссан`}
            </p>
          </div>
          <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
            {[...monthTasks, ...extraDone]
              .sort((a, b) => Number(b.status === "done") - Number(a.status === "done"))
              .map((t) => {
                const st = STATUSES.find((s) => s.id === t.status)!;
                return (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                    <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[t.status])} title={st.label} />
                    <span className={cn("min-w-0 flex-1 truncate", t.status === "done" && "text-zinc-500")}>
                      {t.title}
                      {!t.planned_month && <span className="ml-1.5 rounded bg-zinc-100 px-1 text-[10px] text-zinc-500">төлөвлөгөөнөөс гадуур</span>}
                    </span>
                    <span className="hidden text-xs whitespace-nowrap text-zinc-400 sm:inline">{st.label}</span>
                    <Avatar profile={t.assignee_id ? profileById.get(t.assignee_id) : null} size={22} />
                  </li>
                );
              })}
            {monthTasks.length + extraDone.length === 0 && <li className="px-5 py-6 text-center text-sm text-zinc-400">Ажил алга</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, s, strong, total, future }: { label: React.ReactNode; s: ReturnType<typeof planStats>; strong?: boolean; total?: boolean; future?: boolean }) {
  const tone = pctTone(s.pct);
  return (
    <tr className={cn("border-b border-zinc-100", strong && "bg-zinc-50/70 font-semibold", total && "bg-zinc-100/80")}>
      <td className="py-2.5 pl-5">{label}</td>
      <td className="px-3 text-right">{s.planned || <span className="text-zinc-300">0</span>}</td>
      <td className="px-3 text-right text-emerald-700">{s.done || <span className="text-zinc-300">0</span>}</td>
      <td className="px-3 text-right">{s.inProgress || <span className="text-zinc-300">0</span>}</td>
      <td className={cn("px-3 text-right", s.overdue ? "text-red-600" : "")}>{s.overdue || <span className="text-zinc-300">0</span>}</td>
      <td className="px-5">
        {s.planned ? (
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Progress value={s.pct ?? 0} tone={future ? "bg-sky-300" : tone.bar} />
            </div>
            <span className={cn("w-10 text-right text-xs", future ? "text-zinc-400" : tone.text)}>{s.pct}%</span>
          </div>
        ) : (
          <span className="text-xs text-zinc-300">—</span>
        )}
      </td>
    </tr>
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
