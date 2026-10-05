"use client";

/**
 * Чатын client hook-ууд — Supabase Realtime-аар сувгууд, мессежийг шууд шинэчилнэ.
 * Чат зөвхөн Supabase горимд ажиллана (demo горимд realtime байхгүй).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowser, isSupabaseConfigured } from "../supabase/client";
import type { Channel, Message } from "../types";

const SCHEMA_HINT =
  "Чатын хүснэгт үүсээгүй байна. Supabase → SQL Editor дээр supabase/schema.sql-ийг бүтнээр нь дахин Run хийнэ үү (v5).";

export function useChannels() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = getSupabaseBrowser();
    const { data, error } = await sb.from("channels").select("*").eq("archived", false).order("position");
    if (error) setError(error.code === "PGRST205" ? SCHEMA_HINT : error.message);
    else {
      setChannels(data as Channel[]);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    void load();
    const sb = getSupabaseBrowser();
    const ch = sb
      .channel(`chat-channels-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "channels" }, () => void load())
      .subscribe();
    return () => {
      void sb.removeChannel(ch);
    };
  }, [load]);

  return { channels, setChannels, loading, error, reload: load };
}

const PAGE = 60;
// Postgres (+00:00) ба JS (Z) огнооны форматыг тэгшитгэж харьцуулна
const ts = (iso: string) => Date.parse(iso) || 0;
const byTime = (a: Message, b: Message) => ts(a.created_at) - ts(b.created_at);

export function useMessages(channelId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const upsert = useCallback(
    (m: Message) =>
      setMessages((prev) => {
        if (m.channel_id !== channelId) return prev;
        const i = prev.findIndex((x) => x.id === m.id);
        if (i >= 0) {
          const next = prev.slice();
          next[i] = m;
          return next;
        }
        return [...prev, m].sort(byTime);
      }),
    [channelId],
  );
  const removeLocal = useCallback((id: string) => setMessages((prev) => prev.filter((x) => x.id !== id)), []);

  useEffect(() => {
    if (!channelId || !isSupabaseConfigured) return;
    let alive = true;
    setLoading(true);
    setMessages([]);
    const sb = getSupabaseBrowser();
    void (async () => {
      const { data } = await sb.from("messages").select("*").eq("channel_id", channelId).order("created_at", { ascending: false }).limit(PAGE);
      if (!alive) return;
      const rows = (data ?? []) as Message[];
      // Realtime-аар түрүүлж ирсэн мөрүүдийг хадгална
      setMessages((prev) => {
        const ids = new Set(rows.map((r) => r.id));
        return [...rows.reverse(), ...prev.filter((p) => !ids.has(p.id))].sort(byTime);
      });
      setHasMore(rows.length === PAGE);
      setLoading(false);
    })();

    const filter = `channel_id=eq.${channelId}`;
    const ch = sb
      .channel(`chat-${channelId}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter }, (p) => upsert(p.new as Message))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter }, (p) => upsert(p.new as Message))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (p) => removeLocal((p.old as { id: string }).id))
      .subscribe();
    return () => {
      alive = false;
      void sb.removeChannel(ch);
    };
  }, [channelId, upsert, removeLocal]);

  // Realtime тасарсан ч AI-ийн хариуг алдахгүй: боловсруулж буй мессеж байвал 4 сек тутам шалгана
  const pendingKey = messages
    .filter((m) => m.ai_state === "pending" && !m.id.startsWith("tmp-") && Date.now() - ts(m.created_at) < 180_000)
    .map((m) => m.id)
    .join(",");
  useEffect(() => {
    if (!channelId || !pendingKey || !isSupabaseConfigured) return;
    const sb = getSupabaseBrowser();
    const t = setInterval(async () => {
      const { data } = await sb.from("messages").select("*").eq("channel_id", channelId).order("created_at", { ascending: false }).limit(20);
      ((data ?? []) as Message[]).forEach(upsert);
    }, 4000);
    const stop = setTimeout(() => clearInterval(t), 180_000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [channelId, pendingKey, upsert]);

  const loadOlder = useCallback(async () => {
    const first = messages.find((m) => !m.id.startsWith("tmp-"));
    if (!channelId || !first) return;
    const sb = getSupabaseBrowser();
    const { data } = await sb
      .from("messages")
      .select("*")
      .eq("channel_id", channelId)
      .lt("created_at", first.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE);
    const rows = (data ?? []) as Message[];
    setMessages((prev) => [...rows.reverse(), ...prev]);
    setHasMore(rows.length === PAGE);
  }, [channelId, messages]);

  return { messages, loading, hasMore, loadOlder, upsert, removeLocal };
}

/* ─────────── Уншаагүй мессеж (browser-т хадгална) ─────────── */
const READ_KEY = "zuca-chat-read";
const READ_EVENT = "zuca-chat-read";

function readMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) || "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function markRead(channelId: string) {
  const m = readMap();
  const now = new Date().toISOString();
  m[channelId] = now;
  m._init ??= now;
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(m));
  } catch {
    /* private горимд хадгалахгүй байж болно */
  }
  window.dispatchEvent(new Event(READ_EVENT));
}

type Lite = Pick<Message, "id" | "channel_id" | "created_at" | "author_id" | "author_kind">;

/** Суваг бүрийн уншаагүй мессежийн тоо. Өөрийн бичсэнийг тоолохгүй. */
export function useChatUnread(meId: string | null | undefined, enabled: boolean) {
  const [recent, setRecent] = useState<Lite[]>([]);
  const [tick, setTick] = useState(0);
  const init = useRef<string>("");

  useEffect(() => {
    if (!enabled || !meId || !isSupabaseConfigured) return;
    const m = readMap();
    if (!m._init) {
      // Анх удаа — өмнөх бүх мессежийг уншсанд тооцно
      m._init = new Date().toISOString();
      try {
        localStorage.setItem(READ_KEY, JSON.stringify(m));
      } catch {}
    }
    init.current = m._init;

    let alive = true;
    const sb = getSupabaseBrowser();
    void (async () => {
      const { data } = await sb
        .from("messages")
        .select("id,channel_id,created_at,author_id,author_kind")
        .gt("created_at", init.current)
        .order("created_at", { ascending: false })
        .limit(300);
      if (alive && data) setRecent(data as Lite[]);
    })();
    const ch = sb
      .channel(`chat-unread-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (p) =>
        setRecent((prev) => [p.new as Lite, ...prev].slice(0, 300)),
      )
      .subscribe();
    const onRead = () => setTick((t) => t + 1);
    window.addEventListener(READ_EVENT, onRead);
    window.addEventListener("storage", onRead);
    return () => {
      alive = false;
      void sb.removeChannel(ch);
      window.removeEventListener(READ_EVENT, onRead);
      window.removeEventListener("storage", onRead);
    };
  }, [meId, enabled]);

  return useMemo(() => {
    void tick;
    const m = readMap();
    const byChannel = new Map<string, number>();
    for (const r of recent) {
      if (r.author_kind === "user" && r.author_id === meId) continue;
      const seen = m[r.channel_id] ?? m._init ?? init.current;
      if (seen && ts(r.created_at) <= ts(seen)) continue;
      byChannel.set(r.channel_id, (byChannel.get(r.channel_id) ?? 0) + 1);
    }
    let total = 0;
    byChannel.forEach((n) => (total += n));
    return { total, byChannel };
  }, [recent, tick, meId]);
}
