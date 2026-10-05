"use client";

import {
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Mail,
  Send,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DayPlan } from "@/components/agent/day-plan";
import { TaskModal } from "@/components/tasks/task-modal";
import { Avatar, Button, Card, Empty, PageHeader, PriorityChip, Segmented } from "@/components/ui";
import { agentFetch, type AgentStatus } from "@/lib/agent/client";
import { buildDigest, digestHtml, digestTelegram, type OrgSnapshot } from "@/lib/agent/digest";
import type { AgentPlan } from "@/lib/agent/schema";
import { useStore } from "@/lib/data/store";
import { atLeast, canManageOrg, canNotify } from "@/lib/permissions";
import type { Task } from "@/lib/types";
import { cn, relativeTime, todayISO } from "@/lib/utils";

export default function AgentPage() {
  const store = useStore();
  const { me, mode, profiles, tasks, departments, approvals, dailyReports, agentRuns, profileById, updateProfile, logAgentRun, toast } = store;

  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [personId, setPersonId] = useState<string>("");
  const [plan, setPlan] = useState<AgentPlan | null>(null);
  const [planFor, setPlanFor] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [applied, setApplied] = useState<Set<number>>(new Set());
  const [preview, setPreview] = useState<"email" | "telegram">("email");
  const [openTask, setOpenTask] = useState<Task | null>(null);

  useEffect(() => {
    fetch("/api/agent/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);
  useEffect(() => {
    if (me && !personId) setPersonId(me.id);
  }, [me, personId]);

  const snapshot = useCallback(
    (): OrgSnapshot => ({ profiles, tasks, departments, approvals, daily_reports: dailyReports }),
    [profiles, tasks, departments, approvals, dailyReports],
  );
  const ctx = { mode, me, snapshot };

  const person = profileById.get(personId) ?? me;
  const reachable = useMemo(() => profiles.filter((p) => p.active && canNotify(me, p, departments)), [profiles, me, departments]);
  const digest = useMemo(
    () => (person ? buildDigest(snapshot(), person, todayISO(), planFor === person.id ? plan : null) : null),
    [person, snapshot, plan, planFor],
  );

  async function organize() {
    if (!person) return;
    setThinking(true);
    setApplied(new Set());
    try {
      const res = await agentFetch<{ plan: AgentPlan }>("/api/agent/organize", { person_id: person.id }, ctx);
      setPlan(res.plan);
      setPlanFor(person.id);
      if (mode === "demo") void logAgentRun({ profile_id: person.id, kind: "organize", channel: "preview", ok: true, detail: res.plan.summary.slice(0, 200) });
    } catch (e) {
      toast(e instanceof Error ? e.message : "AI алдаа", "error");
    } finally {
      setThinking(false);
    }
  }

  return (
    <>
      <PageHeader
        title="AI туслах"
        subtitle="Өдрийн ажлыг цэгцэлж, өглөө бүр имэйл болон Telegram-аар хүн бүрт илгээнэ"
        actions={
          reachable.length > 1 && (
            <select className="field h-9 w-auto" value={personId} onChange={(e) => (setPersonId(e.target.value), setApplied(new Set()))}>
              {reachable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.id === me?.id ? `Би (${p.full_name})` : p.full_name}
                </option>
              ))}
            </select>
          )
        }
      />

      <StatusStrip status={status} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        {/* ── Цэгцлэх ── */}
        <Card className="min-w-0">
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
            <div>
              <h2 className="text-[15px] font-semibold">{person?.id === me?.id ? "Миний өнөөдөр" : `${person?.full_name}-ийн өнөөдөр`}</h2>
              <p className="mt-0.5 text-xs text-zinc-500">
                {digest?.total ?? 0} нээлттэй ажил · AI дараалал, цагийн хуваарь, цэгцлэх санал гаргана
              </p>
            </div>
            <Button variant="primary" onClick={() => void organize()} disabled={thinking || status?.ai === false}>
              {thinking ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
              {thinking ? "Бодож байна…" : plan && planFor === person?.id ? "Дахин цэгцлэх" : "Өдрөө цэгцлэх"}
            </Button>
          </div>

          {status?.ai === false && (
            <p className="mx-5 mb-4 rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
              AI ажиллуулахын тулд <code className="rounded bg-zinc-200/70 px-1">ANTHROPIC_API_KEY</code>-г <code>.env.local</code>-д нэмнэ. Доорх энгийн товчоо AI-гүй ч ажиллана.
            </p>
          )}

          {plan && planFor === person?.id ? (
            <div className="px-5 pb-5">
              <DayPlan
                plan={plan}
                applied={applied}
                onApplied={(i) => setApplied((prev) => new Set(prev).add(i))}
                onOpenTask={setOpenTask}
                checkable={person?.id === me?.id}
              />
            </div>
          ) : (
            <div className="px-5 pb-5">
              {digest && digest.sections.length ? (
                <ul className="space-y-4">
                  {digest.sections.map((s) => (
                    <li key={s.key}>
                      <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-zinc-500 uppercase">
                        {s.title} · {s.tasks.length}
                      </h3>
                      <ul className="space-y-1">
                        {s.tasks.slice(0, 6).map((t) => (
                          <li key={t.id}>
                            <button onClick={() => setOpenTask(t)} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-zinc-50">
                              <PriorityChip priority={t.priority} compact />
                              <span className="truncate">{t.title}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty icon={<Bot size={30} />} title="Хугацаатай нээлттэй ажил алга" />
              )}
            </div>
          )}
        </Card>

        {/* ── Урьдчилан харах + илгээх ── */}
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
              <div>
                <h2 className="text-[15px] font-semibold">Өглөөний мессеж</h2>
                <p className="mt-0.5 text-xs text-zinc-500">{person?.full_name}-д очих хэлбэр{plan && planFor === person?.id ? " · AI төлөвлөгөөтэй" : ""}</p>
              </div>
              <Segmented
                value={preview}
                onChange={setPreview}
                options={[
                  { id: "email", label: "Имэйл", icon: <Mail size={14} /> },
                  { id: "telegram", label: "Telegram", icon: <Send size={14} /> },
                ]}
              />
            </div>
            <div className="px-5 pb-5">
              {digest &&
                (preview === "email" ? (
                  <iframe title="Имэйлийн харагдац" className="h-[420px] w-full rounded-xl border border-zinc-200 bg-zinc-50" srcDoc={digestHtml(digest)} />
                ) : (
                  <div className="scroll-thin h-[420px] overflow-y-auto rounded-xl bg-[#8ea8c3] p-4">
                    <div
                      className="max-w-[92%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap shadow-sm [&_a]:text-sky-600 [&_code]:font-mono"
                      dangerouslySetInnerHTML={{ __html: digestTelegram(digest) }}
                    />
                  </div>
                ))}
            </div>
          </Card>

          <SendPanel status={status} ctx={ctx} withPlan={!!plan} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {me && <MyChannels status={status} ctx={ctx} onToggle={(patch) => void updateProfile(me.id, patch)} />}
        <Card>
          <div className="px-5 pt-4 pb-3">
            <h2 className="text-[15px] font-semibold">Илгээлтийн түүх</h2>
            <p className="mt-0.5 text-xs text-zinc-500">Сүүлийн илгээлт, AI цэгцлэлт</p>
          </div>
          {!agentRuns.length ? (
            <Empty icon={<Send size={28} />} title="Одоогоор илгээгээгүй" />
          ) : (
            <ul className="scroll-thin max-h-80 divide-y divide-zinc-100 overflow-y-auto">
              {agentRuns.slice(0, 60).map((r) => {
                const p = r.profile_id ? profileById.get(r.profile_id) : null;
                return (
                  <li key={r.id} className="flex items-center gap-3 px-5 py-2 text-sm">
                    {r.ok ? <CheckCircle2 size={15} className="shrink-0 text-emerald-500" /> : <XCircle size={15} className="shrink-0 text-red-500" />}
                    <Avatar profile={p} size={22} />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-medium">{p?.full_name ?? "—"}</span>
                      <span className="text-zinc-500"> · {r.kind === "organize" ? "AI цэгцлэлт" : r.channel === "email" ? "Имэйл" : "Telegram"}</span>
                      {r.detail && <span className="text-zinc-400"> · {r.detail}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400">{relativeTime(r.created_at)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <TaskModal open={!!openTask} task={openTask} onClose={() => setOpenTask(null)} />
    </>
  );
}

type Ctx = Parameters<typeof agentFetch>[2];

function StatusStrip({ status }: { status: AgentStatus | null }) {
  const items = [
    { key: "ai", label: "Claude AI", ok: status?.ai, hint: status?.ai ? status.model : "ANTHROPIC_API_KEY" },
    { key: "email", label: "Имэйл (SMTP)", ok: status?.email, hint: status?.email ? "бэлэн" : "SMTP_HOST, SMTP_USER, SMTP_PASS" },
    { key: "telegram", label: "Telegram bot", ok: status?.telegram, hint: status?.bot ? `@${status.bot.replace(/^@/, "")}` : "TELEGRAM_BOT_TOKEN" },
    { key: "cron", label: "Өглөө 07:00 автомат", ok: status?.cron && status?.serviceRole, hint: status?.cron ? (status.serviceRole ? "Vercel Cron" : "SUPABASE_SERVICE_ROLE_KEY") : "CRON_SECRET" },
    { key: "intake", label: "Имэйл / zuca.mn → ажил", ok: status?.intake && status?.serviceRole, hint: status?.intake ? (status.serviceRole ? "/api/intake бэлэн" : "SUPABASE_SERVICE_ROLE_KEY") : "INTAKE_SECRET" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {items.map((i) => (
        <Card key={i.key} className="flex items-center gap-3 p-3.5">
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-lg", status == null ? "bg-zinc-100 text-zinc-300" : i.ok ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-400")}>
            {status == null ? <Loader2 size={15} className="animate-spin" /> : i.ok ? <Check size={16} /> : <CircleAlert size={16} />}
          </span>
          <div className="min-w-0">
            <div className="text-sm font-medium">{i.label}</div>
            <div className="truncate text-[11px] text-zinc-400">{i.ok ? i.hint : `Тохируулаагүй · ${i.hint}`}</div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function SendPanel({ status, ctx, withPlan }: { status: AgentStatus | null; ctx: Ctx; withPlan: boolean }) {
  const { me, profiles, departments, logAgentRun, toast, mode } = useStore();
  type Scope = "me" | "dept" | "all";
  const [scope, setScope] = useState<Scope>("me");
  const [channels, setChannels] = useState<{ email: boolean; telegram: boolean }>({ email: true, telegram: true });
  const [withAi, setWithAi] = useState(true);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{ name: string; channel: string; ok: boolean; detail: string }[] | null>(null);

  const targets = profiles.filter(
    (p) =>
      p.active &&
      canNotify(me, p, departments) &&
      (scope === "me" ? p.id === me?.id : scope === "dept" ? p.department_id && p.department_id === me?.department_id : true),
  );
  const scopes: { id: Scope; label: string }[] = [
    { id: "me", label: "Өөртөө" },
    ...(me?.department_id ? [{ id: "dept" as const, label: "Хэлтэстээ" }] : []),
    ...(canManageOrg(me) ? [{ id: "all" as const, label: "Бүх ажилтанд" }] : []),
  ];

  async function send() {
    const ch = (Object.keys(channels) as ("email" | "telegram")[]).filter((c) => channels[c]);
    setBusy(true);
    setResults(null);
    try {
      const res = await agentFetch<{ results: { profile_id: string; name: string; channel: "email" | "telegram"; ok: boolean; detail: string }[] }>(
        "/api/agent/send",
        { person_ids: targets.map((p) => p.id), channels: ch, with_ai: withAi && status?.ai },
        ctx,
      );
      setResults(res.results);
      if (mode === "demo") res.results.forEach((r) => void logAgentRun({ profile_id: r.profile_id, kind: "digest", channel: r.channel, ok: r.ok, detail: r.detail }));
      const ok = res.results.filter((r) => r.ok).length;
      toast(`${ok}/${res.results.length} мессеж илгээгдлээ`, ok ? "ok" : "error");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Алдаа", "error");
    } finally {
      setBusy(false);
    }
  }

  const canSend = (channels.email && status?.email) || (channels.telegram && status?.telegram);

  return (
    <Card>
      <div className="px-5 pt-4 pb-3">
        <h2 className="text-[15px] font-semibold">Одоо илгээх</h2>
        <p className="mt-0.5 text-xs text-zinc-500">Өглөө бүр 07:00-д автоматаар очдог. Эндээс гараар шууд илгээж болно.</p>
      </div>
      <div className="space-y-3.5 px-5 pb-5">
        {scopes.length > 1 && <Segmented value={scope} onChange={setScope} options={scopes} />}
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="size-4 accent-brand-600" checked={channels.email} onChange={(e) => setChannels({ ...channels, email: e.target.checked })} />
            <Mail size={14} /> Имэйл
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="size-4 accent-brand-600" checked={channels.telegram} onChange={(e) => setChannels({ ...channels, telegram: e.target.checked })} />
            <Send size={14} /> Telegram
          </label>
          <label className={cn("flex items-center gap-2", status?.ai ? "cursor-pointer" : "opacity-40")}>
            <input type="checkbox" className="size-4 accent-brand-600" disabled={!status?.ai} checked={withAi && !!status?.ai} onChange={(e) => setWithAi(e.target.checked)} />
            <Sparkles size={14} /> AI-аар цэгцэлж илгээх
          </label>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={() => void send()} disabled={busy || !targets.length || !canSend}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {targets.length} хүнд илгээх
          </Button>
          {!canSend && status && <span className="text-xs text-zinc-400">Имэйл эсвэл Telegram тохируулна уу</span>}
          {withPlan && scope === "me" && <span className="text-xs text-zinc-400">AI дахин цэгцэлнэ</span>}
        </div>
        {results && (
          <ul className="space-y-1 rounded-lg bg-zinc-50 p-3 text-xs">
            {results.map((r, i) => (
              <li key={i} className="flex items-center gap-2">
                {r.ok ? <CheckCircle2 size={13} className="text-emerald-500" /> : <XCircle size={13} className="text-red-500" />}
                <b>{r.name}</b> · {r.channel === "email" ? "имэйл" : "Telegram"} · <span className="text-zinc-500">{r.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function MyChannels({ status, ctx, onToggle }: { status: AgentStatus | null; ctx: Ctx; onToggle: (patch: { notify_email?: boolean; notify_telegram?: boolean }) => void }) {
  const { me, toast } = useStore();
  const [linking, setLinking] = useState(false);
  if (!me) return null;

  async function link() {
    setLinking(true);
    try {
      const { url } = await agentFetch<{ url: string }>("/api/telegram/link", {}, ctx);
      window.open(url, "_blank", "noopener");
      toast("Telegram дээр «Start» дарна уу — холбогдсоны дараа хуудсаа шинэчилнэ");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Алдаа", "error");
    } finally {
      setLinking(false);
    }
  }

  async function setupWebhook() {
    try {
      const res = await agentFetch<{ url: string }>("/api/telegram/setup", {}, ctx);
      toast(`Webhook тохирлоо: ${res.url}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Алдаа", "error");
    }
  }

  return (
    <Card>
      <div className="px-5 pt-4 pb-3">
        <h2 className="text-[15px] font-semibold">Миний мэдэгдэл</h2>
        <p className="mt-0.5 text-xs text-zinc-500">Өглөө бүр өнөөдрийн ажлаа хаанаас авах вэ</p>
      </div>
      <ul className="divide-y divide-zinc-100 border-t border-zinc-100">
        <li className="flex items-center gap-3 px-5 py-3">
          <Mail size={18} className="text-zinc-400" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Имэйл</div>
            <div className="truncate text-xs text-zinc-500">{me.email || "Имэйл хаяг бүртгэлгүй"}</div>
          </div>
          <Toggle on={me.notify_email} onChange={(v) => onToggle({ notify_email: v })} />
        </li>
        <li className="flex items-center gap-3 px-5 py-3">
          <Send size={18} className="text-sky-500" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Telegram</div>
            <div className="truncate text-xs text-zinc-500">
              {me.telegram_chat_id ? `Холбогдсон · ${me.telegram_chat_id}` : "Холбоогүй — bot-оор нэг товшилтоор холбоно"}
            </div>
          </div>
          {me.telegram_chat_id ? (
            <Toggle on={me.notify_telegram} onChange={(v) => onToggle({ notify_telegram: v })} />
          ) : (
            <Button size="sm" onClick={() => void link()} disabled={linking || !status?.bot || ctx.mode === "demo"}>
              Telegram холбох <ArrowRight size={13} />
            </Button>
          )}
        </li>
      </ul>
      {ctx.mode === "demo" && (
        <p className="border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">
          Demo горимд bot-оор холбох боломжгүй (өгөгдөл browser-т). Telegram-д bot-оо эхлүүлээд <code>/id</code> гэж бичиж авсан chat ID-гаа «Ажилчид» → засах хэсэгт оруулна.
        </p>
      )}
      {atLeast(me, "manager") && status?.bot && ctx.mode === "supabase" && (
        <div className="border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">
          <div className="mb-1.5 font-medium text-zinc-700">Багийнхнаа олноор холбох</div>
          Энэ холбоосыг багийн группт илгээнэ. Ажилтан бүр <b>Start</b> → <b>«📱 Утасны дугаараа илгээх»</b> дарахад «Ажилчид» хэсэгт
          бүртгэлтэй утсаар нь таньж автоматаар холбогдоно.
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-zinc-100 px-2 py-1.5 text-zinc-800">https://t.me/{status.bot.replace(/^@/, "")}</code>
            <Button
              size="sm"
              onClick={() =>
                void navigator.clipboard
                  .writeText(`https://t.me/${status.bot!.replace(/^@/, "")}`)
                  .then(() => toast("Холбоос хууллаа"))
                  .catch(() => toast("Хуулж чадсангүй", "error"))
              }
            >
              Хуулах
            </Button>
          </div>
        </div>
      )}
      {me.role === "admin" && status?.telegram && ctx.mode === "supabase" && (
        <div className="flex items-center justify-between gap-3 border-t border-zinc-100 px-5 py-3 text-xs text-zinc-500">
          Bot-ын командууд (/today, /plan, /report) ажиллахын тулд webhook бүртгэнэ
          <Button size="sm" variant="ghost" onClick={() => void setupWebhook()}>
            Webhook тохируулах
          </Button>
        </div>
      )}
    </Card>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={cn("relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition", on ? "bg-brand-600" : "bg-zinc-300")}
    >
      <span className={cn("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}
