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
    <div className="grid min-h-screen gap-4 p-3 sm:p-4 lg:grid-cols-[1.1fr_1fr]">
      {/* Зүүн тал — bento брэнд */}
      <div className="hidden grid-cols-6 grid-rows-[auto_1fr_auto] gap-4 lg:grid">
        <div className="col-span-6 flex items-center gap-1.5 px-2 pt-2 text-xl tracking-tight">
          <b className="font-semibold">zuca</b>
          <span className="text-zinc-400">ops</span>
        </div>
        <div className="relative col-span-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#86ebc6] via-[#c2f27c] to-[#eef98f] p-10 text-neutral-900">
          <div className="pointer-events-none absolute -right-20 -bottom-28 size-96 rotate-12 rounded-[4rem] bg-white/25" />
          <div className="relative flex h-full max-w-md flex-col justify-end">
            <h1 className="text-[2.75rem] leading-[1.05] font-semibold tracking-tight">ZUCA-гийн ажил, зуслан — нэг дор.</h1>
            <p className="mt-4 text-neutral-900/70">
              Ажил чат, Telegram, zuca.mn-ээс автоматаар орж ирнэ. AI туслах өдрийг тань цэгцэлж, зуслангийн мэдээллийг орой бүр шинэчилнэ.
            </p>
          </div>
        </div>
        {[
          ["AI туслах", "Чатаас ажил үүсгэнэ", "from-[#c9b8ff] to-[#9d8bff]"],
          ["Telegram", "Шинэ ажил шууд ирнэ", "from-[#ffc29a] to-[#ff94ad]"],
          ["zuca.mn", "Орой бүр синк", "from-[#bfe3ff] to-[#8fb8ff]"],
        ].map(([a, b, tone]) => (
          <div key={a} className={`col-span-2 rounded-[1.75rem] bg-gradient-to-br p-5 text-neutral-900 ${tone}`}>
            <div className="text-[15px] font-semibold">{a}</div>
            <div className="mt-6 text-xs text-neutral-900/70">{b}</div>
          </div>
        ))}
      </div>

      {/* Баруун тал — форм */}
      <div className="glass flex items-center justify-center rounded-[2rem] p-6 sm:p-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-1.5 text-xl tracking-tight lg:hidden">
            <b className="font-semibold">zuca</b>
            <span className="text-zinc-400">ops</span>
          </div>
          <h2 className="text-3xl font-semibold tracking-tight">{tab === "in" ? "Тавтай морил" : "Багт нэгдэх"}</h2>
          <p className="mt-1 text-sm text-zinc-500">
            {tab === "in" ? "Багийн бүртгэлээрээ нэвтэрнэ үү" : "Шинэ гишүүний бүртгэл үүсгэх"}
          </p>

          <div className="mt-6 grid grid-cols-2 rounded-full bg-zinc-100 p-1 text-sm font-medium">
            {(["in", "up"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn("h-9 cursor-pointer rounded-full transition", tab === t ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-zinc-500")}
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

            <Button variant="primary" className="h-11 w-full" disabled={busy}>
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
