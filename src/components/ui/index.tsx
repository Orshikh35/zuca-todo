"use client";

import { X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { PRIORITIES } from "@/lib/constants";
import type { Profile, TaskPriority } from "@/lib/types";
import { cn, initials } from "@/lib/utils";

/* ─────────── Button ─────────── */
type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-600/20",
  secondary: "bg-white text-zinc-800 ring-1 ring-zinc-200 hover:bg-zinc-50 shadow-card",
  ghost: "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
  danger: "bg-white text-red-600 ring-1 ring-red-200 hover:bg-red-50",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        variants[variant],
        className,
      )}
    />
  );
}

/* ─────────── Segmented control ─────────── */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { id: T; label: string; icon?: ReactNode }[];
}) {
  return (
    <div className="inline-flex rounded-lg bg-zinc-200/60 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-3 text-sm font-medium transition",
            value === o.id ? "bg-white text-zinc-900 shadow-card" : "text-zinc-500 hover:text-zinc-800",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ─────────── Avatar ─────────── */
export function Avatar({ profile, size = 24, className }: { profile?: Profile | null; size?: number; className?: string }) {
  if (!profile) {
    return (
      <span
        title="Хариуцагчгүй"
        style={{ width: size, height: size }}
        className={cn("inline-flex shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-300 bg-white", className)}
      />
    );
  }
  return (
    <span
      title={profile.full_name}
      style={{ width: size, height: size, background: profile.color, fontSize: size * 0.42 }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white ring-2 ring-white", className)}
    >
      {initials(profile.full_name)}
    </span>
  );
}

/* ─────────── Priority ─────────── */
export function PriorityChip({ priority, compact }: { priority: TaskPriority; compact?: boolean }) {
  const p = PRIORITIES.find((x) => x.id === priority)!;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap ring-1 ring-inset", p.chip)}>
      <span className={cn("size-1.5 rounded-full", p.dot)} />
      {compact ? p.short : p.label}
    </span>
  );
}

/* ─────────── Modal ─────────── */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[8vh]">
      <div className="animate-in fixed inset-0 bg-zinc-950/30 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal className={cn("animate-pop relative w-full rounded-2xl bg-white shadow-lift", width)}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button onClick={onClose} className="cursor-pointer rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Хаах">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-zinc-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/* ─────────── Drawer ─────────── */
export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="animate-in absolute inset-0 bg-zinc-950/25" onClick={onClose} />
      <aside className="animate-slide absolute top-0 right-0 flex h-full w-full max-w-xl flex-col bg-white shadow-lift">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{title}</h2>
            {subtitle && <div className="mt-0.5 text-sm text-zinc-500">{subtitle}</div>}
          </div>
          <button onClick={onClose} className="cursor-pointer rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700" aria-label="Хаах">
            <X size={20} />
          </button>
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex items-center gap-2 border-t border-zinc-100 px-6 py-3">{footer}</div>}
      </aside>
    </div>
  );
}

function useEscape(active: boolean, fn: () => void) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && fn();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active, fn]);
}

/* ─────────── Misc ─────────── */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("min-w-0 rounded-2xl border border-zinc-200/70 bg-white shadow-card", className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Empty({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="mb-2 text-zinc-300">{icon}</div>
      <div className="text-sm font-medium text-zinc-600">{title}</div>
      {hint && <div className="mt-0.5 text-xs text-zinc-400">{hint}</div>}
    </div>
  );
}

export function Progress({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
      <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${Math.max(3, value)}%` }} />
    </div>
  );
}
