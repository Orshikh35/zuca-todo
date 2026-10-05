"use client";

import { Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { Donut, Hero, HeroChip, PillBars, Tile } from "@/components/bento";
import { BarList, SERIES } from "@/components/charts";
import { Avatar, Button, Card, PageHeader, Segmented } from "@/components/ui";
import { FIELD_CHECKS, completeness } from "@/lib/completeness";
import { download } from "@/lib/csv";
import { OWNERSHIPS, PRIORITIES, STAGES, STATUSES } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { inRange, periodStats, taskBuckets } from "@/lib/report";
import { taskDeptId } from "@/lib/permissions";
import { cn, isOverdue, toISODate, todayISO } from "@/lib/utils";

type Range = "7" | "30" | "90";

// Ordinal цэнхэр шат (dataviz sequential ramp, 250→650)
const STAGE_RAMP = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"];
const PRIORITY_HEX: Record<string, string> = { urgent: "#d03b3b", high: "#ec835a", medium: "#2a78d6", low: "#a1a1aa" };

export default function ReportsPage() {
  const { tasks, camps, profiles, campById, departments, profileById } = useStore();
  const [range, setRange] = useState<Range>("30");
  const days = Number(range);

  const stats = useMemo(() => periodStats(tasks, days), [tasks, days]);
  const buckets = useMemo(() => taskBuckets(tasks, days), [tasks, days]);
  const open = tasks.filter((t) => t.status !== "done");

  const people = useMemo(
    () =>
      [...profiles, null].map((p) => {
        const own = tasks.filter((t) => (p ? t.assignee_id === p.id : !t.assignee_id));
        const o = own.filter((t) => t.status !== "done");
        return {
          p,
          open: o.length,
          urgent: o.filter((t) => t.priority === "urgent").length,
          overdue: o.filter((t) => isOverdue(t.due_date, false)).length,
          done: own.filter((t) => inRange(t.completed_at, stats.from)).length,
        };
      }).filter((r) => r.p || r.open),
    [profiles, tasks, stats.from],
  );
  const maxDone = Math.max(1, ...people.map((r) => r.done));

  // Хэлтэс бүрийн гүйцэтгэл
  const deptRows = useMemo(() => {
    return departments.map((d) => {
      const own = tasks.filter((t) => taskDeptId(t, profileById) === d.id);
      const o = own.filter((t) => t.status !== "done");
      const done = own.filter((t) => inRange(t.completed_at, stats.from));
      const withDue = done.filter((t) => t.due_date);
      const onTime = withDue.filter((t) => toISODate(new Date(t.completed_at!)) <= t.due_date!).length;
      const members = profiles.filter((p) => p.active && p.department_id === d.id);
      return {
        d,
        members: members.length,
        open: o.length,
        overdue: o.filter((t) => isOverdue(t.due_date, false)).length,
        done: done.length,
        onTimePct: withDue.length ? Math.round((onTime / withDue.length) * 100) : null,
        incoming: own.filter((t) => t.from_department_id && inRange(t.created_at, stats.from)).length,
      };
    });
  }, [departments, tasks, profiles, profileById, stats.from]);

  const scored = camps.map((c) => ({ c, ...completeness(c) }));
  const activeish = scored.filter((x) => x.c.stage !== "inactive");

  const missingByField = FIELD_CHECKS.map((f) => ({
    label: f.label,
    value: activeish.filter((x) => x.missing.some((m) => m.key === f.key)).length,
    color: "#eda100",
  }))
    .filter((r) => r.value)
    .sort((a, b) => b.value - a.value);

  const byAimag = Object.entries(
    camps.reduce<Record<string, number>>((acc, c) => {
      const k = c.aimag ?? "Тодорхойгүй";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const completeBands = [
    { label: "90–100% (бүрэн)", value: activeish.filter((x) => x.score >= 90).length, color: "#0ca30c" },
    { label: "60–89% (дутуу)", value: activeish.filter((x) => x.score >= 60 && x.score < 90).length, color: "#eda100" },
    { label: "0–59% (их дутуу)", value: activeish.filter((x) => x.score < 60).length, color: "#d03b3b" },
  ];

  function exportTasks() {
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = ["Гарчиг", "Төлөв", "Яаралтай байдал", "Хариуцагч", "Хэлтэс", "Хүсэлт гаргасан", "Зуслан", "Хугацаа", "Дууссан", "Үүссэн", "Шошго"];
    const rows = tasks.map((t) =>
      [
        t.title,
        STATUSES.find((s) => s.id === t.status)?.label,
        PRIORITIES.find((p) => p.id === t.priority)?.label,
        profiles.find((p) => p.id === t.assignee_id)?.full_name,
        departments.find((d) => d.id === taskDeptId(t, profileById))?.name,
        departments.find((d) => d.id === t.from_department_id)?.name,
        t.camp_id ? campById.get(t.camp_id)?.name : "",
        t.due_date,
        t.completed_at?.slice(0, 10),
        t.created_at.slice(0, 10),
        t.tags.join(" "),
      ]
        .map(esc)
        .join(","),
    );
    download(`zuca-ajil-${todayISO()}.csv`, "﻿" + [head.join(","), ...rows].join("\n"));
  }

  const delta = stats.doneCount - stats.prevDone;

  return (
    <>
      <PageHeader
        title="Тайлан"
        subtitle={`Сүүлийн ${days} хоног · ${toISODate(stats.from)} – өнөөдөр`}
        actions={
          <>
            <Segmented
              value={range}
              onChange={setRange}
              options={[
                { id: "7", label: "7 хоног" },
                { id: "30", label: "30 хоног" },
                { id: "90", label: "90 хоног" },
              ]}
            />
            <Button onClick={exportTasks}>
              <Download size={15} /> CSV
            </Button>
            <Button onClick={() => window.print()} className="print:hidden">
              <Printer size={15} /> Хэвлэх
            </Button>
          </>
        }
      />

      {/* Bento товчоо */}
      <div className="flex flex-wrap gap-4">
        <Hero
          tone="lime"
          className="min-w-0 flex-[2_1_340px]"
          title="Дууссан ажил"
          value={`+${stats.doneCount}`}
          unit={`сүүлийн ${days} хоногт`}
          chips={
            <>
              {(stats.prevDone > 0 || stats.doneCount > 0) && (
                <HeroChip>
                  {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} өмнөх үеэс
                </HeroChip>
              )}
              <HeroChip>🆕 Шинэ {stats.created}</HeroChip>
              <HeroChip>📂 Нээлттэй {open.length}</HeroChip>
            </>
          }
        />
        <Tile
          className="flex-[1_1_190px]"
          tint="violet"
          title="Дундаж хугацаа"
          value={
            <>
              {stats.avgCycle == null ? "—" : stats.avgCycle.toFixed(1)}
              <span className="ml-1 text-base font-medium text-zinc-400">хоног</span>
            </>
          }
          caption="Үүссэнээс дуусах хүртэл"
        />
        <Tile
          className="flex-[1_1_190px]"
          tint="emerald"
          title="Хугацаандаа"
          value={stats.onTimePct == null ? "—" : `${stats.onTimePct}%`}
          caption="Хугацаатай ажлуудаас"
          chip={stats.onTimePct == null ? null : stats.onTimePct >= 80 ? { text: "Сайн", tone: "good" } : stats.onTimePct >= 50 ? { text: "Дунд", tone: "warn" } : { text: "Сул", tone: "bad" }}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Ажлын урсгал" sub={`${days <= 14 ? "Өдөр бүрээр" : "7 хоног бүрээр"} дууссан ажил`}>
          <PillBars
            data={buckets.map((b, i) => ({
              label: b.label,
              value: b.values[1],
              hint: `${b.full}: ${b.values[1]} дууссан, ${b.values[0]} шинэ`,
              active: i === buckets.length - 1,
            }))}
            format={(v) => `+${v}`}
          />
        </Panel>
        <Panel title="Нээлттэй ажлын бүтэц">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <Donut
              parts={PRIORITIES.map((p) => ({ label: p.label, value: open.filter((t) => t.priority === p.id).length, color: PRIORITY_HEX[p.id] }))}
              center={
                <>
                  <span className="text-xs text-zinc-500">Нийт</span>
                  <span className="tabular text-3xl font-semibold">{open.length}</span>
                </>
              }
            />
            <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3">
              {PRIORITIES.map((p) => {
                const n = open.filter((t) => t.priority === p.id).length;
                return (
                  <div key={p.id}>
                    <div className="text-xs text-zinc-500">{p.label}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-lg font-semibold">
                      <span className="h-4 w-1 rounded-full" style={{ background: PRIORITY_HEX[p.id] }} />
                      {n}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-4 gap-2 text-center">
            {STATUSES.map((s) => (
              <div key={s.id} className="rounded-2xl bg-zinc-100 py-2">
                <div className="tabular text-lg font-semibold">{tasks.filter((t) => t.status === s.id).length}</div>
                <div className="text-[11px] text-zinc-500">{s.label}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {deptRows.length > 0 && (
        <Panel title="Хэлтсүүд" sub={`Сүүлийн ${days} хоног`} className="mt-4" flush>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-y border-zinc-100 text-xs text-zinc-500">
                <tr>
                  <th className="py-2.5 pl-5 text-left font-medium">Хэлтэс</th>
                  <th className="px-3 text-right font-medium">Хүн</th>
                  <th className="px-3 text-right font-medium">Нээлттэй</th>
                  <th className="px-3 text-right font-medium">Хэтэрсэн</th>
                  <th className="px-3 text-right font-medium">Дууссан</th>
                  <th className="px-3 text-right font-medium">Хугацаандаа</th>
                  <th className="px-5 text-right font-medium">Ирсэн хүсэлт</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-zinc-100">
                {deptRows.map((r) => (
                  <tr key={r.d.id}>
                    <td className="py-2.5 pl-5">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span className="size-2.5 rounded-full" style={{ background: r.d.color }} />
                        {r.d.name}
                      </span>
                    </td>
                    <td className="px-3 text-right text-zinc-500">{r.members}</td>
                    <td className="px-3 text-right">{r.open}</td>
                    <td className={cn("px-3 text-right", r.overdue ? "font-semibold text-red-600" : "text-zinc-300")}>{r.overdue}</td>
                    <td className="px-3 text-right font-semibold">{r.done}</td>
                    <td className={cn("px-3 text-right", r.onTimePct == null ? "text-zinc-300" : r.onTimePct >= 80 ? "text-emerald-700" : r.onTimePct >= 50 ? "text-amber-700" : "text-red-600")}>
                      {r.onTimePct == null ? "—" : `${r.onTimePct}%`}
                    </td>
                    <td className="px-5 text-right text-zinc-600">{r.incoming || <span className="text-zinc-300">0</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <Panel title="Багийн гишүүд" sub={`Дууссан = сүүлийн ${days} хоногт`} className="mt-4" flush>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-y border-zinc-100 text-xs text-zinc-500">
              <tr>
                <th className="py-2.5 pl-5 text-left font-medium">Гишүүн</th>
                <th className="px-3 text-right font-medium">Нээлттэй</th>
                <th className="px-3 text-right font-medium">Яаралтай</th>
                <th className="px-3 text-right font-medium">Хэтэрсэн</th>
                <th className="w-[35%] px-5 text-left font-medium">Дууссан</th>
              </tr>
            </thead>
            <tbody className="tabular divide-y divide-zinc-100">
              {people.map((r) => (
                <tr key={r.p?.id ?? "none"}>
                  <td className="py-2.5 pl-5">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Avatar profile={r.p} size={24} />
                      {r.p?.full_name ?? <span className="text-zinc-400">Хариуцагчгүй</span>}
                    </span>
                  </td>
                  <td className="px-3 text-right">{r.open}</td>
                  <td className={cn("px-3 text-right", r.urgent ? "font-semibold text-red-600" : "text-zinc-300")}>{r.urgent}</td>
                  <td className={cn("px-3 text-right", r.overdue ? "font-semibold text-red-600" : "text-zinc-300")}>{r.overdue}</td>
                  <td className="px-5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 rounded-full bg-zinc-100">
                        <div className="h-full rounded-full" style={{ width: `${(r.done / maxDone) * 100}%`, minWidth: r.done ? 6 : 0, background: SERIES[1] }} />
                      </div>
                      <span className="w-6 text-right font-semibold">{r.done}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Зуслан татах шат" sub={`${camps.length} зуслан`}>
          <BarList rows={STAGES.map((s, i) => ({ label: s.label, value: camps.filter((c) => c.stage === s.id).length, color: STAGE_RAMP[i] }))} />
        </Panel>
        <Panel title="Мэдээллийн бүрэн байдал" sub="Идэвхгүйг оруулаагүй">
          <BarList rows={completeBands} />
        </Panel>
        <Panel title="Хамгийн их дутуу мэдээлэл" sub="Хэдэн зусланд дутуу">
          <BarList rows={missingByField} unit=" зуслан" empty="Дутуу мэдээлэл алга" />
        </Panel>
        <Panel title="Өмчийн хэлбэрээр" sub="Нийт зуслан, үүнээс zuca.mn дээр байгаа нь">
          <BarList
            rows={[...OWNERSHIPS.map((o) => ({ id: o.id as string | null, label: o.label })), { id: null, label: "Тодорхойгүй" }].map((o, i) => {
              const all = camps.filter((c) => c.ownership === o.id);
              const onZuca = all.filter((c) => c.stage === "active").length;
              return { label: o.label, value: all.length, color: ["#2a78d6", "#1baf7a", "#4a3aa7", "#eda100", "#e87ba4", "#a1a1aa"][i], hint: `ZUCA дээр ${onZuca}`, extra: onZuca ? `zuca.mn: ${onZuca}` : undefined };
            })}
          />
        </Panel>
        <Panel title="Аймгаар" sub="Эхний 10">
          <BarList rows={byAimag} />
        </Panel>
      </div>
    </>
  );
}

function Panel({ title, sub, children, className, flush }: { title: string; sub?: string; children: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <Card className={cn("break-inside-avoid", className)}>
      <div className="px-5 pt-5 pb-3 sm:px-6">
        <h2 className="text-lg font-medium tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
      </div>
      <div className={flush ? "pb-2" : "px-5 pb-5 sm:px-6"}>{children}</div>
    </Card>
  );
}
