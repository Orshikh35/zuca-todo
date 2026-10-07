import type { FinanceEntry, Payroll } from "./types";
import { addMonths, MONTH_NAMES, parseMonth, quarterOf, type MonthKey } from "./plan";

/** Тайлангийн үе: сар · улирал · жил. anchor — тухайн үеийн аль нэг сар */
export type PeriodKind = "month" | "quarter" | "year";

export function periodMonths(kind: PeriodKind, anchor: MonthKey): MonthKey[] {
  const { year, month } = parseMonth(anchor);
  if (kind === "month") return [anchor];
  const first = kind === "year" ? 1 : (quarterOf(month) - 1) * 3 + 1;
  const n = kind === "year" ? 12 : 3;
  return Array.from({ length: n }, (_, i) => `${year}-${String(first + i).padStart(2, "0")}`);
}

export function shiftPeriod(kind: PeriodKind, anchor: MonthKey, n: number) {
  return addMonths(anchor, n * (kind === "month" ? 1 : kind === "quarter" ? 3 : 12));
}

export function periodLabel(kind: PeriodKind, anchor: MonthKey) {
  const { year, month } = parseMonth(anchor);
  if (kind === "year") return `${year} он`;
  if (kind === "quarter") return `${year} оны ${["I", "II", "III", "IV"][quarterOf(month) - 1]} улирал`;
  return `${year} оны ${MONTH_NAMES[month - 1]}`;
}

/** Нийт цалин (үндсэн + нэмэгдэл) */
export const payrollGross = (p: Payroll) => p.base_salary + p.bonus;
/** Гарт олгох */
export const payrollNet = (p: Payroll) => payrollGross(p) - p.social_insurance - p.income_tax - p.other_deductions;
/** Байгууллагад туссан зардал = нийт цалин + байгууллагын НДШ */
export const payrollCost = (p: Payroll) => payrollGross(p) + p.employer_insurance;

export const sum = <T,>(rows: T[], f: (r: T) => number) => rows.reduce((a, r) => a + f(r), 0);

export function entriesIn(entries: FinanceEntry[], months: MonthKey[]) {
  const set = new Set(months);
  return entries.filter((e) => set.has(e.date.slice(0, 7)));
}
export function payrollIn(rows: Payroll[], months: MonthKey[]) {
  const set = new Set(months);
  return rows.filter((p) => set.has(p.month));
}

/** Тэнхлэг, жижиг талбарт: 12.5 сая · 850 мян */
export function fmtCompact(n: number) {
  const a = Math.abs(n);
  if (a >= 1e9) return `${+(n / 1e9).toFixed(1)} тэрбум`;
  if (a >= 1e6) return `${+(n / 1e6).toFixed(1)} сая`;
  if (a >= 1e3) return `${Math.round(n / 1e3)} мян`;
  return String(n);
}

export function fmtSize(bytes: number) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
