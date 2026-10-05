"use client";

import { AlertOctagon, CheckCircle2, Clock, NotebookPen, Sparkles, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Avatar, Button, Card, Empty, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/data/store";
import { canManageDept, canSeeDaily, visibleDeptIds } from "@/lib/permissions";
import type { Profile } from "@/lib/types";
import { addDays, cn, toISODate, todayISO } from "@/lib/utils";

const WD = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

export default function DailyPage() {
  const { me, profiles, departments, dailyReports, profileById, deptById } = useStore();
  const [date, setDate] = useState(todayISO());
  const [dept, setDept] = useState("");

  const visible = visibleDeptIds(me, departments);
  const manages = departments.some((d) => canManageDept(me, d));

  // Миний харж болох хүмүүс (өөрөө + удирддаг хэлтсийнх)
  const team = useMemo(
    () =>
      profiles.filter(
        (p) =>
          p.active &&
          (p.id === me?.id || (manages && (visible === null || (p.department_id && visible.has(p.department_id))))) &&
          (!dept || p.department_id === dept),
      ),
    [profiles, me, manages, visible, dept],
  );

  const reports = dailyReports
    .filter((r) => r.date === date && canSeeDaily(me, r, profileById, departments) && team.some((p) => p.id === r.profile_id))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const missing = team.filter((p) => !reports.some((r) => r.profile_id === p.id));

  const days = Array.from({ length: 7 }, (_, i) => toISODate(addDays(new Date(), i - 6)));

  return (
    <>
      <PageHeader
        title="Өдрийн тайлан"
        subtitle="Өдөр бүр юу хийсэн, маргааш юу хийх, юу саад болж байгааг богино бичнэ — дарга, удирдлага нэг дороос харна"
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        {me && <MyReport me={me} />}

        <div className="min-w-0 space-y-6">
          {manages && (
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
                <div>
                  <h2 className="text-[15px] font-semibold">Сүүлийн 7 хоног</h2>
                  <p className="mt-0.5 text-xs text-zinc-500">Хэн тайлангаа өгсөн · нүдэн дээр дарж тухайн өдрийг харна</p>
                </div>
                {departments.length > 1 && (
                  <select className="field h-8 w-auto py-0 text-xs" value={dept} onChange={(e) => setDept(e.target.value)}>
                    <option value="">Бүх хэлтэс</option>
                    {departments
                      .filter((d) => visible === null || visible.has(d.id))
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                  </select>
                )}
              </div>
              <div className="scroll-thin overflow-x-auto px-5 pb-4">
                <table className="text-sm">
                  <thead>
                    <tr>
                      <th />
                      {days.map((d) => {
                        const wd = new Date(d).getDay();
                        return (
                          <th key={d} className={cn("px-1 pb-1.5 text-center text-[11px] font-medium", wd === 0 || wd === 6 ? "text-zinc-300" : "text-zinc-500")}>
                            {WD[wd]}
                            <br />
                            {Number(d.slice(8))}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {team.map((p) => (
                      <tr key={p.id}>
                        <td className="py-0.5 pr-3">
                          <div className="flex items-center gap-2 whitespace-nowrap">
                            <Avatar profile={p} size={22} />
                            <span className="text-xs">{p.full_name}</span>
                          </div>
                        </td>
                        {days.map((d) => {
                          const r = dailyReports.find((x) => x.profile_id === p.id && x.date === d);
                          const wd = new Date(d).getDay();
                          return (
                            <td key={d} className="p-0.5">
                              <button
                                onClick={() => setDate(d)}
                                title={r ? r.done.slice(0, 120) : "Тайлангүй"}
                                className={cn(
                                  "grid size-8 cursor-pointer place-items-center rounded-md transition",
                                  r ? (r.blockers ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700") : wd === 0 || wd === 6 ? "bg-zinc-50" : "bg-zinc-100 text-zinc-300",
                                  d === date && "ring-2 ring-brand-500",
                                )}
                              >
                                {r ? r.blockers ? <AlertOctagon size={13} /> : <CheckCircle2 size={13} /> : "·"}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
              <div>
                <h2 className="text-[15px] font-semibold">{manages ? "Багийн тайлан" : "Миний тайлангууд"}</h2>
                <p className="mt-0.5 text-xs text-zinc-500">
                  {reports.length} тайлан{manages && missing.length ? ` · ${missing.length} хүн өгөөгүй` : ""}
                </p>
              </div>
              <input type="date" className="field h-8 w-auto py-0 text-xs" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value || todayISO())} />
            </div>
            {manages && missing.length > 0 && (
              <div className="mx-5 mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
                <Users size={13} /> Тайлан өгөөгүй:
                {missing.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1 text-zinc-700">
                    <Avatar profile={p} size={18} /> {p.full_name}
                  </span>
                ))}
              </div>
            )}
            {!reports.length ? (
              <Empty icon={<NotebookPen size={30} />} title="Энэ өдөр тайлан алга" />
            ) : (
              <ul className="divide-y divide-zinc-100">
                {reports.map((r) => {
                  const p = profileById.get(r.profile_id);
                  const d = p?.department_id ? deptById.get(p.department_id) : null;
                  return (
                    <li key={r.id} className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <Avatar profile={p} size={28} />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{p?.full_name}</div>
                          <div className="text-[11px] text-zinc-400">{[p?.job_title, d?.name].filter(Boolean).join(" · ")}</div>
                        </div>
                        {r.hours != null && (
                          <span className="tabular inline-flex items-center gap-1 text-xs text-zinc-500">
                            <Clock size={12} /> {r.hours} цаг
                          </span>
                        )}
                      </div>
                      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                        <Block label="Хийсэн" text={r.done} />
                        {r.plan && <Block label="Дараагийн ажил" text={r.plan} />}
                      </div>
                      {r.blockers && (
                        <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                          <span className="text-xs font-semibold">Саад: </span>
                          {r.blockers}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">{label}</div>
      <p className="whitespace-pre-line text-zinc-700">{text}</p>
    </div>
  );
}

function MyReport({ me }: { me: Profile }) {
  const { dailyReports, tasks, saveDailyReport } = useStore();
  const [date, setDate] = useState(todayISO());
  const existing = dailyReports.find((r) => r.profile_id === me.id && r.date === date);
  const [f, setF] = useState({ done: "", plan: "", blockers: "", hours: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setF({
      done: existing?.done ?? "",
      plan: existing?.plan ?? "",
      blockers: existing?.blockers ?? "",
      hours: existing?.hours != null ? String(existing.hours) : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing?.id, date]);

  // Тухайн өдөр дууссан болон хийж буй ажлуудаас бөглөх
  const doneThatDay = tasks.filter((t) => t.assignee_id === me.id && t.completed_at && toISODate(new Date(t.completed_at)) === date);
  const inProgress = tasks.filter((t) => t.assignee_id === me.id && (t.status === "in_progress" || t.status === "todo") && (t.due_date ?? "9999") <= toISODate(addDays(new Date(date), 2)));

  function fillFromTasks() {
    setF((p) => ({
      ...p,
      done: p.done || doneThatDay.map((t) => `• ${t.title}`).join("\n"),
      plan: p.plan || inProgress.slice(0, 5).map((t) => `• ${t.title}`).join("\n"),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.done.trim()) return;
    setBusy(true);
    await saveDailyReport({
      profile_id: me.id,
      date,
      done: f.done.trim(),
      plan: f.plan.trim() || null,
      blockers: f.blockers.trim() || null,
      hours: f.hours ? Math.min(24, Math.max(0, Number(f.hours))) : null,
    });
    setBusy(false);
  }

  return (
    <Card className="h-fit xl:sticky xl:top-8">
      <form onSubmit={submit} className="space-y-3.5 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">Миний тайлан</h2>
          <input
            type="date"
            className="field h-8 w-auto py-0 text-xs"
            value={date}
            max={todayISO()}
            min={toISODate(addDays(new Date(), -7))}
            onChange={(e) => setDate(e.target.value || todayISO())}
          />
        </div>
        {existing && <p className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">✓ Энэ өдрийн тайлан илгээгдсэн — засаж болно</p>}
        {(doneThatDay.length > 0 || inProgress.length > 0) && !f.done && (
          <button type="button" onClick={fillFromTasks} className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-brand-200 px-3 py-2 text-left text-xs text-brand-700 hover:bg-brand-50">
            <Sparkles size={14} /> Ажлуудаас автоматаар бөглөх ({doneThatDay.length} дууссан, {inProgress.length} төлөвлөсөн)
          </button>
        )}
        <div>
          <label className="label" htmlFor="r-done">Өнөөдөр юу хийсэн бэ? *</label>
          <textarea id="r-done" className="field min-h-28" value={f.done} onChange={(e) => setF({ ...f, done: e.target.value })} placeholder={"• Зуслантай гэрээ байгуулсан\n• Маркетингийн төлөвлөгөө"} />
        </div>
        <div>
          <label className="label" htmlFor="r-plan">Маргааш / дараа нь</label>
          <textarea id="r-plan" className="field min-h-20" value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} />
        </div>
        <div className="grid grid-cols-[1fr_90px] gap-3">
          <div>
            <label className="label" htmlFor="r-block">Саад, тусламж хэрэгтэй</label>
            <input id="r-block" className="field" value={f.blockers} onChange={(e) => setF({ ...f, blockers: e.target.value })} placeholder="Байхгүй" />
          </div>
          <div>
            <label className="label" htmlFor="r-hours">Цаг</label>
            <input id="r-hours" type="number" step="0.5" min="0" max="24" className="field" value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} placeholder="8" />
          </div>
        </div>
        <Button type="submit" variant="primary" className="w-full" disabled={busy || !f.done.trim()}>
          {existing ? "Шинэчлэх" : "Тайлан илгээх"}
        </Button>
        <p className="text-center text-[11px] text-zinc-400">Telegram-аас: /report текст</p>
      </form>
    </Card>
  );
}
