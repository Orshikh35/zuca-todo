"use client";

import { ArrowRight, ArrowUp, Bot, Loader2, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Card, PriorityChip } from "@/components/ui";
import { agentFetch, type AgentStatus } from "@/lib/agent/client";
import type { OrgSnapshot } from "@/lib/agent/digest";
import type { AgentPlan } from "@/lib/agent/schema";
import { useStore } from "@/lib/data/store";
import type { Task } from "@/lib/types";
import { cn, todayISO } from "@/lib/utils";
import { DayPlan } from "./day-plan";

interface Cached {
  plan: AgentPlan;
  applied: number[];
  /** Төлөвлөгөө гаргасан үе — түүнээс хойш нэмэгдсэн ажлыг илрүүлнэ */
  at: string;
}

// Өдөрт нэг удаа автоматаар цэгцэлнэ; дахин ачаалахад AI дуудахгүйн тулд browser-т хадгална
const cacheKey = (who: string, date: string) => `zuca:plan:${who}:${date}`;
function readCache(key: string): Cached | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Cached) : null;
  } catch {
    return null;
  }
}
function writeCache(key: string, v: Cached) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* private горим — хадгалахгүй ч ажиллана */
  }
}

const EXAMPLES = ["Бат маргааш Хөх тэнгэрт залгаж намрын хуваарь авах", "Надад хугацаа хэтэрсэн ажил юу байна?", "Төлбөрийн буцаалтын ажлыг яаралтай болго"];

/** Самбарын AI туслах: өнөөдрийн төлөвлөгөө + AI-д шууд хэлэх */
export function AiPanel({ onOpenTask, className }: { onOpenTask: (t: Task) => void; className?: string }) {
  const { me, mode, profiles, tasks, departments, approvals, dailyReports, logAgentRun, toast } = useStore();
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [cached, setCached] = useState<Cached | null>(null);
  const [thinking, setThinking] = useState(false);
  const autoRan = useRef(false);

  const date = todayISO();
  const key = me ? cacheKey(me.id, date) : null;

  useEffect(() => {
    fetch("/api/agent/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  useEffect(() => {
    if (key) setCached(readCache(key));
  }, [key]);

  const save = useCallback(
    (v: Cached) => {
      setCached(v);
      if (key) writeCache(key, v);
    },
    [key],
  );

  const snapshot = useCallback(
    (): OrgSnapshot => ({ profiles, tasks, departments, approvals, daily_reports: dailyReports }),
    [profiles, tasks, departments, approvals, dailyReports],
  );

  const organize = useCallback(async () => {
    if (!me) return;
    setThinking(true);
    try {
      const res = await agentFetch<{ plan: AgentPlan }>("/api/agent/organize", { person_id: me.id }, { mode, me, snapshot });
      save({ plan: res.plan, applied: [], at: new Date().toISOString() });
      if (mode === "demo") void logAgentRun({ profile_id: me.id, kind: "organize", channel: "preview", ok: true, detail: res.plan.summary.slice(0, 200) });
    } catch (e) {
      toast(e instanceof Error ? e.message : "AI алдаа", "error");
    } finally {
      setThinking(false);
    }
  }, [me, mode, snapshot, save, logAgentRun, toast]);

  const mine = tasks.filter((t) => t.status !== "done" && t.assignee_id === me?.id);

  // Өнөөдрийн төлөвлөгөө байхгүй бол нэг удаа автоматаар гаргана
  useEffect(() => {
    if (autoRan.current || !status?.ai || !key || cached || !mine.length) return;
    if (readCache(key)) return;
    autoRan.current = true;
    void organize();
  }, [status, key, cached, mine.length, organize]);

  const plan = cached?.plan ?? null;
  const planned = new Set(plan?.focus.map((f) => f.task_id) ?? []);
  const fresh = cached ? mine.filter((t) => !planned.has(t.id) && t.created_at > cached.at).length : 0;
  const aiOff = status?.ai === false;

  return (
    <Card className={cn("overflow-hidden", className ?? "mt-6")}>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-white">
            <Sparkles size={17} />
          </span>
          <div>
            <h2 className="text-[15px] font-semibold">AI туслах</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              {plan
                ? `Өнөөдрийн төлөвлөгөө · ${new Date(cached!.at).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}-д гаргасан`
                : `${mine.length} нээлттэй ажлыг тань дараалалд оруулж, цагийн хуваарь гаргана`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/agent" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
            Дэлгэрэнгүй <ArrowRight size={12} />
          </Link>
          {!aiOff && (
            <Button size="sm" variant={plan ? "ghost" : "primary"} onClick={() => void organize()} disabled={thinking || !status}>
              {thinking ? <Loader2 size={13} className="animate-spin" /> : plan ? <RefreshCw size={13} /> : <Wand2 size={13} />}
              {thinking ? "Бодож байна…" : plan ? "Дахин цэгцлэх" : "Өдрөө цэгцлэх"}
            </Button>
          )}
        </div>
      </div>

      <div className={cn("grid gap-6 px-5 pb-5", mode === "supabase" && !aiOff && "lg:grid-cols-[1.35fr_1fr]")}>
        <div className="min-w-0">
          {aiOff ? (
            <p className="rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-600">
              AI унтраалттай байна. <code className="rounded bg-zinc-200/70 px-1 text-xs">ANTHROPIC_API_KEY</code>-г <code className="text-xs">.env.local</code>-д нэмээд
              серверээ дахин асаавал энд өдрийн төлөвлөгөө автоматаар гарч, чатад бичсэн ажил бүртгэгдэнэ.
            </p>
          ) : thinking && !plan ? (
            <PlanSkeleton />
          ) : plan ? (
            <div className={cn("transition-opacity", thinking && "opacity-50")}>
              {fresh > 0 && (
                <button
                  onClick={() => void organize()}
                  disabled={thinking}
                  className="mb-3 flex w-full cursor-pointer items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-left text-xs font-medium text-sky-900 hover:bg-sky-100"
                >
                  <RefreshCw size={13} /> Төлөвлөгөө гаргаснаас хойш {fresh} шинэ ажил нэмэгдсэн — дахин цэгцлэх
                </button>
              )}
              <DayPlan
                plan={plan}
                applied={new Set(cached!.applied)}
                onApplied={(i) => save({ ...cached!, applied: [...cached!.applied, i] })}
                onOpenTask={onOpenTask}
                checkable
                compact
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-200 px-4 py-6 text-center text-sm text-zinc-500">
              {mine.length ? "«Өдрөө цэгцлэх» дарж өнөөдрийн дарааллаа гаргана уу." : "Танд нээлттэй ажил алга — доор AI-д шинэ ажил хэлж болно."}
            </div>
          )}
        </div>

        {mode === "supabase" && !aiOff && <AskBox onOpenTask={onOpenTask} disabled={!status?.ai} />}
      </div>
    </Card>
  );
}

function PlanSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-label="AI бодож байна">
      <div className="h-14 rounded-xl bg-brand-50" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border border-zinc-100 px-3 py-3">
          <div className="size-6 rounded-full bg-zinc-100" />
          <div className="h-3 flex-1 rounded bg-zinc-100" style={{ maxWidth: `${80 - i * 12}%` }} />
        </div>
      ))}
    </div>
  );
}

