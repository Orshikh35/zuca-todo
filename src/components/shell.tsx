"use client";

import { BarChart3, CalendarRange, CheckSquare, LayoutDashboard, Loader2, LogOut, Menu, Tent, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { completeness } from "@/lib/completeness";
import { useStore } from "@/lib/data/store";
import { resetDemo } from "@/lib/data/demo-repo";
import { cn, isOverdue } from "@/lib/utils";
import { Avatar } from "./ui";

export function Shell({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const { ready, me, mode, tasks, camps } = store;
  const path = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Нэг л удаа /login руу шилжүүлнэ. Эс бөгөөс middleware (session хүчинтэй гэж үзээд)
  // буцаагаад энд авчирч, хоёулаа эцэс төгсгөлгүй redirect хийж "уншиж байна" дээр гацна.
  const [bounced, setBounced] = useState(false);
  useEffect(() => {
    if (ready && !me && !bounced) {
      setBounced(true);
      router.replace(`/login?next=${encodeURIComponent(path)}`);
    }
  }, [ready, me, bounced, router, path]);

  useEffect(() => setMobileOpen(false), [path]);

  if (!ready || !me) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 text-zinc-400">
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

  const openTasks = tasks.filter((t) => t.status !== "done");
  const urgent = openTasks.filter((t) => t.priority === "urgent" || isOverdue(t.due_date, false)).length;
  const incomplete = camps.filter((c) => c.stage !== "inactive" && !completeness(c).complete).length;
  const unassigned = openTasks.filter((t) => !t.assignee_id).length;

  const nav = [
    { href: "/", label: "Самбар", icon: LayoutDashboard },
    { href: "/tasks", label: "Ажлууд", icon: CheckSquare, badge: urgent, badgeTone: "bg-red-500 text-white" },
    { href: "/plan", label: "Төлөвлөгөө", icon: CalendarRange },
    { href: "/camps", label: "Зуслангууд", icon: Tent, badge: incomplete, badgeTone: "bg-amber-100 text-amber-800" },
    { href: "/team", label: "Ажилчид", icon: Users, badge: unassigned, badgeTone: "bg-zinc-200 text-zinc-700" },
    { href: "/reports", label: "Тайлан", icon: BarChart3 },
  ];

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/" className="flex items-center gap-2.5 px-5 pt-5 pb-6">
        <img src="/icon.svg" alt="" className="size-8 rounded-lg" />
        <div>
          <div className="text-[15px] leading-tight font-semibold">ZUCA Ops</div>
          <div className="text-[11px] text-zinc-400">Багийн удирдлага</div>
        </div>
      </Link>

      <nav className="space-y-0.5 px-3">
        {nav.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
                active ? "bg-white text-zinc-900 shadow-card ring-1 ring-zinc-200/70" : "text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-900",
              )}
            >
              <n.icon size={18} className={active ? "text-brand-600" : "text-zinc-400 group-hover:text-zinc-600"} />
              <span className="flex-1">{n.label}</span>
              {!!n.badge && (
                <span className={cn("tabular rounded-full px-1.5 py-px text-[11px] font-semibold", n.badgeTone)}>{n.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto space-y-3 p-3">
        {mode === "demo" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[11px] leading-snug text-amber-800">
            <b>Demo горим</b> · өгөгдөл browser-т хадгалагдана.{" "}
            <button
              className="cursor-pointer font-semibold underline"
              onClick={() => {
                resetDemo();
                window.location.href = "/login";
              }}
            >
              Шинэчлэх
            </button>
          </div>
        )}
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
          <Avatar profile={me} size={30} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{me.full_name}</div>
            <div className="truncate text-[11px] text-zinc-400">{me.email}</div>
          </div>
          <button
            onClick={() => void store.signOut()}
            title="Гарах"
            className="cursor-pointer rounded-md p-1.5 text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-60 border-r border-zinc-200/70 bg-zinc-50/80 lg:block">{sidebar}</aside>

      {/* Mobile */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2 font-semibold">
          <img src="/icon.svg" alt="" className="size-7 rounded-lg" /> ZUCA Ops
        </div>
        <button onClick={() => setMobileOpen(true)} className="rounded-md p-1.5 hover:bg-zinc-100" aria-label="Цэс">
          <Menu size={20} />
        </button>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="animate-slide absolute inset-y-0 left-0 w-64 bg-zinc-50">
            <button onClick={() => setMobileOpen(false)} className="absolute top-5 right-3 p-1 text-zinc-400" aria-label="Хаах">
              <X size={18} />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <main className="lg:pl-60">
        <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
