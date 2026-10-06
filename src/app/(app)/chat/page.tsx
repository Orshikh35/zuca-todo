"use client";

import {
  AtSign,
  CornerDownRight,
  Globe,
  Hash,
  Inbox,
  Loader2,
  Mail,
  MessagesSquare,
  Plug,
  Plus,
  Send,
  Sparkles,
  Sun,
  Trash2,
  Undo2,
  Wand2,
} from "lucide-react";
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { TaskModal } from "@/components/tasks/task-modal";
import { Avatar, Button, Card, Empty, Modal, PriorityChip, Select } from "@/components/ui";
import type { AgentStatus } from "@/lib/agent/client";
import { markRead, useChannels, useChatUnread, useMessages } from "@/lib/chat/hooks";
import { STATUSES } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { canManageDept, canManageOrg } from "@/lib/permissions";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { AiMode, Channel, Message, Profile, Task, TaskProposal } from "@/lib/types";
import { cn, dueLabel } from "@/lib/utils";

const AI_MODES: { id: AiMode; label: string; hint: string }[] = [
  { id: "auto", label: "AI: Автомат", hint: "Ажил дурдвал AI шууд бүртгэнэ" },
  { id: "suggest", label: "AI: Санал болгох", hint: "AI санал болгоно, хүн «Үүсгэх» дарна" },
  { id: "mention", label: "AI: Зөвхөн @ai", hint: "@ai гэж хандсан үед л ажиллана" },
  { id: "off", label: "AI: Унтраах", hint: "AI энэ сувгийг уншихгүй" },
];

const PROMPTS = [
  "@ai Өнөөдөр яаралтай юу байна?",
  "@ai Хугацаа хэтэрсэн ажлуудыг хүнээр нь жагсаа",
  "@ai Хэн хамгийн их ачаалалтай байна?",
  "@ai Хариуцагчгүй ажлуудыг тохирох хүнд хуваарил",
];

const ts = (iso: string) => Date.parse(iso) || 0;
const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const dayKey = (iso: string) => new Date(iso).toDateString();
const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Өнөөдөр";
  if (d.toDateString() === y.toDateString()) return "Өчигдөр";
  return `${d.getMonth() + 1}-р сарын ${d.getDate()}, ${WEEKDAYS[d.getDay()]}`;
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export default function ChatPage() {
  const { mode } = useStore();
  if (mode === "demo") {
    return (
      <Card className="p-8">
        <Empty icon={<MessagesSquare size={28} />} title="Чат Supabase холбогдсон үед ажиллана" hint=".env.local-д Supabase-ийн утгуудыг оруулаад дахин ачаална уу" />
      </Card>
    );
  }
  return <ChatApp />;
}

