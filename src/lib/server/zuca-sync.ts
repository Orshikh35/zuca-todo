/**
 * Орой бүр zuca.mn-ээс зуслан, ээлжийн мэдээллийг татаж ZUCA Ops-д шинэчилнэ.
 * - Зуслан: zuca_id → slug → нэрээр тааруулна; zuca.mn дээр бөглөгдсөн талбарыг л шинэчилнэ.
 * - Ээлж: zuca_shifts хүснэгтэд (дүүргэлт, үнэ, огноо).
 * - zuca.mn-д шинээр нэмэгдсэн зусланд «шалгах» ажил үүсгэж, #Ерөнхий-д товчоо бичнэ.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { prettyDate, shiftDate, todayIn } from "../agent/digest";
import type { Camp, Department, Task } from "../types";
import { notifyAssignee } from "./task-notify";
import { mapCamp, mapShifts, nameKey, type ZCamp } from "./zuca-map";

export const zucaApi = () => (process.env.ZUCA_API_URL || "https://zuca.mn/api/v1").replace(/\/+$/, "");

async function getResult<T>(path: string): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch(`${zucaApi()}${path}`, { cache: "no-store", signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`zuca.mn ${path}: HTTP ${res.status}`);
    const json = (await res.json()) as { status?: boolean; result?: T; message?: string };
    if (json.status === false || json.result === undefined) throw new Error(`zuca.mn ${path}: ${json.message ?? "хариу хоосон"}`);
    return json.result;
  } finally {
    clearTimeout(timer);
  }
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

export interface SyncResult {
  at: string;
  camps: number;
  updated: number;
  added: string[];
  missing: string[];
  shifts: number;
  upcoming: { count: number; capacity: number; booked: number };
  /** Ирэх 14 хоногийн өдрийн ээлжүүд */
  day: { count: number; booked: number; camps: number };
  errors: string[];
  posted: boolean;
}

