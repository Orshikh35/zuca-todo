"use client";

import { Download, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { BarList, ColumnChart, SERIES } from "@/components/charts";
import { Avatar, Button, Card, PageHeader, Segmented } from "@/components/ui";
import { FIELD_CHECKS, completeness } from "@/lib/completeness";
import { download } from "@/lib/csv";
import { OWNERSHIPS, PRIORITIES, STAGES, STATUSES } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { inRange, periodStats, taskBuckets } from "@/lib/report";
import { cn, isOverdue, toISODate, todayISO } from "@/lib/utils";

type Range = "7" | "30" | "90";

// Ordinal цэнхэр шат (dataviz sequential ramp, 250→650)
const STAGE_RAMP = ["#86b6ef", "#5598e7", "#2a78d6", "#1c5cab", "#104281"];
const PRIORITY_HEX: Record<string, string> = { urgent: "#d03b3b", high: "#ec835a", medium: "#2a78d6", low: "#a1a1aa" };

export default function ReportsPage() {
  const { tasks, camps, profiles, campById } = useStore();
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
    const head = ["Гарчиг", "Төлөв", "Яаралтай байдал", "Хариуцагч", "Зуслан", "Хугацаа", "Дууссан", "Үүссэн", "Шошго"];
    const rows = tasks.map((t) =>
      [
        t.title,
        STATUSES.find((s) => s.id === t.status)?.label,
        PRIORITIES.find((p) => p.id === t.priority)?.label,
        profiles.find((p) => p.id === t.assignee_id)?.full_name,
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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric
          label="Дууссан ажил"
          value={stats.doneCount}
          foot={
            stats.prevDone || stats.doneCount ? (
              <span className={delta >= 0 ? "text-emerald-700" : "text-red-600"}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)} өмнөх үетэй харьцуулахад
              </span>
            ) : null
          }
        />
        <Metric label="Шинээр үүссэн" value={stats.created} foot={`${open.length} нээлттэй байна`} />
        <Metric
          label="Дундаж гүйцэтгэх хугацаа"
          value={stats.avgCycle == null ? "—" : stats.avgCycle.toFixed(1)}
          unit="хоног"
          foot="Үүссэнээс дуусах хүртэл"
        />
        <Metric
          label="Хугацаандаа дууссан"
          value={stats.onTimePct == null ? "—" : stats.onTimePct}
          unit={stats.onTimePct == null ? "" : "%"}
          foot="Хугацаатай ажлуудаас"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Ажлын урсгал" sub={days <= 14 ? "Өдөр бүрээр" : "7 хоног бүрээр"}>
          <ColumnChart
            buckets={buckets}
            series={[
              { name: "Шинээр үүссэн", color: SERIES[0] },
              { name: "Дууссан", color: SERIES[1] },
            ]}
          />
        </Panel>
        <Panel title="Нээлттэй ажил — яаралтай байдлаар">
          <BarList
            rows={PRIORITIES.map((p) => ({
              label: p.label,
              value: open.filter((t) => t.priority === p.id).length,
              color: PRIORITY_HEX[p.id],
            }))}
          />
          <div className="mt-5 border-t border-zinc-100 pt-4">
            <div className="mb-2 text-xs font-medium text-zinc-500">Төлөвөөр</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {STATUSES.map((s) => (
                <div key={s.id} className="rounded-lg bg-zinc-50 py-2">
                  <div className="tabular text-lg font-semibold">{tasks.filter((t) => t.status === s.id).length}</div>
                  <div className="text-[11px] text-zinc-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Багийн гишүүд" sub={`Дууссан = сүүлийн ${days} хоногт`} className="mt-6" flush>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-y border-zinc-100 bg-zinc-50/70 text-xs text-zinc-500">
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

      <div className="mt-6 grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
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

function Metric({ label, value, unit, foot }: { label: string; value: number | string; unit?: string; foot?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className="mt-1.5 text-3xl font-semibold tracking-tight">
        {value}
        {unit && <span className="ml-1 text-base font-medium text-zinc-400">{unit}</span>}
      </div>
      {foot && <div className="mt-1 text-[11px] text-zinc-400">{foot}</div>}
    </Card>
  );
}

function Panel({ title, sub, children, className, flush }: { title: string; sub?: string; children: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <Card className={cn("break-inside-avoid", className)}>
      <div className="px-5 pt-4 pb-3">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
      </div>
      <div className={flush ? "pb-2" : "px-5 pb-5"}>{children}</div>
    </Card>
  );
}
