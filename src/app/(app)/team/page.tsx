"use client";

import { AlertTriangle, CheckCircle2, Crown, KeyRound, Mail, Phone, Plus, Search, Send, Tent, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BulkAddModal } from "@/components/team/bulk-add-modal";
import { MemberModal } from "@/components/team/member-modal";
import { Avatar, Button, Card, Empty, PageHeader, Progress } from "@/components/ui";
import { useStore } from "@/lib/data/store";
import { ROLES } from "@/lib/constants";
import { atLeast, canEditProfile } from "@/lib/permissions";
import type { Profile } from "@/lib/types";
import { cn, isOverdue } from "@/lib/utils";

export default function TeamPage() {
  const { profiles, tasks, camps, me, departments, deptById } = useStore();
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [modal, setModal] = useState<{ member: Profile | null } | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  /** Ажилтан бүрийн ачаалал */
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return profiles
      .filter((p) => (showInactive || p.active) && (!s || `${p.full_name} ${p.email} ${p.job_title ?? ""}`.toLowerCase().includes(s)))
      .filter((p) => !dept || (dept === "none" ? !p.department_id : p.department_id === dept))
      .map((p) => {
        const mine = tasks.filter((t) => t.assignee_id === p.id);
        const open = mine.filter((t) => t.status !== "done");
        return {
          p,
          open: open.length,
          overdue: open.filter((t) => isOverdue(t.due_date, false)).length,
          urgent: open.filter((t) => t.priority === "urgent").length,
          done: mine.filter((t) => t.status === "done").length,
          total: mine.length,
          camps: camps.filter((c) => c.owner_id === p.id).length,
        };
      })
      .sort((a, b) => b.open - a.open || a.p.full_name.localeCompare(b.p.full_name, "mn"));
  }, [profiles, tasks, camps, q, showInactive, dept]);

  const unassigned = tasks.filter((t) => !t.assignee_id && t.status !== "done").length;
  const inactiveCount = profiles.filter((p) => !p.active).length;
  const maxOpen = Math.max(1, ...rows.map((r) => r.open));

  return (
    <>
      <PageHeader
        title="Ажилчид"
        subtitle={`${profiles.filter((p) => p.active).length} хүн · ${departments.length} хэлтэс · хэн ямар ажил хариуцаж байгаа`}
        actions={
          <>
            <div className="relative">
              <Search size={15} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-zinc-400" />
              <input className="field h-9 w-48 pl-8" placeholder="Хайх…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {departments.length > 0 && (
              <select className="field h-9 w-auto py-0" value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="">Бүх хэлтэс</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
                <option value="none">Хэлтэсгүй</option>
              </select>
            )}
            {atLeast(me, "manager") && (
              <>
                <Button onClick={() => setBulkOpen(true)}>
                  <Users size={16} /> Олноор нэмэх
                </Button>
                <Button variant="primary" onClick={() => setModal({ member: null })}>
                  <Plus size={16} /> Ажилтан нэмэх
                </Button>
              </>
            )}
          </>
        }
      />

      {unassigned > 0 && (
        <Link
          href="/tasks?who=none"
          className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 transition hover:bg-amber-100"
        >
          <AlertTriangle size={16} className="shrink-0" />
          <b className="tabular">{unassigned}</b> ажил хариуцагчгүй байна — хэн хийхийг нь тодорхойл
        </Link>
      )}

      <Card>
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
                <th className="px-4 py-2.5 font-medium">Ажилтан</th>
                <th className="px-4 py-2.5 font-medium">Хэлтэс, эрх</th>
                <th className="px-4 py-2.5 font-medium">Холбоо барих</th>
                <th className="px-4 py-2.5 font-medium">Ачаалал</th>
                <th className="px-4 py-2.5 text-right font-medium">Хийж буй</th>
                <th className="px-4 py-2.5 text-right font-medium">Хэтэрсэн</th>
                <th className="px-4 py-2.5 text-right font-medium">Дууссан</th>
                <th className="px-4 py-2.5 text-right font-medium">Зуслан</th>
                <th className="w-20 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, open, overdue, urgent, done, camps: campCount }) => (
                <tr key={p.id} className={cn("border-b border-zinc-50 last:border-0 hover:bg-zinc-50/60", !p.active && "opacity-55")}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar profile={p} size={32} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium">{p.full_name}</span>
                          {p.id === me?.id && <span className="rounded bg-brand-50 px-1.5 text-[10px] font-semibold text-brand-700">Би</span>}
                          {!p.active && <span className="rounded bg-zinc-100 px-1.5 text-[10px] font-semibold text-zinc-500">Гарсан</span>}
                        </div>
                        <div className="truncate text-xs text-zinc-400">{p.job_title || "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {(() => {
                      const d = p.department_id ? deptById.get(p.department_id) : null;
                      const r = ROLES.find((x) => x.id === p.role)!;
                      return (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs">
                            {d ? (
                              <>
                                <span className="size-2 rounded-full" style={{ background: d.color }} />
                                <span className="truncate text-zinc-700">{d.name}</span>
                                {d.head_id === p.id && <Crown size={11} className="text-amber-500" />}
                              </>
                            ) : (
                              <span className="text-zinc-300">хэлтэсгүй</span>
                            )}
                          </div>
                          <span className={cn("inline-block rounded px-1.5 py-px text-[10px] font-semibold ring-1 ring-inset", r.chip)}>{r.label}</span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-0.5 text-xs text-zinc-500">
                      {p.email ? (
                        <a href={`mailto:${p.email}`} className="flex items-center gap-1.5 hover:text-brand-600">
                          <Mail size={12} className="shrink-0" /> <span className="truncate">{p.email}</span>
                        </a>
                      ) : (
                        <span className="text-zinc-300">имэйлгүй</span>
                      )}
                      {p.telegram_chat_id && (
                        <span className="flex items-center gap-1.5 text-sky-600">
                          <Send size={12} className="shrink-0" /> Telegram
                        </span>
                      )}
                      {p.phone && (
                        <a href={`tel:${p.phone}`} className="flex items-center gap-1.5 hover:text-brand-600">
                          <Phone size={12} className="shrink-0" /> {p.phone}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="w-28">
                      <Progress value={(open / maxOpen) * 100} tone={overdue ? "bg-red-500" : urgent ? "bg-orange-500" : "bg-brand-500"} />
                      <div className="mt-1 flex items-center gap-1 text-[11px] text-zinc-400">
                        {p.user_id ? (
                          <><KeyRound size={10} /> нэвтэрдэг</>
                        ) : (
                          <span className="text-zinc-300">нэвтрэх эрхгүй</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="tabular px-4 py-3 text-right">
                    {open ? <Link href={`/tasks?who=${p.id}`} className="font-semibold hover:text-brand-600 hover:underline">{open}</Link> : <span className="text-zinc-300">0</span>}
                  </td>
                  <td className="tabular px-4 py-3 text-right">
                    {overdue ? <span className="font-semibold text-red-600">{overdue}</span> : <span className="text-zinc-300">0</span>}
                  </td>
                  <td className="tabular px-4 py-3 text-right text-zinc-500">{done || <span className="text-zinc-300">0</span>}</td>
                  <td className="tabular px-4 py-3 text-right text-zinc-500">
                    {campCount ? <span className="inline-flex items-center gap-1"><Tent size={12} />{campCount}</span> : <span className="text-zinc-300">0</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setModal({ member: p })}>
                      {canEditProfile(me, p, departments) ? "Засах" : "Харах"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!rows.length && (
          <Empty
            icon={<Users size={30} />}
            title={q ? "Хайлтад тохирох ажилтан алга" : "Ажилтан бүртгээгүй байна"}
            hint={q ? undefined : "«Ажилтан нэмэх» дарж багийнхаа хүмүүсийг оруулаарай"}
          />
        )}
      </Card>

      {inactiveCount > 0 && (
        <button onClick={() => setShowInactive((v) => !v)} className="mt-3 cursor-pointer text-xs text-zinc-400 hover:text-zinc-700">
          {showInactive ? "Гарсан хүмүүсийг нуух" : `Гарсан ${inactiveCount} хүнийг харах`}
        </button>
      )}

      {/* Хариуцагчгүй ажлууд болон хамгийн их ачаалалтай хүн */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat icon={<UserPlus size={16} />} label="Нийт ажилтан" value={profiles.filter((p) => p.active).length} />
        <Stat icon={<AlertTriangle size={16} />} label="Хариуцагчгүй ажил" value={unassigned} tone={unassigned ? "text-amber-600" : undefined} />
        <Stat icon={<CheckCircle2 size={16} />} label="Дууссан ажил" value={tasks.filter((t) => t.status === "done").length} />
      </div>

      {modal && <MemberModal member={modal.member} onClose={() => setModal(null)} />}
      <BulkAddModal open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </>
  );
}

function Stat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: string }) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-zinc-100 text-zinc-500">{icon}</span>
      <div>
        <div className={cn("tabular text-xl font-semibold", tone)}>{value}</div>
        <div className="text-xs text-zinc-500">{label}</div>
      </div>
    </Card>
  );
}
