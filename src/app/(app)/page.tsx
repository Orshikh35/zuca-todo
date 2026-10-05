"use client";

import { ArrowRight, CalendarClock, Check, Plus, RefreshCw, Sparkles, Star, Sun, Tent } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { AiPanel } from "@/components/agent/ai-panel";
import { CardTitle, Donut, PillBars, Tile } from "@/components/bento";
import { CampDrawer } from "@/components/camps/camp-drawer";
import { TaskModal, type TaskDraft } from "@/components/tasks/task-modal";
import { Avatar, Card, PriorityChip } from "@/components/ui";
import { PRIORITIES, PRIORITY_RANK, STATUSES } from "@/lib/constants";
import { completeness } from "@/lib/completeness";
import { useStore } from "@/lib/data/store";
import { atLeast } from "@/lib/permissions";
import { greeting, periodStats, taskBuckets } from "@/lib/report";
import type { Task, ZucaShift } from "@/lib/types";
import { syncedLabel, useZucaLive, useZucaSyncNow } from "@/lib/zuca/hooks";
import { cn, dueLabel, isOverdue, todayISO } from "@/lib/utils";

const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
const PRIO_COLOR: Record<Task["priority"], string> = { urgent: "#ff6b8b", high: "#ffb34d", medium: "#8b8cff", low: "#bdeb5c" };
const CARD_TONES = [
  "from-[#c9b8ff] to-[#9d8bff]",
  "from-[#dff77e] to-[#8fe7c4]",
  "from-[#ffc29a] to-[#ff94ad]",
];

