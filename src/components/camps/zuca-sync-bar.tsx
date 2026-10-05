"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import { useCallback } from "react";
import { Hero, HeroChip, heroBtn } from "@/components/bento";
import { useStore } from "@/lib/data/store";
import { atLeast } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { syncedLabel, useZucaLive, useZucaSyncNow } from "@/lib/zuca/hooks";

/** Зуслангийн хуудасны hero — zuca.mn-ээс хэзээ шинэчилсэн, ээлжийн дүүргэлт, «Одоо шинэчлэх» */
export function ZucaSyncBar({ className }: { className?: string }) {
  const { me, camps, refresh, toast } = useStore();
  const { sync, shifts, available, reload } = useZucaLive();
  const after = useCallback(() => Promise.all([reload(), refresh().catch(() => {})]), [reload, refresh]);
  const { busy, run } = useZucaSyncNow(after, toast);
  const lead = atLeast(me, "manager");
  const at = syncedLabel(sync?.at);
  const open = shifts.filter((s) => s.is_open && !s.is_day).length;
  const dayCount = shifts.filter((s) => s.is_open && s.is_day).length;
  const fill = sync?.upcoming.capacity ? Math.round((sync.upcoming.booked / sync.upcoming.capacity) * 100) : null;
  const onZuca = camps.filter((c) => c.zuca_id != null).length;

  return (
    <Hero
      tone="peach"
      className={className}
      title={
        <span className="flex items-center gap-2">
          zuca.mn дээрх зуслан <span className={cn("size-2 rounded-full", at ? "animate-pulse bg-emerald-600" : "bg-neutral-900/30")} />
        </span>
      }
      value={onZuca}
      unit={`/ ${camps.length} зуслан`}
      chips={
        !available ? (
          <HeroChip>Supabase-д schema v6-г ажиллуулсны дараа орой бүр шинэчилнэ</HeroChip>
        ) : (
          <>
            <HeroChip>🕘 {at ? `Сүүлд ${at}` : "Синк хийгдээгүй"}</HeroChip>
            <HeroChip>⛺ {open} хоноглох ээлж</HeroChip>
            {dayCount > 0 && <HeroChip>☀️ {dayCount} өдрийн ээлж</HeroChip>}
            {fill !== null && <HeroChip>📈 14 хоногт {fill}% дүүрсэн</HeroChip>}
            {sync && sync.missing.length > 0 && <HeroChip>⚠️ zuca.mn-д алга {sync.missing.length}</HeroChip>}
          </>
        )
      }
      actions={
        <>
          {lead && available && (
            <button onClick={() => void run()} disabled={busy} className={cn(heroBtn.dark, "disabled:opacity-60")}>
              <RefreshCw size={15} className={cn(busy && "animate-spin")} /> {busy ? "Татаж байна…" : "Одоо шинэчлэх"}
            </button>
          )}
          <a href="https://zuca.mn" target="_blank" rel="noreferrer" className={heroBtn.light}>
            zuca.mn нээх <ExternalLink size={14} />
          </a>
          <span className="text-xs opacity-60">Орой бүр 21:00-д автоматаар</span>
        </>
      }
    />
  );
}
