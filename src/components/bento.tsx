"use client";

/** Bento дизайны бүрэлдэхүүн: hero карт, tile, гарчиг, шүүлтүүрийн pill, pill баганат график, donut */
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ─────────── Өнгөт hero карт (гэрэл/харанхуй хоёуланд нь тод) ─────────── */
const HERO_TONES = {
  lime: "from-[#86ebc6] via-[#c2f27c] to-[#eef98f] shadow-[0_20px_50px_-24px_rgba(120,200,120,0.7)]",
  lavender: "from-[#d6cbff] via-[#b8a6ff] to-[#9d8bff] shadow-[0_20px_50px_-24px_rgba(140,110,255,0.7)]",
  peach: "from-[#ffd6a8] via-[#ffb0a0] to-[#ff94ad] shadow-[0_20px_50px_-24px_rgba(255,130,150,0.7)]",
  sky: "from-[#c4ecff] via-[#a7d3ff] to-[#9fb5ff] shadow-[0_20px_50px_-24px_rgba(110,160,255,0.7)]",
} as const;
export type HeroTone = keyof typeof HERO_TONES;

export function Hero({
  tone = "lime",
  title,
  value,
  unit,
  chips,
  actions,
  children,
  className,
}: {
  tone?: HeroTone;
  title: ReactNode;
  value?: ReactNode;
  unit?: ReactNode;
  chips?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br p-6 text-neutral-900 sm:p-7", HERO_TONES[tone], className)}>
      <div className="pointer-events-none absolute -right-16 -bottom-24 size-72 rotate-12 rounded-[3rem] bg-white/25" />
      <div className="pointer-events-none absolute right-24 -bottom-10 size-40 rotate-12 rounded-[2rem] bg-neutral-900/5" />
      <div className="relative flex h-full flex-col">
        <div className="text-[15px] font-medium">{title}</div>
        {value !== undefined && (
          <div className="mt-2 flex items-start gap-1">
            <span className="tabular text-5xl font-semibold tracking-tight sm:text-6xl">{value}</span>
            {unit && <span className="mt-2 text-sm font-medium opacity-70">{unit}</span>}
          </div>
        )}
        {chips && <div className="mt-3 flex flex-wrap gap-2 text-[13px]">{chips}</div>}
        {children}
        {actions && <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">{actions}</div>}
      </div>
    </section>
  );
}

/** Hero доторх цагаан хагас тунгалаг chip */
export function HeroChip({ children, onClick, active }: { children: ReactNode; onClick?: () => void; active?: boolean }) {
  const cls = cn("rounded-full px-2.5 py-1", active ? "bg-neutral-900 text-white" : "bg-white/50", onClick && "cursor-pointer hover:bg-white/80");
  return onClick ? (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  ) : (
    <span className={cls}>{children}</span>
  );
}

/** Hero доторх хар / цагаан pill товч */
export const heroBtn = {
  dark: "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full bg-neutral-900 px-5 text-sm font-medium text-white hover:bg-neutral-800",
  light: "inline-flex h-11 cursor-pointer items-center gap-1.5 rounded-full bg-white/90 px-5 text-sm font-medium text-neutral-900 hover:bg-white",
};

/* ─────────── Тоон tile ─────────── */
const TINTS = {
  emerald: "from-emerald-400/20",
  rose: "from-rose-400/20",
  violet: "from-violet-400/20",
  amber: "from-amber-400/20",
  sky: "from-sky-400/20",
  none: "from-transparent",
} as const;

export function Tile({
  title,
  value,
  caption,
  chip,
  tint = "none",
  icon,
  href,
  onClick,
  active,
  className,
  children,
}: {
  title: ReactNode;
  value: ReactNode;
  caption?: ReactNode;
  chip?: { text: string; tone: "good" | "bad" | "warn" | "info" } | null;
  tint?: keyof typeof TINTS;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  active?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const chipTone = { good: "bg-[#c6f36b]", bad: "bg-[#ff7b8f]", warn: "bg-[#ffc56b]", info: "bg-[#c9b8ff]" };
  const body = (
    <>
      <div className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent", TINTS[tint])} />
      <div className="relative flex flex-1 flex-col">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 text-[15px] leading-snug font-medium">{title}</div>
          {icon && <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-solid text-zinc-500 shadow-sm">{icon}</span>}
        </div>
        <div className="tabular mt-2 text-4xl font-semibold tracking-tight">{value}</div>
        {children}
        {(caption || chip) && (
          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <span className="text-xs text-zinc-500">{caption}</span>
            {chip && <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-neutral-900", chipTone[chip.tone])}>{chip.text}</span>}
          </div>
        )}
      </div>
    </>
  );
  const cls = cn(
    "glass relative flex min-w-0 flex-col overflow-hidden rounded-[1.75rem] p-5 text-left",
    (href || onClick) && "cursor-pointer transition hover:-translate-y-0.5",
    active && "ring-2 ring-neutral-900 dark:ring-white",
    className,
  );
  if (href)
    return (
      <Link href={href} className={cls}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={cls}>
        {body}
      </button>
    );
  return <section className={cls}>{body}</section>;
}

/* ─────────── Картын гарчиг ─────────── */
export function CardTitle({
  title,
  sub,
  pill,
  href,
  count,
  right,
}: {
  title: ReactNode;
  sub?: ReactNode;
  pill?: ReactNode;
  href?: string;
  count?: number;
  right?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-medium tracking-tight">
          {title}
          {count !== undefined && <sup className="ml-1 text-xs text-zinc-500">{count}</sup>}
        </h2>
        {sub && <p className="mt-0.5 text-xs text-zinc-500">{sub}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        {pill && <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600">{pill}</span>}
        {href && (
          <Link href={href} className="grid size-9 place-items-center rounded-full bg-surface-solid text-zinc-700 shadow-sm hover:text-zinc-900" aria-label="Дэлгэрэнгүй">
            <ArrowUpRight size={16} />
          </Link>
        )}
      </div>
    </div>
  );
}

/* ─────────── Шүүлтүүрийн pill ─────────── */
export function Pill({
  active,
  onClick,
  children,
  activeClass,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
  activeClass?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-xs font-medium transition",
        active ? (activeClass ?? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900") : "glass text-zinc-600 hover:text-zinc-900",
      )}
    >
      {children}
    </button>
  );
}

/** Шүүлтүүрийн мөр — гар утсанд хэвтээ гүйлгэнэ */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("scroll-thin -mx-3 mb-5 flex items-center gap-2 overflow-x-auto px-3 pb-1 sm:-mx-0 sm:flex-wrap sm:overflow-visible sm:px-0", className)}>{children}</div>;
}

/** Pill хэлбэрийн input/select-д */
export const pillField = "field h-9 w-auto rounded-full border-line bg-surface py-0 backdrop-blur";

export function PillBars({
  data,
  height = 168,
  format = (v: number) => String(v),
}: {
  data: { label: string; value: number; hint?: string; active?: boolean }[];
  height?: number;
  format?: (v: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-2 sm:gap-3" style={{ height: height + 22 }}>
      {data.map((d, i) => {
        const h = Math.max(28, Math.round((d.value / max) * height));
        return (
          <div key={i} className="group flex flex-1 flex-col items-center gap-1.5">
            <div
              title={d.hint}
              className={cn(
                "relative flex w-full items-end justify-center rounded-[1.1rem] pb-2.5 transition-all",
                d.active
                  ? "bg-gradient-to-b from-[#d9ccff] to-[#b9a3ff] text-neutral-900 shadow-[0_8px_24px_-8px_rgba(150,120,255,0.6)]"
                  : "bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200",
              )}
              style={{ height: h }}
            >
              <span className="tabular text-[11px] font-semibold">{format(d.value)}</span>
              {d.active && <span className="absolute -top-2 right-2 size-3.5 rounded-full border-[3px] border-white bg-[#b9a3ff] dark:border-neutral-900" />}
            </div>
            <span className="text-[11px] text-zinc-500">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function Donut({
  parts,
  size = 168,
  stroke = 18,
  center,
}: {
  parts: { label: string; value: number; color: string }[];
  size?: number;
  stroke?: number;
  center?: ReactNode;
}) {
  const total = parts.reduce((a, p) => a + p.value, 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = total && parts.filter((p) => p.value).length > 1 ? 6 : 0;
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-zinc-100" />
        {total > 0 &&
          parts
            .filter((p) => p.value > 0)
            .map((p) => {
              const len = (p.value / total) * c;
              const el = (
                <circle
                  key={p.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={p.color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={`${Math.max(0.01, len - gap)} ${c}`}
                  strokeDashoffset={-offset}
                />
              );
              offset += len;
              return el;
            })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>
    </div>
  );
}
