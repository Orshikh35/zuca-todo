"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowser, isSupabaseConfigured } from "../supabase/client";
import type { ZucaShift } from "../types";

export interface ZucaSyncInfo {
  at: string;
  camps: number;
  shifts: number;
  added: string[];
  missing: string[];
  upcoming: { count: number; capacity: number; booked: number };
  day?: { count: number; booked: number; camps: number };
  errors: string[];
}

/** zuca.mn-ээс синк хийсэн ээлжүүд (ирэх 45 хоног) + сүүлийн синкийн мэдээлэл */
export function useZucaLive() {
  const [shifts, setShifts] = useState<ZucaShift[]>([]);
  const [sync, setSync] = useState<ZucaSyncInfo | null>(null);
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setAvailable(false);
      setReady(true);
      return;
    }
    const sb = getSupabaseBrowser();
    const from = new Date(Date.now() - 86_400_000).toISOString();
    const to = new Date(Date.now() + 45 * 86_400_000).toISOString();
    const [s, m] = await Promise.all([
      sb.from("zuca_shifts").select("*").gte("starts_at", from).lte("starts_at", to).order("starts_at").limit(400),
      sb.from("app_meta").select("value").eq("key", "zuca_sync").maybeSingle(),
    ]);
    if (s.error) setAvailable(false);
    else setShifts(s.data as ZucaShift[]);
    if (!m.error && m.data) setSync(m.data.value as ZucaSyncInfo);
    setReady(true);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { shifts, sync, ready, available, reload: load };
}

/** «Одоо шинэчлэх» — /api/zuca/sync дуудаж, амжилттай бол onDone-г ажиллуулна */
export function useZucaSyncNow(onDone: () => Promise<unknown> | void, toast: (t: string, tone?: "ok" | "error") => void) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/zuca/sync", { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { camps?: number; shifts?: number; added?: string[]; errors?: string[]; error?: string };
      if (!res.ok) throw new Error(json.error || `Алдаа (${res.status})`);
      const added = json.added?.length ? `, ${json.added.length} шинэ` : "";
      toast(`zuca.mn: ${json.camps ?? 0} зуслан, ${json.shifts ?? 0} ээлж шинэчиллээ${added}`, json.errors?.length ? "error" : "ok");
      await onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Синк амжилтгүй", "error");
    } finally {
      setBusy(false);
    }
  }, [onDone, toast]);
  return { busy, run };
}

export function syncedLabel(at?: string | null) {
  if (!at) return null;
  const d = new Date(at);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.toTimeString().slice(0, 5)}`;
}
