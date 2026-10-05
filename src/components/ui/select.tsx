"use client";

/**
 * Профайл цэс шиг харагдах dropdown. Native <select>-ийг шууд орлоно:
 * <Select value onChange={(e) => e.target.value}> <option/> <optgroup/> </Select>
 * Popover-ийг body руу portal-оор гаргадаг тул modal, drawer дотор тасрахгүй.
 */
import { Check, ChevronDown } from "lucide-react";
import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

interface Opt {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

function textOf(n: ReactNode): string {
  if (n == null || typeof n === "boolean") return "";
  if (typeof n === "string" || typeof n === "number") return String(n);
  if (Array.isArray(n)) return n.map(textOf).join("");
  if (isValidElement(n)) return textOf((n.props as { children?: ReactNode }).children);
  return "";
}

function collect(children: ReactNode, out: Opt[] = [], group?: string): Opt[] {
  Children.toArray(children).forEach((c) => {
    if (!isValidElement(c)) return;
    const p = c.props as { value?: string | number; children?: ReactNode; disabled?: boolean; label?: string };
    if (c.type === "option") {
      const label = textOf(p.children);
      out.push({ value: p.value !== undefined ? String(p.value) : label, label, disabled: p.disabled, group });
    } else if (c.type === "optgroup") collect(p.children, out, p.label);
    else collect(p.children, out, group); // Fragment г.м.
  });
  return out;
}

export function Select({
  value,
  onChange,
  children,
  className,
  id,
  title,
  disabled,
  placeholder,
  "aria-label": ariaLabel,
}: {
  value?: string | number | null;
  onChange?: (e: { target: { value: string } }) => void;
  children: ReactNode;
  className?: string;
  id?: string;
  title?: string;
  disabled?: boolean;
  placeholder?: string;
  "aria-label"?: string;
}) {
  const opts = useMemo(() => collect(children), [children]);
  const val = value == null ? "" : String(value);
  const current = opts.find((o) => o.value === val);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; up: boolean; maxH: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom;
    const up = below < 240 && r.top > below;
    const width = Math.max(r.width, 190);
    setPos({
      left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)),
      top: up ? r.top - 6 : r.bottom + 6,
      width: r.width,
      up,
      maxH: Math.max(160, Math.min(340, (up ? r.top : below) - 16)),
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !pop.current?.contains(t)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (!pop.current?.contains(e.target as Node)) place();
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open, place]);

  // Нээгдэхэд сонгосон мөрийг харагдуулна
  useEffect(() => {
    if (!open) return;
    setHi(opts.findIndex((o) => o.value === val));
    requestAnimationFrame(() => pop.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pick = (o: Opt) => {
    if (o.disabled) return;
    setOpen(false);
    if (o.value !== val) onChange?.({ target: { value: o.value } });
    btn.current?.focus();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const d = e.key === "ArrowDown" ? 1 : -1;
      let i = hi;
      for (let k = 0; k < opts.length; k++) {
        i = (i + d + opts.length) % opts.length;
        if (!opts[i].disabled) break;
      }
      setHi(i);
      pop.current?.querySelectorAll('[role="option"]')[i]?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open && hi >= 0) pick(opts[hi]);
      else setOpen(true);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      e.stopPropagation(); // modal хаагдахгүй
      setOpen(false);
    } else if (e.key === "Tab") setOpen(false);
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        id={id}
        title={title}
        aria-label={ariaLabel}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
        className={cn(
          className ?? "field",
          "inline-flex cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60",
          open && "border-brand-400 ring-3 ring-brand-100",
        )}
      >
        <span className={cn("min-w-0 truncate", !current && "text-zinc-400")}>{current?.label ?? placeholder ?? "Сонгох"}</span>
        <ChevronDown size={15} className={cn("shrink-0 text-zinc-400 transition-transform", open && "rotate-180")} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={pop}
            role="listbox"
            className="animate-pop scroll-thin fixed z-[200] overflow-y-auto overscroll-contain rounded-3xl border border-line bg-surface-solid p-2 shadow-lift"
            style={{
              left: pos.left,
              top: pos.up ? undefined : pos.top,
              bottom: pos.up ? window.innerHeight - pos.top : undefined,
              minWidth: Math.max(pos.width, 190),
              maxWidth: "min(24rem, calc(100vw - 16px))",
              maxHeight: pos.maxH,
            }}
          >
            {opts.map((o, i) => {
              const sel = o.value === val;
              const head = o.group && o.group !== opts[i - 1]?.group;
              return (
                <Fragment key={`${o.value}-${i}`}>
                  {head && <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">{o.group}</div>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={sel}
                    disabled={o.disabled}
                    onMouseEnter={() => setHi(i)}
                    onClick={() => pick(o)}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm text-zinc-800 transition-colors",
                      i === hi && "bg-zinc-100",
                      sel && "font-medium text-zinc-950",
                      o.disabled && "cursor-not-allowed opacity-40",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.label}</span>
                    {sel && <Check size={15} className="shrink-0" />}
                  </button>
                </Fragment>
              );
            })}
            {!opts.length && <div className="px-3 py-2.5 text-sm text-zinc-400">Сонголт алга</div>}
          </div>,
          document.body,
        )}
    </>
  );
}
