"use client";

import { Ban, Check, ClipboardCheck, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Avatar, Button, Card, Empty, Modal, PageHeader, Segmented } from "@/components/ui";
import { APPROVAL_KINDS, APPROVAL_STATUSES } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { approverFor, canDecide, canSeeApproval } from "@/lib/permissions";
import type { Approval, ApprovalKind } from "@/lib/types";
import { cn, fmtMNT, relativeTime, todayISO } from "@/lib/utils";

type Tab = "inbox" | "mine" | "all";

export default function ApprovalsPage() {
  const { approvals, me, departments, profileById, deptById } = useStore();
  const inboxCount = approvals.filter((a) => a.status === "pending" && canDecide(me, a)).length;
  const [tab, setTab] = useState<Tab>(inboxCount ? "inbox" : "mine");
  const [creating, setCreating] = useState(false);
  const [deciding, setDeciding] = useState<{ a: Approval; approve: boolean } | null>(null);

  const rows = useMemo(() => {
    const list = approvals.filter((a) =>
      tab === "inbox" ? a.status === "pending" && canDecide(me, a) : tab === "mine" ? a.requester_id === me?.id : canSeeApproval(me, a, departments),
    );
    return list.sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending") || b.created_at.localeCompare(a.created_at));
  }, [approvals, tab, me, departments]);

  const pendingAll = approvals.filter((a) => a.status === "pending" && canSeeApproval(me, a, departments)).length;

  return (
    <>
      <PageHeader
        title="Хүсэлт, батлалт"
        subtitle="Чөлөө, худалдан авалт, зардал, томилолт — хэлтсийн дарга → удирдлага батална"
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Шинэ хүсэлт
          </Button>
        }
      />

      <div className="mb-4">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { id: "inbox", label: `Надаар батлуулах${inboxCount ? ` · ${inboxCount}` : ""}` },
            { id: "mine", label: "Миний хүсэлт" },
            { id: "all", label: `Бүгд${pendingAll ? ` · ${pendingAll} хүлээгдэж буй` : ""}` },
          ]}
        />
      </div>

      <Card>
        {!rows.length ? (
          <Empty
            icon={<ClipboardCheck size={32} />}
            title={tab === "inbox" ? "Батлах хүсэлт алга" : "Хүсэлт алга"}
            hint={tab === "mine" ? "«Шинэ хүсэлт» дарж чөлөө, худалдан авалт гэх мэт хүсэлт гаргана" : undefined}
          />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {rows.map((a) => {
              const kind = APPROVAL_KINDS.find((k) => k.id === a.kind)!;
              const st = APPROVAL_STATUSES.find((s) => s.id === a.status)!;
              const req = profileById.get(a.requester_id);
              const appr = a.approver_id ? profileById.get(a.approver_id) : null;
              const dept = a.department_id ? deptById.get(a.department_id) : null;
              return (
                <li key={a.id} className="flex flex-wrap items-start gap-3 px-5 py-4 sm:flex-nowrap">
                  <Avatar profile={req} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.title}</span>
                      <span className="rounded bg-zinc-100 px-1.5 py-px text-[11px] font-medium text-zinc-600">{kind.label}</span>
                      <span className={cn("rounded px-1.5 py-px text-[11px] font-semibold ring-1 ring-inset", st.chip)}>{st.label}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500">
                      <span>
                        {req?.full_name ?? "?"}
                        {dept ? ` · ${dept.name}` : ""}
                      </span>
                      {a.amount != null && <span className="tabular font-medium text-zinc-700">{fmtMNT(a.amount)}</span>}
                      {a.start_date && (
                        <span className="tabular">
                          {a.start_date}
                          {a.end_date && a.end_date !== a.start_date ? ` → ${a.end_date}` : ""}
                        </span>
                      )}
                      <span>{relativeTime(a.created_at)}</span>
                    </div>
                    {a.description && <p className="mt-1.5 text-sm text-zinc-600">{a.description}</p>}
                    <div className="mt-1.5 text-xs text-zinc-400">
                      {a.status === "pending" ? (
                        <>Батлах: {appr?.full_name ?? "удирдлага"}</>
                      ) : a.status === "approved" || a.status === "rejected" ? (
                        <>
                          {appr?.full_name ?? "Удирдлага"} {a.status === "approved" ? "баталсан" : "татгалзсан"}
                          {a.decided_at ? ` · ${relativeTime(a.decided_at)}` : ""}
                          {a.decision_note ? ` — “${a.decision_note}”` : ""}
                        </>
                      ) : null}
                    </div>
                  </div>
                  <Actions a={a} onDecide={(approve) => setDeciding({ a, approve })} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {creating && <NewApproval onClose={() => setCreating(false)} />}
      {deciding && <Decide {...deciding} onClose={() => setDeciding(null)} />}
    </>
  );
}

function Actions({ a, onDecide }: { a: Approval; onDecide: (approve: boolean) => void }) {
  const { me, updateApproval } = useStore();
  if (a.status !== "pending") return null;
  if (canDecide(me, a)) {
    return (
      <div className="flex shrink-0 gap-1.5">
        <Button size="sm" variant="danger" onClick={() => onDecide(false)}>
          <X size={14} /> Татгалзах
        </Button>
        <Button size="sm" variant="primary" onClick={() => onDecide(true)}>
          <Check size={14} /> Батлах
        </Button>
      </div>
    );
  }
  if (a.requester_id === me?.id) {
    return (
      <Button size="sm" variant="ghost" onClick={() => void updateApproval(a.id, { status: "cancelled" })}>
        <Ban size={14} /> Цуцлах
      </Button>
    );
  }
  return null;
}

function Decide({ a, approve, onClose }: { a: Approval; approve: boolean; onClose: () => void }) {
  const { updateApproval, createTask, departments, profileById, toast } = useStore();
  const [note, setNote] = useState("");
  const kind = APPROVAL_KINDS.find((k) => k.id === a.kind)!;
  // Мөнгөтэй хүсэлт батлагдвал санхүүгийн хэлтэст төлбөрийн ажил үүснэ
  const finance = departments.find((d) => d.code?.toUpperCase() === "FIN" || /санхүү/i.test(d.name));
  const makesTask = approve && kind.money && a.amount && finance;

  async function submit() {
    await updateApproval(a.id, { status: approve ? "approved" : "rejected", decision_note: note.trim() || null, decided_at: new Date().toISOString() });
    if (makesTask) {
      const req = profileById.get(a.requester_id);
      await createTask({
        title: `Төлбөр гүйцэтгэх: ${a.title}`,
        description: `${kind.label} · ${fmtMNT(a.amount)} · ${req?.full_name ?? ""}\nБатлагдсан хүсэлтээс автоматаар үүсэв.`,
        priority: "high",
        status: "todo",
        department_id: finance.id,
        from_department_id: a.department_id !== finance.id ? a.department_id : null,
        assignee_id: finance.head_id,
        due_date: todayISO(),
        planned_month: todayISO().slice(0, 7),
        tags: ["батлалт"],
        position: Date.now(),
      });
    }
    toast(approve ? "Хүсэлт батлагдлаа" + (makesTask ? " · санхүүд ажил үүслээ" : "") : "Хүсэлтээс татгалзлаа");
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={approve ? "Хүсэлт батлах" : "Хүсэлтээс татгалзах"}
      footer={
        <>
          <Button onClick={onClose}>Болих</Button>
          <Button variant={approve ? "primary" : "danger"} onClick={() => void submit()}>
            {approve ? "Батлах" : "Татгалзах"}
          </Button>
        </>
      }
    >
      <p className="text-sm">
        <b>{a.title}</b>
        {a.amount != null && <span className="text-zinc-500"> · {fmtMNT(a.amount)}</span>}
      </p>
      <label className="label mt-4" htmlFor="dec-note">
        Тайлбар {approve ? "(заавал биш)" : ""}
      </label>
      <textarea id="dec-note" autoFocus className="field min-h-20" value={note} onChange={(e) => setNote(e.target.value)} placeholder={approve ? "Зөвшөөрөв" : "Шалтгаан"} />
      {makesTask && (
        <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">
          Батлахад <b>{finance.name}</b> хэлтэст «Төлбөр гүйцэтгэх» ажил автоматаар үүснэ.
        </p>
      )}
    </Modal>
  );
}

function NewApproval({ onClose }: { onClose: () => void }) {
  const { me, profiles, departments, createApproval } = useStore();
  const [kind, setKind] = useState<ApprovalKind>("leave");
  const [f, setF] = useState({ title: "", description: "", amount: "", start_date: "", end_date: "" });
  const auto = me ? approverFor(me, departments, profiles) : null;
  const [approver, setApprover] = useState(auto ?? "");
  const k = APPROVAL_KINDS.find((x) => x.id === kind)!;
  const set = (key: keyof typeof f, v: string) => setF((p) => ({ ...p, [key]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!me || !f.title.trim()) return;
    await createApproval({
      kind,
      title: f.title.trim(),
      description: f.description.trim() || null,
      amount: k.money && f.amount ? Math.round(Number(f.amount.replace(/[^\d.]/g, ""))) : null,
      start_date: k.dates ? f.start_date || null : null,
      end_date: k.dates ? f.end_date || f.start_date || null : null,
      requester_id: me.id,
      department_id: me.department_id,
      approver_id: approver || null,
    });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Шинэ хүсэлт"
      footer={
        <>
          <Button onClick={onClose}>Болих</Button>
          <Button type="submit" form="appr-form" variant="primary" disabled={!f.title.trim()}>
            Илгээх
          </Button>
        </>
      }
    >
      <form id="appr-form" onSubmit={submit} className="space-y-3.5">
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          {APPROVAL_KINDS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setKind(x.id)}
              className={cn(
                "cursor-pointer rounded-lg border px-2 py-2 text-xs font-medium transition",
                kind === x.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div>
          <label className="label" htmlFor="a-title">Гарчиг *</label>
          <input id="a-title" autoFocus className="field" value={f.title} onChange={(e) => set("title", e.target.value)} placeholder={k.hint} />
        </div>
        {(k.money || k.dates) && (
          <div className="grid gap-3.5 sm:grid-cols-3">
            {k.money && (
              <div>
                <label className="label" htmlFor="a-amount">Дүн (₮)</label>
                <input id="a-amount" inputMode="numeric" className="field" value={f.amount} onChange={(e) => set("amount", e.target.value)} placeholder="500000" />
              </div>
            )}
            {k.dates && (
              <>
                <div>
                  <label className="label" htmlFor="a-start">Эхлэх</label>
                  <input id="a-start" type="date" className="field" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
                </div>
                <div>
                  <label className="label" htmlFor="a-end">Дуусах</label>
                  <input id="a-end" type="date" className="field" value={f.end_date} min={f.start_date} onChange={(e) => set("end_date", e.target.value)} />
                </div>
              </>
            )}
          </div>
        )}
        <div>
          <label className="label" htmlFor="a-desc">Тайлбар</label>
          <textarea id="a-desc" className="field min-h-16" value={f.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="a-appr">Батлах хүн</label>
          <select id="a-appr" className="field" value={approver} onChange={(e) => setApprover(e.target.value)}>
            <option value="">— Удирдлага (дурын) —</option>
            {profiles
              .filter((p) => p.active && p.id !== me?.id && p.role !== "member")
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                  {p.job_title ? ` · ${p.job_title}` : ""}
                  {p.id === auto ? " (хэлтсийн дарга / санал болгож буй)" : ""}
                </option>
              ))}
          </select>
        </div>
      </form>
    </Modal>
  );
}
