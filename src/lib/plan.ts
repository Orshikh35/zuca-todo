import type { Task } from "./types";
import { isOverdue } from "./utils";

/** "YYYY-MM" */
export type MonthKey = string;

export const MONTH_NAMES = ["1-р сар", "2-р сар", "3-р сар", "4-р сар", "5-р сар", "6-р сар", "7-р сар", "8-р сар", "9-р сар", "10-р сар", "11-р сар", "12-р сар"];

export const QUARTERS = [
  { id: 1, label: "I улирал", months: [1, 2, 3], hint: "1–3 сар" },
  { id: 2, label: "II улирал", months: [4, 5, 6], hint: "4–6 сар" },
  { id: 3, label: "III улирал", months: [7, 8, 9], hint: "7–9 сар · зуны ээлж" },
  { id: 4, label: "IV улирал", months: [10, 11, 12], hint: "10–12 сар · намрын хөтөлбөр" },
] as const;

export const monthKey = (year: number, month: number): MonthKey => `${year}-${String(month).padStart(2, "0")}`;

export function currentMonthKey(d = new Date()): MonthKey {
  return monthKey(d.getFullYear(), d.getMonth() + 1);
}

export function addMonths(key: MonthKey, n: number): MonthKey {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d.getFullYear(), d.getMonth() + 1);
}

export function parseMonth(key: MonthKey) {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}

export function monthLabel(key: MonthKey, withYear = false) {
  const { year, month } = parseMonth(key);
  return withYear ? `${year} оны ${MONTH_NAMES[month - 1]}` : MONTH_NAMES[month - 1];
}

export const quarterOf = (month: number) => Math.ceil(month / 3);

export interface PlanStats {
  planned: number;
  done: number;
  inProgress: number;
  overdue: number;
  pct: number | null;
}

export function planStats(tasks: Task[]): PlanStats {
  const done = tasks.filter((t) => t.status === "done").length;
  return {
    planned: tasks.length,
    done,
    inProgress: tasks.filter((t) => t.status === "in_progress" || t.status === "review").length,
    overdue: tasks.filter((t) => isOverdue(t.due_date, t.status === "done")).length,
    pct: tasks.length ? Math.round((done / tasks.length) * 100) : null,
  };
}

/** Тухайн саруудад төлөвлөгдсөн ажлууд */
export function tasksInMonths(tasks: Task[], keys: MonthKey[]) {
  const set = new Set(keys);
  return tasks.filter((t) => t.planned_month && set.has(t.planned_month));
}

export function pctTone(pct: number | null) {
  if (pct == null) return { text: "text-zinc-400", bar: "bg-zinc-300" };
  if (pct >= 80) return { text: "text-emerald-700", bar: "bg-emerald-500" };
  if (pct >= 50) return { text: "text-amber-700", bar: "bg-amber-500" };
  return { text: "text-red-700", bar: "bg-red-500" };
}