function ChatApp() {
  const { me, deptById, toast } = useStore();
  const { channels, setChannels, loading, error } = useChannels();
  const [slug, setSlug] = useState<string>(() => {
    try {
      return localStorage.getItem("zuca-chat-channel") || "general";
    } catch {
      return "general";
    }
  });
  const active = channels.find((c) => c.slug === slug) ?? channels.find((c) => c.slug === "general") ?? channels[0] ?? null;
  const { messages, loading: mLoading, hasMore, loadOlder, upsert, removeLocal } = useMessages(active?.id ?? null);
  const unread = useChatUnread(me?.id, true);
  const [newOpen, setNewOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [openTask, setOpenTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!active) return;
    try {
      localStorage.setItem("zuca-chat-channel", active.slug);
    } catch {}
  }, [active]);

  // Харж буй сувгаа уншсанд тооцно
  useEffect(() => {
    if (active && document.visibilityState === "visible") markRead(active.id);
  }, [active, messages.length]);
  useEffect(() => {
    const f = () => {
      if (active && document.visibilityState === "visible") markRead(active.id);
    };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [active]);

  const alertError = (e: unknown) => toast(e instanceof Error ? e.message : "Алдаа гарлаа", "error");

  async function send(text: string) {
    if (!active || !me) return false;
    const tmp: Message = {
      id: `tmp-${Date.now()}`,
      channel_id: active.id,
      author_id: me.id,
      author_kind: "user",
      author_name: null,
      body: text,
      reply_to: null,
      source: "app",
      source_ref: null,
      ai_state: null,
      task_ids: [],
      proposals: null,
      created_at: new Date().toISOString(),
      edited_at: null,
    };
    upsert(tmp);
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel_id: active.id, body: text }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: Message; error?: string };
      if (!res.ok || !json.message) throw new Error(json.error || `Алдаа (${res.status})`);
      removeLocal(tmp.id);
      upsert(json.message);
      return true;
    } catch (e) {
      removeLocal(tmp.id);
      alertError(e);
      return false;
    }
  }

  async function setMode(ch: Channel, ai_mode: AiMode) {
    setChannels((prev) => prev.map((c) => (c.id === ch.id ? { ...c, ai_mode } : c)));
    const { error } = await getSupabaseBrowser().from("channels").update({ ai_mode }).eq("id", ch.id);
    if (error) alertError(new Error(error.message));
    else toast(AI_MODES.find((m) => m.id === ai_mode)?.hint ?? "Хадгаллаа");
  }

  const canEdit = (ch: Channel) =>
    canManageOrg(me) || ch.created_by === me?.id || (!!ch.department_id && canManageDept(me, deptById.get(ch.department_id)));

  return (
    <div className="glass flex h-[calc(100dvh-11rem)] overflow-hidden rounded-[1.75rem] lg:-my-3 lg:h-[calc(100dvh-1.5rem)]">
      {/* ── Сувгууд ── */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200/70 md:flex">
        <div className="flex items-center justify-between px-4 pt-5 pb-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Чат</h1>
            <p className="text-[11px] text-zinc-400">Ажил дурдвал AI өөрөө бүртгэнэ</p>
          </div>
          <button onClick={() => setNewOpen(true)} title="Шинэ суваг" className="grid size-9 cursor-pointer place-items-center rounded-full bg-surface-solid text-zinc-600 shadow-sm hover:text-zinc-900">
            <Plus size={18} />
          </button>
        </div>
        <ChannelList channels={channels} active={active} unread={unread.byChannel} onPick={setSlug} />
        <div className="m-3 rounded-[1.25rem] bg-gradient-to-br from-[#d6cbff] to-[#9d8bff] p-3.5 text-[11px] leading-relaxed text-neutral-900">
          <div className="mb-1 flex items-center gap-1 font-semibold">
            <Sparkles size={12} /> ZUCA AI
          </div>
          Чатад «Бат, маргааш Хөх тэнгэрт залгаарай» гэж бичихэд AI ажлыг Батад, маргаашийн хугацаатай үүсгэнэ. <b>@ai</b> гэж асуулт асууна.
        </div>
      </aside>

      {/* ── Мессежүүд ── */}
      <section className="flex min-w-0 flex-1 flex-col">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-zinc-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6">
            <Card className="p-6">
              <Empty icon={<MessagesSquare size={28} />} title="Чат ачаалж чадсангүй" hint={error} />
            </Card>
          </div>
        ) : !active ? (
          <div className="p-6">
            <Card className="p-6">
              <Empty icon={<Hash size={28} />} title="Суваг алга" hint="Зүүн талын + товчоор суваг үүсгэнэ үү" />
            </Card>
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-zinc-200/70 px-4 py-3">
              <Select className="field h-9 w-auto max-w-[45vw] md:hidden" value={active.slug} onChange={(e) => setSlug(e.target.value)}>
                {channels.map((c) => {
                  const n = unread.byChannel.get(c.id) ?? 0;
                  return (
                    <option key={c.id} value={c.slug}>
                      {c.kind === "inbox" ? "📥" : "#"} {c.name}
                      {n && c.id !== active.id ? ` (${n})` : ""}
                    </option>
                  );
                })}
              </Select>
              <button onClick={() => setNewOpen(true)} className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 md:hidden" aria-label="Шинэ суваг">
                <Plus size={18} />
              </button>
              <div className="hidden min-w-0 md:block">
                <div className="flex items-center gap-1.5 font-semibold">
                  {active.kind === "inbox" ? <Inbox size={16} className="text-zinc-400" /> : <Hash size={16} className="text-zinc-400" />}
                  {active.name}
                </div>
                {active.description && <div className="truncate text-xs text-zinc-500">{active.description}</div>}
              </div>
              <div className="ml-auto flex items-center gap-2">
                {active.kind === "inbox" && (
                  <Button size="sm" onClick={() => setGuideOpen(true)} aria-label="Эх үүсвэр холбох" title="Эх үүсвэр холбох">
                    <Plug size={14} /> <span className="hidden sm:inline">Эх үүсвэр холбох</span>
                  </Button>
                )}
                {canEdit(active) ? (
                  <Select
                    className="field h-8 w-auto py-0 text-xs"
                    value={active.ai_mode}
                    onChange={(e) => void setMode(active, e.target.value as AiMode)}
                    title={AI_MODES.find((m) => m.id === active.ai_mode)?.hint}
                  >
                    {AI_MODES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600" title={AI_MODES.find((m) => m.id === active.ai_mode)?.hint}>
                    {AI_MODES.find((m) => m.id === active.ai_mode)?.label}
                  </span>
                )}
              </div>
            </header>

            <MessageList
              key={active.id}
              channel={active}
              messages={messages}
              loading={mLoading}
              hasMore={hasMore}
              loadOlder={loadOlder}
              onOpenTask={setOpenTask}
              onPrompt={(p) => void send(p)}
            />
            <Composer channel={active} onSend={send} />
          </>
        )}
      </section>

      <NewChannelModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        channels={channels}
        onCreated={(c) => {
          setChannels((prev) => (prev.some((x) => x.id === c.id) ? prev : [...prev, c]));
          setSlug(c.slug);
        }}
      />
      <IntakeGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
      <TaskModal open={!!openTask} task={openTask} onClose={() => setOpenTask(null)} />
    </div>
  );
}

