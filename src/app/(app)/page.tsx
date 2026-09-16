"use client";

import { AlertTriangle, ArrowRight, CalendarClock, Check, Flame, ListTodo, Tent } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CampDrawer } from "@/components/camps/camp-drawer";
import { ColumnChart, SERIES, StackBar } from "@/components/charts";
import { TaskModal } from "@/components/tasks/task-modal";
import { Avatar, Card, Empty, PriorityChip, Progress } from "@/components/ui";
import { PRIORITY_RANK, STAGES } from "@/lib/constants";
import { completeness, scoreTone } from "@/lib/completeness";
import { useStore } from "@/lib/data/store";
import { greeting, periodStats, taskBuckets } from "@/lib/report";
import { currentMonthKey, monthLabel, pctTone, planStats, tasksInMonths } from "@/lib/plan";
import type { Task } from "@/lib/types";
import { cn, dueLabel, isOverdue } from "@/lib/utils";

const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

const STAGE_BG: Record<string, string> = {
  lead: "bg-zinc-300",
  contacted: "bg-sky-400",
  onboarding: "bg-amber-400",
  active: "bg-emerald-500",
  inactive: "bg-rose-300",
};

export default function Dashboard() {
  const { me, tasks, camps, profileById, campById, updateTask } = useStore();
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [openCamp, setOpenCamp] = useState<string | null>(null);

  const open = tasks.filter((t) => t.status !== "done");
  const mine = open.filter((t) => t.assignee_id === me?.id);
  const urgent = open.filter((t) => t.priority === "urgent");
  const overdue = open.filter((t) => isOverdue(t.due_date, false));

  const focus = useMemo(
    () =>
      [...open]
        .sort((a, b) => {
          const oa = Number(isOverdue(a.due_date, false)), ob = Number(isOverdue(b.due_date, false));
          if (oa !== ob) return ob - oa;
          if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority]) return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
          return (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
        })
        .slice(0, 8),
    [open],
  );

  const weakCamps = useMemo(
    () =>
      camps
        .filter((c) => c.stage !== "inactive")
        .map((c) => ({ c, ...completeness(c) }))
        .filter((x) => !x.complete)
        .sort((a, b) => {
          // Идэвхтэй зуслангууд эхэнд — эцэг эхчүүд харж байгаа
          const aa = Number(a.c.stage === "active"), ab = Number(b.c.stage === "active");
          return ab - aa || a.score - b.score;
        })
        .slice(0, 6),
    [camps],
  );
  const missingTotal = camps.filter((c) => c.stage !== "inactive" && !completeness(c).complete).length;

  const week = periodStats(tasks, 7);
  const thisMonth = currentMonthKey();
  const monthPlan = planStats(tasksInMonths(tasks, [thisMonth]));
  const buckets = taskBuckets(tasks, 7);

  const now = new Date();
  const today = `${now.getMonth() + 1}-р сарын ${now.getDate()}, ${WEEKDAYS[now.getDay()]}`;

  return (
    <>
      <div className="mb-7">
        <p className="text-sm text-zinc-500">{today}</p>
        <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">
          {greeting()}, {me?.full_name}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi href="/tasks" icon={<ListTodo size={18} />} label="Миний нээлттэй ажил" value={mine.length} tint="bg-brand-50 text-brand-600" />
        <Kpi href="/tasks" icon={<Flame size={18} />} label="Яаралтай" value={urgent.length} tint="bg-red-50 text-red-600" />
        <Kpi href="/tasks" icon={<AlertTriangle size={18} />} label="Хугацаа хэтэрсэн" value={overdue.length} tint="bg-orange-50 text-orange-600" alert={overdue.length > 0} />
        <Kpi href="/camps" icon={<Tent size={18} />} label="Мэдээлэл дутуу зуслан" value={missingTotal} tint="bg-amber-50 text-amber-600" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHead title="Анхаарах ажлууд" sub="Хэтэрсэн → яаралтай → хугацаагаар" href="/tasks" />
          {focus.length === 0 ? (
            <Empty icon={<Check size={32} />} title="Бүх ажил хийгдсэн байна" hint="Сайн байна!" />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {focus.map((t) => {
                const due = dueLabel(t.due_date);
                const camp = t.camp_id ? campById.get(t.camp_id) : null;
                return (
                  <li key={t.id} className="group flex items-center gap-3 px-5 py-2.5 hover:bg-zinc-50">
                    <button
                      title="Дууссан болгох"
                      onClick={() => void updateTask(t.id, { status: "done" })}
                      className="flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-zinc-300 text-transparent transition hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-600"
                    >
                      <Check size={11} strokeWidth={3} />
                    </button>
                    <button onClick={() => setOpenTask(t)} className="min-w-0 flex-1 cursor-pointer text-left">
                      <div className="truncate text-sm font-medium">{t.title}</div>
                      {camp && <div className="truncate text-xs text-zinc-400">{camp.name}</div>}
                    </button>
                    <PriorityChip priority={t.priority} />
                    {due && (
                      <span
                        className={cn(
                          "hidden w-28 items-center justify-end gap-1 text-xs sm:inline-flex",
                          due.tone === "overdue" ? "font-medium text-red-600" : due.tone === "today" ? "text-orange-600" : "text-zinc-400",
                        )}
                      >
                        <CalendarClock size={12} /> {due.text}
                      </span>
                    )}
                    <Avatar profile={t.assignee_id ? profileById.get(t.assignee_id) : null} size={24} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHead title="Мэдээлэл дутуу зуслангууд" sub="ZUCA дээр идэвхтэй нь эхэнд" href="/camps" />
          {weakCamps.length === 0 ? (
            <Empty icon={<Tent size={32} />} title="Бүх зуслангийн мэдээлэл бүрэн" />
          ) : (
            <ul className="divide-y divide-zinc-100">
              {weakCamps.map(({ c, score, missing }) => {
                const tone = scoreTone(score);
                return (
                  <li key={c.id}>
                    <button onClick={() => setOpenCamp(c.id)} className="w-full cursor-pointer px-5 py-3 text-left hover:bg-zinc-50">
                      <div className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", STAGES.find((s) => s.id === c.stage)!.dot)} />
                        <span className="flex-1 truncate text-sm font-medium">{c.name}</span>
                        <span className={cn("tabular text-xs font-semibold", tone.text)}>{score}%</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <div className="w-24 shrink-0">
                          <Progress value={score} tone={tone.bar} />
                        </div>
                        <span className="min-w-0 truncate text-xs text-zinc-500">{missing.map((m) => m.label).join(", ")}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHead
            title="Энэ 7 хоног"
            sub={
              <>
                <b className="text-zinc-800">{week.doneCount}</b> ажил дууссан
                {week.prevDone > 0 && (
                  <span className={cn("ml-1.5", week.doneCount >= week.prevDone ? "text-emerald-700" : "text-red-600")}>
                    ({week.doneCount >= week.prevDone ? "▲" : "▼"} өмнөх 7 хоног {week.prevDone})
                  </span>
                )}
              </>
            }
            href="/reports"
            linkLabel="Тайлан"
          />
          <div className="px-5 pb-5">
            <ColumnChart
              height={170}
              buckets={buckets}
              series={[
                { name: "Шинэ", color: SERIES[0] },
                { name: "Дууссан", color: SERIES[1] },
              ]}
            />
          </div>
        </Card>

        <div className="flex min-w-0 flex-col gap-6">
        <Card>
          <CardHead title={`${monthLabel(thisMonth)}ын төлөвлөгөө`} sub={`${monthPlan.done}/${monthPlan.planned} ажил дууссан`} href="/plan?view=month" linkLabel="Төлөвлөгөө" />
          <div className="flex items-center gap-3 px-5 pb-5">
            <div className="flex-1">
              <Progress value={monthPlan.pct ?? 0} tone={pctTone(monthPlan.pct).bar} />
            </div>
            <span className={cn("tabular text-lg font-semibold", pctTone(monthPlan.pct).text)}>{monthPlan.pct == null ? "—" : `${monthPlan.pct}%`}</span>
          </div>
        </Card>
        <Card>
          <CardHead title="Зуслан татах явц" sub={`${camps.length} зуслан бүртгэлтэй`} href="/camps" />
          <div className="px-5 pb-5">
            <StackBar
              parts={STAGES.map((s) => ({ label: s.label, value: camps.filter((c) => c.stage === s.id).length, className: STAGE_BG[s.id] }))}
            />
          </div>
        </Card>
        </div>
      </div>

      <TaskModal open={!!openTask} task={openTask} onClose={() => setOpenTask(null)} />
      <CampDrawer open={!!openCamp} camp={openCamp ? campById.get(openCamp) : null} onClose={() => setOpenCamp(null)} />
    </>
  );
}

function Kpi({ icon, label, value, tint, href, alert }: { icon: React.ReactNode; label: string; value: number; tint: string; href: string; alert?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "group rounded-2xl border bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:shadow-md",
        alert ? "border-orange-200" : "border-zinc-200/70",
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("flex size-9 items-center justify-center rounded-xl", tint)}>{icon}</span>
        <ArrowRight size={15} className="text-zinc-300 transition group-hover:translate-x-0.5 group-hover:text-zinc-500" />
      </div>
      <div className="tabular mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs font-medium text-zinc-500">{label}</div>
    </Link>
  );
}

function CardHead({ title, sub, href, linkLabel = "Бүгдийг харах" }: { title: string; sub?: React.ReactNode; href?: string; linkLabel?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
      </div>
      {href && (
        <Link href={href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
          {linkLabel} <ArrowRight size={12} />
        </Link>
      )}
    </div>
  );
}
