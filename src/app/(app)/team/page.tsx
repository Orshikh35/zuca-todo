"use client";

import { Building2, Crown, KeyRound, Mail, Phone, Plus, Search, Send, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { BulkAddModal } from "@/components/team/bulk-add-modal";
import { MemberModal } from "@/components/team/member-modal";
import { Donut, Hero, HeroChip, heroBtn, pillField, Tile } from "@/components/bento";
import { Avatar, Button, Card, Empty, PageHeader, Select } from "@/components/ui";
import { useStore } from "@/lib/data/store";
import { ROLES } from "@/lib/constants";
import { atLeast, canEditProfile, isAdmin } from "@/lib/permissions";
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
    const since = Date.now() - 30 * 86_400_000;
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
          done30: mine.filter((t) => t.status === "done" && t.completed_at && Date.parse(t.completed_at) >= since).length,
          camps: camps.filter((c) => c.owner_id === p.id).length,
        };
      })
      .sort((a, b) => b.open - a.open || a.p.full_name.localeCompare(b.p.full_name, "mn"));
  }, [profiles, tasks, camps, q, showInactive, dept]);

  const unassigned = tasks.filter((t) => !t.assignee_id && t.status !== "done").length;
  const inactiveCount = profiles.filter((p) => !p.active).length;
  const active = profiles.filter((p) => p.active);

  return (
    <>
      <PageHeader
        title="Баг"
        subtitle="Хэн ямар ажил хариуцаж, хэдэн хувьтай явж байгаа"
        actions={
          <>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-zinc-400" />
              <input className={cn(pillField, "w-48 pl-9")} placeholder="Хайх…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {departments.length > 0 && (
              <Select className={pillField} value={dept} onChange={(e) => setDept(e.target.value)}>
                <option value="">Бүх хэлтэс</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
                <option value="none">Хэлтэсгүй</option>
              </Select>
            )}
            {atLeast(me, "manager") && (
              <>
                <Link href="/departments" className="glass inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-zinc-700 hover:text-zinc-900">
                  <Building2 size={15} /> Хэлтэс
                </Link>
              </>
            )}
          </>
        }
      />

      {/* Bento товчоо */}
      <div className="mb-5 flex flex-wrap gap-4">
        <Hero
          tone="lime"
          className="min-w-0 flex-[2.4_1_340px]"
          title="ZUCA баг"
          value={active.length}
          unit="хүн"
          chips={
            <>
              <HeroChip>👑 Админ {active.filter((p) => isAdmin(p)).length}</HeroChip>
              <HeroChip>
                ✈️ Telegram {active.filter((p) => p.telegram_chat_id).length}/{active.length}
              </HeroChip>
              <HeroChip>🔑 Нэвтэрдэг {active.filter((p) => p.user_id).length}</HeroChip>
            </>
          }
          actions={
            atLeast(me, "manager") ? (
              <>
                <button onClick={() => setModal({ member: null })} className={heroBtn.dark}>
                  <Plus size={15} /> Ажилтан нэмэх
                </button>
                <button onClick={() => setBulkOpen(true)} className={heroBtn.light}>
                  <Users size={15} /> Олноор нэмэх
                </button>
              </>
            ) : undefined
          }
        />
        <Tile
          className="flex-[1_1_150px]"
          tint="amber"
          title="Эзэнгүй ажил"
          value={unassigned}
          caption="хариуцагч тавих"
          href="/tasks?who=none"
          chip={unassigned ? { text: "Хуваарил", tone: "warn" } : null}
        />
        <Tile
          className="flex-[1_1_150px]"
          tint="rose"
          title="Хэтэрсэн"
          value={rows.reduce((a, r) => a + r.overdue, 0)}
          caption="багийн нийт"
        />
        <Tile
          className="flex-[1_1_150px]"
          tint="emerald"
          title="Дууссан"
          value={`+${rows.reduce((a, r) => a + r.done30, 0)}`}
          caption="сүүлийн 30 хоног"
        />
      </div>

      {/* Ажилтан бүрийн карт */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map(({ p, open, overdue, urgent, done30, camps: campCount }) => {
          const d = p.department_id ? deptById.get(p.department_id) : null;
          const r = ROLES.find((x) => x.id === p.role) ?? ROLES[1];
          const total = open + done30;
          const pct = total ? Math.round((done30 / total) * 100) : null;
          const color = pct === null ? "#d4d4d8" : pct >= 70 ? "#8fd16a" : pct >= 40 ? "#ffb34d" : "#ff6b8b";
          return (
            <article key={p.id} className={cn("glass flex flex-col rounded-[1.75rem] p-5", !p.active && "opacity-55")}>
              <div className="flex items-start gap-3">
                <Avatar profile={p} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-medium">{p.full_name}</span>
                    {p.id === me?.id && <span className="rounded-full bg-[#c9b8ff] px-1.5 text-[10px] font-semibold text-neutral-900">Би</span>}
                    {!p.active && <span className="rounded-full bg-zinc-100 px-1.5 text-[10px] font-semibold text-zinc-500">Гарсан</span>}
                  </div>
                  <div className="truncate text-xs text-zinc-500">{p.job_title || "—"}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", r.chip)}>{r.label}</span>
                    {d && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] text-zinc-600">
                        <span className="size-1.5 rounded-full" style={{ background: d.color }} />
                        {d.name}
                        {d.head_id === p.id && <Crown size={10} className="text-amber-500" />}
                      </span>
                    )}
                  </div>
                </div>
                <Donut
                  size={58}
                  stroke={6}
                  parts={[
                    { label: "done", value: done30, color },
                    { label: "open", value: open, color: "transparent" },
                  ]}
                  center={<span className="tabular text-xs font-semibold">{pct === null ? "—" : `${pct}%`}</span>}
                />
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                {[
                  { k: "Нээлттэй", v: open, href: open ? `/tasks?who=${p.id}` : undefined, tone: urgent ? "text-orange-600" : "" },
                  { k: "Хэтэрсэн", v: overdue, tone: overdue ? "text-red-600" : "text-zinc-300" },
                  { k: "Дууссан", v: done30, tone: done30 ? "" : "text-zinc-300" },
                  { k: "Зуслан", v: campCount, tone: campCount ? "" : "text-zinc-300" },
                ].map((x) => {
                  const inner = (
                    <>
                      <div className={cn("tabular text-lg font-semibold", x.tone)}>{x.v}</div>
                      <div className="text-[10.5px] text-zinc-500">{x.k}</div>
                    </>
                  );
                  return x.href ? (
                    <Link key={x.k} href={x.href} className="rounded-2xl bg-zinc-100 py-2 hover:bg-zinc-200">
                      {inner}
                    </Link>
                  ) : (
                    <div key={x.k} className="rounded-2xl bg-zinc-100 py-2">
                      {inner}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex items-center gap-1.5">
                {p.email && (
                  <a href={`mailto:${p.email}`} title={p.email} className="grid size-8 place-items-center rounded-full bg-zinc-100 text-zinc-500 hover:text-zinc-900">
                    <Mail size={14} />
                  </a>
                )}
                {p.phone && (
                  <a href={`tel:${p.phone}`} title={p.phone} className="grid size-8 place-items-center rounded-full bg-zinc-100 text-zinc-500 hover:text-zinc-900">
                    <Phone size={14} />
                  </a>
                )}
                {p.telegram_chat_id ? (
                  <span title="Telegram холбогдсон" className="grid size-8 place-items-center rounded-full bg-sky-100 text-sky-600">
                    <Send size={14} />
                  </span>
                ) : (
                  <span title="Telegram холбоогүй" className="grid size-8 place-items-center rounded-full bg-zinc-100 text-zinc-300">
                    <Send size={14} />
                  </span>
                )}
                {p.user_id ? (
                  <span title="Системд нэвтэрдэг" className="grid size-8 place-items-center rounded-full bg-zinc-100 text-zinc-500">
                    <KeyRound size={14} />
                  </span>
                ) : null}
                <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setModal({ member: p })}>
                  {canEditProfile(me, p, departments) ? "Засах" : "Харах"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      {!rows.length && (
        <Card className="mt-4">
          <Empty
            icon={<Users size={30} />}
            title={q ? "Хайлтад тохирох ажилтан алга" : "Ажилтан бүртгээгүй байна"}
            hint={q ? undefined : "«Ажилтан нэмэх» дарж багийнхаа хүмүүсийг оруулаарай"}
          />
        </Card>
      )}

      {inactiveCount > 0 && (
        <button onClick={() => setShowInactive((v) => !v)} className="mt-4 cursor-pointer text-xs text-zinc-400 hover:text-zinc-700">
          {showInactive ? "Гарсан хүмүүсийг нуух" : `Гарсан ${inactiveCount} хүнийг харах`}
        </button>
      )}

      {modal && <MemberModal member={modal.member} onClose={() => setModal(null)} />}
      <BulkAddModal open={bulkOpen} onClose={() => setBulkOpen(false)} />
    </>
  );
}
