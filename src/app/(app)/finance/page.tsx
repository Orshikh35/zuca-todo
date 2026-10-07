"use client";

import { BarChart3, ChevronLeft, ChevronRight, Download, FolderOpen, Lock, Printer, Receipt, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Hero, HeroChip, Tile } from "@/components/bento";
import { BarList, ColumnChart, SERIES } from "@/components/charts";
import { EntriesTab } from "@/components/finance/entries-tab";
import { FilesTab } from "@/components/finance/files-tab";
import { PayrollTab } from "@/components/finance/payroll-tab";
import { Avatar, Button, Card, Empty, PageHeader, Segmented } from "@/components/ui";
import { download } from "@/lib/csv";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYROLL_CATEGORY, financeCategoryLabel } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import {
  entriesIn,
  fmtCompact,
  payrollCost,
  payrollGross,
  payrollIn,
  payrollNet,
  periodLabel,
  periodMonths,
  shiftPeriod,
  sum,
  type PeriodKind,
} from "@/lib/finance";
import { isAdmin } from "@/lib/permissions";
import { addMonths, currentMonthKey, monthLabel, parseMonth } from "@/lib/plan";
import { cn, fmtMNT, todayISO } from "@/lib/utils";

type Tab = "report" | "entries" | "payroll" | "files";

export default function FinancePage() {
  return (
    <Suspense>
      <FinanceInner />
    </Suspense>
  );
}

function FinanceInner() {
  const { me } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "report";
  const [kind, setKind] = useState<PeriodKind>("month");
  const [anchor, setAnchor] = useState(currentMonthKey());

  // Ажилтанд огт харагдахгүй (Supabase дээр RLS давхар хамгаална)
  if (!isAdmin(me)) {
    return (
      <Card className="mt-6">
        <Empty icon={<Lock size={30} />} title="Энэ хэсэг зөвхөн админд нээлттэй" hint="Санхүү, цалингийн мэдээлэл хаалттай" />
      </Card>
    );
  }

  const period = { kind, anchor, months: periodMonths(kind, anchor) };

  return (
    <>
      <PageHeader
        title="Санхүү"
        subtitle="Зардал, орлого, цалин, баримт бичиг — зөвхөн админд харагдана"
        actions={
          tab !== "files" && tab !== "payroll" ? (
            <PeriodPicker kind={kind} anchor={anchor} onKind={setKind} onAnchor={setAnchor} />
          ) : undefined
        }
      />

      <div className="mb-5 print:hidden">
        <Segmented
          value={tab}
          onChange={(t) => router.replace(`/finance?tab=${t}`)}
          options={[
            { id: "report", label: "Тайлан", icon: <BarChart3 size={14} /> },
            { id: "entries", label: "Зардал, орлого", icon: <Receipt size={14} /> },
            { id: "payroll", label: "Цалин", icon: <Wallet size={14} /> },
            { id: "files", label: "Файлууд", icon: <FolderOpen size={14} /> },
          ]}
        />
      </div>

      {tab === "report" && <Overview period={period} />}
      {tab === "entries" && <EntriesTab months={period.months} label={periodLabel(kind, anchor)} />}
      {tab === "payroll" && <PayrollTab />}
      {tab === "files" && <FilesTab />}
    </>
  );
}

function PeriodPicker({
  kind,
  anchor,
  onKind,
  onAnchor,
}: {
  kind: PeriodKind;
  anchor: string;
  onKind: (k: PeriodKind) => void;
  onAnchor: (a: string) => void;
}) {
  return (
    <>
      <Segmented
        value={kind}
        onChange={onKind}
        options={[
          { id: "month", label: "Сар" },
          { id: "quarter", label: "Улирал" },
          { id: "year", label: "Жил" },
        ]}
      />
      <div className="glass inline-flex items-center rounded-full p-1">
        <button onClick={() => onAnchor(shiftPeriod(kind, anchor, -1))} className="grid size-8 cursor-pointer place-items-center rounded-full text-zinc-500 hover:bg-zinc-100" aria-label="Өмнөх">
          <ChevronLeft size={16} />
        </button>
        <span className="min-w-36 px-1 text-center text-sm font-medium">{periodLabel(kind, anchor)}</span>
        <button onClick={() => onAnchor(shiftPeriod(kind, anchor, 1))} className="grid size-8 cursor-pointer place-items-center rounded-full text-zinc-500 hover:bg-zinc-100" aria-label="Дараах">
          <ChevronRight size={16} />
        </button>
      </div>
    </>
  );
}

