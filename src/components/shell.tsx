"use client";

import {
  BarChart3,
  CalendarRange,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  LayoutGrid,
  Loader2,
  LogOut,
  Menu,
  MessagesSquare,
  Monitor,
  Moon,
  Sparkles,
  Sun,
  Tent,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useChatUnread } from "@/lib/chat/hooks";
import { completeness } from "@/lib/completeness";
import { ROLES } from "@/lib/constants";
import { resetDemo } from "@/lib/data/demo-repo";
import { useStore } from "@/lib/data/store";
import { atLeast } from "@/lib/permissions";
import { useTheme, type ThemePref } from "@/lib/theme";
import { cn, isOverdue } from "@/lib/utils";
import { Avatar } from "./ui";

type NavItem = { href: string; label: string; short: string; icon: typeof Users; badge?: number | string; tone?: string; mobile?: boolean };

export function Shell({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const { ready, me, mode, tasks, camps, deptById } = store;
  const path = usePathname();
  const router = useRouter();
  const [sheet, setSheet] = useState(false);
  const [collapsed, setCollapsedState] = useState(false);
  useEffect(() => {
    try {
      setCollapsedState(localStorage.getItem("zuca-sidebar") === "mini");
    } catch {}
  }, []);
  const setCollapsed = (v: boolean) => {
    setCollapsedState(v);
    try {
      localStorage.setItem("zuca-sidebar", v ? "mini" : "full");
    } catch {}
  };
  const chatUnread = useChatUnread(me?.id, mode === "supabase");

  // Нэг л удаа /login руу шилжүүлнэ (middleware-тэй эцэс төгсгөлгүй redirect үүсэхээс сэргийлнэ)
  const [bounced, setBounced] = useState(false);
  useEffect(() => {
    if (ready && !me && !bounced) {
      setBounced(true);
      router.replace(`/login?next=${encodeURIComponent(path)}`);
    }
  }, [ready, me, bounced, router, path]);
  useEffect(() => setSheet(false), [path]);

  if (!ready || !me) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 text-zinc-400">
        <Loader2 className="animate-spin" />
        {bounced && (
          <div className="max-w-sm text-center text-sm">
            <p className="text-zinc-600">Бүртгэлийг тань уншиж чадсангүй.</p>
            <a href="/login" className="mt-1 inline-block font-medium text-brand-600 hover:underline">
              Дахин нэвтрэх
            </a>
          </div>
        )}
      </div>
    );
  }

  const open = tasks.filter((t) => t.status !== "done");
  const mineUrgent = open.filter(
    (t) => t.assignee_id === me.id && (t.priority === "urgent" || isOverdue(t.due_date, false)),
  ).length;
  const incomplete = camps.filter((c) => c.stage !== "inactive" && !completeness(c).complete).length;
  const lead = atLeast(me, "manager");

  const nav: NavItem[] = [
    { href: "/", label: "Самбар", short: "Самбар", icon: LayoutGrid, mobile: true },
    { href: "/chat", label: "Чат", short: "Чат", icon: MessagesSquare, badge: chatUnread.total > 99 ? "99+" : chatUnread.total, tone: "bg-brand-500 text-white", mobile: true },
    { href: "/tasks", label: "Ажлууд", short: "Ажил", icon: CheckSquare, badge: mineUrgent, tone: "bg-red-500 text-white", mobile: true },
    { href: "/plan", label: "Төлөвлөгөө", short: "Төлөвлөгөө", icon: CalendarRange },
    { href: "/camps", label: "Зуслангууд", short: "Зуслан", icon: Tent, badge: lead ? incomplete : undefined, tone: "bg-amber-400 text-amber-950", mobile: true },
    ...(lead
      ? [
          { href: "/team", label: "Баг", short: "Баг", icon: Users },
          { href: "/reports", label: "Тайлан", short: "Тайлан", icon: BarChart3 },
        ]
      : []),
    { href: "/agent", label: "AI туслах", short: "AI", icon: Sparkles },
  ];
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const myDept = me.department_id ? deptById.get(me.department_id) : null;
  const roleLabel = `${ROLES.find((r) => r.id === me.role)?.label ?? ""}${myDept ? ` · ${myDept.name}` : ""}`;

  const groups: { title: string; items: NavItem[] }[] = [
    { title: "Ажил", items: nav.filter((n) => ["/", "/chat", "/tasks", "/plan", "/camps"].includes(n.href)) },
    ...(lead ? [{ title: "Удирдлага", items: nav.filter((n) => n.href === "/team" || n.href === "/reports") }] : []),
    { title: "Туслах", items: nav.filter((n) => n.href === "/agent") },
  ];

  return (
    <div className="min-h-dvh">
      {/* ── Desktop: хажуугийн цэс ── */}
      <aside
        className={cn(
          "glass fixed inset-y-3 left-3 z-40 hidden flex-col rounded-[1.75rem] p-3 transition-[width] duration-200 lg:flex",
          collapsed ? "w-[76px]" : "w-[248px]",
        )}
      >
        <div className={cn("flex items-center gap-2 pt-1 pb-4", collapsed ? "flex-col" : "px-1.5")}>
          <Link href="/" className="flex min-w-0 items-center gap-2.5" title="Самбар">
            <img src="/icon.svg" alt="" className="size-10 shrink-0 rounded-xl" />
            {!collapsed && (
              <span className="text-[19px] tracking-tight">
                <b className="font-semibold">zuca</b>
                <span className="font-light text-zinc-500">ops</span>
              </span>
            )}
          </Link>
          <button
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? "Цэсийг дэлгэх" : "Цэсийг хураах"}
            className={cn("grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900", !collapsed && "ml-auto")}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          </button>
        </div>

        <nav className="scroll-thin -mx-1 flex-1 space-y-4 overflow-y-auto px-1">
          {groups.map((g) => (
            <div key={g.title} className="space-y-1">
              {!collapsed && <div className="px-3 pb-0.5 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase">{g.title}</div>}
              {g.items.map((n) => {
                const on = isActive(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    title={collapsed ? n.label : undefined}
                    className={cn(
                      "relative flex h-11 items-center gap-3 rounded-full text-sm font-medium transition",
                      collapsed ? "justify-center" : "px-3.5",
                      on
                        ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900"
                        : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
                    )}
                  >
                    <n.icon size={18} className="shrink-0" />
                    {!collapsed && <span className="flex-1 truncate">{n.label}</span>}
                    {!!n.badge &&
                      (collapsed ? (
                        <span className={cn("absolute top-2 right-3 size-2 rounded-full", n.tone)} />
                      ) : (
                        <span className={cn("tabular rounded-full px-1.5 text-[10.5px] leading-[18px] font-semibold", n.tone)}>{n.badge}</span>
                      ))}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {!collapsed && !path.startsWith("/chat") && (
          <Link
            href="/chat"
            className="mb-3 block rounded-[1.25rem] bg-gradient-to-br from-[#d6cbff] to-[#9d8bff] p-3.5 text-neutral-900 transition hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles size={14} /> ZUCA AI
            </div>
            <p className="mt-1 text-[11px] leading-snug opacity-75">Чатад ажлаа бич — AI хариуцагч, хугацаатай нь бүртгээд Telegram-аар мэдэгдэнэ.</p>
          </Link>
        )}

        <div className={cn("flex items-center gap-2", collapsed ? "flex-col" : "")}>
          <ProfileMenu
            name={me.full_name}
            sub={roleLabel}
            demo={mode === "demo"}
            onSignOut={() => void store.signOut()}
            placement="up"
            className={cn(
              "flex min-w-0 cursor-pointer items-center gap-2.5 rounded-full text-left transition hover:bg-zinc-100",
              collapsed ? "p-0.5" : "flex-1 p-1 pr-2.5",
            )}
          >
            <Avatar profile={me} size={36} className="ring-0" />
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{me.full_name}</span>
                  <span className="block truncate text-[11px] text-zinc-500">{roleLabel}</span>
                </span>
                <ChevronsUpDown size={14} className="shrink-0 text-zinc-400" />
              </>
            )}
          </ProfileMenu>
          <ThemeButton />
        </div>
      </aside>

      {/* ── Утас, таблет: дээд мөр ── */}
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6 lg:hidden">
        <div className="glass flex h-14 items-center gap-3 rounded-full pr-2 pl-3">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <img src="/icon.svg" alt="" className="size-8 rounded-xl" />
            <span className="text-[18px] tracking-tight">
              <b className="font-semibold">zuca</b>
              <span className="font-light text-zinc-500">ops</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <ThemeButton />
            <ProfileMenu name={me.full_name} sub={roleLabel} demo={mode === "demo"} onSignOut={() => void store.signOut()}>
              <Avatar profile={me} size={40} className="ring-0" />
            </ProfileMenu>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "px-3 pt-5 pb-28 transition-[padding] duration-200 sm:px-6 lg:pt-6 lg:pr-6 lg:pb-6",
          // Хажуугийн цэс (left-3 + өргөн) + 28px зай
          collapsed ? "lg:pl-[116px]" : "lg:pl-[288px]",
        )}
      >
        <div className="max-w-[1680px]">{children}</div>
      </main>

      {/* ── Утасны доод цэс ── */}
      <nav className="glass fixed inset-x-3 bottom-3 z-40 flex items-center justify-around rounded-full p-1.5 lg:hidden">
        {nav
          .filter((n) => n.mobile)
          .map((n) => {
            const on = isActive(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium transition",
                  on ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-zinc-500",
                )}
              >
                <n.icon size={19} />
                {n.short}
                {!!n.badge && (
                  <span className={cn("tabular absolute top-1 right-[calc(50%-18px)] rounded-full px-1 text-[9px] leading-[14px] font-semibold", n.tone)}>
                    {n.badge}
                  </span>
                )}
              </Link>
            );
          })}
        <button
          onClick={() => setSheet(true)}
          className="flex h-12 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium text-zinc-500"
        >
          <Menu size={19} />
          Бусад
        </button>
      </nav>

      {sheet && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="animate-in absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setSheet(false)} />
          <div className="animate-pop absolute inset-x-3 bottom-3 rounded-[1.75rem] border border-line bg-surface-solid p-3 shadow-lift">
            <div className="flex items-center gap-3 px-2 pt-1 pb-3">
              <Avatar profile={me} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{me.full_name}</div>
                <div className="truncate text-xs text-zinc-500">{roleLabel}</div>
              </div>
              <button onClick={() => setSheet(false)} className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100" aria-label="Хаах">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {nav
                .filter((n) => !n.mobile)
                .map((n) => (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-sm font-medium",
                      isActive(n.href) ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "bg-zinc-100 text-zinc-700",
                    )}
                  >
                    <n.icon size={17} /> {n.label}
                  </Link>
                ))}
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 px-1">
              <ThemeSegment />
              <button
                onClick={() => void store.signOut()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut size={15} /> Гарах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Light / dark ─────────── */
function ThemeButton() {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={dark ? "Цайвар горим" : "Харанхуй горим"}
      aria-label="Горим солих"
      className="glass grid size-10 cursor-pointer place-items-center rounded-full text-zinc-600 transition hover:text-zinc-900"
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

const THEME_OPTIONS: { id: ThemePref; icon: typeof Sun; label: string }[] = [
  { id: "light", icon: Sun, label: "Цайвар" },
  { id: "dark", icon: Moon, label: "Харанхуй" },
  { id: "system", icon: Monitor, label: "Систем" },
];

function ThemeSegment() {
  const { pref, setPref } = useTheme();
  return (
    <div className="inline-flex rounded-full bg-zinc-100 p-1">
      {THEME_OPTIONS.map((o) => (
        <button
          key={o.id}
          onClick={() => setPref(o.id)}
          title={o.label}
          className={cn(
            "grid size-8 cursor-pointer place-items-center rounded-full transition",
            pref === o.id ? "bg-surface-solid text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800",
          )}
        >
          <o.icon size={15} />
        </button>
      ))}
    </div>
  );
}

/* ─────────── Профайл цэс ─────────── */
function ProfileMenu({
  name,
  sub,
  demo,
  onSignOut,
  children,
  placement = "down",
  className,
}: {
  name: string;
  sub: string;
  demo: boolean;
  onSignOut: () => void;
  children: React.ReactNode;
  placement?: "down" | "up";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", placement === "up" && className?.includes("flex-1") && "min-w-0 flex-1")}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(className ?? "block cursor-pointer rounded-full ring-2 ring-surface-solid", placement === "up" && "w-full")}
        aria-label="Профайл"
      >
        {children}
      </button>
      {open && (
        <div
          className={cn(
            "animate-pop absolute z-50 w-64 rounded-3xl border border-line bg-surface-solid p-2 shadow-lift",
            placement === "up" ? "bottom-full left-0 mb-2" : "top-12 right-0",
          )}
        >
          <div className="px-3 pt-2 pb-3">
            <div className="truncate font-semibold">{name}</div>
            <div className="truncate text-xs text-zinc-500">{sub}</div>
          </div>
          <div className="px-2 pb-2">
            <ThemeSegment />
          </div>
          <Link href="/agent" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-2xl px-3 py-2.5 text-sm hover:bg-zinc-100">
            <Sparkles size={15} className="text-zinc-400" /> Мэдэгдэл, Telegram
          </Link>
          {demo && (
            <button
              onClick={() => {
                resetDemo();
                window.location.href = "/login";
              }}
              className="flex w-full cursor-pointer items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm text-amber-700 hover:bg-amber-50"
            >
              Demo өгөгдлийг шинэчлэх
            </button>
          )}
          <button
            onClick={onSignOut}
            className="flex w-full cursor-pointer items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut size={15} /> Гарах
          </button>
        </div>
      )}
    </div>
  );
}