export async function syncZuca(sb: SupabaseClient, opts: { manual?: boolean; actorName?: string } = {}): Promise<SyncResult> {
  const now = new Date();
  const errors: string[] = [];
  const list = await getResult<ZCamp[]>("/Camps/all");
  const details = await pool(list, 4, async (c) => {
    try {
      return await getResult<ZCamp>(`/Camps/detailed/${c.id}`);
    } catch (e) {
      errors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
      return c; // жагсаалтын товч мэдээллээр ч шинэчилнэ
    }
  });

  // Анхны синк бол zuca.mn-ийн бүх зуслан «шинэ» гэж харагдана — тэр үед ажил үүсгэхгүй, зөвхөн импортлоно
  const { data: prevMeta } = await sb.from("app_meta").select("key").eq("key", "zuca_sync").maybeSingle();
  const firstRun = !prevMeta;

  const { data: existing, error: exErr } = await sb.from("camps").select("*");
  if (exErr) throw new Error(exErr.message);
  const camps = existing as Camp[];
  const byZid = new Map(camps.filter((c) => c.zuca_id != null).map((c) => [Number(c.zuca_id), c]));
  const bySlug = new Map(camps.filter((c) => c.zuca_slug).map((c) => [String(c.zuca_slug).toLowerCase(), c]));
  const byName = new Map(camps.map((c) => [nameKey(c.name), c]));

  const added: Camp[] = [];
  let updated = 0;
  const shiftRows: ReturnType<typeof mapShifts> = [];
  const syncedCampIds: string[] = [];

  for (const d of details) {
    const patch = mapCamp(d, now);
    const match = byZid.get(d.id) ?? (d.slug ? bySlug.get(d.slug.toLowerCase()) : undefined) ?? byName.get(nameKey(d.name));
    let campId: string;
    if (match) {
      // zuca.mn дээр байгаа бол «идэвхтэй» (гараар «идэвхгүй» болгосныг хүндэтгэнэ)
      if (match.stage !== "inactive") patch.stage = "active";
      // Гараар засварласан нэрийг хадгална
      delete patch.name;
      const { error } = await sb.from("camps").update(patch).eq("id", match.id);
      if (error) {
        errors.push(`${d.name}: ${error.message}`);
        continue;
      }
      campId = match.id;
      updated++;
    } else {
      const { data, error } = await sb
        .from("camps")
        .insert({ ...patch, name: patch.name || d.name, stage: "active", season: "summer", position: Date.now() + added.length })
        .select()
        .single();
      if (error || !data) {
        errors.push(`${d.name}: ${error?.message ?? "нэмэгдсэнгүй"}`);
        continue;
      }
      campId = (data as Camp).id;
      added.push(data as Camp);
    }
    syncedCampIds.push(campId);
    shiftRows.push(...mapShifts(d, campId, now));
  }

  // Ээлжүүд: шинэчилж, zuca.mn-ээс хасагдсаныг устгана
  if (shiftRows.length) {
    for (let i = 0; i < shiftRows.length; i += 500) {
      const { error } = await sb.from("zuca_shifts").upsert(shiftRows.slice(i, i + 500), { onConflict: "id" });
      if (error) errors.push(`ээлж: ${error.message}`);
    }
  }
  if (syncedCampIds.length) {
    const keep = shiftRows.map((r) => r.id);
    let del = sb.from("zuca_shifts").delete().in("camp_id", syncedCampIds);
    if (keep.length) del = del.not("id", "in", `(${keep.join(",")})`);
    const { error } = await del;
    if (error) errors.push(`ээлж устгах: ${error.message}`);
  }

  // zuca.mn-ээс алга болсон (өмнө нь синк хийгдсэн) зуслангууд
  const listed = new Set(list.map((c) => c.id));
  const missing = camps.filter((c) => c.zuca_id != null && !listed.has(Number(c.zuca_id)) && c.stage === "active").map((c) => c.name);

  // Ирэх 14 хоногийн нээлттэй ээлжүүд
  const today = todayIn();
  const horizon = shiftDate(today, 14);
  const soon = shiftRows.filter((s) => s.is_open && s.starts_at && s.starts_at.slice(0, 10) >= today && s.starts_at.slice(0, 10) <= horizon);
  // Өдрийн ээлж (өдөр бүр давтагддаг) дүүргэлтийн дүнг гажуудуулахгүйн тулд тусад нь тооцно
  const upcoming = soon.filter((s) => !s.is_day);
  const daySoon = soon.filter((s) => s.is_day);
  const cap = upcoming.reduce((a, s) => a + s.capacity, 0);
  const booked = upcoming.reduce((a, s) => a + s.booked, 0);
  const dayBooked = daySoon.reduce((a, s) => a + s.booked, 0);
  const campName = new Map([...camps, ...added].map((c) => [c.id, c.name]));
  const weak = upcoming
    .filter((s) => s.capacity >= 20 && s.starts_at!.slice(0, 10) <= shiftDate(today, 10) && s.booked / s.capacity < 0.25)
    .sort((a, b) => a.booked / a.capacity - b.booked / b.capacity)
    .slice(0, 5);

  // Шинэ зуслан → Партнершипийн даргад шалгах ажил
  if (added.length && !firstRun) {
    const { data: depts } = await sb.from("departments").select("*");
    const part = (depts as Department[] | null)?.find((d) => (d.code ?? "").toUpperCase() === "PART" || /партнер/i.test(d.name));
    const due = shiftDate(today, 2);
    const rows = added.map((c, i) => ({
      title: `zuca.mn-д шинэ зуслан: ${c.name} — профайл, гэрээг шалгах`,
      description: `zuca.mn дээр шинээр нэмэгдсэн. Мэдээлэл бүрэн эсэх, гэрээ байгуулсан эсэхийг шалгаж, хариуцагч тавина.`,
      priority: "high",
      status: "todo",
      camp_id: c.id,
      assignee_id: part?.head_id ?? null,
      department_id: part?.id ?? null,
      due_date: due,
      planned_month: due.slice(0, 7),
      tags: ["zuca.mn", "auto"],
      source: "auto",
      position: Date.now() + i,
    }));
    const { data: tasks, error } = await sb.from("tasks").insert(rows).select();
    if (error) errors.push(`ажил: ${error.message}`);
    for (const t of (tasks ?? []) as Task[]) await notifyAssignee(sb, t, { actorName: "zuca.mn синк" });
  }

  const result: SyncResult = {
    at: now.toISOString(),
    camps: list.length,
    updated,
    added: added.map((c) => c.name),
    missing,
    shifts: shiftRows.length,
    upcoming: { count: upcoming.length, capacity: cap, booked },
    day: { count: daySoon.length, booked: dayBooked, camps: new Set(daySoon.map((s) => s.camp_id)).size },
    errors,
    posted: false,
  };
  await sb.from("app_meta").upsert({ key: "zuca_sync", value: result, updated_at: result.at });

  // #Ерөнхий сувагт товчоо
  const { data: general } = await sb.from("channels").select("id").eq("slug", "general").maybeSingle();
  if (general) {
    const pct = cap ? Math.round((booked / cap) * 100) : 0;
    const L = [
      `🌙 zuca.mn-ээс мэдээлэл шинэчиллээ${opts.actorName ? ` (${opts.actorName})` : ""} — ${list.length} зуслан, ${shiftRows.length} ээлж.`,
      upcoming.length
        ? `• Ирэх 14 хоногт ${upcoming.length} нээлттэй ээлж (хоноглох), дүүргэлт ${pct}% (${booked}/${cap}).`
        : "• Ирэх 14 хоногт хоноглох нээлттэй ээлж алга.",
    ];
    if (daySoon.length) L.push(`• Өдрийн ээлж: ${daySoon.length} өдөр (${result.day.camps} зуслан), ${dayBooked} бүртгэл.`);
    if (added.length && firstRun) L.push(`• Анхны синк: ${added.length} зуслан zuca.mn-ээс импортлогдлоо.`);
    else if (added.length) L.push(`• zuca.mn-д шинэ зуслан: ${added.map((c) => c.name).join(", ")} — шалгах ажил үүсгэлээ.`);
    if (missing.length) L.push(`• zuca.mn-ээс алга болсон: ${missing.join(", ")}`);
    if (weak.length) {
      L.push("", "📉 Дүүргэлт сул, удахгүй эхлэх ээлжүүд:");
      weak.forEach((s) =>
        L.push(`• ${campName.get(s.camp_id) ?? ""} — ${s.name} (${prettyDate(s.starts_at!.slice(0, 10))}): ${s.booked}/${s.capacity}`),
      );
    }
    if (errors.length) L.push("", `⚠️ ${errors.length} алдаа: ${errors.slice(0, 3).join("; ")}`);
    const { error } = await sb.from("messages").insert({
      channel_id: general.id,
      author_kind: "system",
      author_name: "zuca.mn синк",
      body: L.join("\n"),
      source: "cron",
      source_ref: opts.manual ? `zuca-sync-${result.at.slice(0, 16)}` : `zuca-sync-${today}`,
    });
    result.posted = !error;
  }
  return result;
}
