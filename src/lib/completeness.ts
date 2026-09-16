import type { Camp } from "./types";

export interface FieldCheck {
  key: string;
  label: string;
  weight: number;
  ok: (c: Camp) => boolean;
}

const filled = (v: unknown) => v !== null && v !== undefined && String(v).trim() !== "";

/** ZUCA дээр зуслан бүрэн харагдахад шаардлагатай мэдээлэл */
export const FIELD_CHECKS: FieldCheck[] = [
  { key: "phone", label: "Утас", weight: 2, ok: (c) => filled(c.phone) },
  { key: "contact_person", label: "Холбоо барих хүн", weight: 1, ok: (c) => filled(c.contact_person) },
  { key: "email", label: "Имэйл", weight: 1, ok: (c) => filled(c.email) },
  { key: "aimag", label: "Аймаг", weight: 1, ok: (c) => filled(c.aimag) },
  { key: "address", label: "Хаяг", weight: 1, ok: (c) => filled(c.address) },
  { key: "coords", label: "Газрын зураг (координат)", weight: 1, ok: (c) => c.lat != null && c.lng != null },
  { key: "age", label: "Насны ангилал", weight: 2, ok: (c) => c.age_min != null && c.age_max != null },
  { key: "capacity", label: "Багтаамж", weight: 1, ok: (c) => c.capacity != null && c.capacity > 0 },
  { key: "price", label: "Үнэ", weight: 2, ok: (c) => c.price_from != null && c.price_from > 0 },
  { key: "description", label: "Тайлбар", weight: 2, ok: (c) => (c.description ?? "").trim().length >= 40 },
  { key: "photos", label: "Зураг (3+)", weight: 2, ok: (c) => c.photos_count >= 3 },
  { key: "contract", label: "Гэрээ", weight: 1, ok: (c) => c.has_contract },
];

const TOTAL = FIELD_CHECKS.reduce((s, f) => s + f.weight, 0);

export function completeness(c: Camp) {
  const missing = FIELD_CHECKS.filter((f) => !f.ok(c));
  const lost = missing.reduce((s, f) => s + f.weight, 0);
  const score = Math.round(((TOTAL - lost) / TOTAL) * 100);
  return { score, missing, complete: missing.length === 0 };
}

export function scoreTone(score: number) {
  if (score >= 90) return { text: "text-emerald-700", bar: "bg-emerald-500", label: "Бүрэн" };
  if (score >= 60) return { text: "text-amber-700", bar: "bg-amber-500", label: "Дутуу" };
  return { text: "text-red-700", bar: "bg-red-500", label: "Их дутуу" };
}
