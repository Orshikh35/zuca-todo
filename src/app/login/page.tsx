"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";
import { SEED_PEOPLE } from "@/lib/seed-data";
import { getRepo } from "@/lib/data/store";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const repo = getRepo();
  const demo = repo.mode === "demo";
  const params = useSearchParams();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [email, setEmail] = useState(demo ? SEED_PEOPLE[0].email : "");
  const [password, setPassword] = useState(demo ? "demo1234" : "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (tab === "in") {
        await repo.signIn(email, password);
      } else {
        const { needsConfirm } = await repo.signUp(email, password, name);
        if (needsConfirm) {
          setMsg({ tone: "ok", text: "Имэйл рүү баталгаажуулах холбоос илгээлээ. Баталгаажуулаад нэвтэрнэ үү." });
          setBusy(false);
          return;
        }
      }
      window.location.href = params.get("next") || "/";
    } catch (err) {
      const m = err instanceof Error ? err.message : "Алдаа";
      setMsg({ tone: "error", text: m.includes("Invalid login") ? "Имэйл эсвэл нууц үг буруу байна" : m });
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Зүүн тал — брэнд */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-sky-400 via-brand-500 to-brand-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-24 -right-24 size-96 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute bottom-0 left-0 size-72 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="relative flex items-center gap-2.5 text-lg font-semibold">
          <img src="/icon.svg" alt="" className="size-9 rounded-xl ring-2 ring-white/30" />
          ZUCA Ops
        </div>
        <div className="relative max-w-md">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">
            Багийн ажил, зуслан, тайлан — нэг дор.
          </h1>
          <p className="mt-4 text-white/80">
            Яаралтай ажлаа эхэнд нь тавьж, Монголын бүх зуслангийн мэдээллийн дутууг нэг дороос хянаарай.
          </p>
          <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
            {[
              ["Kanban", "Чирж зөөх самбар"],
              ["Pipeline", "Зуслан татах явц"],
              ["Тайлан", "Долоо хоног бүр"],
            ].map(([a, b]) => (
              <div key={a} className="rounded-xl bg-white/10 p-3 ring-1 ring-white/20 backdrop-blur">
                <div className="font-semibold">{a}</div>
                <div className="text-xs text-white/70">{b}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-xs text-white/60">zuca.mn · дотоод хэрэгсэл</div>
      </div>

      {/* Баруун тал — форм */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src="/icon.svg" alt="" className="size-9 rounded-xl" />
            <span className="text-lg font-semibold">ZUCA Ops</span>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">{tab === "in" ? "Тавтай морил" : "Багт нэгдэх"}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {tab === "in" ? "Багийн бүртгэлээрээ нэвтэрнэ үү" : "Шинэ гишүүний бүртгэл үүсгэх"}
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-lg bg-zinc-200/60 p-0.5 text-sm font-medium">
            {(["in", "up"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn("h-8 cursor-pointer rounded-md transition", tab === t ? "bg-white shadow-card" : "text-zinc-500")}
              >
                {t === "in" ? "Нэвтрэх" : "Бүртгүүлэх"}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-3.5">
            {tab === "up" && (
              <div>
                <label className="label" htmlFor="name">Нэр</label>
                <input id="name" className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Жишээ: Номин" required />
              </div>
            )}
            <div>
              <label className="label" htmlFor="email">Имэйл</label>
              <input id="email" type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ner@zuca.mn" required autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="pw">Нууц үг</label>
              <input id="pw" type="password" className="field" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} autoComplete={tab === "in" ? "current-password" : "new-password"} />
            </div>

            {msg && (
              <div className={cn("rounded-lg px-3 py-2 text-sm", msg.tone === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700")}>
                {msg.text}
              </div>
            )}

            <Button variant="primary" className="h-10 w-full" disabled={busy}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <>{tab === "in" ? "Нэвтрэх" : "Бүртгүүлэх"} <ArrowRight size={16} /></>}
            </Button>
          </form>

          {demo && (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <b>Demo горим</b> — Supabase холбоогүй тул өгөгдөл зөвхөн энэ browser-т хадгалагдана. Дурын нууц үгээр нэвтэрч болно.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
