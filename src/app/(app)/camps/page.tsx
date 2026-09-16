"use client";

import { ArrowDown, ArrowUp, Download, KanbanSquare, Plus, Search, Table2, Upload, X } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Board } from "@/components/board";
import { CampCard } from "@/components/camps/camp-card";
import { CampDrawer } from "@/components/camps/camp-drawer";
import { Button, Card, PageHeader, Progress, Segmented } from "@/components/ui";
import { AIMAGS, OWNERSHIPS, STAGES } from "@/lib/constants";
import { completeness, scoreTone } from "@/lib/completeness";
import { campsToCSV, csvToCamps, download } from "@/lib/csv";
import { useStore } from "@/lib/data/store";
import type { Camp, CampOwnership, CampStage } from "@/lib/types";
import { cn, relativeTime, todayISO } from "@/lib/utils";

type View = "pipeline" | "table";
type Fill = "all" | "missing" | "complete";
type SortKey = "name" | "stage" | "aimag" | "score" | "tasks" | "contacted" | "own" | "capacity";

export default function CampsPage() {
  const { camps, tasks, updateCamp, importCamps, toast } = useStore();
  const [view, setView] = useState<View>("pipeline");
  const [q, setQ] = useState("");
  const [aimag, setAimag] = useState("");
  const [fill, setFill] = useState<Fill>("all");
  const [stage, setStage] = useState<CampStage | "">("");
  const [own, setOwn] = useState<CampOwnership | "" | "__none">("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "score", dir: 1 });
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const scored = useMemo(
    () =>
      camps.map((c) => ({
        camp: c,
        ...completeness(c),
        openTasks: tasks.filter((t) => t.camp_id === c.id && t.status !== "done").length,
      })),
    [camps, tasks],
  );
  const scoreById = useMemo(() => new Map(scored.map((s) => [s.camp.id, s])), [scored]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return scored.filter((x) => {
      const c = x.camp;
      if (s && !`${c.name} ${c.contact_person ?? ""} ${c.phone ?? ""} ${c.soum ?? ""}`.toLowerCase().includes(s)) return false;
      if (aimag === "__none" ? c.aimag : aimag && c.aimag !== aimag) return false;
      if (fill === "missing" && x.complete) return false;
      if (fill === "complete" && !x.complete) return false;
      if (view === "table" && stage && c.stage !== stage) return false;
      if (own === "__none" ? c.ownership : own && c.ownership !== own) return false;
      return true;
    });
  }, [scored, q, aimag, fill, stage, view, own]);

  const sorted = useMemo(() => {
    const stageIdx = (s: CampStage) => STAGES.findIndex((x) => x.id === s);
    const val = (x: (typeof filtered)[number]): string | number => {
      switch (sort.key) {
        case "name": return x.camp.name;
        case "stage": return stageIdx(x.camp.stage);
        case "aimag": return x.camp.aimag ?? "яяя";
        case "score": return x.score;
        case "tasks": return x.openTasks;
        case "contacted": return x.camp.last_contacted_at ?? "";
        case "own": return OWNERSHIPS.findIndex((o) => o.id === x.camp.ownership) + (x.camp.ownership ? 0 : 99);
        case "capacity": return x.camp.capacity ?? -1;
      }
    };
    return [...filtered].sort((a, b) => {
      const va = val(a), vb = val(b);
      const r = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "mn");
      return r * sort.dir;
    });
  }, [filtered, sort]);

  const getColumn = useCallback((c: Camp) => c.stage, []);
  const onMove = useCallback(
    (c: Camp, to: string, position: number) => {
      const patch: Partial<Camp> = { stage: to as CampStage, position };
      if (to !== c.stage && c.stage === "lead") patch.last_contacted_at = new Date().toISOString();
      void updateCamp(c.id, patch);
    },
    [updateCamp],
  );

  async function onImport(file: File) {
    const text = await file.text();
    const { camps: rows, unknownHeaders } = csvToCamps(text);
    if (!rows.length) return toast("CSV-д 'name' эсвэл 'Нэр' багана олдсонгүй", "error");
    const existing = new Set(camps.map((c) => c.name.trim().toLowerCase()));
    const fresh = rows.filter((r) => !existing.has(r.name.trim().toLowerCase()));
    const n = await importCamps(fresh);
    const skipped = rows.length - fresh.length;
    toast(
      `${n} зуслан нэмэгдлээ` +
        (skipped ? ` · ${skipped} давхардсан` : "") +
        (unknownHeaders.length ? ` · танигдаагүй багана: ${unknownHeaders.join(", ")}` : ""),
    );
  }

  const active = camps.filter((c) => c.stage === "active").length;
  const missingCount = scored.filter((x) => !x.complete && x.camp.stage !== "inactive").length;
  const avg = scored.length ? Math.round(scored.reduce((s, x) => s + x.score, 0) / scored.length) : 0;
  const openCamp = openId ? camps.find((c) => c.id === openId) : null;

  const th = (key: SortKey, label: string, cls = "") => (
    <th className={cn("px-3 py-2.5 text-left font-medium", cls)}>
      <button
        className="inline-flex cursor-pointer items-center gap-1 hover:text-zinc-900"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}
      >
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );

  return (
    <>
      <PageHeader
        title="Зуслангууд"
        subtitle="МҮЗХ-ны жагсаалт (2026.05.28) + zuca.mn — ZUCA-д татах явц ба мэдээллийн бүрэн байдал"
        actions={
          <>
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { id: "pipeline", label: "Pipeline", icon: <KanbanSquare size={15} /> },
                { id: "table", label: "Хүснэгт", icon: <Table2 size={15} /> },
              ]}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
                e.target.value = "";
              }}
            />
            <Button onClick={() => fileRef.current?.click()} title="CSV багана: Нэр, Аймаг, Сум, Утас, Имэйл, Үнэ…">
              <Upload size={15} /> Импорт
            </Button>
            <Button
              onClick={() =>
                download(
                  `zuca-zuslan-${todayISO()}.csv`,
                  campsToCSV(sorted.map((x) => x.camp), (c) => {
                    const s = scoreById.get(c.id)!;
                    return { completeness: s.score, missing: s.missing.map((m) => m.label).join(" / ") };
                  }),
                )
              }
            >
              <Download size={15} /> Экспорт
            </Button>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus size={16} /> Зуслан нэмэх
            </Button>
          </>
        }
      />

      {/* Товч үзүүлэлт */}
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Нийт зуслан" value={camps.length} />
        <Stat label="ZUCA дээр идэвхтэй" value={active} hint={`${camps.length ? Math.round((active / camps.length) * 100) : 0}% нь`} />
        <Stat
          label="Мэдээлэл дутуу"
          value={missingCount}
          tone="text-amber-600"
          onClick={() => setFill(fill === "missing" ? "all" : "missing")}
          active={fill === "missing"}
          hint="Дарж шүүх"
        />
        <Stat label="Дундаж бүрэн байдал" value={`${avg}%`} bar={avg} />
      </div>

      {/* Шүүлтүүр */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={15} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-zinc-400" />
          <input className="field h-9 w-56 pl-8" placeholder="Нэр, утас, хүн…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select className="field h-9 w-auto py-0" value={aimag} onChange={(e) => setAimag(e.target.value)}>
          <option value="">Бүх аймаг</option>
          <option value="__none">— Байршилгүй —</option>
          {AIMAGS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select className="field h-9 w-auto py-0" value={own} onChange={(e) => setOwn(e.target.value as CampOwnership | "")}>
          <option value="">Бүх өмчийн хэлбэр</option>
          {OWNERSHIPS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label} ({camps.filter((c) => c.ownership === o.id).length})
            </option>
          ))}
          <option value="__none">— Тодорхойгүй —</option>
        </select>
        {view === "table" && (
          <select className="field h-9 w-auto py-0" value={stage} onChange={(e) => setStage(e.target.value as CampStage | "")}>
            <option value="">Бүх төлөв</option>
            {STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        <Segmented
          value={fill}
          onChange={setFill}
          options={[
            { id: "all", label: "Бүгд" },
            { id: "missing", label: "Дутуутай" },
            { id: "complete", label: "Бүрэн" },
          ]}
        />
        {(q || aimag || fill !== "all" || stage || own) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ("");
              setAimag("");
              setFill("all");
              setStage("");
              setOwn("");
            }}
          >
            <X size={14} /> Цэвэрлэх
          </Button>
        )}
        <span className="ml-auto text-xs text-zinc-400">{filtered.length} зуслан</span>
      </div>

      {view === "pipeline" ? (
        <Board
          columns={STAGES.map((s) => ({ id: s.id, label: s.label, hint: s.hint, dot: s.dot }))}
          items={filtered.map((x) => x.camp)}
          getColumn={getColumn}
          onMove={onMove}
          columnWidth="w-[280px] 2xl:w-[calc((100%-4rem)/5)] 2xl:min-w-[260px]"
          renderCard={(c, { overlay }) => <CampCard camp={c} overlay={overlay} onOpen={(x) => setOpenId(x.id)} />}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[1280px] text-sm">
              <thead className="border-b border-zinc-100 bg-zinc-50/70 text-xs text-zinc-500">
                <tr>
                  {th("name", "Нэр", "pl-5")}
                  {th("stage", "Төлөв")}
                  {th("aimag", "Байршил")}
                  {th("own", "Өмч")}
                  {th("capacity", "Хүчин чадал", "text-right")}
                  <th className="px-3 py-2.5 text-left font-medium">Холбоо барих</th>
                  {th("score", "Бүрэн байдал")}
                  <th className="px-3 py-2.5 text-left font-medium">Дутуу мэдээлэл</th>
                  {th("tasks", "Ажил", "text-right")}
                  {th("contacted", "Холбогдсон")}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {sorted.map(({ camp: c, score, missing, openTasks }) => {
                  const st = STAGES.find((s) => s.id === c.stage)!;
                  const tone = scoreTone(score);
                  return (
                    <tr key={c.id} onClick={() => setOpenId(c.id)} className="cursor-pointer transition hover:bg-zinc-50">
                      <td className="min-w-[230px] py-2.5 pr-3 pl-5 font-medium">
                        {c.name}
                        {c.website?.includes("zuca.mn") && (
                          <span className="ml-1.5 rounded bg-brand-50 px-1 py-px align-middle text-[10px] font-semibold text-brand-700">zuca.mn</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-zinc-600">
                          <span className={cn("size-2 rounded-full", st.dot)} />
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-zinc-600">
                        {c.aimag ?? <span className="text-red-500">—</span>}
                        {c.soum && <span className="text-zinc-400"> · {c.soum}</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {(() => {
                          const o = OWNERSHIPS.find((x) => x.id === c.ownership);
                          return o ? (
                            <span className={cn("rounded px-1.5 py-px text-[11px] font-medium ring-1 ring-inset", o.chip)}>{o.short}</span>
                          ) : (
                            <span className="text-zinc-300">—</span>
                          );
                        })()}
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-zinc-600">{c.capacity ?? <span className="text-zinc-300">—</span>}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap text-zinc-600">
                        <div>{c.contact_person ?? <span className="text-zinc-300">—</span>}</div>
                        <div className="tabular text-zinc-400">{c.phone?.split(",")[0]}</div>
                      </td>
                      <td className="w-40 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Progress value={score} tone={tone.bar} />
                          <span className={cn("tabular w-9 text-right text-xs font-semibold", tone.text)}>{score}%</span>
                        </div>
                      </td>
                      <td className="min-w-[260px] px-3 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {missing.length === 0 ? (
                            <span className="text-xs font-medium text-emerald-600">✓ Бүрэн</span>
                          ) : (
                            <>
                              {missing.slice(0, 4).map((m) => (
                                <span key={m.key} className="rounded bg-amber-50 px-1.5 py-px text-[11px] font-medium whitespace-nowrap text-amber-800">
                                  {m.label}
                                </span>
                              ))}
                              {missing.length > 4 && <span className="text-[11px] text-zinc-400">+{missing.length - 4}</span>}
                            </>
                          )}
                        </div>
                      </td>
                      <td className="tabular px-3 py-2.5 text-right text-zinc-600">{openTasks || <span className="text-zinc-300">0</span>}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap text-zinc-500">
                        {c.last_contacted_at ? relativeTime(c.last_contacted_at) : <span className="text-zinc-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-sm text-zinc-400">
                      Илэрц олдсонгүй
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CampDrawer open={!!openCamp || creating} camp={creating ? null : openCamp} onClose={() => (setOpenId(null), setCreating(false))} />
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
  bar,
  onClick,
  active,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: string;
  bar?: number;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-white p-4 text-left shadow-card transition",
        onClick && "cursor-pointer hover:border-zinc-300",
        active ? "border-amber-300 ring-4 ring-amber-100" : "border-zinc-200/70",
      )}
    >
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className={cn("mt-1 text-2xl font-semibold tracking-tight", tone)}>{value}</div>
      {bar != null ? (
        <div className="mt-2">
          <Progress value={bar} tone={scoreTone(bar).bar} />
        </div>
      ) : (
        hint && <div className="mt-0.5 text-[11px] text-zinc-400">{hint}</div>
      )}
    </Tag>
  );
}
