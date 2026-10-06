"use client";

import { CalendarClock, FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Donut } from "@/components/bento";
import { ProjectModal } from "@/components/projects/project-modal";
import { Avatar, Button, Card, Empty, PageHeader, Segmented } from "@/components/ui";
import { PROJECT_STATUSES } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { pctTone } from "@/lib/plan";
import type { Profile, Project } from "@/lib/types";
import { cn, dueLabel, isOverdue } from "@/lib/utils";

type Filter = "open" | "done" | "all";

export default function ProjectsPage() {
  const { projects, tasks, profileById, projectProgress } = useStore();
  const [filter, setFilter] = useState<Filter>("open");
  const [creating, setCreating] = useState(false);

  const list = useMemo(
    () =>
      projects.filter((p) => (filter === "all" ? true : filter === "done" ? p.status === "done" : p.status !== "done")),
    [projects, filter],
  );

  return (
    <>
      <PageHeader
        title="Төслүүд"
        subtitle="Том ажлыг төсөл болгож, доторх ажлууд нь хэдэн хувьтай хаагдаж байгааг харна"
        actions={
          <>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { id: "open", label: "Явагдаж буй" },
                { id: "done", label: "Хаагдсан" },
                { id: "all", label: "Бүгд" },
              ]}
            />
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={16} /> Шинэ төсөл
            </Button>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => (
          <ProjectCard
            key={p.id}
            project={p}
            progress={projectProgress(p.id)}
            overdue={tasks.filter((t) => t.project_id === p.id && isOverdue(t.due_date, t.status === "done")).length}
            people={Array.from(new Set(tasks.filter((t) => t.project_id === p.id && t.assignee_id).map((t) => t.assignee_id!)))
              .map((id) => profileById.get(id))
              .filter((x): x is Profile => !!x)}
            owner={p.owner_id ? profileById.get(p.owner_id) : undefined}
          />
        ))}
      </div>

      {!list.length && (
        <Card>
          <Empty
            icon={<FolderKanban size={30} />}
            title={filter === "done" ? "Хаагдсан төсөл алга" : "Төсөл үүсгээгүй байна"}
            hint={filter === "done" ? undefined : "«Шинэ төсөл» дарж эхлээрэй — ж.нь «Зуслангийн 100 жилийн хаалт»"}
          />
        </Card>
      )}

      <ProjectModal open={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function ProjectCard({
  project: p,
  progress,
  overdue,
  people,
  owner,
}: {
  project: Project;
  progress: { total: number; done: number; pct: number | null };
  overdue: number;
  people: Profile[];
  owner?: Profile;
}) {
  const st = PROJECT_STATUSES.find((s) => s.id === p.status)!;
  const due = p.status !== "done" ? dueLabel(p.due_date) : null;
  const tone = pctTone(progress.pct);

  return (
    <Link href={`/projects/${p.id}`} className="glass relative flex flex-col overflow-hidden rounded-[1.75rem] p-5 transition hover:-translate-y-0.5">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1.5" style={{ background: p.color }} />
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className={cn("rounded-full px-2 py-0.5 text-[10.5px] font-semibold", st.chip)}>{st.label}</span>
            {due && (
              <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium", due.tone === "overdue" ? "text-red-600" : "text-zinc-500")}>
                <CalendarClock size={11} /> {due.text}
              </span>
            )}
          </div>
          <h3 className="mt-2 line-clamp-2 text-[17px] leading-snug font-semibold tracking-tight">{p.name}</h3>
          {p.description && <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{p.description}</p>}
        </div>
        <Donut
          size={72}
          stroke={7}
          parts={[
            { label: "done", value: progress.done, color: p.color },
            { label: "open", value: progress.total - progress.done, color: "transparent" },
          ]}
          center={<span className="tabular text-sm font-semibold">{progress.pct == null ? "—" : `${progress.pct}%`}</span>}
        />
      </div>

      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
        <div className={cn("h-full rounded-full transition-all", tone.bar)} style={{ width: `${progress.pct ?? 0}%` }} />
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
        <span>
          <b className="tabular text-zinc-900">{progress.done}</b>/{progress.total} ажил хаагдсан
        </span>
        {overdue > 0 && <span className="font-medium text-red-600">· {overdue} хэтэрсэн</span>}
        <span className="ml-auto flex -space-x-1.5">
          {owner && !people.some((x) => x.id === owner.id) && <Avatar profile={owner} size={24} />}
          {people.slice(0, 5).map((x) => (
            <Avatar key={x.id} profile={x} size={24} />
          ))}
          {people.length > 5 && <span className="grid size-6 place-items-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-600">+{people.length - 5}</span>}
        </span>
      </div>
    </Link>
  );
}