export default function Dashboard() {
  const { me, tasks, camps, toast } = useStore();
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [openCamp, setOpenCamp] = useState<string | null>(null);
  const lead = atLeast(me, "manager");

  const open = tasks.filter((t) => t.status !== "done");
  const mine = open.filter((t) => t.assignee_id === me?.id);
  // Удирдлага багийн, ажилтан өөрийн тоог харна
  const scope = lead ? tasks : tasks.filter((t) => t.assignee_id === me?.id);
  const scopeOpen = scope.filter((t) => t.status !== "done");
  const overdue = scopeOpen.filter((t) => isOverdue(t.due_date, false));
  const urgent = scopeOpen.filter((t) => t.priority === "urgent");
  const dueToday = mine.filter((t) => t.due_date === todayISO()).length;
  const week = periodStats(scope, 7);
  const change = week.prevDone ? Math.round(((week.doneCount - week.prevDone) / week.prevDone) * 100) : null;

  const weeks = useMemo(() => taskBuckets(scope, 42), [scope]);
  const byPrio = PRIORITIES.map((p) => ({ label: p.label, value: scopeOpen.filter((t) => t.priority === p.id).length, color: PRIO_COLOR[p.id] }));

  const focus = useMemo(
    () =>
      [...mine]
        .sort((a, b) => {
          const oa = Number(isOverdue(a.due_date, false));
          const ob = Number(isOverdue(b.due_date, false));
          return ob - oa || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
        })
        .slice(0, 6),
    [mine],
  );
  const recent = useMemo(() => [...scope].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6), [scope]);
  const weakCamps = useMemo(
    () =>
      camps
        .filter((c) => c.stage === "active" || c.stage === "onboarding")
        .map((c) => ({ c, ...completeness(c) }))
        .filter((x) => !x.complete)
        .sort((a, b) => a.score - b.score)
        .slice(0, 4),
    [camps],
  );

  const now = new Date();
  const today = `${now.getMonth() + 1}-р сарын ${now.getDate()}, ${WEEKDAYS[now.getDay()]}`;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-zinc-500">{today}</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-[2.6rem] sm:leading-[1.1]">
            {greeting()}, {me?.full_name.split(/\s+/)[0]}
          </h1>
        </div>
        <div className="flex gap-2">
          <a
            href="#ai"
            className="glass inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-zinc-700 hover:text-zinc-900"
          >
            <Sparkles size={15} /> AI-д хэлэх
          </a>
          <button
            onClick={() => setDraft({ assignee_id: me?.id ?? null })}
            className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            <Plus size={16} /> Шинэ ажил
          </button>
        </div>
      </div>

      {/* Bento: зүүн — ажил, баруун — zuca.mn. Flex тул өргөнд зөөлөн зохицно */}
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            {/* ── Hero ── */}
            <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-[#86ebc6] via-[#c2f27c] to-[#eef98f] p-6 text-neutral-900 shadow-[0_20px_50px_-24px_rgba(120,200,120,0.7)] min-w-0 flex-[2_1_340px] sm:p-7">
              <div className="pointer-events-none absolute -right-16 -bottom-24 size-72 rotate-12 rounded-[3rem] bg-white/25" />
              <div className="pointer-events-none absolute right-24 -bottom-10 size-40 rotate-12 rounded-[2rem] bg-neutral-900/5" />
              <div className="relative flex h-full flex-col">
                <div className="text-[15px] font-medium">Миний нээлттэй ажил</div>
                <div className="mt-2 flex items-start gap-1">
                  <span className="tabular text-6xl font-semibold tracking-tight sm:text-7xl">{mine.length}</span>
                  <span className="mt-2 text-sm font-medium opacity-70">ажил</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[13px]">
                  <span className="rounded-full bg-white/50 px-2.5 py-1">⏰ Өнөөдөр {dueToday}</span>
                  <span className="rounded-full bg-white/50 px-2.5 py-1">
                    ⚠️ Хэтэрсэн {mine.filter((t) => isOverdue(t.due_date, false)).length}
                  </span>
                  <span className="rounded-full bg-white/50 px-2.5 py-1">🔥 Яаралтай {mine.filter((t) => t.priority === "urgent").length}</span>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-8">
                  <Link href={`/tasks?who=${me?.id ?? ""}`} className="inline-flex h-11 items-center rounded-full bg-neutral-900 px-6 text-sm font-medium text-white hover:bg-neutral-800">
                    Миний ажлууд
                  </Link>
                  <button
                    onClick={() => setDraft({ assignee_id: me?.id ?? null })}
                    className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-white/90 pr-1.5 pl-5 text-sm font-medium hover:bg-white"
                  >
                    Шинэ ажил
                    <span className="grid size-8 place-items-center rounded-full border border-neutral-900/15">
                      <Plus size={15} />
                    </span>
                  </button>
                </div>
              </div>
            </section>
            <div className="flex min-w-0 flex-[1_1_210px] flex-col gap-4">
              {/* ── Дууссан ── */}
              <Tile
                className="flex-1"
                tint="emerald"
                title={lead ? "Багийн гүйцэтгэл" : "Дууссан"}
                value={`+${week.doneCount}`}
                caption="Энэ 7 хоногт дууссан"
                chip={change === null ? null : { text: `${change > 0 ? "+" : ""}${change}%`, tone: change >= 0 ? "good" : "bad" }}
              />
              {/* ── Хэтэрсэн ── */}
              <Tile
                className="flex-1"
                tint="rose"
                title="Хугацаа хэтэрсэн"
                value={String(overdue.length)}
                caption={`Яаралтай ${urgent.length} · ${lead ? "баг" : "миний"}`}
                chip={overdue.length ? { text: "Анхаар", tone: "bad" } : { text: "Цэвэр", tone: "good" }}
                href={`/tasks${lead ? "" : `?who=${me?.id ?? ""}`}`}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            {/* ── Ажлын урсгал ── */}
            <Card className="min-w-0 flex-[1.2_1_300px] p-5 sm:p-6">
              <CardTitle title="Ажлын урсгал" pill="7 хоногоор" href="/reports" />
              <div className="mt-5">
                <PillBars
                  data={weeks.map((w, i) => ({
                    label: w.label,
                    value: w.values[1],
                    hint: `${w.full}: ${w.values[1]} дууссан, ${w.values[0]} шинэ`,
                    active: i === weeks.length - 1,
                  }))}
                  format={(v) => `+${v}`}
                />
              </div>
            </Card>
            {/* ── Бүтэц ── */}
            <Card className="min-w-0 flex-[1_1_280px] p-5 sm:p-6">
              <CardTitle title="Нээлттэй ажлын бүтэц" pill={lead ? "Баг" : "Миний"} />
              <div className="mt-5 flex flex-wrap items-center justify-center gap-6">
                <Donut
                  parts={byPrio}
                  center={
                    <>
                      <span className="text-xs text-zinc-500">Нийт</span>
                      <span className="tabular text-3xl font-semibold">{scopeOpen.length}</span>
                    </>
                  }
                />
                <div className="grid min-w-[150px] flex-1 grid-cols-2 gap-x-4 gap-y-3">
                  {byPrio.map((p) => (
                    <div key={p.label}>
                      <div className="text-xs text-zinc-500">{p.label}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-lg font-semibold">
                        <span className="h-4 w-1 rounded-full" style={{ background: p.color }} />
                        {scopeOpen.length ? Math.round((p.value / scopeOpen.length) * 100) : 0}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* ── AI ── */}
          <div id="ai" className="scroll-mt-24">
            <AiPanel onOpenTask={setOpenTask} className="h-full" />
          </div>

          {/* ── Миний дараагийн ажлууд / сүүлийн үйл ажиллагаа ── */}
          <Card className="p-5 sm:p-6">
            <CardTitle title={focus.length ? "Дараагийн ажлууд" : "Сүүлийн үйл ажиллагаа"} count={focus.length ? mine.length : undefined} href="/tasks" />
            <ul className="mt-3 divide-y divide-zinc-100">
              {(focus.length ? focus : recent).map((t) => (
                <TaskRow key={t.id} t={t} onOpen={() => setOpenTask(t)} />
              ))}
              {!focus.length && !recent.length && <li className="py-6 text-sm text-zinc-500">Одоохондоо ажил алга.</li>}
            </ul>
          </Card>
        </div>

        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <ZucaCard lead={lead} onOpenCamp={setOpenCamp} toast={toast} />
          {/* ── Анхаарах зуслан ── */}
          <Card className="p-5 sm:p-6">
            <CardTitle title="Мэдээлэл дутуу" href="/camps" />
            {weakCamps.length === 0 ? (
              <p className="mt-6 text-sm text-zinc-500">Идэвхтэй зуслангуудын мэдээлэл бүрэн байна ✨</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {weakCamps.map(({ c, score, missing }) => (
                  <li key={c.id}>
                    <button onClick={() => setOpenCamp(c.id)} className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-zinc-100 px-3 py-2.5 text-left hover:bg-zinc-200">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-solid text-xs font-semibold">{score}%</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{c.name}</span>
                        <span className="block truncate text-[11px] text-zinc-500">Дутуу: {missing.map((m) => m.label).join(", ")}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <TaskModal open={!!openTask || !!draft} task={openTask} draft={draft ?? undefined} onClose={() => (setOpenTask(null), setDraft(null))} />
      {openCamp && <CampDrawer open camp={camps.find((c) => c.id === openCamp) ?? null} onClose={() => setOpenCamp(null)} />}
    </>
  );
}

function TaskRow({ t, onOpen }: { t: Task; onOpen: () => void }) {
  const { profileById, campById, updateTask } = useStore();
  const due = dueLabel(t.due_date);
  const camp = t.camp_id ? campById.get(t.camp_id) : null;
  const st = STATUSES.find((s) => s.id === t.status);
  const done = t.status === "done";
  return (
    <li className="flex items-center gap-3 py-3">
      <button
        title={done ? "Дууссан" : "Дууссан болгох"}
        onClick={() => !done && void updateTask(t.id, { status: "done" })}
        className={cn(
          "grid size-10 shrink-0 cursor-pointer place-items-center rounded-full transition",
          done ? "bg-[#c6f36b] text-neutral-900" : "bg-zinc-100 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600",
        )}
      >
        <Check size={16} strokeWidth={2.5} />
      </button>
      <button onClick={onOpen} className="min-w-0 flex-1 cursor-pointer text-left">
        <div className={cn("truncate text-sm font-medium", done && "text-zinc-400 line-through")}>{t.title}</div>
        <div className="truncate text-xs text-zinc-500">{camp ? `⛺ ${camp.name}` : st?.label}</div>
      </button>
      <span
        className={cn(
          "hidden rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline",
          done ? "bg-[#c6f36b] text-neutral-900" : t.status === "in_progress" ? "bg-[#c9b8ff] text-neutral-900" : "bg-zinc-100 text-zinc-600",
        )}
      >
        {st?.label}
      </span>
      {due && !done && (
        <span className={cn("hidden w-28 items-center justify-end gap-1 text-xs md:inline-flex", due.tone === "overdue" ? "font-medium text-red-600" : "text-zinc-500")}>
          <CalendarClock size={12} /> {due.text}
        </span>
      )}
      <PriorityChip priority={t.priority} compact />
      <Avatar profile={t.assignee_id ? profileById.get(t.assignee_id) : null} size={28} />
    </li>
  );
}

/* ─────────── zuca.mn — шууд мэдээлэл ─────────── */
function ZucaCard({
  className,
  lead,
  onOpenCamp,
  toast,
}: {
  className?: string;
  lead: boolean;
  onOpenCamp: (id: string) => void;
  toast: (t: string, tone?: "ok" | "error") => void;
}) {
  const { camps, campById, refresh } = useStore();
  const { shifts, sync, available, reload } = useZucaLive();
  const today = todayISO();
  const upcoming = useMemo(() => shifts.filter((s) => s.is_open && (s.starts_at ?? "").slice(0, 10) >= today), [shifts, today]);
  // Хоноглох ээлж тус бүрээр, өдрийн ээлжийг (өдөр бүр давтагддаг) зуслангаар нь нэгтгэнэ
  const rows = useMemo(() => {
    const day = new Map<string, { camp_id: string; count: number; booked: number; first: string }>();
    const out: ({ kind: "main"; s: ZucaShift; at: string } | { kind: "day"; camp_id: string; count: number; booked: number; at: string })[] = [];
    for (const s of upcoming) {
      if (!s.is_day) out.push({ kind: "main", s, at: s.starts_at ?? "" });
      else {
        const d = day.get(s.camp_id) ?? { camp_id: s.camp_id, count: 0, booked: 0, first: s.starts_at ?? "" };
        d.count++;
        d.booked += s.booked;
        day.set(s.camp_id, d);
      }
    }
    for (const d of day.values()) out.push({ kind: "day", camp_id: d.camp_id, count: d.count, booked: d.booked, at: d.first });
    // Хоноглох ээлж эхэнд (дүүргэлт чухал), өдрийн ээлжүүд дараа нь
    return out.sort((x, y) => (x.kind === y.kind ? x.at.localeCompare(y.at) : x.kind === "main" ? -1 : 1));
  }, [upcoming]);
  // Ирэх ээлжүүдээр хамгийн их бүртгэлтэй зуслангууд
  const topCamps = useMemo(() => {
    const agg = new Map<string, { booked: number; capacity: number; count: number }>();
    for (const s of upcoming) {
      const a = agg.get(s.camp_id) ?? { booked: 0, capacity: 0, count: 0 };
      a.booked += s.booked;
      if (!s.is_day) a.capacity += s.capacity;
      a.count++;
      agg.set(s.camp_id, a);
    }
    const ranked = [...agg.entries()].sort((x, y) => y[1].booked - x[1].booked || y[1].count - x[1].count).slice(0, 3);
    const top = ranked.map(([id, a]) => ({ camp: campById.get(id), ...a }));
    // Ээлж цөөн бол zuca.mn-ийн өндөр үнэлгээтэй зуслангаар нөхнө
    const extra = camps
      .filter((c) => c.stage === "active" && c.zuca_id != null && !agg.has(c.id))
      .sort((a, b) => (Number(b.zuca_rating) || 0) - (Number(a.zuca_rating) || 0) || (b.zuca_reviews ?? 0) - (a.zuca_reviews ?? 0))
      .slice(0, 3 - top.length)
      .map((c) => ({ camp: c, booked: 0, capacity: 0, count: 0 }));
    return [...extra.reverse(), ...top.reverse()];
  }, [upcoming, campById, camps]);

  const after = useCallback(() => Promise.all([reload(), refresh().catch(() => {})]), [reload, refresh]);
  const { busy, run: syncNow } = useZucaSyncNow(after, toast);

  const fill = sync?.upcoming.capacity ? Math.round((sync.upcoming.booked / sync.upcoming.capacity) * 100) : null;
  const syncedAt = syncedLabel(sync?.at);

  return (
    <Card className={cn("flex flex-col p-5 sm:p-6", className)}>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-medium tracking-tight">
          zuca.mn <span className="size-2 animate-pulse rounded-full bg-emerald-500" />
        </h2>
        {lead && (
          <button
            onClick={() => void syncNow()}
            disabled={busy}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full bg-surface-solid pr-1 pl-3.5 text-xs font-medium shadow-sm disabled:opacity-60"
          >
            Шинэчлэх
            <span className="grid size-7 place-items-center rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
              <RefreshCw size={13} className={cn(busy && "animate-spin")} />
            </span>
          </button>
        )}
      </div>

      {/* Давхарласан зуслангийн картууд */}
      <div className="relative mt-5 h-[168px]">
        {topCamps.map((t, i) => (
          <button
            key={t.camp?.id ?? i}
            onClick={() => t.camp && onOpenCamp(t.camp.id)}
            className={cn(
              "absolute inset-x-0 cursor-pointer rounded-3xl bg-gradient-to-br p-4 text-left text-neutral-900 shadow-[0_12px_30px_-14px_rgba(0,0,0,0.45)] transition hover:-translate-y-1",
              CARD_TONES[i % CARD_TONES.length],
            )}
            style={{ top: i * 26, transform: `scale(${1 - (topCamps.length - 1 - i) * 0.04})`, zIndex: i }}
          >
            <div className="flex items-center justify-between text-xs font-medium opacity-80">
              <span className="truncate">{t.camp?.aimag ?? "zuca.mn"}</span>
              {t.camp?.zuca_rating ? (
                <span className="inline-flex items-center gap-0.5">
                  <Star size={11} className="fill-current" /> {Number(t.camp.zuca_rating).toFixed(1)}
                </span>
              ) : null}
            </div>
            <div className="mt-6 truncate text-[15px] font-semibold">{t.camp?.name ?? "—"}</div>
            <div className="mt-0.5 text-xs opacity-75">
              {t.capacity
                ? `${t.booked}/${t.capacity} бүртгэл · ${t.count} ээлж`
                : t.count
                  ? `${t.count} ээлж · ${t.booked} бүртгэл`
                  : `${t.camp?.zuca_reviews ?? 0} сэтгэгдэл · ${t.camp?.aimag ?? ""}`}
            </div>
          </button>
        ))}
        {!topCamps.length && (
          <div className="grid h-full place-items-center rounded-3xl border border-dashed border-zinc-200 text-center text-xs text-zinc-500">
            {available ? "Синк хийгдээгүй байна" : "Schema v6-г Supabase-д ажиллуулна уу"}
          </div>
        )}
      </div>

      <div className="mt-5">
        <h3 className="text-[15px] font-medium">
          Удахгүй эхлэх ээлж <sup className="text-xs text-zinc-500">{rows.length}</sup>
        </h3>
        {fill !== null && <p className="mt-0.5 text-xs text-zinc-500">Хоноглох ээлж 14 хоногт {fill}% дүүрсэн</p>}
      </div>
      <ul className="mt-3 flex-1 space-y-2">
        {rows.slice(0, 5).map((r) => {
          const campId = r.kind === "main" ? r.s.camp_id : r.camp_id;
          const camp = campById.get(campId);
          const d = new Date(r.at);
          const pct = r.kind === "main" && r.s.capacity ? Math.round((r.s.booked / r.s.capacity) * 100) : null;
          return (
            <li key={r.kind === "main" ? r.s.id : `day-${campId}`}>
              <button
                onClick={() => camp && onOpenCamp(camp.id)}
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-zinc-100 px-3 py-2.5 text-left hover:bg-zinc-200"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface-solid">
                  {r.kind === "main" ? <Tent size={15} className="text-zinc-500" /> : <Sun size={15} className="text-amber-500" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{camp?.name ?? "Зуслан"}</span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {d.getMonth() + 1}/{d.getDate()} · {r.kind === "main" ? r.s.name : `Өдрийн ээлж · ${r.count} өдөр`}
                  </span>
                </span>
                <span className="text-right">
                  {pct !== null && r.kind === "main" ? (
                    <>
                      <span className={cn("tabular block text-sm font-semibold", pct < 25 ? "text-red-600" : "")}>{pct}%</span>
                      <span className="tabular block text-[10px] text-zinc-500">
                        {r.s.booked}/{r.s.capacity}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="tabular block text-sm font-semibold">{r.kind === "day" ? r.booked : r.s.booked}</span>
                      <span className="block text-[10px] text-zinc-500">бүртгэл</span>
                    </>
                  )}
                </span>
              </button>
            </li>
          );
        })}
        {available && !rows.length && <li className="text-xs text-zinc-500">Ирэх 45 хоногт нээлттэй ээлж алга.</li>}
      </ul>
      <div className="mt-4 flex items-center justify-between text-[11px] text-zinc-500">
        <span>{syncedAt ? `Шинэчилсэн: ${syncedAt}` : "Орой бүр 21:00-д шинэчилнэ"}</span>
        <Link href="/camps" className="inline-flex items-center gap-0.5 font-medium text-zinc-700 hover:underline">
          Зуслангууд <ArrowRight size={11} />
        </Link>
      </div>
    </Card>
  );
}
