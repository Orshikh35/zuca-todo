"use client";

import { Check, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Modal, Select } from "@/components/ui";
import { DEPARTMENT_COLORS, PROJECT_STATUSES } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { canDeleteProject } from "@/lib/permissions";
import type { Project, ProjectStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Төсөл үүсгэх / засах */
export function ProjectModal({ open, project, onClose }: { open: boolean; project?: Project | null; onClose: () => void }) {
  const { profiles, camps, me, createProject, updateProject, deleteProject, projectProgress } = useStore();
  const router = useRouter();
  const [f, setF] = useState(() => init());
  const [confirmDelete, setConfirmDelete] = useState(false);

  function init() {
    return {
      name: project?.name ?? "",
      description: project?.description ?? "",
      color: project?.color ?? DEPARTMENT_COLORS[Math.floor(Math.random() * DEPARTMENT_COLORS.length)],
      status: project?.status ?? ("active" as ProjectStatus),
      owner_id: project ? project.owner_id ?? "" : me?.id ?? "",
      camp_id: project?.camp_id ?? "",
      start_date: project?.start_date ?? "",
      due_date: project?.due_date ?? "",
    };
  }

  useEffect(() => {
    setF(init());
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project?.id]);

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    if (!f.name.trim()) return;
    const payload = {
      name: f.name.trim(),
      description: f.description.trim() || null,
      color: f.color,
      status: f.status,
      owner_id: f.owner_id || null,
      camp_id: f.camp_id || null,
      start_date: f.start_date || null,
      due_date: f.due_date || null,
    };
    if (project) {
      await updateProject(project.id, payload);
      onClose();
    } else {
      const p = await createProject(payload);
      onClose();
      if (p) router.push(`/projects/${p.id}`);
    }
  }

  const taskCount = project ? projectProgress(project.id).total : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={project ? "Төсөл засах" : "Шинэ төсөл"}
      footer={
        <>
          {project && canDeleteProject(me, project) && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                if (!confirmDelete) return setConfirmDelete(true);
                void deleteProject(project.id);
                onClose();
                router.push("/projects");
              }}
            >
              <Trash2 size={15} /> {confirmDelete ? "Тийм, устга" : "Устгах"}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Болих
          </Button>
          <Button variant="primary" onClick={() => void save()} disabled={!f.name.trim()}>
            {project ? "Хадгалах" : "Үүсгэх"}
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
        <input
          autoFocus
          className="w-full border-0 bg-transparent p-0 text-lg font-semibold outline-none placeholder:text-zinc-300"
          placeholder="Төслийн нэр — ж.нь Зуслангийн 100 жилийн хаалт"
          value={f.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <textarea
          className="field min-h-16 resize-y"
          placeholder="Зорилго, тайлбар (заавал биш)"
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
        />

        <div>
          <span className="label">Өнгө</span>
          <div className="flex flex-wrap gap-2">
            {DEPARTMENT_COLORS.map((c) => (
              <button
                type="button"
                key={c}
                onClick={() => set("color", c)}
                aria-label={c}
                className="grid size-8 cursor-pointer place-items-center rounded-full text-white transition hover:scale-110"
                style={{ background: c }}
              >
                {f.color === c && <Check size={14} strokeWidth={3} />}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Хариуцагч</label>
            <Select className="field" value={f.owner_id} onChange={(e) => set("owner_id", e.target.value)}>
              <option value="">— Хариуцагчгүй —</option>
              {profiles
                .filter((p) => p.active || p.id === project?.owner_id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                    {p.id === me?.id ? " (би)" : ""}
                  </option>
                ))}
            </Select>
          </div>
          <div>
            <label className="label">Төлөв</label>
            <Select className="field" value={f.status} onChange={(e) => set("status", e.target.value as ProjectStatus)}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label">Эхлэх</label>
            <input type="date" className="field" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </div>
          <div>
            <label className="label">Дуусах</label>
            <input type="date" className="field" value={f.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Холбоотой зуслан</label>
            <Select className="field" value={f.camp_id} onChange={(e) => set("camp_id", e.target.value)}>
              <option value="">— Байхгүй —</option>
              {[...camps]
                .sort((a, b) => a.name.localeCompare(b.name, "mn"))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          </div>
        </div>

        {confirmDelete && (
          <p className={cn("rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700")}>
            Төслийг устгахад доторх {taskCount} ажил устахгүй — зөвхөн төслөөс салж, Ажлууд хуудсанд хэвээр үлдэнэ.
          </p>
        )}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
