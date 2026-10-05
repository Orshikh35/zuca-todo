"use client";

import { AlertCircle, CheckCircle2, ExternalLink, ListPlus, PhoneCall, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { TaskModal, type TaskDraft } from "@/components/tasks/task-modal";
import { Avatar, Button, Drawer, PriorityChip, Progress, Select } from "@/components/ui";
import { AIMAGS, OWNERSHIPS, SEASONS, STAGES } from "@/lib/constants";
import { completeness, scoreTone } from "@/lib/completeness";
import { useStore } from "@/lib/data/store";
import type { Camp, CampSeason, CampStage, Task } from "@/lib/types";
import { cn, dueLabel, relativeTime } from "@/lib/utils";

type Form = Record<string, string | boolean>;

const TEXT_FIELDS = ["name", "aimag", "soum", "address", "contact_person", "phone", "email", "website", "facebook", "description", "notes", "owner_id", "register_no"] as const;
const NUM_FIELDS = ["lat", "lng", "age_min", "age_max", "capacity", "price_from", "photos_count", "founded_year", "distance_km"] as const;

function toForm(c?: Camp | null): Form {
  const f: Form = { stage: c?.stage ?? "lead", season: c?.season ?? "summer", has_contract: c?.has_contract ?? false, ownership: c?.ownership ?? "" };
  TEXT_FIELDS.forEach((k) => (f[k] = (c?.[k] as string | null) ?? ""));
  NUM_FIELDS.forEach((k) => (f[k] = c?.[k] != null ? String(c[k]) : ""));
  return f;
}

function fromForm(f: Form): Partial<Camp> {
  const out: Record<string, unknown> = { stage: f.stage, season: f.season, has_contract: f.has_contract, ownership: f.ownership || null };
  TEXT_FIELDS.forEach((k) => (out[k] = String(f[k]).trim() || null));
  NUM_FIELDS.forEach((k) => {
    const v = String(f[k]).trim();
    out[k] = v === "" ? (k === "photos_count" ? 0 : null) : Number(v);
  });
  out.name = out.name ?? "";
  return out as Partial<Camp>;
}

export function CampDrawer({ camp, open, onClose }: { camp?: Camp | null; open: boolean; onClose: () => void }) {
  const { createCamp, updateCamp, deleteCamp, tasks, createTask, profileById, profiles, toast } = useStore();
  const [f, setF] = useState<Form>(() => toForm(camp));
  const [taskModal, setTaskModal] = useState<{ task?: Task; draft?: TaskDraft } | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    setF(toForm(camp));
    setConfirmDel(false);
  }, [camp?.id, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = useMemo(() => ({ ...(camp ?? ({} as Camp)), ...fromForm(f) }) as Camp, [camp, f]);
  const { score, missing } = completeness(preview);
  const tone = scoreTone(score);
  const dirty = JSON.stringify(toForm(camp)) !== JSON.stringify(f);
  const related = camp ? tasks.filter((t) => t.camp_id === camp.id).sort((a, b) => Number(a.status === "done") - Number(b.status === "done")) : [];

  const set = (k: string, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    const data = fromForm(f);
    if (!data.name) return toast("Нэр оруулна уу", "error");
    if (camp) {
      await updateCamp(camp.id, data);
      toast("Хадгалагдлаа");
    } else {
      await createCamp({ ...(data as Camp), position: Date.now() });
      toast("Зуслан нэмэгдлээ");
      onClose();
    }
  }

  async function taskForMissing() {
    if (!camp) return;
    await createTask({
      title: `${camp.name}: дутуу мэдээлэл нөхөх`,
      description: `Дутуу: ${missing.map((m) => m.label).join(", ")}`,
      priority: camp.stage === "active" ? "urgent" : "high",
      camp_id: camp.id,
      tags: ["мэдээлэл"],
      position: Date.now(),
    });
    toast("Ажил үүсгэлээ");
  }

  const input = (k: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label className="label">{label}</label>
      <input className={cn("field", missingKeys.has(k) && "border-amber-300 bg-amber-50/40")} value={String(f[k])} onChange={(e) => set(k, e.target.value)} {...props} />
    </div>
  );
  const missingKeys = new Set(
    missing.flatMap((m) => ({ coords: ["lat", "lng"], age: ["age_min", "age_max"], price: ["price_from"], photos: ["photos_count"], contract: [] })[m.key] ?? [m.key]),
  );

  return (
    <>
      <Drawer
        open={open}
        onClose={taskModal ? () => {} : onClose}
        title={camp ? camp.name : "Шинэ зуслан"}
        subtitle={
          camp && (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Сүүлд засварласан: {relativeTime(camp.updated_at)}</span>
              {camp.website?.includes("zuca.mn") && (
                <a href={camp.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline">
                  zuca.mn дээр харах <ExternalLink size={12} />
                </a>
              )}
            </span>
          )
        }
        footer={
          <>
            {camp &&
              (confirmDel ? (
                <Button
                  variant="danger"
                  onClick={() => {
                    void deleteCamp(camp.id);
                    onClose();
                  }}
                >
                  Тийм, устгах
                </Button>
              ) : (
                <Button variant="ghost" onClick={() => setConfirmDel(true)} className="text-zinc-400 hover:text-red-600">
                  <Trash2 size={15} />
                </Button>
              ))}
            <div className="ml-auto flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Хаах
              </Button>
              <Button variant="primary" onClick={() => void save()} disabled={camp ? !dirty : false}>
                {camp ? "Хадгалах" : "Нэмэх"}
              </Button>
            </div>
          </>
        }
      >
        {/* Бүрэн байдал */}
        <div className={cn("rounded-xl border p-4", missing.length ? "border-amber-200 bg-amber-50/50" : "border-emerald-200 bg-emerald-50/50")}>
          <div className="flex items-center gap-3">
            {missing.length ? <AlertCircle size={18} className="text-amber-600" /> : <CheckCircle2 size={18} className="text-emerald-600" />}
            <div className="flex-1">
              <div className="text-sm font-semibold">{missing.length ? `${missing.length} мэдээлэл дутуу` : "Мэдээлэл бүрэн"}</div>
              <div className="mt-1.5 max-w-60">
                <Progress value={score} tone={tone.bar} />
              </div>
            </div>
            <span className={cn("tabular text-2xl font-semibold", tone.text)}>{score}%</span>
          </div>
          {missing.length > 0 && (
            <>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {missing.map((m) => (
                  <span key={m.key} className="rounded-md bg-surface px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                    {m.label}
                  </span>
                ))}
              </div>
              {camp && (
                <Button size="sm" className="mt-3" onClick={() => void taskForMissing()}>
                  <ListPlus size={14} /> Нөхөх ажил үүсгэх
                </Button>
              )}
            </>
          )}
        </div>

        {/* Pipeline */}
        <div className="mt-5">
          <span className="label">Төлөв</span>
          <div className="flex flex-wrap gap-1.5">
            {STAGES.map((s) => (
              <button
                key={s.id}
                onClick={() => set("stage", s.id as CampStage)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                  f.stage === s.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-zinc-200 text-zinc-600 hover:bg-zinc-50",
                )}
              >
                <span className={cn("size-2 rounded-full", s.dot)} />
                {s.label}
              </button>
            ))}
          </div>
          {camp && (
            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
              <PhoneCall size={13} />
              {camp.last_contacted_at ? <>Сүүлд холбогдсон: {relativeTime(camp.last_contacted_at)}</> : "Холбогдож байгаагүй"}
              <button
                className="cursor-pointer font-medium text-brand-600 hover:underline"
                onClick={() => void updateCamp(camp.id, { last_contacted_at: new Date().toISOString() }).then(() => toast("Тэмдэглэлээ"))}
              >
                Өнөөдөр холбогдсон
              </button>
            </div>
          )}
        </div>

        <Section title="Үндсэн">
          <div className="sm:col-span-2">{input("name", "Нэр *", { required: true })}</div>
          <div>
            <label className="label">Улирал</label>
            <Select className="field" value={String(f.season)} onChange={(e) => set("season", e.target.value as CampSeason)}>
              {SEASONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="label">Өмчийн хэлбэр</label>
            <Select className="field" value={String(f.ownership)} onChange={(e) => set("ownership", e.target.value)}>
              <option value="">— Тодорхойгүй —</option>
              {OWNERSHIPS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </div>
          {input("register_no", "Регистрийн дугаар")}
          {input("founded_year", "Байгуулагдсан он", { type: "number", min: 1900, max: 2100 })}
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" className="size-4 accent-brand-600" checked={Boolean(f.has_contract)} onChange={(e) => set("has_contract", e.target.checked)} />
            ZUCA-тай гэрээ байгуулсан
          </label>
          <div className="sm:col-span-2">
            <label className="label">ZUCA-гаас хариуцагч</label>
            <Select className="field" value={String(f.owner_id)} onChange={(e) => set("owner_id", e.target.value)}>
              <option value="">— Хариуцагчгүй —</option>
              {profiles.filter((p) => p.active || p.id === camp?.owner_id).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name}
                  {p.job_title ? ` · ${p.job_title}` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Тайлбар</label>
            <textarea
              className={cn("field min-h-24", missingKeys.has("description") && "border-amber-300 bg-amber-50/40")}
              value={String(f.description)}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Хөтөлбөр, онцлог (40+ тэмдэгт)"
            />
          </div>
        </Section>

        <Section title="Байршил">
          <div>
            <label className="label">Аймаг / хот</label>
            <Select className={cn("field", missingKeys.has("aimag") && "border-amber-300 bg-amber-50/40")} value={String(f.aimag)} onChange={(e) => set("aimag", e.target.value)}>
              <option value="">— Сонгох —</option>
              {AIMAGS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
          </div>
          {input("soum", "Сум / дүүрэг")}
          <div className="sm:col-span-2">{input("address", "Хаяг")}</div>
          {input("lat", "Өргөрөг (lat)", { type: "number", step: "any", placeholder: "47.92" })}
          {input("lng", "Уртраг (lng)", { type: "number", step: "any", placeholder: "106.91" })}
          {input("distance_km", "Суурин газраас зай (км)", { type: "number", step: "any", min: 0 })}
        </Section>

        <Section title="Холбоо барих">
          {input("contact_person", "Хариуцсан хүн")}
          {input("phone", "Утас", { inputMode: "tel" })}
          {input("email", "Имэйл", { type: "email" })}
          {input("facebook", "Facebook")}
          <div className="sm:col-span-2">{input("website", "Вэбсайт")}</div>
        </Section>

        <Section title="Хөтөлбөр">
          {input("age_min", "Нас (доод)", { type: "number", min: 0, max: 25 })}
          {input("age_max", "Нас (дээд)", { type: "number", min: 0, max: 25 })}
          {input("capacity", "Багтаамж (хүүхэд)", { type: "number", min: 0 })}
          {input("price_from", "Үнэ (₮-с эхэлнэ)", { type: "number", min: 0, step: 1000 })}
          {input("photos_count", "Зургийн тоо", { type: "number", min: 0 })}
        </Section>

        <Section title="Тэмдэглэл">
          <div className="sm:col-span-2">
            <textarea className="field min-h-20" value={String(f.notes)} onChange={(e) => set("notes", e.target.value)} placeholder="Уулзалт, яриа, дараагийн алхам…" />
          </div>
        </Section>

        {camp && (
          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Холбоотой ажлууд</h3>
              <Button size="sm" variant="ghost" onClick={() => setTaskModal({ draft: { camp_id: camp.id } })}>
                <Plus size={14} /> Ажил нэмэх
              </Button>
            </div>
            {related.length === 0 ? (
              <p className="rounded-lg border border-dashed border-zinc-200 p-4 text-center text-xs text-zinc-400">Ажил алга</p>
            ) : (
              <ul className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                {related.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => setTaskModal({ task: t })} className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left hover:bg-zinc-50">
                      <PriorityChip priority={t.priority} compact />
                      <span className={cn("flex-1 truncate text-sm", t.status === "done" && "text-zinc-400 line-through")}>{t.title}</span>
                      {t.status !== "done" && dueLabel(t.due_date) && (
                        <span className={cn("text-[11px]", dueLabel(t.due_date)!.tone === "overdue" ? "text-red-600" : "text-zinc-400")}>
                          {dueLabel(t.due_date)!.text}
                        </span>
                      )}
                      <Avatar profile={t.assignee_id ? profileById.get(t.assignee_id) : null} size={20} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Drawer>
      <TaskModal open={!!taskModal} task={taskModal?.task} draft={taskModal?.draft} onClose={() => setTaskModal(null)} />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-7">
      <legend className="mb-3 text-xs font-semibold tracking-wider text-zinc-400 uppercase">{title}</legend>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}