interface Answer {
  q: string;
  reply: string;
  created: Task[];
  updated: Task[];
}

/** AI-д энгийн хэлээр ажил хэлэх, асуух — чат руу орохгүйгээр */
function AskBox({ onOpenTask, disabled }: { onOpenTask: (t: Task) => void; disabled: boolean }) {
  const { tasks, profileById, refresh, toast } = useStore();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(null);

  async function ask(q = text.trim()) {
    if (!q || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/agent/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: q }) });
      const json = (await res.json().catch(() => ({}))) as Partial<Answer> & { error?: string };
      if (!res.ok) throw new Error(json.error || `Алдаа (${res.status})`);
      setAnswer({ q, reply: json.reply ?? "", created: json.created ?? [], updated: json.updated ?? [] });
      setText("");
      if (json.created?.length || json.updated?.length) void refresh().catch(() => {});
    } catch (e) {
      toast(e instanceof Error ? e.message : "AI алдаа", "error");
    } finally {
      setBusy(false);
    }
  }

  // Store шинэчлэгдсэн бол хамгийн сүүлийн хувилбарыг нээнэ
  const live = (t: Task) => tasks.find((x) => x.id === t.id) ?? t;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <h3 className="text-xs font-semibold tracking-wide text-zinc-500 uppercase">AI-д хэлэх</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
        className="relative"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void ask();
            }
          }}
          rows={3}
          maxLength={4000}
          disabled={disabled}
          placeholder="Ажил хэлэх эсвэл асуух… жишээ нь «Болдод баасан гараг гэхэд гэрээний төсөл бэлдүүл»"
          className="field min-h-[84px] w-full resize-none py-2.5 pr-11 text-sm"
        />
        <button
          type="submit"
          title="Илгээх (Enter)"
          disabled={!text.trim() || busy || disabled}
          className="absolute right-2 bottom-2 grid size-8 cursor-pointer place-items-center rounded-lg bg-brand-600 text-white transition hover:bg-brand-700 disabled:cursor-default disabled:bg-zinc-200 disabled:text-zinc-400"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <ArrowUp size={16} />}
        </button>
      </form>

      {!answer && !busy && (
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setText(ex)}
              disabled={disabled}
              className="cursor-pointer rounded-full border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {answer && (
        <div className="space-y-2 rounded-xl bg-zinc-50 p-3 text-sm">
          <p className="truncate text-xs text-zinc-400">«{answer.q}»</p>
          {answer.reply ? (
            <p className="flex gap-2 whitespace-pre-wrap text-zinc-800">
              <Bot size={15} className="mt-0.5 shrink-0 text-brand-600" />
              <span className="min-w-0">{answer.reply}</span>
            </p>
          ) : (
            !answer.created.length && !answer.updated.length && <p className="text-zinc-500">Бүртгэх ажил олдсонгүй.</p>
          )}
          {[...answer.created.map((t) => ({ t, kind: "Шинэ" })), ...answer.updated.map((t) => ({ t, kind: "Шинэчилсэн" }))].map(({ t, kind }) => {
            const cur = live(t);
            const who = cur.assignee_id ? profileById.get(cur.assignee_id)?.full_name : null;
            return (
              <button
                key={kind + t.id}
                onClick={() => onOpenTask(cur)}
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg bg-surface px-2.5 py-2 text-left ring-1 ring-zinc-200 hover:ring-brand-300"
              >
                <span className={cn("shrink-0 rounded px-1.5 py-px text-[10px] font-semibold", kind === "Шинэ" ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700")}>{kind}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{cur.title}</span>
                <PriorityChip priority={cur.priority} compact />
                {(who || cur.due_date) && <span className="hidden shrink-0 text-xs text-zinc-500 sm:inline">{[who, cur.due_date?.slice(5).replace("-", "/")].filter(Boolean).join(" · ")}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
