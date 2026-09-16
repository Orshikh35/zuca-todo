export { clsx as cn } from "clsx";

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export const todayISO = () => toISODate(new Date());

export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Хугацаа: "Өнөөдөр", "Маргааш", "3 хоног хэтэрсэн" гэх мэт */
export function dueLabel(due: string | null) {
  if (!due) return null;
  const today = new Date(todayISO());
  const d = new Date(due);
  const diff = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return { text: "Өнөөдөр", tone: "today" as const, diff };
  if (diff === 1) return { text: "Маргааш", tone: "soon" as const, diff };
  if (diff < 0) return { text: `${-diff} хоног хэтэрсэн`, tone: "overdue" as const, diff };
  if (diff <= 7) return { text: `${diff} хоногийн дараа`, tone: "soon" as const, diff };
  return { text: `${d.getMonth() + 1}-р сарын ${d.getDate()}`, tone: "later" as const, diff };
}

export function isOverdue(due: string | null, done: boolean) {
  if (!due || done) return false;
  return due < todayISO();
}

export const fmtMNT = (n: number | null | undefined) =>
  n == null ? "—" : new Intl.NumberFormat("mn-MN").format(n) + "₮";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Хоёр элементийн дундах position */
export function between(before: number | undefined, after: number | undefined) {
  if (before == null && after == null) return 1000;
  if (before == null) return (after as number) - 1000;
  if (after == null) return before + 1000;
  return (before + after) / 2;
}

export function relativeTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "саяхан";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин өмнө`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} цагийн өмнө`;
  return `${Math.floor(diff / 86400)} хоногийн өмнө`;
}
