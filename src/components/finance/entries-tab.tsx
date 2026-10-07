"use client";

import { FileText, Inbox, Paperclip, Plus, Receipt, Search, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pill, pillField } from "@/components/bento";
import { Avatar, Button, Card, Empty, Modal, Select } from "@/components/ui";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, financeCategoryLabel } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { entriesIn, fmtSize, sum } from "@/lib/finance";
import type { Approval, FinanceEntry, FinanceKind } from "@/lib/types";
import { cn, fmtMNT, todayISO } from "@/lib/utils";

/** Батлагдсан хүсэлтийн төрөл → зардлын ангилал */
const APPROVAL_CATEGORY: Partial<Record<Approval["kind"], string>> = { purchase: "equipment", expense: "other", trip: "trip" };

type Draft = Partial<FinanceEntry> & { kind: FinanceKind };

export function EntriesTab({ months, label }: { months: string[]; label: string }) {
  const { financeEntries, approvals, files, profileById, deptById, projectById } = useStore();
  const [kind, setKind] = useState<"" | FinanceKind>("");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [modal, setModal] = useState<{ entry?: FinanceEntry; draft?: Draft } | null>(null);

  const inPeriod = useMemo(() => entriesIn(financeEntries, months), [financeEntries, months]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return inPeriod
      .filter((e) => (!kind || e.kind === kind) && (!category || e.category === category))
      .filter((e) => !s || `${e.title} ${e.vendor ?? ""} ${e.description ?? ""}`.toLowerCase().includes(s))
      .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  }, [inPeriod, kind, category, q]);

  const attachCount = useMemo(() => {
    const m = new Map<string, number>();
    files.forEach((f) => f.entry_id && m.set(f.entry_id, (m.get(f.entry_id) ?? 0) + 1));
    return m;
  }, [files]);

  // Мөнгөн дүнтэй батлагдсан хүсэлт, зардалд бүртгээгүй
  const pendingApprovals = useMemo(() => {
    const used = new Set(financeEntries.map((e) => e.approval_id).filter(Boolean));
    return approvals.filter((a) => a.status === "approved" && a.amount && APPROVAL_CATEGORY[a.kind] && !used.has(a.id));
  }, [approvals, financeEntries]);

  const expense = sum(rows.filter((e) => e.kind === "expense"), (e) => e.amount);
  const income = sum(rows.filter((e) => e.kind === "income"), (e) => e.amount);
  const categories = kind === "income" ? INCOME_CATEGORIES : kind === "expense" ? EXPENSE_CATEGORIES : [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES.filter((c) => c.id !== "other")];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Pill active={!kind} onClick={() => setKind("")}>
          Бүгд
        </Pill>
        <Pill active={kind === "expense"} onClick={() => setKind("expense")}>
          Зардал
        </Pill>
        <Pill active={kind === "income"} onClick={() => setKind("income")}>
          Орлого
        </Pill>
        <Select className={pillField} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Бүх ангилал</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-zinc-400" />
          <input className={cn(pillField, "w-44 pl-9")} placeholder="Хайх…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="ml-auto flex gap-2">
          <Button onClick={() => setModal({ draft: { kind: "income", category: "commission" } })}>
            <Plus size={15} /> Орлого
          </Button>
          <Button variant="primary" onClick={() => setModal({ draft: { kind: "expense", category: "other" } })}>
            <Plus size={15} /> Зардал
          </Button>
        </div>
      </div>

      {pendingApprovals.length > 0 && (
        <Card className="mb-4 p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <Inbox size={14} className="text-zinc-400" /> Батлагдсан хүсэлт — зардалд бүртгээгүй · {pendingApprovals.length}
          </h3>
          <ul className="divide-y divide-zinc-100">
            {pendingApprovals.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-2 text-sm">
                <Avatar profile={profileById.get(a.requester_id)} size={22} />
                <span className="min-w-0 flex-1 truncate">{a.title}</span>
                <span className="tabular font-semibold">{fmtMNT(a.amount)}</span>
                <Button
                  size="sm"
                  onClick={() =>
                    setModal({
                      draft: {
                        kind: "expense",
                        category: APPROVAL_CATEGORY[a.kind],
                        title: a.title,
                        amount: a.amount ?? 0,
                        description: a.description,
                        department_id: a.department_id,
                        profile_id: a.requester_id,
                        approval_id: a.id,
                        date: (a.decided_at ?? a.created_at).slice(0, 10),
                      },
                    })
                  }
                >
                  Зардалд бүртгэх
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-zinc-100 px-5 py-3 text-sm">
          <span className="font-medium">{label}</span>
          <span className="text-zinc-500">
            Зардал <b className="tabular text-zinc-900">{fmtMNT(expense)}</b>
          </span>
          <span className="text-zinc-500">
            Орлого <b className="tabular text-zinc-900">{fmtMNT(income)}</b>
          </span>
          <span className="ml-auto text-xs text-zinc-400">Цалин «Цалин» табд тусдаа</span>
        </div>
        <div className="divide-y divide-zinc-100">
          {rows.map((e) => {
            const n = attachCount.get(e.id) ?? 0;
            const dept = e.department_id ? deptById.get(e.department_id) : null;
            const proj = e.project_id ? projectById.get(e.project_id) : null;
            return (
              <button key={e.id} onClick={() => setModal({ entry: e })} className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left transition hover:bg-zinc-50">
                <span className="tabular w-20 shrink-0 text-xs text-zinc-500">{e.date}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{e.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-zinc-500">
                    {financeCategoryLabel(e.kind, e.category)}
                    {e.vendor && <span>· {e.vendor}</span>}
                    {dept && <span>· {dept.name}</span>}
                    {proj && (
                      <span className="font-medium" style={{ color: proj.color }}>
                        · {proj.name}
                      </span>
                    )}
                  </span>
                </span>
                {n > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-xs text-zinc-400" title={`${n} хавсралт`}>
                    <Paperclip size={12} /> {n}
                  </span>
                )}
                <span className={cn("tabular w-32 shrink-0 text-right text-sm font-semibold", e.kind === "income" ? "text-emerald-600" : "text-zinc-900")}>
                  {e.kind === "income" ? "+" : "−"}
                  {fmtMNT(e.amount)}
                </span>
              </button>
            );
          })}
          {!rows.length && <Empty icon={<Receipt size={28} />} title="Энэ үед бүртгэл алга" hint="«+ Зардал» эсвэл «+ Орлого» дарж нэмнэ" />}
        </div>
      </Card>

      {modal && <EntryModal entry={modal.entry} draft={modal.draft} onClose={() => setModal(null)} />}
    </>
  );
}

/** Мөнгөн дүнг «2 800 000» хэлбэрээр бичүүлнэ */
export function MoneyInput({ value, onChange, autoFocus }: { value: number; onChange: (v: number) => void; autoFocus?: boolean }) {
  return (
    <div className="relative">
      <input
        autoFocus={autoFocus}
        inputMode="numeric"
        className="field tabular pr-8"
        value={value ? new Intl.NumberFormat("mn-MN").format(value) : ""}
        placeholder="0"
        onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
      />
      <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-zinc-400">₮</span>
    </div>
  );
}

function EntryModal({ entry, draft, onClose }: { entry?: FinanceEntry; draft?: Draft; onClose: () => void }) {
  const { departments, projects, profiles, files, createEntry, updateEntry, deleteEntry, uploadFiles, openFile, deleteFile } = useStore();
  const [f, setF] = useState(() => ({
    kind: entry?.kind ?? draft?.kind ?? "expense",
    category: entry?.category ?? draft?.category ?? "other",
    title: entry?.title ?? draft?.title ?? "",
    amount: entry?.amount ?? draft?.amount ?? 0,
    date: entry?.date ?? draft?.date ?? todayISO(),
    vendor: entry?.vendor ?? draft?.vendor ?? "",
    description: entry?.description ?? draft?.description ?? "",
    department_id: entry?.department_id ?? draft?.department_id ?? "",
    project_id: entry?.project_id ?? draft?.project_id ?? "",
    profile_id: entry?.profile_id ?? draft?.profile_id ?? "",
  }));
  const [pending, setPending] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const attached = entry ? files.filter((x) => x.entry_id === entry.id) : [];
  const categories = f.kind === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  useEffect(() => {
    if (!categories.some((c) => c.id === f.category)) set("category", categories[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.kind]);

  async function save() {
    if (!f.title.trim() || !f.amount) return;
    setBusy(true);
    const payload = {
      ...f,
      title: f.title.trim(),
      vendor: f.vendor.trim() || null,
      description: f.description.trim() || null,
      department_id: f.department_id || null,
      project_id: f.project_id || null,
      profile_id: f.profile_id || null,
    };
    let id = entry?.id;
    if (entry) await updateEntry(entry.id, payload);
    else id = (await createEntry({ ...payload, approval_id: draft?.approval_id ?? null }))?.id;
    if (id && pending.length) await uploadFiles(pending, { folder: "receipts", entry_id: id });
    setBusy(false);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={entry ? (f.kind === "income" ? "Орлого засах" : "Зардал засах") : f.kind === "income" ? "Шинэ орлого" : "Шинэ зардал"}
      width="max-w-xl"
      footer={
        <>
          {entry && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                void deleteEntry(entry.id);
                onClose();
              }}
            >
              <Trash2 size={15} /> {confirmDelete ? "Тийм, устга" : "Устгах"}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Болих
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || !f.title.trim() || !f.amount}>
            {busy ? "Хадгалж байна…" : entry ? "Хадгалах" : "Бүртгэх"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="grid grid-cols-2 gap-1.5">
          {(["expense", "income"] as const).map((k) => (
            <button
              type="button"
              key={k}
              onClick={() => set("kind", k)}
              className={cn(
                "cursor-pointer rounded-lg border py-2 text-sm font-medium transition",
                f.kind === k ? "border-transparent bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "border-zinc-200 text-zinc-500 hover:bg-zinc-50",
              )}
            >
              {k === "expense" ? "Зардал" : "Орлого"}
            </button>
          ))}
        </div>
        <input
          autoFocus
          className="w-full border-0 bg-transparent p-0 text-lg font-semibold outline-none placeholder:text-zinc-300"
          placeholder={f.kind === "income" ? "Юуны орлого вэ?" : "Юунд зарцуулсан бэ?"}
          value={f.title}
          onChange={(e) => set("title", e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Дүн</label>
            <MoneyInput value={f.amount} onChange={(v) => set("amount", v)} />
          </div>
          <div>
            <label className="label">Огноо</label>
            <input type="date" className="field" value={f.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div>
            <label className="label">Ангилал</label>
            <Select className="field" value={f.category} onChange={(e) => set("category", e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label">{f.kind === "income" ? "Хэнээс" : "Хэнд төлсөн"}</label>
            <input className="field" placeholder="Байгууллага, хүн" value={f.vendor} onChange={(e) => set("vendor", e.target.value)} />
          </div>
          <div>
            <label className="label">Хэлтэс</label>
            <Select className="field" value={f.department_id} onChange={(e) => set("department_id", e.target.value)}>
              <option value="">— Хэлтэсгүй —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label">Төсөл</label>
            <Select className="field" value={f.project_id} onChange={(e) => set("project_id", e.target.value)}>
              <option value="">— Төсөлгүй —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Холбоотой ажилтан</label>
            <Select className="field" value={f.profile_id} onChange={(e) => set("profile_id", e.target.value)}>
              <option value="">— Байхгүй —</option>
              {profiles
                .filter((p) => p.active || p.id === f.profile_id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
            </Select>
          </div>
        </div>
        <textarea className="field min-h-16 resize-y" placeholder="Тайлбар (заавал биш)" value={f.description} onChange={(e) => set("description", e.target.value)} />

        {/* Баримт хавсаргах */}
        <div>
          <span className="label">Баримт, нэхэмжлэх</span>
          <div className="space-y-1.5">
            {attached.map((x) => (
              <div key={x.id} className="flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-sm">
                <FileText size={14} className="shrink-0 text-zinc-400" />
                <button type="button" onClick={() => void openFile(x)} className="min-w-0 flex-1 cursor-pointer truncate text-left hover:underline">
                  {x.name}
                </button>
                <span className="text-xs text-zinc-400">{fmtSize(x.size)}</span>
                <button type="button" onClick={() => void deleteFile(x)} className="cursor-pointer text-zinc-400 hover:text-red-600" aria-label="Устгах">
                  <X size={14} />
                </button>
              </div>
            ))}
            {pending.map((x, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-sm">
                <Upload size={14} className="shrink-0 text-zinc-400" />
                <span className="min-w-0 flex-1 truncate">{x.name}</span>
                <span className="text-xs text-zinc-400">{fmtSize(x.size)}</span>
                <button type="button" onClick={() => setPending((p) => p.filter((_, j) => j !== i))} className="cursor-pointer text-zinc-400 hover:text-red-600" aria-label="Хасах">
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-zinc-300 py-2.5 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-800"
            >
              <Paperclip size={14} /> Файл хавсаргах (зураг, PDF)
            </button>
            <input
              ref={input}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                setPending((p) => [...p, ...list]);
                e.target.value = "";
              }}
            />
          </div>
          {pending.length > 0 && <p className="mt-1 text-[11px] text-zinc-400">Хадгалах үед «Баримт» хавтаст хуулагдана</p>}
        </div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
