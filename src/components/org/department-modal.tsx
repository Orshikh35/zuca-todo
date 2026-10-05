"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Modal, Select } from "@/components/ui";
import { DEPARTMENT_COLORS } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import type { Department } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DepartmentModal({ dept, onClose }: { dept: Department | null; onClose: () => void }) {
  const { departments, profiles, createDepartment, updateDepartment, deleteDepartment, updateProfile } = useStore();
  const [f, setF] = useState(() => ({
    name: dept?.name ?? "",
    code: dept?.code ?? "",
    color: dept?.color ?? DEPARTMENT_COLORS[departments.length % DEPARTMENT_COLORS.length],
    description: dept?.description ?? "",
    head_id: dept?.head_id ?? "",
    parent_id: dept?.parent_id ?? "",
  }));
  const [confirm, setConfirm] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  const members = dept ? profiles.filter((p) => p.department_id === dept.id).length : 0;
  // Өөрийгөө эсвэл өөрийн дэд хэлтсийг эх болгохгүй
  const descendants = new Set<string>();
  if (dept) {
    const walk = (id: string) => {
      descendants.add(id);
      departments.filter((d) => d.parent_id === id).forEach((d) => walk(d.id));
    };
    walk(dept.id);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim()) return;
    const patch = {
      name: f.name.trim(),
      code: f.code.trim().toUpperCase() || null,
      color: f.color,
      description: f.description.trim() || null,
      head_id: f.head_id || null,
      parent_id: f.parent_id || null,
    };
    const saved = dept ? (await updateDepartment(dept.id, patch), { ...dept, ...patch }) : await createDepartment(patch);
    // Даргыг тухайн хэлтэст харьяалуулна
    const head = profiles.find((p) => p.id === patch.head_id);
    if (saved && head && head.department_id !== saved.id) {
      await updateProfile(head.id, { department_id: saved.id, ...(head.role === "member" ? { role: "manager" } : {}) });
    }
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={dept ? "Хэлтэс засах" : "Шинэ хэлтэс"}
      footer={
        <>
          {dept && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                if (!confirm) return setConfirm(true);
                void deleteDepartment(dept.id);
                onClose();
              }}
            >
              <Trash2 size={15} /> {confirm ? "Итгэлтэй байна уу?" : "Устгах"}
            </Button>
          )}
          <Button onClick={onClose}>Болих</Button>
          <Button type="submit" form="dept-form" variant="primary" disabled={!f.name.trim()}>
            {dept ? "Хадгалах" : "Нэмэх"}
          </Button>
        </>
      }
    >
      <form id="dept-form" onSubmit={save} className="space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-[1fr_120px]">
          <div>
            <label className="label" htmlFor="d-name">Нэр *</label>
            <input id="d-name" autoFocus className="field" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Санхүүгийн алба" />
          </div>
          <div>
            <label className="label" htmlFor="d-code">Код</label>
            <input id="d-code" className="field uppercase" value={f.code} onChange={(e) => set("code", e.target.value)} placeholder="FIN" maxLength={8} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="d-desc">Үүрэг, чиг үүрэг</label>
          <textarea id="d-desc" className="field min-h-16 resize-y" value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Юу хариуцдаг хэлтэс вэ" />
        </div>
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="d-head">Хэлтсийн дарга</label>
            <Select id="d-head" className="field" value={f.head_id} onChange={(e) => set("head_id", e.target.value)}>
              <option value="">— Томилоогүй —</option>
              {profiles
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                    {p.job_title ? ` · ${p.job_title}` : ""}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <label className="label" htmlFor="d-parent">Харьяалагдах</label>
            <Select id="d-parent" className="field" value={f.parent_id} onChange={(e) => set("parent_id", e.target.value)}>
              <option value="">— Дээд түвшин —</option>
              {departments
                .filter((d) => !descendants.has(d.id))
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </Select>
          </div>
        </div>
        <div>
          <span className="label">Өнгө</span>
          <div className="flex flex-wrap gap-1.5">
            {DEPARTMENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => set("color", c)}
                style={{ background: c }}
                aria-label={c}
                className={cn("size-7 cursor-pointer rounded-full transition", f.color === c ? "ring-2 ring-zinc-900 ring-offset-2" : "hover:scale-110")}
              />
            ))}
          </div>
        </div>
        {confirm && members > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Энэ хэлтэст <b>{members}</b> ажилтан байна. Устгавал тэд хэлтэсгүй болно — ажил, тайлан нь хэвээр үлдэнэ.
          </p>
        )}
      </form>
    </Modal>
  );
}