/* ─────────── Тайлан ─────────── */
function Overview({ period }: { period: { kind: PeriodKind; anchor: string; months: string[] } }) {
  const { financeEntries, payroll, profiles, profileById, departments, deptById, projectById } = useStore();
  const { kind, anchor, months } = period;

  const r = useMemo(() => {
    const E = entriesIn(financeEntries, months);
    const P = payrollIn(payroll, months);
    const exp = E.filter((e) => e.kind === "expense");
    const inc = E.filter((e) => e.kind === "income");
    const salary = sum(P, payrollCost);
    const other = sum(exp, (e) => e.amount);
    const income = sum(inc, (e) => e.amount);

    const prevMonths = periodMonths(kind, shiftPeriod(kind, anchor, -1));
    const prevExp =
      sum(entriesIn(financeEntries, prevMonths).filter((e) => e.kind === "expense"), (e) => e.amount) + sum(payrollIn(payroll, prevMonths), payrollCost);

    const byCategory = [
      { label: PAYROLL_CATEGORY.label, value: salary },
      ...EXPENSE_CATEGORIES.map((c) => ({ label: c.label, value: sum(exp.filter((e) => e.category === c.id), (e) => e.amount) })),
    ]
      .filter((x) => x.value)
      .sort((a, b) => b.value - a.value);
    const incomeByCategory = INCOME_CATEGORIES.map((c) => ({ label: c.label, value: sum(inc.filter((e) => e.category === c.id), (e) => e.amount) }))
      .filter((x) => x.value)
      .sort((a, b) => b.value - a.value);

    // Хэлтэс: зардлын хэлтэс + цалинг ажилтны хэлтсээр
    const deptTotals = new Map<string, number>();
    const addDept = (id: string | null | undefined, v: number) => deptTotals.set(id ?? "", (deptTotals.get(id ?? "") ?? 0) + v);
    exp.forEach((e) => addDept(e.department_id, e.amount));
    P.forEach((p) => addDept(profileById.get(p.profile_id)?.department_id, payrollCost(p)));
    const byDept = [...deptTotals]
      .map(([id, value]) => ({ label: id ? deptById.get(id)?.name ?? "—" : "Хэлтэсгүй", value }))
      .sort((a, b) => b.value - a.value);

    const projTotals = new Map<string, number>();
    exp.filter((e) => e.project_id).forEach((e) => projTotals.set(e.project_id!, (projTotals.get(e.project_id!) ?? 0) + e.amount));
    const byProject = [...projTotals].map(([id, value]) => ({ id, label: projectById.get(id)?.name ?? "—", value })).sort((a, b) => b.value - a.value);

    // Хүн тус бүрийн цалин
    const people = Array.from(new Set(P.map((p) => p.profile_id)))
      .map((id) => {
        const rows = P.filter((p) => p.profile_id === id);
        return {
          profile: profileById.get(id),
          months: rows.length,
          gross: sum(rows, payrollGross),
          net: sum(rows, payrollNet),
          cost: sum(rows, payrollCost),
          unpaid: rows.filter((p) => !p.paid).length,
        };
      })
      .sort((a, b) => b.cost - a.cost);

    return { E, P, salary, other, income, prevExp, byCategory, incomeByCategory, byDept, byProject, people };
  }, [financeEntries, payroll, months, kind, anchor, profileById, deptById, projectById]);

  // Сүүлийн 12 сар — сонгосон үеийн сүүлийн сараар төгсөнө
  const trend = useMemo(() => {
    const last = months[months.length - 1];
    return Array.from({ length: 12 }, (_, i) => addMonths(last, i - 11)).map((m) => {
      const E = entriesIn(financeEntries, [m]);
      const inc = sum(E.filter((e) => e.kind === "income"), (e) => e.amount);
      const exp = sum(E.filter((e) => e.kind === "expense"), (e) => e.amount) + sum(payrollIn(payroll, [m]), payrollCost);
      const { month } = parseMonth(m);
      return { label: `${month}`, full: monthLabel(m, true), values: [inc, exp] };
    });
  }, [financeEntries, payroll, months]);

  const totalExp = r.salary + r.other;
  const net = r.income - totalExp;
  const change = r.prevExp ? Math.round(((totalExp - r.prevExp) / r.prevExp) * 100) : null;
  const unpaid = r.P.filter((p) => !p.paid);
  const activeCount = profiles.filter((p) => p.active).length;

  function exportCsv() {
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [["Төрөл", "Огноо / Сар", "Ангилал", "Гарчиг", "Дүн", "Хэнд / хэнээс", "Хэлтэс", "Төсөл", "Ажилтан"].join(",")];
    r.E.forEach((e) =>
      lines.push(
        [
          e.kind === "income" ? "Орлого" : "Зардал",
          e.date,
          financeCategoryLabel(e.kind, e.category),
          e.title,
          e.amount,
          e.vendor,
          e.department_id ? deptById.get(e.department_id)?.name : "",
          e.project_id ? projectById.get(e.project_id)?.name : "",
          e.profile_id ? profileById.get(e.profile_id)?.full_name : "",
        ]
          .map(esc)
          .join(","),
      ),
    );
    r.P.forEach((p) =>
      lines.push(
        ["Цалин", p.month, PAYROLL_CATEGORY.label, `Цалин — ${profileById.get(p.profile_id)?.full_name ?? ""}`, payrollCost(p), "", "", "", profileById.get(p.profile_id)?.full_name]
          .map(esc)
          .join(","),
      ),
    );
    download(`zuca-sanhuu-${anchor}-${kind}-${todayISO()}.csv`, "﻿" + lines.join("\n"));
  }

  const money = (v: number) => fmtMNT(v);

  return (
    <>
      <div className="mb-4 flex flex-wrap justify-end gap-2 print:hidden">
        <Button size="sm" onClick={exportCsv}>
          <Download size={14} /> CSV
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer size={14} /> Хэвлэх
        </Button>
      </div>

      <div className="flex flex-wrap gap-4">
        <Hero
          tone="peach"
          className="min-w-0 flex-[2.2_1_340px]"
          title={`Нийт зардал · ${periodLabel(kind, anchor)}`}
          value={fmtCompact(totalExp)}
          unit="₮"
          chips={
            <>
              {change != null && (
                <HeroChip>
                  {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% өмнөх үеэс
                </HeroChip>
              )}
              <HeroChip>💵 Цалин {fmtCompact(r.salary)}</HeroChip>
              <HeroChip>🧾 Бусад {fmtCompact(r.other)}</HeroChip>
            </>
          }
        />
        <Tile className="flex-[1_1_180px]" tint="sky" title="Орлого" value={fmtCompact(r.income)} caption={money(r.income)} />
        <Tile
          className="flex-[1_1_180px]"
          tint={net >= 0 ? "emerald" : "rose"}
          title={net >= 0 ? "Ашиг" : "Алдагдал"}
          value={fmtCompact(Math.abs(net))}
          caption="Орлого − зардал"
          chip={r.income || totalExp ? (net >= 0 ? { text: "Ашигтай", tone: "good" } : { text: "Алдагдалтай", tone: "bad" }) : null}
        />
        <Tile
          className="flex-[1_1_180px]"
          tint="amber"
          title="Олгоогүй цалин"
          value={unpaid.length}
          caption={unpaid.length ? `${fmtCompact(sum(unpaid, payrollNet))}₮ гарт олгох` : "Бүгд олгогдсон"}
          href="/finance?tab=payroll"
          chip={unpaid.length ? { text: "Олгох", tone: "warn" } : null}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Panel title="Орлого ба зардал" sub="Сүүлийн 12 сар · зардалд цалин орсон">
          <ColumnChart
            buckets={trend}
            series={[
              { name: "Орлого", color: SERIES[0] },
              { name: "Зардал", color: SERIES[1] },
            ]}
            format={fmtCompact}
            axisWidth={52}
          />
        </Panel>
        <Panel title="Зардал ангиллаар" sub={periodLabel(kind, anchor)}>
          <BarList
            rows={r.byCategory.map((x) => ({ ...x, color: SERIES[1], extra: totalExp ? `${Math.round((x.value / totalExp) * 100)}%` : undefined }))}
            format={money}
            empty="Энэ үед зардал бүртгээгүй"
          />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Хэлтэс тус бүр" sub="Зардал + ажилтнуудын цалин">
          <BarList rows={r.byDept.map((x) => ({ ...x, color: SERIES[1] }))} format={money} empty="Өгөгдөл алга" />
        </Panel>
        <Panel title="Төслийн зардал" sub="Төсөлтэй холбосон зардал">
          {r.byProject.length ? (
            <ul className="space-y-2">
              {r.byProject.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-3 text-[13px]">
                  <Link href={`/projects/${p.id}`} className="truncate text-zinc-700 hover:underline">
                    {p.label}
                  </Link>
                  <span className="tabular shrink-0 font-semibold">{money(p.value)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-sm text-zinc-400">Төсөлтэй холбосон зардал алга</p>
          )}
        </Panel>
        <Panel title="Орлого ангиллаар" sub={periodLabel(kind, anchor)}>
          <BarList rows={r.incomeByCategory.map((x) => ({ ...x, color: SERIES[0] }))} format={money} empty="Энэ үед орлого бүртгээгүй" />
        </Panel>
      </div>

      {/* Хүний нөөц, цалин */}
      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
          <div>
            <h2 className="text-lg font-medium tracking-tight">Хүний нөөц, цалин</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              Идэвхтэй {activeCount} ажилтан · цалин бодогдсон {r.people.length} · дундаж нийт цалин{" "}
              {r.P.length ? money(Math.round(sum(r.P, payrollGross) / r.P.length)) : "—"} / сар
            </p>
          </div>
          <Link href="/finance?tab=payroll" className="text-sm font-medium text-brand-600 hover:underline print:hidden">
            Цалин засах →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-y border-zinc-100 text-left text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                <th className="px-5 py-2">Ажилтан</th>
                <th className="px-3 py-2">Хэлтэс</th>
                <th className="px-3 py-2 text-right">Нийт цалин</th>
                <th className="px-3 py-2 text-right">Гарт олгох</th>
                <th className="px-3 py-2 text-right">Байгууллагад туссан</th>
                <th className="px-5 py-2 text-right">Төлөв</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {r.people.map((x) => (
                <tr key={x.profile?.id ?? "?"}>
                  <td className="px-5 py-2.5">
                    <span className="flex items-center gap-2">
                      <Avatar profile={x.profile} size={24} />
                      {x.profile?.full_name ?? "—"}
                      {x.months > 1 && <span className="text-xs text-zinc-400">· {x.months} сар</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-zinc-500">{x.profile?.department_id ? deptById.get(x.profile.department_id)?.name : "—"}</td>
                  <td className="tabular px-3 py-2.5 text-right">{money(x.gross)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{money(x.net)}</td>
                  <td className="tabular px-3 py-2.5 text-right font-semibold">{money(x.cost)}</td>
                  <td className="px-5 py-2.5 text-right">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", x.unpaid ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700")}>
                      {x.unpaid ? `${x.unpaid} олгоогүй` : "✓ Олгосон"}
                    </span>
                  </td>
                </tr>
              ))}
              {!r.people.length && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-zinc-400">
                    Энэ үед цалин бодоогүй байна
                  </td>
                </tr>
              )}
            </tbody>
            {r.people.length > 0 && (
              <tfoot>
                <tr className="border-t border-zinc-200 font-semibold">
                  <td className="px-5 py-2.5" colSpan={2}>
                    Нийт
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{money(sum(r.people, (x) => x.gross))}</td>
                  <td className="tabular px-3 py-2.5 text-right">{money(sum(r.people, (x) => x.net))}</td>
                  <td className="tabular px-3 py-2.5 text-right">{money(r.salary)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {departments.length === 0 && <p className="mt-3 text-xs text-zinc-400">Хэлтэс үүсгэвэл хэлтэс тус бүрийн зардал гарна.</p>}
    </>
  );
}

function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <h2 className="text-lg font-medium tracking-tight">{title}</h2>
      {sub && <p className="mt-0.5 mb-4 text-xs text-zinc-500">{sub}</p>}
      {children}
    </Card>
  );
}
