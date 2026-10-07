"use client";

import { Check, ChevronLeft, ChevronRight, Copy, FolderOpen, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MoneyInput } from "@/components/finance/entries-tab";
import { Avatar, Button, Card, Modal } from "@/components/ui";
import { useStore } from "@/lib/data/store";
import { payrollCost, payrollGross, payrollNet, sum } from "@/lib/finance";
import { addMonths, currentMonthKey, monthLabel } from "@/lib/plan";
import type { Payroll, Profile } from "@/lib/types";
import { cn, fmtMNT, todayISO } from "@/lib/utils";

const MONEY_FIELDS = ["base_salary", "bonus", "social_insurance", "income_tax", "other_deductions", "employer_insurance"] as const;

export function PayrollTab() {
  const { payroll, profiles, deptById, files, savePayroll, toast } = useStore();
  const [month, setMonth] = useState(currentMonthKey());
  const [modal, setModal] = useState<{ profile: Profile; row?: Payroll } | null>(null);
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => payroll.filter((p) => p.month === month), [payroll, month]);
  const prev = useMemo(() => payroll.filter((p) => p.month === addMonths(month, -1)), [payroll, month]);
  const byProfile = new Map(rows.map((r) => [r.profile_id, r]));
  // Идэвхтэй ажилтнууд + тэр сард цалинтай гарсан ажилтан
  const people = profiles.filter((p) => p.active || byProfile.has(p.id)).sort((a, b) => a.full_name.localeCompare(b.full_name, "mn"));
  const copyable = prev.filter((p) => !byProfile.has(p.profile_id) && profiles.some((x) => x.id === p.profile_id && x.active));
  const unpaid = rows.filter((r) => !r.paid);
  const hrFiles = useMemo(() => {
    const m = new Map<string, number>();
    files.forEach((f) => f.profile_id && m.set(f.profile_id, (m.get(f.profile_id) ?? 0) + 1));
    return m;
  }, [files]);

  async function copyPrev() {
    setBusy(true);
    for (const p of copyable) {
      const { id: _i, created_at: _c, updated_at: _u, created_by: _b, ...rest } = p;
      await savePayroll({ ...rest, month, paid: false, paid_at: null });
    }
    setBusy(false);
    toast(`${copyable.length} ажилтны цалинг ${monthLabel(addMonths(month, -1))}-аас хууллаа`);
  }

  async function payAll() {
    setBusy(true);
    for (const r of unpaid) await savePayroll({ profile_id: r.profile_id, month, paid: true, paid_at: todayISO() });
    setBusy(false);
    toast(`${unpaid.length} ажилтанд олгосон гэж тэмдэглэлээ`);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="glass inline-flex items-center rounded-full p-1">
          <button onClick={() => setMonth(addMonths(month, -1))} className="grid size-8 cursor-pointer place-items-center rounded-full text-zinc-500 hover:bg-zinc-100" aria-label="Өмнөх сар">
            <ChevronLeft size={16} />
          </button>
          <span className="min-w-36 px-1 text-center text-sm font-medium">{monthLabel(month, true)}</span>
          <button onClick={() => setMonth(addMonths(month, 1))} className="grid size-8 cursor-pointer place-items-center rounded-full text-zinc-500 hover:bg-zinc-100" aria-label="Дараах сар">
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {copyable.length > 0 && (
            <Button onClick={() => void copyPrev()} disabled={busy}>
              <Copy size={14} /> Өмнөх сараас хуулах ({copyable.length})
            </Button>
          )}
          {unpaid.length > 0 && (
            <Button variant="primary" onClick={() => void payAll()} disabled={busy}>
              <Check size={14} /> Бүгдийг олгосон ({unpaid.length})
            </Button>
          )}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">
                <th className="px-5 py-2.5">Ажилтан</th>
                <th className="px-2 py-2.5 text-right">Үндсэн</th>
                <th className="px-2 py-2.5 text-right">Нэмэгдэл</th>
                <th className="px-2 py-2.5 text-right">НДШ</th>
                <th className="px-2 py-2.5 text-right">ХХОАТ</th>
                <th className="px-2 py-2.5 text-right">Бусад суутгал</th>
                <th className="px-2 py-2.5 text-right">Гарт олгох</th>
                <th className="px-2 py-2.5 text-right">Байг. НДШ</th>
                <th className="px-5 py-2.5 text-right">Олгосон</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {people.map((p) => {
                const r = byProfile.get(p.id);
                const dept = p.department_id ? deptById.get(p.department_id) : null;
                const nFiles = hrFiles.get(p.id) ?? 0;
                return (
                  <tr key={p.id} onClick={() => setModal({ profile: p, row: r })} className="cursor-pointer transition hover:bg-zinc-50">
                    <td className="px-5 py-2.5">
                      <span className="flex items-center gap-2">
                        <Avatar profile={p} size={26} />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{p.full_name}</span>
                          <span className="block truncate text-[11px] text-zinc-500">
                            {p.job_title || "—"}
                            {dept && ` · ${dept.name}`}
                          </span>
                        </span>
                        <Link
                          href={`/finance?tab=files&who=${p.id}`}
                          onClick={(e) => e.stopPropagation()}
                          title="Хувийн хэрэг, гэрээ"
                          className="ml-auto inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800"
                        >
                          <FolderOpen size={12} />
                          {nFiles || ""}
                        </Link>
                      </span>
                    </td>
                    {r ? (
                      <>
                        <Money v={r.base_salary} />
                        <Money v={r.bonus} />
                        <Money v={r.social_insurance} muted />
                        <Money v={r.income_tax} muted />
                        <Money v={r.other_deductions} muted />
                        <Money v={payrollNet(r)} strong />
                        <Money v={r.employer_insurance} muted />
                        <td className="px-5 py-2.5 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              void savePayroll({ profile_id: p.id, month, paid: !r.paid, paid_at: r.paid ? null : todayISO() });
                            }}
                            className={cn(
                              "inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              r.paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-800 hover:bg-amber-100",
                            )}
                          >
                            {r.paid ? <>✓ {r.paid_at?.slice(5) ?? ""}</> : "Олгоогүй"}
                          </button>
                        </td>
                      </>
                    ) : (
                      <td colSpan={8} className="px-5 py-2.5 text-right text-xs text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                          <Plus size={12} /> Цалин бодох
                        </span>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="border-t border-zinc-200 font-semibold">
                  <td className="px-5 py-2.5">Нийт · {rows.length} хүн</td>
                  <Money v={sum(rows, (r) => r.base_salary)} />
                  <Money v={sum(rows, (r) => r.bonus)} />
                  <Money v={sum(rows, (r) => r.social_insurance)} />
                  <Money v={sum(rows, (r) => r.income_tax)} />
                  <Money v={sum(rows, (r) => r.other_deductions)} />
                  <Money v={sum(rows, payrollNet)} strong />
                  <Money v={sum(rows, (r) => r.employer_insurance)} />
                  <td className="px-5 py-2.5 text-right text-xs font-normal text-zinc-500">
                    Зардал <b className="tabular text-zinc-900">{fmtMNT(sum(rows, payrollCost))}</b>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-zinc-400">
        Гарт олгох = үндсэн + нэмэгдэл − НДШ − ХХОАТ − бусад суутгал. Байгууллагад туссан зардал = үндсэн + нэмэгдэл + байгууллагын НДШ. Суутгалын дүнг
        нягтлан бодогчийн тооцоогоор оруулна.
      </p>

      {modal && <PayrollModal profile={modal.profile} row={modal.row} month={month} lastRow={prev.find((x) => x.profile_id === modal.profile.id)} onClose={() => setModal(null)} />}
    </>
  );
}

function Money({ v, strong, muted }: { v: number; strong?: boolean; muted?: boolean }) {
  return (
    <td className={cn("tabular px-2 py-2.5 text-right whitespace-nowrap", strong && "font-semibold", muted && "text-zinc-500", !v && "text-zinc-300")}>
      {v ? new Intl.NumberFormat("mn-MN").format(v) : "—"}
    </td>
  );
}

function PayrollModal({ profile, row, month, lastRow, onClose }: { profile: Profile; row?: Payroll; month: string; lastRow?: Payroll; onClose: () => void }) {
  const { savePayroll, deletePayroll } = useStore();
  const src = row ?? lastRow;
  const [f, setF] = useState(() => ({
    base_salary: src?.base_salary ?? 0,
    bonus: row?.bonus ?? 0,
    social_insurance: src?.social_insurance ?? 0,
    income_tax: src?.income_tax ?? 0,
    other_deductions: row?.other_deductions ?? 0,
    employer_insurance: src?.employer_insurance ?? 0,
    paid: row?.paid ?? false,
    paid_at: row?.paid_at ?? "",
    note: row?.note ?? "",
  }));
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const preview = { ...f, paid_at: null } as unknown as Payroll;

  async function save() {
    await savePayroll({
      profile_id: profile.id,
      month,
      ...f,
      paid_at: f.paid ? f.paid_at || todayISO() : null,
      note: f.note.trim() || null,
    });
    onClose();
  }

  const labels: Record<(typeof MONEY_FIELDS)[number], string> = {
    base_salary: "Үндсэн цалин",
    bonus: "Нэмэгдэл, урамшуулал",
    social_insurance: "НДШ (ажилтнаас)",
    income_tax: "ХХОАТ",
    other_deductions: "Бусад суутгал (урьдчилгаа г.м.)",
    employer_insurance: "НДШ (байгууллагаас)",
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Avatar profile={profile} size={24} /> {profile.full_name} · {monthLabel(month, true)}
        </span>
      }
      footer={
        <>
          {row && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                void deletePayroll(row.id);
                onClose();
              }}
            >
              <Trash2 size={15} /> Устгах
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Болих
          </Button>
          <Button variant="primary" onClick={() => void save()}>
            Хадгалах
          </Button>
        </>
      }
    >
      {!row && lastRow && <p className="mb-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">Өмнөх сарын дүнгээр бөглөсөн — шалгаад хадгална уу.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {MONEY_FIELDS.map((k) => (
          <div key={k}>
            <label className="label">{labels[k]}</label>
            <MoneyInput value={f[k]} onChange={(v) => set(k, v)} />
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-zinc-100 p-3 text-center">
        <div>
          <div className="text-[11px] text-zinc-500">Нийт цалин</div>
          <div className="tabular font-semibold">{fmtMNT(payrollGross(preview))}</div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500">Гарт олгох</div>
          <div className={cn("tabular font-semibold", payrollNet(preview) < 0 && "text-red-600")}>{fmtMNT(payrollNet(preview))}</div>
        </div>
        <div>
          <div className="text-[11px] text-zinc-500">Байгууллагад туссан</div>
          <div className="tabular font-semibold">{fmtMNT(payrollCost(preview))}</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={f.paid} onChange={(e) => set("paid", e.target.checked)} className="size-4" />
          Олгосон
        </label>
        {f.paid && <input type="date" className="field w-auto" value={f.paid_at || todayISO()} onChange={(e) => set("paid_at", e.target.value)} />}
      </div>
      <input className="field mt-3" placeholder="Тэмдэглэл (заавал биш)" value={f.note} onChange={(e) => set("note", e.target.value)} />
    </Modal>
  );
}
