/**
 * zuca.mn-ийн нийтийн API (https://zuca.mn/api/v1/Camps/…) → ZUCA Ops-ийн зуслан, ээлж.
 * Цэвэр функцууд — тест хийхэд хялбар.
 */
import type { Camp } from "../types";

export interface ZShift {
  id: number;
  name?: string;
  capacity?: number;
  booked?: number;
  price?: number | null;
  discount?: number;
  isOpen?: boolean;
  startDate?: string | null;
  endDate?: string | null;
  isDayShift?: boolean;
}

export interface ZCamp {
  id: number;
  slug?: string;
  name: string;
  city?: string;
  district?: string;
  address?: string;
  about?: string;
  rating?: string | number;
  phone?: string;
  phone2?: string;
  email?: string;
  webSite?: string;
  facebook?: string;
  mapUrl?: string;
  embededMap?: string;
  ageRange?: string;
  commentCount?: number;
  images?: string[];
  shifts?: ZShift[];
}

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Tiptap JSON («{"type":"doc",…}») → энгийн текст */
export function tiptapText(raw: string | undefined | null): string {
  const s = clean(raw);
  if (!s) return "";
  if (!s.startsWith("{")) return s;
  try {
    const out: string[] = [];
    const walk = (n: { type?: string; text?: string; content?: unknown[] }) => {
      if (n.type === "text" && n.text) out.push(n.text);
      else if (n.type === "hardBreak") out.push("\n");
      (n.content as (typeof n)[] | undefined)?.forEach(walk);
      if (n.type === "paragraph" || n.type === "heading" || n.type === "listItem") out.push("\n");
    };
    walk(JSON.parse(s));
    return out.join("").replace(/\n{3,}/g, "\n\n").trim();
  } catch {
    return "";
  }
}

export function parseAge(range: string | undefined): [number | null, number | null] {
  const m = clean(range).match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
  if (!m) return [null, null];
  const a = Number(m[1]);
  const b = Number(m[2]);
  return a <= b && b <= 25 ? [a, b] : [null, null];
}

/** Google Maps embed / холбоосоос координат (Монголын хүрээнд эсэхийг шалгана) */
export function parseCoords(embed?: string, url?: string): { lat: number; lng: number } | null {
  const ok = (lat: number, lng: number) => lat > 41 && lat < 53 && lng > 87 && lng < 121;
  const tries: [RegExp, (m: RegExpMatchArray) => [number, number]][] = [
    [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, (m) => [Number(m[1]), Number(m[2])]], // place: lat, lng
    [/!2d(-?\d+\.\d+)!3d(-?\d+\.\d+)/, (m) => [Number(m[2]), Number(m[1])]], // embed: lng, lat
    [/@(-?\d+\.\d+),(-?\d+\.\d+)/, (m) => [Number(m[1]), Number(m[2])]],
    [/cp=(-?\d+\.\d+)(?:~|%7E)(-?\d+\.\d+)/i, (m) => [Number(m[1]), Number(m[2])]], // bing
  ];
  for (const src of [embed ?? "", url ?? ""]) {
    for (const [re, get] of tries) {
      const m = src.match(re);
      if (!m) continue;
      const [lat, lng] = get(m);
      if (ok(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

/** zuca.mn-ийн ээлжийн огноо (Улаанбаатарын цаг, timezone-гүй) → ISO */
export function zTime(v: string | null | undefined) {
  const s = clean(v);
  if (!s) return null;
  return /[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : `${s}+08:00`;
}

/** Зуслангийн мэдээлэл — зөвхөн zuca.mn дээр бөглөгдсөн талбарыг (хоосноор дарж бичихгүй) */
export function mapCamp(d: ZCamp, now = new Date()): Partial<Camp> {
  const shifts = d.shifts ?? [];
  const main = shifts.filter((s) => !s.isDayShift);
  const pool = main.length ? main : shifts;
  const prices = pool.map((s) => Number(s.price) || 0).filter((p) => p > 0);
  const caps = pool.map((s) => Number(s.capacity) || 0).filter((c) => c > 0);
  const [ageMin, ageMax] = parseAge(d.ageRange);
  const coords = parseCoords(d.embededMap, d.mapUrl);
  const phones = [clean(d.phone), clean(d.phone2)].filter(Boolean);
  const nowIso = now.toISOString();
  const openUpcoming = shifts.filter((s) => s.isOpen && (zTime(s.startDate) ?? "") >= nowIso.slice(0, 10)).length;

  const patch: Partial<Camp> = {
    name: clean(d.name),
    zuca_id: d.id,
    zuca_slug: clean(d.slug) || null,
    zuca_rating: Number(d.rating) || 0,
    zuca_reviews: Number(d.commentCount) || 0,
    zuca_shifts_open: openUpcoming,
    zuca_synced_at: nowIso,
    photos_count: d.images?.length ?? 0,
  };
  const set = <K extends keyof Camp>(k: K, v: Camp[K] | null | undefined | "") => {
    if (v !== null && v !== undefined && v !== "") patch[k] = v as Camp[K];
  };
  set("aimag", clean(d.city));
  set("soum", clean(d.district));
  set("address", clean(d.address));
  set("phone", phones.join(", "));
  set("email", clean(d.email));
  set("website", clean(d.webSite));
  set("facebook", clean(d.facebook));
  set("age_min", ageMin);
  set("age_max", ageMax);
  set("lat", coords?.lat);
  set("lng", coords?.lng);
  set("capacity", caps.length ? Math.max(...caps) : null);
  set("price_from", prices.length ? Math.min(...prices) : null);
  set("description", tiptapText(d.about).slice(0, 4000));
  return patch;
}

export function mapShifts(d: ZCamp, campId: string, now = new Date()) {
  return (d.shifts ?? [])
    .filter((s) => Number.isFinite(Number(s.id)))
    .map((s) => ({
      id: Number(s.id),
      camp_id: campId,
      name: clean(s.name),
      starts_at: zTime(s.startDate),
      ends_at: zTime(s.endDate),
      capacity: Math.max(0, Number(s.capacity) || 0),
      booked: Math.max(0, Number(s.booked) || 0),
      price: Number(s.price) > 0 ? Math.round(Number(s.price)) : null,
      is_open: s.isOpen !== false,
      is_day: !!s.isDayShift,
      synced_at: now.toISOString(),
    }));
}

/** Нэрийг харьцуулах түлхүүр — «"Урандөш" хүүхдийн зуслан» ≈ «Урандөш зуслан» */
export function nameKey(name: string) {
  return name
    .toLowerCase()
    .replace(/["'«»“”]/g, "")
    .replace(/(хүүхдийн|хүүхдий|олон улсын|зуслан|camp|аймгийн|дүүргийн|харьяа)/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}
