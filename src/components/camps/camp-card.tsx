"use client";

import { Globe, MapPin, Phone } from "lucide-react";
import { OWNERSHIPS } from "@/lib/constants";
import { Progress } from "@/components/ui";
import { completeness, scoreTone } from "@/lib/completeness";
import { useStore } from "@/lib/data/store";
import type { Camp } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CampCard({ camp, onOpen, overlay }: { camp: Camp; onOpen?: (c: Camp) => void; overlay?: boolean }) {
  const { tasks } = useStore();
  const { score, missing } = completeness(camp);
  const tone = scoreTone(score);
  const own = OWNERSHIPS.find((o) => o.id === camp.ownership);
  const openTasks = tasks.filter((t) => t.camp_id === camp.id && t.status !== "done").length;

  return (
    <article
      onClick={() => !overlay && onOpen?.(camp)}
      className={cn(
        "cursor-grab rounded-xl border border-zinc-200/80 bg-white p-3 shadow-card transition select-none",
        !overlay && "hover:-translate-y-px hover:border-zinc-300 hover:shadow-md",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-[13.5px] leading-snug font-semibold text-zinc-900">{camp.name}</h4>
        <span className={cn("tabular shrink-0 text-xs font-semibold", tone.text)}>{score}%</span>
      </div>
      <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
        <span className="inline-flex min-w-0 items-center gap-1 truncate">
          <MapPin size={12} className="text-zinc-400" />
          {camp.aimag ?? <span className="text-red-500">Байршилгүй</span>}
          {camp.soum && <span className="text-zinc-400">· {camp.soum}</span>}
        </span>
        {camp.phone && (
          <span className="inline-flex items-center gap-1">
            <Phone size={11} className="text-zinc-400" />
            {camp.phone.split(",")[0]}
          </span>
        )}
      </div>
      <div className="mt-2.5">
        <Progress value={score} tone={tone.bar} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {camp.website?.includes("zuca.mn") && (
          <span className="inline-flex items-center gap-1 rounded bg-brand-50 px-1.5 py-px text-[10.5px] font-semibold text-brand-700 ring-1 ring-brand-200 ring-inset">
            <Globe size={10} /> zuca.mn
          </span>
        )}
        {own && <span className={cn("rounded px-1.5 py-px text-[10.5px] font-medium ring-1 ring-inset", own.chip)}>{own.short}</span>}
        {camp.capacity != null && <span className="text-[10.5px] text-zinc-400">{camp.capacity} хүүхэд</span>}
      </div>
      {missing.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {missing.slice(0, 3).map((m) => (
            <span key={m.key} className="rounded bg-amber-50 px-1.5 py-px text-[10.5px] font-medium text-amber-800 ring-1 ring-amber-200/70 ring-inset">
              {m.label}
            </span>
          ))}
          {missing.length > 3 && <span className="px-1 text-[10.5px] text-zinc-400">+{missing.length - 3}</span>}
        </div>
      )}
      {openTasks > 0 && (
        <div className="mt-2 text-[11px] font-medium text-brand-600">
          {openTasks} нээлттэй ажил
        </div>
      )}
    </article>
  );
}
