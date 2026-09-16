"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/* Өнгө — dataviz reference palette (categorical 1, 2) */
export const SERIES = ["#2a78d6", "#eb6834"] as const;

/* ─────────── Horizontal bar list ─────────── */
export function BarList({
  rows,
  unit = "",
  empty = "Өгөгдөл алга",
}: {
  rows: { label: string; value: number; color?: string; hint?: string; extra?: string }[];
  unit?: string;
  empty?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-sm text-zinc-400">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} className="group" title={`${r.label}: ${r.value}${unit}${r.hint ? ` · ${r.hint}` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-zinc-700">{r.label}</span>
            <span className="tabular shrink-0 font-semibold text-zinc-900">
              {r.extra && <span className="mr-2 text-xs font-normal text-zinc-400">{r.extra}</span>}
              {r.value}
              {unit && <span className="ml-0.5 font-normal text-zinc-400">{unit}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full transition-all duration-500 group-hover:brightness-110"
              style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value ? 6 : 0, background: r.color ?? SERIES[0] }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ─────────── Grouped column chart ─────────── */
export function ColumnChart({
  buckets,
  series,
  height = 220,
}: {
  buckets: { label: string; full: string; values: number[] }[];
  series: { name: string; color: string }[];
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...buckets.flatMap((b) => b.values));
  const niceMax = Math.max(4, Math.ceil(max / 4) * 4);
  const ticks = [0, 1, 2, 3, 4].map((i) => (niceMax / 4) * i);

  return (
    <div>
      {/* Legend */}
      <div className="mb-3 flex gap-4 text-xs text-zinc-600">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>

      <div className="relative flex" style={{ height }}>
        {/* Y тэнхлэг */}
        <div className="tabular relative w-7 shrink-0 text-[10px] text-zinc-400">
          {ticks.map((t) => (
            <span key={t} className="absolute right-2" style={{ bottom: `${(t / niceMax) * 100}%`, transform: "translateY(50%)" }}>
              {t}
            </span>
          ))}
        </div>

        <div className="relative flex-1">
          {ticks.map((t) => (
            <div
              key={t}
              className={cn("absolute inset-x-0 border-t", t === 0 ? "border-zinc-300" : "border-zinc-100")}
              style={{ bottom: `${(t / niceMax) * 100}%` }}
            />
          ))}
          <div className="absolute inset-0 flex items-end">
            {buckets.map((b, i) => (
              <div
                key={b.full}
                className="relative flex h-full min-w-0 flex-1 items-end justify-center"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {hover === i && <div className="absolute inset-0 rounded-md bg-zinc-100/70" />}
                <div className="relative flex h-full w-3/4 max-w-12 items-end justify-center gap-[2px]">
                  {b.values.map((v, si) => (
                    <div
                      key={si}
                      className="min-w-0 flex-1 rounded-t-[4px]"
                      style={{ height: `${(v / niceMax) * 100}%`, minHeight: v ? 3 : 0, background: series[si].color }}
                    />
                  ))}
                </div>
                {hover === i && (
                  <div className="pointer-events-none absolute bottom-full z-10 mb-1 min-w-32 rounded-lg bg-zinc-900 px-2.5 py-2 text-xs whitespace-nowrap text-white shadow-lift">
                    <div className="mb-1 font-medium text-zinc-300">{b.full}</div>
                    {series.map((s, si) => (
                      <div key={s.name} className="flex items-center gap-1.5">
                        <span className="size-2 rounded-sm" style={{ background: s.color }} />
                        <span className="flex-1">{s.name}</span>
                        <span className="tabular font-semibold">{b.values[si]}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* X тэнхлэг */}
      <div className="ml-7 flex">
        {buckets.map((b, i) => (
          <div
            key={b.full}
            className={cn(
              "flex-1 truncate pt-1.5 text-center text-[10px]",
              hover === i ? "font-medium text-zinc-800" : "text-zinc-400",
              buckets.length > 14 && i % 2 === 1 && "invisible",
            )}
          >
            {b.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Stacked segment bar ─────────── */
export function StackBar({ parts }: { parts: { label: string; value: number; className: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        {parts.map((p) =>
          p.value ? (
            <div key={p.label} title={`${p.label}: ${p.value}`} className={cn("h-full first:rounded-l-full last:rounded-r-full", p.className)} style={{ width: `${(p.value / total) * 100}%` }} />
          ) : null,
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", p.className)} />
            {p.label} <b className="tabular font-semibold text-zinc-900">{p.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
