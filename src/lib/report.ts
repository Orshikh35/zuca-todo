import type { Task } from "./types";
import { addDays, toISODate } from "./utils";

const MONTHS = ["1-р", "2-р", "3-р", "4-р", "5-р", "6-р", "7-р", "8-р", "9-р", "10-р", "11-р", "12-р"];
const WEEKDAYS = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Хугацааны хүрээг өдөр эсвэл 7 хоногоор хувааж, үүссэн/дууссан ажлыг тоолно */
export function taskBuckets(tasks: Task[], days: number) {
  const today = startOfDay(new Date());
  const step = days <= 14 ? 1 : 7;
  const count = Math.ceil(days / step);
  const buckets = Array.from({ length: count }, (_, i) => {
    const end = addDays(today, -(count - 1 - i) * step + 1); // exclusive
    const start = addDays(end, -step);
    const label =
      step === 1
        ? WEEKDAYS[start.getDay()] + " " + start.getDate()
        : `${start.getMonth() + 1}/${start.getDate()}`;
    const full =
      step === 1
        ? `${MONTHS[start.getMonth()]} сарын ${start.getDate()}`
        : `${MONTHS[start.getMonth()]} сарын ${start.getDate()} – ${MONTHS[addDays(end, -1).getMonth()]} сарын ${addDays(end, -1).getDate()}`;
    return { start, end, label, full, values: [0, 0] };
  });

  const place = (iso: string | null, idx: 0 | 1) => {
    if (!iso) return;
    const t = new Date(iso).getTime();
    const b = buckets.find((x) => t >= x.start.getTime() && t < x.end.getTime());
    if (b) b.values[idx]++;
  };
  tasks.forEach((t) => {
    place(t.created_at, 0);
    place(t.completed_at, 1);
  });
  return buckets;
}

export function inRange(iso: string | null, from: Date, to: Date = new Date()) {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

export function periodStats(tasks: Task[], days: number) {
  const now = new Date();
  const from = addDays(startOfDay(now), -days + 1);
  const prevFrom = addDays(from, -days);

  const done = tasks.filter((t) => inRange(t.completed_at, from, now));
  const prevDone = tasks.filter((t) => inRange(t.completed_at, prevFrom, from)).length;
  const created = tasks.filter((t) => inRange(t.created_at, from, now)).length;

  const cycle = done.map((t) => (new Date(t.completed_at!).getTime() - new Date(t.created_at).getTime()) / 86_400_000);
  const avgCycle = cycle.length ? cycle.reduce((a, b) => a + b, 0) / cycle.length : null;

  const withDue = done.filter((t) => t.due_date);
  const onTime = withDue.filter((t) => toISODate(new Date(t.completed_at!)) <= t.due_date!).length;
  const onTimePct = withDue.length ? Math.round((onTime / withDue.length) * 100) : null;

  return { from, done, doneCount: done.length, prevDone, created, avgCycle, onTimePct };
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Сайн байна уу";
  if (h < 12) return "Өглөөний мэнд";
  if (h < 18) return "Өдрийн мэнд";
  return "Оройн мэнд";
}
