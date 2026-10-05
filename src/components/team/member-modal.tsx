"use client";

import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/data/store";
import type { Profile, ProfileInput } from "@/lib/types";
import { ROLES } from "@/lib/constants";
import { atLeast, canEditProfile, canSetRole } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Button, Modal, Select } from "@/components/ui";

export const MEMBER_COLORS = [
  "#4f46e5", "#0891b2", "#ea580c", "#16a34a",
  "#db2777", "#7c3aed", "#ca8a04", "#0d9488",
];

const blank = {
  full_name: "",
  email: "",
  phone: "",
  job_title: "",
  color: MEMBER_COLORS[0],
  role: "member" as Profile["role"],
  department_id: "",
  telegram_chat_id: "",
  notify_email: true,
  notify_telegram: true,
  active: true,
  note: "",
};

export function MemberModal({ member, onClose }: { member: Profile | null; onClose: () => void }) {
  const { createProfile, updateProfile, deleteProfile, profiles, me, tasks, departments } = useStore();
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setErr(null);
    setConfirmDelete(false);
    setF(
      member
        ? {
            full_name: member.full_name,
            email: member.email,
            phone: member.phone ?? "",
            job_title: member.job_title ?? "",
            color: member.color,
            role: member.role,
            department_id: member.department_id ?? "",
            telegram_chat_id: member.telegram_chat_id ?? "",
            notify_email: member.notify_email,
            notify_telegram: member.notify_telegram,
            active: member.active,
            note: member.note ?? "",
          }
        : { ...blank, color: MEMBER_COLORS[profiles.length % MEMBER_COLORS.length], department_id: me?.role === "manager" ? me.department_id ?? "" : "" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member, profiles.length]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const isMe = member?.id === me?.id;
  const editable = canEditProfile(me, member, departments);
  // Эрх: зөвхөн дээд түвшний хүн өөрчилнө, өөрийн эрхийг өөрөө өсгөхгүй
  const roleOptions = ROLES.filter((r) => r.id === f.role || (r.selectable && canSetRole(me, r.id) && (!member || canSetRole(me, member.role))));
  const canDelete = member && !isMe && atLeast(me, "manager") && editable;
  const assigned = member ? tasks.filter((t) => t.assignee_id === member.id && t.status !== "done").length : 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const name = f.full_name.trim();
    if (!name) return setErr("Нэр оруулна уу");

    const email = f.email.trim().toLowerCase();
    // Имэйл давхардвал бүртгүүлэхэд буруу хүнтэй холбогдоно
    if (email && profiles.some((p) => p.id !== member?.id && p.email.toLowerCase() === email)) {
      return setErr("Энэ имэйлтэй ажилтан аль хэдийн бүртгэлтэй байна");
    }

    const patch: ProfileInput = {
      full_name: name,
      email,
      phone: f.phone.trim() || null,
      job_title: f.job_title.trim() || null,
      color: f.color,
      role: f.role,
      department_id: f.department_id || null,
      telegram_chat_id: f.telegram_chat_id.trim() || null,
      notify_email: f.notify_email,
      notify_telegram: f.notify_telegram,
      active: f.active,
      note: f.note.trim() || null,
    };

    setBusy(true);
    if (member) await updateProfile(member.id, patch);
    else await createProfile(patch);
    setBusy(false);
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={member ? "Ажилтан засах" : "Шинэ ажилтан"}
      footer={
        <>
          {canDelete && (
            <Button
              type="button"
              variant="danger"
              className="mr-auto"
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                void deleteProfile(member.id);
                onClose();
              }}
            >
              <Trash2 size={15} />
              {confirmDelete ? "Итгэлтэй байна уу?" : "Устгах"}
            </Button>
          )}
          <Button type="button" onClick={onClose}>Болих</Button>
          <Button type="submit" form="member-form" variant="primary" disabled={busy || !editable}>
            {member ? "Хадгалах" : "Бүртгэх"}
          </Button>
        </>
      }
    >
      <form id="member-form" onSubmit={save} className="space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="m-name">Нэр *</label>
            <input id="m-name" className="field" value={f.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Жишээ: Б. Номин" autoFocus />
          </div>
          <div>
            <label className="label" htmlFor="m-job">Албан тушаал</label>
            <input id="m-job" className="field" value={f.job_title} onChange={(e) => set("job_title", e.target.value)} placeholder="Партнершип менежер" />
          </div>
          <div>
            <label className="label" htmlFor="m-email">Имэйл</label>
            <input id="m-email" type="email" className="field" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="ner@zuca.mn" />
          </div>
          <div>
            <label className="label" htmlFor="m-phone">Утас</label>
            <input id="m-phone" className="field" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="99112233" />
          </div>
        </div>

        <div>
          <span className="label">Өнгө</span>
          <div className="flex flex-wrap gap-1.5">
            {MEMBER_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set("color", c)}
                style={{ background: c }}
                aria-label={c}
                className={cn(
                  "size-7 cursor-pointer rounded-full transition",
                  f.color === c ? "ring-2 ring-zinc-900 ring-offset-2" : "hover:scale-110",
                )}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="m-dept">Хэлтэс</label>
            <Select id="m-dept" className="field" value={f.department_id} onChange={(e) => set("department_id", e.target.value)}>
              <option value="">— Хэлтэсгүй —</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label" htmlFor="m-role">Эрхийн түвшин</label>
            <Select
              id="m-role"
              className="field"
              value={f.role}
              disabled={roleOptions.length < 2}
              onChange={(e) => set("role", e.target.value as Profile["role"])}
            >
              {roleOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-[11px] text-zinc-400">{ROLES.find((r) => r.id === f.role)?.hint}</p>
          </div>
          <div>
            <label className="label" htmlFor="m-active">Төлөв</label>
            <Select id="m-active" className="field" value={f.active ? "1" : "0"} onChange={(e) => set("active", e.target.value === "1")}>
              <option value="1">Ажиллаж байгаа</option>
              <option value="0">Идэвхгүй (гарсан)</option>
            </Select>
          </div>
          <div>
            <label className="label" htmlFor="m-tg">Telegram chat ID</label>
            <input
              id="m-tg"
              className="field"
              value={f.telegram_chat_id}
              onChange={(e) => set("telegram_chat_id", e.target.value)}
              placeholder="Bot-оор автоматаар холбогдоно"
            />
          </div>
        </div>

        <div className="rounded-lg border border-zinc-200 px-3 py-2.5">
          <span className="label mb-2">Өглөө бүр AI туслах өнөөдрийн ажлыг илгээх</span>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="size-4 accent-brand-600" checked={f.notify_email} onChange={(e) => set("notify_email", e.target.checked)} />
              Имэйлээр
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" className="size-4 accent-brand-600" checked={f.notify_telegram} onChange={(e) => set("notify_telegram", e.target.checked)} />
              Telegram-аар
            </label>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="m-note">Тэмдэглэл</label>
          <textarea id="m-note" className="field min-h-16 resize-y" value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Заавал биш" />
        </div>

        {!member && (
          <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-relaxed text-zinc-500">
            Ажилтанд <b>шууд ажил хариуцуулж болно</b> — нэвтрэх эрх хэрэггүй. Хожим тэр хүн <b>ижил имэйлээр</b> бүртгүүлэхэд
            энэ бүртгэлтэй автоматаар холбогдож, өөрийн ажлаа харна.
          </p>
        )}
        {member && confirmDelete && assigned > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Энэ хүн <b>{assigned}</b> дуусаагүй ажил хариуцаж байна. Устгавал тэр ажлууд <b>хариуцагчгүй</b> болно.
            Ажлаас гарсан бол устгахын оронд «Идэвхгүй» болгох нь зөв.
          </p>
        )}
        {!editable && (
          <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-500">Энэ ажилтны мэдээллийг засах эрх танд алга (зөвхөн хэлтсийн дарга, удирдлага).</p>
        )}
        {err && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      </form>
    </Modal>
  );
}