/* ─────────── Сувгийн жагсаалт ─────────── */
function ChannelList({
  channels,
  active,
  unread,
  onPick,
}: {
  channels: Channel[];
  active: Channel | null;
  unread: Map<string, number>;
  onPick: (slug: string) => void;
}) {
  const groups: { title: string; items: Channel[] }[] = [
    { title: "Сувгууд", items: channels.filter((c) => c.kind === "team") },
    { title: "Автоматаар ирсэн", items: channels.filter((c) => c.kind === "inbox") },
  ].filter((g) => g.items.length);

  return (
    <nav className="scroll-thin flex-1 space-y-4 overflow-y-auto px-2">
      {groups.map((g) => (
        <div key={g.title} className="space-y-0.5">
          <div className="px-2.5 pb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">{g.title}</div>
          {g.items.map((c) => {
            const n = unread.get(c.id) ?? 0;
            const on = active?.id === c.id;
            const Icon = c.kind === "inbox" ? Inbox : Hash;
            return (
              <button
                key={c.id}
                onClick={() => onPick(c.slug)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded-full px-3 py-2 text-sm transition",
                  on
                    ? "bg-neutral-900 font-medium text-white dark:bg-white dark:text-neutral-900"
                    : n
                      ? "font-semibold text-zinc-900 hover:bg-zinc-100"
                      : "text-zinc-600 hover:bg-zinc-100",
                )}
              >
                <Icon size={15} className={on ? "opacity-70" : "text-zinc-400"} />
                <span className="flex-1 truncate text-left">{c.name}</span>
                {(c.ai_mode === "auto" || c.ai_mode === "suggest") && (
                  <span title={AI_MODES.find((m) => m.id === c.ai_mode)?.hint}>
                    <Sparkles size={12} className={on ? "opacity-60" : "text-brand-400"} />
                  </span>
                )}
                {n > 0 && !on && <span className="tabular rounded-full bg-[#ff6b8b] px-1.5 text-[11px] font-semibold text-neutral-900">{n > 99 ? "99+" : n}</span>}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

/* ─────────── Мессежийн урсгал ─────────── */
function MessageList({
  channel,
  messages,
  loading,
  hasMore,
  loadOlder,
  onOpenTask,
  onPrompt,
}: {
  channel: Channel;
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
  loadOlder: () => Promise<void>;
  onOpenTask: (t: Task) => void;
  onPrompt: (text: string) => void;
}) {
  const { me } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const keepFrom = useRef<number | null>(null);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (keepFrom.current != null) {
      // Өмнөх мессеж ачаалсны дараа байрлалаа хадгална
      el.scrollTop = el.scrollHeight - keepFrom.current;
      keepFrom.current = null;
      return;
    }
    const last = messages[messages.length - 1];
    const mine = last?.author_kind === "user" && last.author_id === me?.id;
    if (nearBottom.current || mine) el.scrollTop = el.scrollHeight;
  }, [messages, me?.id]);

  async function older() {
    const el = ref.current;
    if (el) keepFrom.current = el.scrollHeight - el.scrollTop;
    await loadOlder();
  }

  return (
    <div
      ref={ref}
      onScroll={(e) => {
        const el = e.currentTarget;
        nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
      }}
      className="scroll-thin flex-1 overflow-y-auto pb-3"
    >
      {hasMore && (
        <div className="flex justify-center pt-3">
          <Button size="sm" variant="ghost" onClick={() => void older()}>
            Өмнөх мессежүүд
          </Button>
        </div>
      )}
      {loading && !messages.length ? (
        <div className="flex justify-center py-16 text-zinc-300">
          <Loader2 className="animate-spin" />
        </div>
      ) : !messages.length ? (
        <Welcome channel={channel} onPrompt={onPrompt} />
      ) : (
        messages.map((m, i) => {
          const prev = messages[i - 1];
          const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
          const grouped =
            !newDay &&
            !!prev &&
            m.author_kind === "user" &&
            prev.author_kind === "user" &&
            prev.author_id === m.author_id &&
            ts(m.created_at) - ts(prev.created_at) < 5 * 60_000;
          return (
            <Fragment key={m.id}>
              {newDay && (
                <div className="flex items-center gap-3 px-4 pt-4 pb-1">
                  <span className="h-px flex-1 bg-zinc-200" />
                  <span className="rounded-full bg-zinc-100 px-3 py-0.5 text-[11px] font-medium text-zinc-500">{dayLabel(m.created_at)}</span>
                  <span className="h-px flex-1 bg-zinc-200" />
                </div>
              )}
              <MessageRow m={m} grouped={grouped} replyTo={m.reply_to ? byId.get(m.reply_to) ?? null : null} onOpenTask={onOpenTask} />
            </Fragment>
          );
        })
      )}
    </div>
  );
}

function Welcome({ channel, onPrompt }: { channel: Channel; onPrompt: (t: string) => void }) {
  const examples =
    channel.kind === "inbox"
      ? []
      : [
          "Бат-Эрдэнэ, маргааш Хөх тэнгэр зуслантай холбогдож намрын ээлжийн хуваарийг аваарай",
          "Нарны зуслангийн гэрээг баасан гаригт багтаан байгуулах хэрэгтэй, яаралтай",
          "@ai Энэ долоо хоногт дуусах ажлууд юу байна?",
        ];
  return (
    <div className="mx-auto max-w-lg px-6 py-14 text-center">
      <div className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-brand-600 text-white">
        {channel.kind === "inbox" ? <Inbox size={22} /> : <Sparkles size={22} />}
      </div>
      <h2 className="text-lg font-semibold">
        {channel.kind === "inbox" ? "Ирсэн хүсэлт" : `#${channel.name}`} сувагт тавтай морил
      </h2>
      <p className="mt-1 text-sm text-zinc-500">
        {channel.kind === "inbox"
          ? "Имэйл, zuca.mn, Facebook-ээс ирсэн мессеж энд автоматаар орж, AI түүнийг ажил болгон хариуцагчид нь онооно. Дээрх «Эх үүсвэр холбох» товчоор тохируулна."
          : "Энд бичсэн мессежийг AI уншаад ажил байвал ZUCA Ops-д автоматаар бүртгэж, хүнд нь онооно. Жишээ:"}
      </p>
      {examples.length > 0 && (
        <div className="mt-4 space-y-2 text-left">
          {examples.map((e) => (
            <button
              key={e}
              onClick={() => onPrompt(e)}
              className="block w-full cursor-pointer rounded-xl border border-zinc-200 bg-surface px-3.5 py-2.5 text-sm text-zinc-700 shadow-card transition hover:border-brand-300 hover:text-brand-700"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AuthorAvatar({ m, author }: { m: Message; author: Profile | null }) {
  if (m.author_kind === "user") return <Avatar profile={author} size={36} />;
  const cls = "grid size-9 place-items-center rounded-xl";
  if (m.author_kind === "ai")
    return (
      <span className={cn(cls, "bg-gradient-to-br from-brand-500 to-violet-600 text-white")}>
        <Sparkles size={17} />
      </span>
    );
  if (m.author_kind === "system")
    return (
      <span className={cn(cls, "bg-amber-100 text-amber-700")}>
        <Sun size={17} />
      </span>
    );
  return <span className={cn(cls, "bg-sky-100 text-sky-700")}>{/@|mail|имэйл/i.test(m.author_name ?? "") ? <Mail size={17} /> : <Globe size={17} />}</span>;
}

function renderBody(text: string) {
  return text.split(/((?:^|(?<=\s))@[\p{L}\p{N}_-]+|https?:\/\/[^\s]+)/gu).map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className="rounded bg-brand-50 px-0.5 font-medium text-brand-700">
        {p}
      </span>
    ) : /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all text-brand-600 underline">
        {p}
      </a>
    ) : (
      p
    ),
  );
}

function MessageRow({
  m,
  grouped,
  replyTo,
  onOpenTask,
}: {
  m: Message;
  grouped: boolean;
  replyTo: Message | null;
  onOpenTask: (t: Task) => void;
}) {
  const { me, profileById, toast } = useStore();
  const [busy, setBusy] = useState(false);
  const author = m.author_id ? profileById.get(m.author_id) ?? null : null;
  const isAi = m.author_kind === "ai";
  const temp = m.id.startsWith("tmp-");
  // 3 минутаас удаан «уншиж байна» хэвээр бол (сервер тасарсан) дахин оролдох товч гаргана
  const stale = m.ai_state === "pending" && Date.now() - ts(m.created_at) > 180_000;
  const name =
    isAi
      ? "ZUCA AI"
      : m.author_kind === "system"
        ? m.author_name || "ZUCA Ops"
        : m.author_kind === "external"
          ? m.author_name || "Гадаад эх үүсвэр"
          : author?.full_name ?? "Тодорхойгүй";
  const replyName = replyTo
    ? replyTo.author_kind === "user"
      ? profileById.get(replyTo.author_id ?? "")?.full_name ?? ""
      : replyTo.author_name || (replyTo.author_kind === "ai" ? "ZUCA AI" : "")
    : "";
  const canDelete = (m.author_kind === "user" && m.author_id === me?.id) || canManageOrg(me);
  const canTask = !temp && (m.author_kind === "user" || m.author_kind === "external");

  async function toTask() {
    setBusy(true);
    try {
      const res = await fetch("/api/chat/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: m.id }),
      });
      const json = (await res.json().catch(() => ({}))) as { created?: number; error?: string };
      if (!res.ok) throw new Error(json.error || `Алдаа (${res.status})`);
      toast(json.created ? `${json.created} ажил үүслээ` : "AI шинэ ажил олсонгүй — хариуг нь харна уу");
    } catch (e) {
      toast(e instanceof Error ? e.message : "AI алдаа", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const { error } = await getSupabaseBrowser().from("messages").delete().eq("id", m.id);
    if (error) toast(error.message, "error");
  }

  return (
    <div className={cn("group relative mx-2 flex gap-3 rounded-2xl px-3 transition-colors hover:bg-zinc-50", grouped ? "py-0.5" : "pt-3 pb-1", isAi && "bg-violet-50/40")}>
      <div className="w-9 shrink-0">{!grouped && <AuthorAvatar m={m} author={author} />}</div>
      <div className="min-w-0 flex-1">
        {!grouped && (
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-sm font-semibold">{name}</span>
            {isAi && <span className="rounded-full bg-[#c9b8ff] px-1.5 text-[10px] font-semibold text-neutral-900">AI</span>}
            {m.author_kind === "external" && <span className="rounded bg-sky-50 px-1 text-[10px] font-semibold text-sky-700">гаднаас</span>}
            {m.source === "telegram" && <span className="rounded bg-sky-50 px-1 text-[10px] font-semibold text-sky-700">Telegram</span>}
            <span className="tabular text-[11px] text-zinc-400">{time(m.created_at)}</span>
          </div>
        )}
        {isAi && replyTo && (
          <div className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-zinc-400">
            <CornerDownRight size={11} className="shrink-0" />
            <span className="truncate">
              {replyName ? `${replyName}: ` : ""}
              {replyTo.body.slice(0, 90)}
            </span>
          </div>
        )}
        {m.body && <div className={cn("text-sm leading-relaxed break-words whitespace-pre-wrap text-zinc-800", temp && "opacity-60")}>{renderBody(m.body)}</div>}

        {m.ai_state === "pending" && !stale && (
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-brand-600">
            <Loader2 size={11} className="animate-spin" /> AI уншиж байна…
          </div>
        )}
        {(m.ai_state === "error" || (m.ai_state === "pending" && stale)) && (
          <div className="mt-1 text-[11px] text-red-600">
            {m.ai_state === "error" ? "AI боловсруулж чадсангүй" : "AI хариу ирсэнгүй"} ·{" "}
            <button onClick={() => void toTask()} className="cursor-pointer font-semibold underline">
              Дахин оролдох
            </button>
          </div>
        )}

        {m.task_ids.length > 0 && (
          <div className="mt-2 grid max-w-2xl gap-1.5">
            {m.task_ids.map((id) => (
              <TaskChip key={id} id={id} fresh={Date.now() - ts(m.created_at) < 15_000} onOpen={onOpenTask} />
            ))}
          </div>
        )}
        {m.proposals && m.proposals.length > 0 && <Proposals m={m} />}
      </div>

      {(canTask || canDelete) && !temp && (
        <div className="absolute -top-3 right-4 hidden gap-0.5 rounded-full border border-line bg-surface-solid p-0.5 shadow-card group-hover:flex">
          {canTask && (
            <button onClick={() => void toTask()} disabled={busy} title="AI-аар ажил болгох" className="cursor-pointer rounded-md p-1.5 text-zinc-500 hover:bg-brand-50 hover:text-brand-700">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            </button>
          )}
          {canDelete && (
            <button onClick={() => void remove()} title="Мессеж устгах" className="cursor-pointer rounded-md p-1.5 text-zinc-500 hover:bg-red-50 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TaskChip({ id, fresh, onOpen }: { id: string; fresh: boolean; onOpen: (t: Task) => void }) {
  const { tasks, profileById, campById, deleteTask } = useStore();
  const t = tasks.find((x) => x.id === id);
  if (!t) {
    return (
      <div className="flex items-center gap-2 rounded-[1.25rem] border border-dashed border-zinc-200 px-3 py-2 text-xs text-zinc-400">
        {fresh ? <Loader2 size={12} className="animate-spin" /> : null}
        {fresh ? "Ажлыг ачаалж байна…" : "Танд харагдахгүй ажил (өөр хүнд оноогдсон эсвэл устгагдсан)"}
      </div>
    );
  }
  const who = t.assignee_id ? profileById.get(t.assignee_id) ?? null : null;
  const due = dueLabel(t.due_date);
  const camp = t.camp_id ? campById.get(t.camp_id) : null;
  const status = STATUSES.find((s) => s.id === t.status);
  return (
    <div className="raised rounded-[1.25rem] px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <PriorityChip priority={t.priority} compact />
        <button
          onClick={() => onOpen(t)}
          className={cn("min-w-0 flex-1 cursor-pointer truncate text-left text-sm font-medium hover:text-brand-700 hover:underline", t.status === "done" && "text-zinc-400 line-through")}
        >
          {t.title}
        </button>
        <button
          onClick={() => void deleteTask(t.id)}
          title="Буцаах — энэ ажлыг устгана"
          className="cursor-pointer rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
        >
          <Undo2 size={13} />
        </button>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1">
          <Avatar profile={who} size={16} />
          {who ? who.full_name : "Хариуцагчгүй"}
        </span>
        {due && <span className={cn("whitespace-nowrap", due.tone === "overdue" && "font-medium text-red-600")}>⏰ {due.text}</span>}
        {camp && <span className="truncate">⛺ {camp.name}</span>}
        <span className="rounded bg-zinc-100 px-1.5 py-px text-[10px] font-medium text-zinc-600">{status?.label}</span>
      </div>
    </div>
  );
}

function Proposals({ m }: { m: Message }) {
  const { createTask, profileById, toast } = useStore();
  const [busy, setBusy] = useState<number | null>(null);
  const list = m.proposals ?? [];

  async function save(next: TaskProposal[]) {
    const { error } = await getSupabaseBrowser().from("messages").update({ proposals: next }).eq("id", m.id);
    if (error) toast(error.message, "error");
  }
  async function accept(i: number) {
    const p = list[i];
    setBusy(i);
    try {
      const t = await createTask({
        title: p.title,
        description: p.description || null,
        priority: p.priority,
        assignee_id: p.assignee_id || null,
        camp_id: p.camp_id || null,
        ...(p.project_id ? { project_id: p.project_id } : {}),
        department_id: p.department_id || null,
        due_date: p.due_date || null,
        planned_month: p.due_date ? p.due_date.slice(0, 7) : null,
        tags: ["AI"],
        source: "chat",
        source_message_id: m.reply_to ?? m.id,
        position: Date.now(),
      });
      if (!t) return;
      await save(list.map((x, j) => (j === i ? { ...x, status: "created", task_id: t.id } : x)));
      toast("Ажил үүслээ");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-2 grid max-w-2xl gap-1.5">
      {list.map((p, i) => {
        const who = p.assignee_id ? profileById.get(p.assignee_id) : null;
        const due = dueLabel(p.due_date || null);
        const st = p.status ?? "open";
        return (
          <div key={i} className={cn("rounded-xl border border-dashed px-3 py-2", st === "open" ? "border-brand-300 bg-surface" : "border-zinc-200 bg-zinc-50 opacity-70")}>
            <div className="flex items-center gap-2">
              <PriorityChip priority={p.priority} compact />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.title}</span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-zinc-500">
              <span>{who ? who.full_name : "Хариуцагчгүй"}</span>
              {due && <span>{due.text}</span>}
              {p.description && <span className="truncate">{p.description.slice(0, 80)}</span>}
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              {st === "open" ? (
                <>
                  <Button size="sm" variant="primary" disabled={busy === i} onClick={() => void accept(i)}>
                    {busy === i ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Үүсгэх
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void save(list.map((x, j) => (j === i ? { ...x, status: "dismissed" } : x)))}>
                    Алгасах
                  </Button>
                </>
              ) : (
                <span className="text-[11px] font-medium text-zinc-500">{st === "created" ? "✓ Ажил үүссэн" : "Алгассан"}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────── Бичих хэсэг ─────────── */
function Composer({ channel, onSend }: { channel: Channel; onSend: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [text]);

  useEffect(() => {
    setText("");
    ref.current?.focus();
  }, [channel.id]);

  async function submit() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    const ok = await onSend(body);
    if (!ok) setText(body);
    setSending(false);
    ref.current?.focus();
  }

  const hint =
    channel.ai_mode === "auto"
      ? "AI ажлыг автоматаар бүртгэнэ"
      : channel.ai_mode === "suggest"
        ? "AI ажил санал болгоно"
        : channel.ai_mode === "mention"
          ? "AI зөвхөн @ai гэхэд хариулна"
          : "AI унтраалттай";

  return (
    <div className="border-t border-zinc-200/70 px-4 pt-2 pb-3">
      <div className="scroll-thin mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
        {PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => {
              setText(p);
              ref.current?.focus();
            }}
            className="shrink-0 cursor-pointer rounded-full bg-zinc-100 px-3 py-1.5 text-[11px] text-zinc-600 transition hover:bg-zinc-200 hover:text-zinc-900"
          >
            {p}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2 rounded-[1.5rem] border border-line bg-surface-solid py-2 pr-2 pl-3 shadow-sm transition focus-within:border-brand-400 focus-within:ring-3 focus-within:ring-brand-100">
        <button
          type="button"
          title="AI-д хандах"
          onClick={() => {
            setText((t) => (t.startsWith("@ai") ? t : `@ai ${t}`));
            ref.current?.focus();
          }}
          className="mb-0.5 grid size-8 cursor-pointer place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
        >
          <AtSign size={16} />
        </button>
        <textarea
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={`#${channel.name} руу бичих…`}
          className="max-h-[200px] min-h-[24px] flex-1 resize-none self-center bg-transparent py-1 text-sm outline-none placeholder:text-zinc-400"
        />
        <button
          type="button"
          disabled={!text.trim() || sending}
          onClick={() => void submit()}
          aria-label="Илгээх"
          className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-1 text-[11px] text-zinc-400">
        <Sparkles size={11} className={channel.ai_mode === "off" ? "" : "text-brand-400"} />
        {hint}
        <span className="hidden sm:inline">· Enter — илгээх · Shift+Enter — шинэ мөр</span>
      </div>
    </div>
  );
}

/* ─────────── Шинэ суваг ─────────── */
function NewChannelModal({
  open,
  onClose,
  channels,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  channels: Channel[];
  onCreated: (c: Channel) => void;
}) {
  const { departments, toast } = useStore();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [dept, setDept] = useState("");
  const [mode, setMode] = useState<AiMode>("auto");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setDesc("");
      setDept("");
      setMode("auto");
    }
  }, [open]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true);
    const base = slugify(name) || "suvag";
    let slug = base;
    for (let n = 2; channels.some((c) => c.slug === slug); n++) slug = `${base}-${n}`;
    const { data, error } = await getSupabaseBrowser()
      .from("channels")
      .insert({ name: name.trim(), slug, description: desc.trim() || null, department_id: dept || null, ai_mode: mode, position: Date.now() })
      .select()
      .single();
    setBusy(false);
    if (error) return toast(error.code === "23505" ? "Ийм нэртэй суваг байна" : error.message, "error");
    onCreated(data as Channel);
    onClose();
    toast(`#${(data as Channel).name} суваг үүслээ`);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Шинэ суваг"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Болих
          </Button>
          <Button variant="primary" disabled={!name.trim() || busy} onClick={() => void create()}>
            {busy && <Loader2 size={14} className="animate-spin" />} Үүсгэх
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="label">Нэр</label>
          <input className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="жишээ нь: Намрын хөтөлбөр" />
        </div>
        <div>
          <label className="label">Тайлбар</label>
          <input className="field" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Энэ сувагт юу ярих вэ" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Хэлтэс (заавал биш)</label>
            <Select className="field" value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label">AI туслах</label>
            <Select className="field" value={mode} onChange={(e) => setMode(e.target.value as AiMode)}>
              {AI_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label.replace("AI: ", "")}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className="text-xs text-zinc-500">{AI_MODES.find((m) => m.id === mode)?.hint}. Хэлтэс сонговол хариуцагчгүй ажил тэр хэлтэст очно.</p>
      </div>
    </Modal>
  );
}

/* ─────────── Гадаад эх үүсвэр холбох заавар ─────────── */
function IntakeGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useStore();
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const url = typeof window === "undefined" ? "/api/intake" : `${window.location.origin}/api/intake`;

  useEffect(() => {
    if (!open) return;
    fetch("/api/agent/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [open]);

  const curl = `curl -X POST "${url}" \\
  -H "Authorization: Bearer $INTAKE_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"from":"Сараа (эцэг эх)","text":"Нарны зусланд хүүхдээ бүртгүүлсэн, төлбөр 2 удаа гарсан байна. Буцааж өгнө үү. 9911xxxx"}'`;

  const gmail = `// script.google.com → шинэ төсөл → доорхыг paste → Triggers: 5 минут тутам
function forwardToZuca() {
  var URL = "${url}";
  var KEY = "INTAKE_SECRET-ээ энд";
  GmailApp.search("label:zuca-ops is:unread", 0, 20).forEach(function (t) {
    t.getMessages().forEach(function (m) {
      if (!m.isUnread()) return;
      UrlFetchApp.fetch(URL, {
        method: "post",
        contentType: "application/json",
        headers: { Authorization: "Bearer " + KEY },
        payload: JSON.stringify({
          from: m.getFrom(), subject: m.getSubject(),
          text: m.getPlainBody().slice(0, 4000), ref: m.getId()
        })
      });
      m.markRead();
    });
  });
}`;

  const copy = (s: string) =>
    navigator.clipboard
      .writeText(s)
      .then(() => toast("Хууллаа"))
      .catch(() => toast("Хуулж чадсангүй", "error"));

  const Code = ({ children }: { children: string }) => (
    <div className="overflow-hidden rounded-lg bg-neutral-900">
      <div className="flex justify-end px-2 pt-1.5">
        <button onClick={() => void copy(children)} className="cursor-pointer rounded bg-white/10 px-2 py-0.5 text-[10px] text-white hover:bg-white/20">
          Хуулах
        </button>
      </div>
      <pre className="scroll-thin overflow-x-auto px-3 pt-1 pb-3 text-[11px] leading-relaxed text-neutral-100">{children}</pre>
    </div>
  );

  const ready = status?.intake && status?.serviceRole && status?.ai;

  return (
    <Modal open={open} onClose={onClose} title="Ажлыг гаднаас автоматаар оруулах" width="max-w-2xl">
      <div className="space-y-5 text-sm">
        <p className="text-zinc-600">
          Имэйл, zuca.mn, Facebook, Google Form зэргээс ирсэн мессеж <b>«Ирсэн хүсэлт»</b> сувагт орж, AI түүнийг ажил болгоод хариуцагчид нь онооно. Хүн гараар оруулах шаардлагагүй.
        </p>

        <div className={cn("rounded-lg px-3 py-2 text-xs", ready ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900")}>
          {status == null
            ? "Тохиргоог шалгаж байна…"
            : ready
              ? "✓ Бэлэн — доорх аль ч аргаар холбож болно."
              : `Дутуу тохиргоо (Vercel → Environment Variables): ${[
                  !status.intake && "INTAKE_SECRET",
                  !status.serviceRole && "SUPABASE_SERVICE_ROLE_KEY",
                  !status.ai && "ANTHROPIC_API_KEY",
                ]
                  .filter(Boolean)
                  .join(", ")}`}
        </div>

        <section className="space-y-2">
          <h3 className="font-semibold">1. Турших</h3>
          <Code>{curl}</Code>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">2. Gmail → ажил</h3>
          <p className="text-xs text-zinc-500">
            Gmail дээр шүүлтүүр үүсгээд (жишээ нь info@zuca.mn руу ирсэн) <code>zuca-ops</code> label наа. Доорх Apps Script 5 минут тутам шинэ имэйлийг илгээнэ.
          </p>
          <Code>{gmail}</Code>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">3. zuca.mn → ажил (Supabase Database Webhook)</h3>
          <p className="text-xs text-zinc-500">
            zuca.mn-ийн Supabase → <b>Database → Webhooks → Create</b>. Хүснэгт: шинэ бүртгэл, гомдол, зуслангийн хүсэлт гэх мэт · Events: Insert · Method: POST · URL:
          </p>
          <Code>{`${url}?key=INTAKE_SECRET&source=zuca.mn`}</Code>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">4. Facebook page, Google Form, Zapier / Make</h3>
          <p className="text-xs text-zinc-500">
            «Webhook → POST» алхам нэмээд дээрх URL руу <code>{`{"from": "...", "text": "..."}`}</code> JSON илгээнэ. Давхардахгүйн тулд <code>ref</code> талбарт мессежийн id-г өгнө.
          </p>
        </section>
      </div>
    </Modal>
  );
}
