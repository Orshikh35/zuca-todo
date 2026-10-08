"use client";

import { Eraser, Lightbulb, Lock, MessageCircle, MousePointer2, Pencil, Plus, SendHorizontal, StickyNote, Trash2, Trophy, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Segmented } from "@/components/ui";
import { IDEA_ANIMALS, IDEA_COLORS, IDEA_EMOJIS, IDEA_EMOJIS_PINNED, IDEA_STAMPS } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { isAdmin } from "@/lib/permissions";
import type { Idea, IdeaComment, IdeaSticker } from "@/lib/types";
import { cn, relativeTime, uid } from "@/lib/utils";

const NOTE_W = 224;
const NOTE_H = 170;
/** Чирэлт эхлэхээс өмнөх зай — товшилтыг чирэлт гэж андуурахгүй */
const DRAG_START = 4;
/** Доод мөрөнд шууд харагдах тамга */
const STAMPS_PINNED = 3;
const PEN_WIDTH = 4;
/** «ink» — горимоос хамаарч хар/цагаан */
const PEN_COLORS = ["ink", "#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7"];
const COMMENT_CURSOR = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><path d='M2 26V13A11 11 0 0 1 13 2h2a11 11 0 0 1 0 22H8z' fill='%23111' stroke='white' stroke-width='2'/></svg>") 2 26, crosshair`;

type View = "board" | "top";
type Tool = "select" | "pen" | "eraser" | "comment";
/** Чирэх зүйл: шинэ наалт, стикер (stickerId байвал наасан стикерийг зөөж байна) */
type DockItem = { kind: "note"; color: string } | { kind: "emoji"; emoji: string; stickerId?: string };
/** Хадгалагдаагүй шинэ наалт */
type Draft = { x: number; y: number; color: string };
/** Самбар дээрх байрлал: наалт дээр бол idea_id-тай, x/y нь наалтаас */
type Spot = { idea_id: string | null; x: number; y: number };
type Line = { id: string; points: [number, number][]; color: string };

const colorOf = (id: string) => IDEA_COLORS.find((c) => c.id === id) ?? IDEA_COLORS[0];
const stampOf = (v: string) => IDEA_STAMPS.find((s) => s.text === v);
const inkOf = (c: string) => (c === "ink" ? "var(--color-ink)" : c);

function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}
/** Наалт бүр бага зэрэг хазгай — id-аас тогтвортой тооцно */
const tiltOf = (id: string) => ((hash(id) % 5) - 2) * 0.6;
/** Сэтгэгдэл бичсэн хүний нэргүй хоч — нэг thread дотор тогтмол, thread бүрт өөр */
const aliasOf = (profileId: string | null, threadId: string) => IDEA_ANIMALS[hash(`${profileId ?? "?"}:${threadId}`) % IDEA_ANIMALS.length];

/** Зураасыг зөөлөн муруй болгоно */
function pathOf(pts: [number, number][]) {
  if (!pts.length) return "";
  if (pts.length < 3) return `M${pts[0][0]},${pts[0][1]} L${pts[pts.length - 1][0]},${pts[pts.length - 1][1]}`;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    d += ` Q${x},${y} ${(x + nx) / 2},${(y + ny) / 2}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return `${d} L${lx},${ly}`;
}

/** Дэлгэцийн цэг дээр юу байна: самбар уу (цэс, хэрэгслийн мөр биш), аль наалт */
function hitAt(cx: number, cy: number, board: HTMLElement | null) {
  const els = document.elementsFromPoint(cx, cy);
  const inBoard = !!els[0] && !!board?.contains(els[0]);
  const note = inBoard ? els.map((el) => el.closest<HTMLElement>("[data-idea-id]")).find(Boolean) ?? null : null;
  return { inBoard, note };
}

export default function IdeasPage() {
  const store = useStore();
  const { me, ideas, ideaComments, ideaStickers, ideaStrokes, createIdea, updateIdea, createSticker, updateSticker, deleteSticker, toast } = store;
  const [view, setView] = useState<View>("board");
  const [tool, setToolState] = useState<Tool>("select");
  const [penColor, setPenColor] = useState(PEN_COLORS[0]);
  const [color, setColor] = useState(IDEA_COLORS[0].id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  // Сүүлд хөдөлгөсөн наалт дээрээ гарна
  const [front, setFront] = useState<string[]>([]);
  // Нээлттэй сэтгэгдлийн thread ("new" — дөнгөж тавьж буй бөмбөлөг)
  const [openThread, setOpenThread] = useState<string | null>(null);
  const [newPin, setNewPin] = useState<Spot | null>(null);
  // Зурж буй болон хадгалагдаж буй зураас
  const [live, setLive] = useState<Line | null>(null);
  const [pending, setPending] = useState<Line[]>([]);
  const scroller = useRef<HTMLDivElement>(null);
  const pad = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  // Чирж буй зүйл (заагчийг дагана), стикер буух гэж буй санаа, зөөж буй стикер
  const [ghost, setGhost] = useState<{ x: number; y: number; item: DockItem } | null>(null);
  const [dropOn, setDropOn] = useState<string | null>(null);
  const [movingSticker, setMovingSticker] = useState<string | null>(null);

  const setTool = (t: Tool) => {
    setToolState(t);
    setOpenThread(null);
    setNewPin(null);
    if (t !== "select") setView("board");
  };

  // Товчлол: V — сонгох, P — үзэг, E — баллуур, C — сэтгэгдэл, Esc — болих
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, [contenteditable]")) return;
      const map: Record<string, Tool> = { v: "select", p: "pen", e: "eraser", c: "comment", escape: "select" };
      const next = map[e.key.toLowerCase()];
      if (next) setTool(next);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Бөмбөлөг (thread-ийн эхний сэтгэгдэл) ба хариултууд
  const { roots, replies } = useMemo(() => {
    const rs: IdeaComment[] = [];
    const m = new Map<string, IdeaComment[]>();
    for (const c of [...ideaComments].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      if (c.thread_id) m.set(c.thread_id, [...(m.get(c.thread_id) ?? []), c]);
      else rs.push(c);
    }
    return { roots: rs, replies: m };
  }, [ideaComments]);

  // Наалт дээрх стикер, бөмбөлөг наалттайгаа хамт; бусад нь самбар дээр чөлөөтэй
  const { freeStickers, stickersByIdea } = useMemo(() => {
    const free: IdeaSticker[] = [];
    const m = new Map<string, IdeaSticker[]>();
    for (const st of [...ideaStickers].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      if (!st.idea_id) free.push(st);
      else m.set(st.idea_id, [...(m.get(st.idea_id) ?? []), st]);
    }
    return { freeStickers: free, stickersByIdea: m };
  }, [ideaStickers]);
  const pinsOn = (ideaId: string | null) => roots.filter((r) => r.idea_id === ideaId);

  const ordered = useMemo(() => {
    const rank = (id: string) => front.indexOf(id);
    return [...ideas].sort((a, b) => rank(a.id) - rank(b.id) || a.created_at.localeCompare(b.created_at));
  }, [ideas, front]);

  // Топ: наалт дээрх стикер + сэтгэгдлийн тоогоор
  const score = (id: string) =>
    (stickersByIdea.get(id)?.length ?? 0) + pinsOn(id).reduce((n, r) => n + 1 + (replies.get(r.id)?.length ?? 0), 0);
  const top = [...ideas].sort((a, b) => score(b.id) - score(a.id) || b.created_at.localeCompare(a.created_at));

  // Самбар агуулгаасаа үргэлж том — баруун, доош нь чөлөөтэй тэлнэ
  const width = Math.max(2400, ...ideas.map((i) => i.x + NOTE_W + 400), ...freeStickers.map((x) => x.x + 400));
  const height = Math.max(1500, ...ideas.map((i) => i.y + NOTE_H + 400), ...freeStickers.map((x) => x.y + 400));

  const raise = (id: string) => setFront((f) => [...f.filter((x) => x !== id), id]);
  const jitter = () => Math.round(Math.random() * 60 - 30);

  /** Харагдаж буй хэсгийн (хажуугийн цэс, хэрэгслийн мөрөөс гадуурх) гол — самбарын координатаар */
  function visibleCenter() {
    const el = scroller.current;
    const cv = view === "board" ? canvas.current : null;
    if (!el || !cv || !pad.current) return null;
    const st = getComputedStyle(pad.current);
    const s = el.getBoundingClientRect();
    const c = cv.getBoundingClientRect();
    return {
      x: s.left + (parseFloat(st.paddingLeft) + el.clientWidth) / 2 - c.left,
      y: s.top + (parseFloat(st.paddingTop) + el.clientHeight) / 2 - c.top,
    };
  }

  /** Дэлгэцийн цэг самбарын аль хэсэгт буух вэ: наалт дээр бол түүнд, үгүй бол самбар дээр */
  function spotAt(cx: number, cy: number): Spot | null {
    const { inBoard, note } = hitAt(cx, cy, scroller.current);
    if (!inBoard) return null;
    if (note) {
      const r = note.getBoundingClientRect();
      return { idea_id: note.dataset.ideaId!, x: Math.round(cx - r.left), y: Math.round(cy - r.top) };
    }
    const cv = canvas.current;
    if (!cv) return null;
    const c = cv.getBoundingClientRect();
    return { idea_id: null, x: Math.max(0, Math.round(cx - c.left)), y: Math.max(0, Math.round(cy - c.top)) };
  }

  function addAtCenter(noteColor = color) {
    const c = visibleCenter();
    const x = c ? c.x - NOTE_W / 2 : 40;
    const y = c ? c.y - NOTE_H / 2 : 40;
    setView("board");
    setEditing(null);
    setDraft({ x: Math.max(16, Math.round(x) + jitter()), y: Math.max(16, Math.round(y) + jitter()), color: noteColor });
  }

  /** Чирэх: наалтыг самбар дээр, стикерийг хаана ч хамаагүй наана. Товшвол харагдаж буй хэсгийн голд гарна. */
  function startDockDrag(e: React.PointerEvent, item: DockItem) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const sx = e.clientX;
    const sy = e.clientY;
    let moved = false;

    const finish = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", finish);
      setGhost(null);
      setDropOn(null);
      setMovingSticker(null);
    };
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < DRAG_START) return;
      if (!moved && item.kind === "emoji" && item.stickerId) setMovingSticker(item.stickerId);
      moved = true;
      setGhost({ x: ev.clientX, y: ev.clientY, item });
      if (item.kind === "emoji") setDropOn(hitAt(ev.clientX, ev.clientY, scroller.current).note?.dataset.ideaId ?? null);
    };
    const up = (ev: PointerEvent) => {
      finish();
      if (item.kind === "emoji") {
        if (!moved) {
          if (item.stickerId) return;
          // Товшсон: харагдаж буй хэсгийн голд наана
          const c = visibleCenter();
          if (!c) return toast(`${item.emoji}-г санаан дээр чирж наана уу`);
          void createSticker({
            emoji: item.emoji,
            idea_id: null,
            x: Math.max(0, Math.round(c.x) + jitter() * 3),
            y: Math.max(0, Math.round(c.y) + jitter() * 2),
            created_by: me?.id ?? null,
          });
          return;
        }
        const spot = spotAt(ev.clientX, ev.clientY);
        if (!spot) return;
        if (item.stickerId) void updateSticker(item.stickerId, spot);
        else void createSticker({ emoji: item.emoji, ...spot, created_by: me?.id ?? null });
        return;
      }

      setColor(item.color);
      if (!moved) return addAtCenter(item.color);
      // Наалт: зөвхөн самбар дээр (хажуугийн цэс, хэрэгслийн мөр биш)
      const cv = canvas.current;
      if (!cv || !hitAt(ev.clientX, ev.clientY, scroller.current).inBoard) return;
      const c = cv.getBoundingClientRect();
      setEditing(null);
      setDraft({
        x: Math.max(0, Math.round(ev.clientX - c.left - NOTE_W / 2)),
        y: Math.max(0, Math.round(ev.clientY - c.top - 14)),
        color: item.color,
      });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", finish);
  }

  /** Үзгээр зурах — самбарын координатаар цэгүүдийг цуглуулна */
  function startPen(e: React.PointerEvent) {
    if (e.button !== 0 || !canvas.current) return;
    e.preventDefault();
    const cv = canvas.current;
    const at = (ev: { clientX: number; clientY: number }): [number, number] => {
      const c = cv.getBoundingClientRect();
      return [Math.round(ev.clientX - c.left), Math.round(ev.clientY - c.top)];
    };
    const id = uid();
    const strokeColor = penColor;
    const pts: [number, number][] = [at(e)];
    setLive({ id, points: pts, color: strokeColor });

    const move = (ev: PointerEvent) => {
      const p = at(ev);
      const l = pts[pts.length - 1];
      if (Math.hypot(p[0] - l[0], p[1] - l[1]) < 2) return;
      pts.push(p);
      setLive({ id, points: [...pts], color: strokeColor });
    };
    const up = async () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      // Нэг товшилт — цэг
      if (pts.length === 1) pts.push([pts[0][0] + 1, pts[0][1]]);
      const line = { id, points: pts, color: strokeColor };
      setLive(null);
      setPending((p) => [...p, line]);
      await store.createStroke({ points: pts, color: strokeColor, width: PEN_WIDTH });
      setPending((p) => p.filter((x) => x.id !== id));
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  /** Сэтгэгдлийн хэрэгсэл: дарсан газарт шинэ бөмбөлөг тавина */
  function placeComment(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    const spot = spotAt(e.clientX, e.clientY);
    setToolState("select");
    if (!spot) return;
    if (spot.idea_id) raise(spot.idea_id);
    setNewPin(spot);
    setOpenThread("new");
  }

  async function saveDraft(body: string) {
    const d = draft;
    setDraft(null);
    if (!d || !body.trim()) return;
    const created = await createIdea({ body: body.trim(), color: d.color, x: d.x, y: d.y, created_by: me?.id ?? null });
    if (created) raise(created.id);
  }

  function startDrag(e: React.PointerEvent, idea: Idea) {
    raise(idea.id);
    if (e.button !== 0 || editing === idea.id) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, textarea, a, [data-nodrag]")) return;
    // Утсан дээр зөвхөн дээд бариулаас чирнэ — бусад хэсгээр самбараа гүйлгэнэ
    if (e.pointerType === "touch" && !target.closest("[data-handle]")) return;

    const startX = e.clientX;
    const startY = e.clientY;
    let moved = false;
    let last = { x: idea.x, y: idea.y };

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && Math.hypot(dx, dy) < DRAG_START) return;
      moved = true;
      last = { x: Math.max(0, Math.round(idea.x + dx)), y: Math.max(0, Math.round(idea.y + dy)) };
      setDrag({ id: idea.id, ...last });
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      setDrag(null);
      if (moved && (last.x !== idea.x || last.y !== idea.y)) void updateIdea(idea.id, last);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  }

  const renderSticker = (st: IdeaSticker) => (
    <Sticker
      key={st.id}
      sticker={st}
      hidden={movingSticker === st.id}
      canMove={!!me && (st.created_by === me.id || isAdmin(me))}
      onPointerDown={(e) => startDockDrag(e, { kind: "emoji", emoji: st.emoji, stickerId: st.id })}
      onDelete={() => void deleteSticker(st.id)}
    />
  );

  /** Тухайн газрын (наалт эсвэл самбар) сэтгэгдлийн бөмбөлгүүд */
  const renderPins = (ideaId: string | null) => {
    const idea = ideaId ? ideas.find((i) => i.id === ideaId) ?? null : null;
    return (
      <>
        {pinsOn(ideaId).map((root) => (
          <Pin
            key={root.id}
            spot={root}
            root={root}
            replies={replies.get(root.id) ?? []}
            idea={idea}
            open={openThread === root.id}
            onToggle={() => {
              if (ideaId) raise(ideaId);
              setOpenThread((o) => (o === root.id ? null : root.id));
            }}
            onClose={() => setOpenThread((o) => (o === root.id ? null : o))}
          />
        ))}
        {newPin && newPin.idea_id === ideaId && (
          <Pin
            spot={newPin}
            root={null}
            replies={[]}
            idea={idea}
            open={openThread === "new"}
            onToggle={() => {}}
            onClose={() => {
              setNewPin(null);
              setOpenThread((o) => (o === "new" ? null : o));
            }}
            onCreated={(id) => {
              setNewPin(null);
              setOpenThread(id);
            }}
          />
        )}
      </>
    );
  };

  const stuff = (idea: Idea) => (
    <>
      {stickersByIdea.get(idea.id)?.map(renderSticker)}
      {renderPins(idea.id)}
    </>
  );

  // Нээлттэй thread-тэй наалт бусдаасаа дээр гарна — цонх нь хөршийн доор орохгүй
  const openOn = openThread === "new" ? newPin?.idea_id : roots.find((r) => r.id === openThread)?.idea_id;
  const lines: Line[] = [...ideaStrokes, ...pending, ...(live ? [live] : [])];
  const canErase = (s: Line) => {
    const row = ideaStrokes.find((x) => x.id === s.id);
    return !!row && !!me && (row.created_by === me.id || isAdmin(me));
  };

  return (
    <>
      {/* Самбар бүх дэлгэцийг эзэлнэ — хажуугийн цэс, хэрэгслийн мөр дээгүүр нь хөвнө */}
      <div
        ref={scroller}
        className="scroll-thin fixed inset-0 overflow-auto overscroll-contain"
        style={
          view === "board"
            ? {
                backgroundImage: "radial-gradient(circle, rgb(120 120 140 / 0.28) 1px, transparent 1.2px)",
                backgroundSize: "24px 24px",
                backgroundAttachment: "local",
              }
            : undefined
        }
      >
        <div
          ref={pad}
          className={cn(
            "pt-[84px] pr-3 pb-52 pl-3 sm:pr-6 sm:pl-6 lg:pt-20 lg:pb-32 lg:pl-[calc(var(--sidebar-w)+16px)]",
            view === "board" && "w-max",
          )}
        >
          {view === "board" ? (
            <div
              ref={canvas}
              className="relative"
              style={{ width, height }}
              onDoubleClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const rect = e.currentTarget.getBoundingClientRect();
                setEditing(null);
                setDraft({
                  x: Math.max(0, Math.round(e.clientX - rect.left - NOTE_W / 2)),
                  y: Math.max(0, Math.round(e.clientY - rect.top - 24)),
                  color,
                });
              }}
            >
              {ordered.map((idea, i) => {
                const pos = drag?.id === idea.id ? drag : idea;
                return (
                  <div
                    key={idea.id}
                    className="absolute"
                    style={{ left: pos.x, top: pos.y, zIndex: openOn === idea.id ? ideas.length + 20 : i + 1 }}
                    onPointerDown={(e) => startDrag(e, idea)}
                  >
                    <Note
                      idea={idea}
                      dragging={drag?.id === idea.id}
                      dropping={dropOn === idea.id}
                      editing={editing === idea.id}
                      onEdit={(on) => setEditing(on ? idea.id : null)}
                      tilt={tiltOf(idea.id)}
                    >
                      {stuff(idea)}
                    </Note>
                  </div>
                );
              })}

              {/* Үзгээр зурсан зураас — наалтуудын дээр */}
              <svg
                className="pointer-events-none absolute inset-0 overflow-visible"
                width={width}
                height={height}
                style={{ zIndex: ideas.length + 4 }}
              >
                {lines.map((s) => {
                  const d = pathOf(s.points);
                  return (
                    <g key={s.id}>
                      <path d={d} fill="none" stroke={inkOf(s.color)} strokeWidth={PEN_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
                      {tool === "eraser" && canErase(s) && (
                        <path
                          d={d}
                          fill="none"
                          stroke="transparent"
                          strokeWidth={18}
                          strokeLinecap="round"
                          style={{ pointerEvents: "stroke", cursor: "pointer" }}
                          onPointerDown={() => void store.deleteStroke(s.id)}
                          onPointerEnter={(e) => e.buttons & 1 && void store.deleteStroke(s.id)}
                        />
                      )}
                    </g>
                  );
                })}
              </svg>

              {/* Самбар дээр чөлөөтэй наасан стикер, сэтгэгдэл — наалтуудын дээр */}
              <div className="pointer-events-none absolute inset-0" style={{ zIndex: openOn === null && openThread ? ideas.length + 21 : ideas.length + 5 }}>
                {freeStickers.map(renderSticker)}
                {renderPins(null)}
              </div>

              {draft && (
                <div className="absolute" style={{ left: draft.x, top: draft.y, zIndex: ideas.length + 25 }}>
                  <DraftNote draft={draft} onDone={saveDraft} onColor={(c) => setDraft({ ...draft, color: c })} />
                </div>
              )}

              {/* Үзэг, сэтгэгдлийн горимд самбар дээрх дарах үйлдлийг барина */}
              {(tool === "pen" || tool === "comment") && (
                <div
                  className="absolute inset-0 touch-none"
                  style={{ zIndex: ideas.length + 30, cursor: tool === "pen" ? "crosshair" : COMMENT_CURSOR }}
                  onPointerDown={tool === "pen" ? startPen : placeComment}
                />
              )}
            </div>
          ) : (
            <div className="grid max-w-[1680px] grid-cols-[repeat(auto-fill,minmax(224px,1fr))] gap-6">
              {top.map((idea, i) => (
                <div key={idea.id} className="relative" style={{ zIndex: openOn === idea.id ? 10 : undefined }}>
                  {i < 3 && score(idea.id) > 0 && (
                    <span className="absolute -top-3 -left-3 z-20 grid size-9 place-items-center rounded-full bg-surface-solid text-xl shadow-card">
                      {["🥇", "🥈", "🥉"][i]}
                    </span>
                  )}
                  <Note
                    idea={idea}
                    dropping={dropOn === idea.id}
                    editing={editing === idea.id}
                    onEdit={(on) => setEditing(on ? idea.id : null)}
                    fluid
                  >
                    {stuff(idea)}
                  </Note>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Дээд хөвөгч мөр */}
      <div className="pointer-events-none fixed top-[84px] right-3 left-3 z-30 flex items-center justify-end gap-2 sm:right-6 sm:left-6 lg:top-3 lg:left-[calc(var(--sidebar-w)+16px)] [&>*]:pointer-events-auto">
        <div className="glass mr-auto hidden h-12 items-center gap-2 rounded-full pr-4 pl-3 sm:flex">
          <Lightbulb size={18} className="text-amber-500" />
          <span className="font-semibold">Санаа</span>
          <span className="inline-flex items-center gap-1 text-xs text-zinc-500">
            <Lock size={11} /> нэргүй
            {ideas.length > 0 && ` · ${ideas.length} санаа · ${ideaComments.length} сэтгэгдэл · ${ideaStickers.length} стикер`}
          </span>
        </div>
        <Segmented
          value={view}
          onChange={(v) => {
            setView(v);
            setToolState("select");
          }}
          options={[
            { id: "board", label: "Самбар", icon: <StickyNote size={14} /> },
            { id: "top", label: "Топ", icon: <Trophy size={14} /> },
          ]}
        />
      </div>

      <Dock color={color} tool={tool} setTool={setTool} penColor={penColor} setPenColor={setPenColor} onStart={startDockDrag} />

      {/* Чирж буй зүйл заагчийг дагана */}
      {ghost && (
        <div className="pointer-events-none fixed z-[100] -translate-x-1/2 -translate-y-1/2" style={{ left: ghost.x, top: ghost.y }}>
          {ghost.item.kind === "emoji" ? (
            <span className="block scale-125 drop-shadow-lg">
              <StickerFace value={ghost.item.emoji} />
            </span>
          ) : (
            <span
              className="block -rotate-3 rounded-[6px] opacity-90 shadow-lift"
              style={{ width: NOTE_W * 0.6, height: NOTE_H * 0.6, background: colorOf(ghost.item.color).bg, borderTop: `10px solid ${colorOf(ghost.item.color).edge}` }}
            />
          )}
        </div>
      )}
    </>
  );
}

/* ─────────── Доод голын хэрэгслүүд ─────────── */
function Dock({
  color,
  tool,
  setTool,
  penColor,
  setPenColor,
  onStart,
}: {
  color: string;
  tool: Tool;
  setTool: (t: Tool) => void;
  penColor: string;
  setPenColor: (c: string) => void;
  onStart: (e: React.PointerEvent, item: DockItem) => void;
}) {
  const [more, setMore] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!more) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setMore(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMore(false);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [more]);

  const item =
    "grid h-10 min-w-10 cursor-grab touch-none place-items-center rounded-2xl transition hover:-translate-y-1 hover:bg-zinc-100 active:cursor-grabbing sm:h-11 sm:min-w-11";
  const toolBtn = (t: Tool, icon: React.ReactNode, label: string) => (
    <button
      onClick={() => setTool(tool === t ? "select" : t)}
      title={label}
      aria-label={label}
      aria-pressed={tool === t}
      className={cn(
        "grid size-10 cursor-pointer place-items-center rounded-2xl transition sm:size-11",
        tool === t ? "bg-neutral-900 text-white shadow-sm dark:bg-white dark:text-neutral-900" : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900",
      )}
    >
      {icon}
    </button>
  );
  const penOn = tool === "pen" || tool === "eraser";

  return (
    <div
      ref={ref}
      className="fixed bottom-[84px] left-1/2 z-30 w-max max-w-[calc(100vw-24px)] -translate-x-1/2 lg:bottom-5 lg:left-[calc((var(--sidebar-w)+100vw)/2)]"
    >
      {/* Үзгийн өнгө, баллуур */}
      {penOn && !more && (
        <div className="animate-pop absolute bottom-full left-0 mb-2 flex items-center gap-1 rounded-full border border-line bg-surface-solid p-1.5 shadow-lift">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setPenColor(c);
                setTool("pen");
              }}
              aria-label="Үзгийн өнгө"
              className={cn(
                "grid size-8 cursor-pointer place-items-center rounded-full transition hover:bg-zinc-100",
                tool === "pen" && penColor === c && "bg-zinc-100",
              )}
            >
              <span
                className={cn("block size-4 rounded-full", tool === "pen" && penColor === c && "ring-2 ring-zinc-400 ring-offset-2 ring-offset-surface-solid")}
                style={{ background: inkOf(c) }}
              />
            </button>
          ))}
          <span className="mx-0.5 h-6 w-px bg-zinc-200" />
          <button
            onClick={() => setTool(tool === "eraser" ? "pen" : "eraser")}
            title="Баллуур (E) — өөрийн зураасан дээгүүр гүйлгэнэ"
            aria-label="Баллуур"
            className={cn(
              "grid size-8 cursor-pointer place-items-center rounded-full transition",
              tool === "eraser" ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900" : "text-zinc-600 hover:bg-zinc-100",
            )}
          >
            <Eraser size={15} />
          </button>
        </div>
      )}
      {tool === "comment" && !more && (
        <div className="animate-pop absolute bottom-full left-0 mb-2 rounded-full border border-line bg-surface-solid px-3.5 py-2 text-xs font-medium text-zinc-600 shadow-lift">
          Сэтгэгдэл үлдээх газраа дарна уу · Esc
        </div>
      )}

      {more && (
        <div className="animate-pop absolute right-0 bottom-full mb-2 w-[min(calc(100vw-24px),400px)] rounded-[1.5rem] border border-line bg-surface-solid p-3 shadow-lift">
          <div className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">Тамга</div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {IDEA_STAMPS.map((s) => (
              <button key={s.text} onPointerDown={(e) => onStart(e, { kind: "emoji", emoji: s.text })} title="Чирж наана" className={cn(item, "px-1.5")}>
                <StickerFace value={s.text} small />
              </button>
            ))}
          </div>
          <div className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-zinc-400 uppercase">Сэтгэл хөдлөл</div>
          <div className="grid grid-cols-7 gap-1">
            {IDEA_EMOJIS.map((r) => (
              <button
                key={r.emoji}
                onPointerDown={(e) => onStart(e, { kind: "emoji", emoji: r.emoji })}
                title={r.label}
                aria-label={r.label}
                className={cn(item, "text-[26px] hover:scale-110")}
              >
                {r.emoji}
              </button>
            ))}
          </div>
          <p className="mt-2 px-1 text-[11px] text-zinc-400">Самбарын хаана ч, санаан дээр ч чирж наана</p>
        </div>
      )}

      <div className="glass flex items-center gap-0.5 rounded-[1.5rem] p-1.5 shadow-lift sm:gap-1 sm:p-2">
        {toolBtn("select", <MousePointer2 size={18} />, "Сонгох (V)")}
        {toolBtn(penOn ? tool : "pen", <Pencil size={18} />, "Үзэг (P)")}
        {toolBtn("comment", <MessageCircle size={18} />, "Сэтгэгдэл (C)")}
        <span className="mx-1 h-8 w-px bg-zinc-200" />
        {IDEA_COLORS.map((c, i) => (
          <button
            key={c.id}
            onPointerDown={(e) => onStart(e, { kind: "note", color: c.id })}
            title={`${c.label} наалт — дарах эсвэл самбар руу чирэх`}
            aria-label={`${c.label} наалт нэмэх`}
            className={cn("group", item, "hover:translate-y-0", i >= 2 && "hidden sm:grid")}
          >
            <span
              className={cn(
                "block size-7 rounded-[4px] shadow-[0_1px_2px_rgb(0_0_0/0.12),0_4px_8px_-4px_rgb(0_0_0/0.3)] transition group-hover:-translate-y-1 group-hover:-rotate-6",
                color === c.id && "ring-2 ring-zinc-400 ring-offset-1 ring-offset-transparent",
              )}
              style={{ background: c.bg, borderTop: `5px solid ${c.edge}` }}
            />
          </button>
        ))}
        <span className="mx-1 h-8 w-px bg-zinc-200" />
        {IDEA_STAMPS.slice(0, STAMPS_PINNED).map((s) => (
          <button
            key={s.text}
            onPointerDown={(e) => onStart(e, { kind: "emoji", emoji: s.text })}
            title={`«${s.text}» тамга — хаана ч чирж наана`}
            className={cn(item, "hidden px-1 md:grid")}
          >
            <StickerFace value={s.text} small />
          </button>
        ))}
        {IDEA_EMOJIS.slice(0, IDEA_EMOJIS_PINNED).map((r, i) => (
          <button
            key={r.emoji}
            onPointerDown={(e) => onStart(e, { kind: "emoji", emoji: r.emoji })}
            title={`${r.label} — хаана ч чирж наана`}
            aria-label={r.label}
            className={cn(item, "text-[24px] hover:scale-110", i >= 1 && "hidden sm:grid", i >= 4 && "sm:hidden md:grid")}
          >
            {r.emoji}
          </button>
        ))}
        <button
          onClick={() => setMore((m) => !m)}
          title="Бүх стикер, тамга"
          aria-label="Бүх стикер"
          className={cn(
            "grid size-10 cursor-pointer place-items-center rounded-2xl text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 sm:size-11",
            more && "bg-zinc-100 text-zinc-900",
          )}
        >
          <Plus size={20} className={cn("transition", more && "rotate-45")} />
        </button>
      </div>
    </div>
  );
}

/* ─────────── Стикерийн дүр: emoji эсвэл бичигтэй тамга ─────────── */
function StickerFace({ value, small }: { value: string; small?: boolean }) {
  const stamp = stampOf(value);
  if (!stamp) return <span className={cn("block leading-none", small ? "text-[24px]" : "text-[38px]")}>{value}</span>;
  return (
    <span
      className={cn(
        "block -rotate-6 rounded-lg border-2 border-white font-black tracking-tight whitespace-nowrap shadow-[0_2px_6px_rgb(0_0_0/0.25)]",
        small ? "px-1.5 py-0.5 text-[11px]" : "px-2.5 py-1 text-[16px]",
      )}
      style={{ background: stamp.bg, color: stamp.fg }}
    >
      {value}
    </span>
  );
}

/* ─────────── Наасан стикер (x, y нь төв) ─────────── */
function Sticker({
  sticker,
  hidden,
  canMove,
  onPointerDown,
  onDelete,
}: {
  sticker: IdeaSticker;
  hidden: boolean;
  canMove: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onDelete: () => void;
}) {
  return (
    <div
      data-nodrag
      onPointerDown={canMove ? onPointerDown : undefined}
      className={cn(
        "group/st absolute -translate-x-1/2 -translate-y-1/2 select-none",
        // Бусдын стикер доорх наалт, самбарт саад болохгүй
        canMove ? "pointer-events-auto cursor-grab touch-none active:cursor-grabbing" : "pointer-events-none",
        hidden && "invisible",
      )}
      style={{ left: sticker.x, top: sticker.y, zIndex: 5 }}
    >
      <span className="block drop-shadow-[0_2px_3px_rgb(0_0_0/0.25)] transition group-hover/st:scale-110">
        <StickerFace value={sticker.emoji} />
      </span>
      {canMove && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onDelete}
          title="Стикер авах"
          aria-label="Стикер авах"
          className="absolute -top-2 -right-2 hidden size-5 cursor-pointer place-items-center rounded-full bg-neutral-900 text-white shadow group-hover/st:grid [@media(hover:none)]:grid"
        >
          <X size={11} />
        </button>
      )}
    </div>
  );
}

/* ─────────── Наалт (санаа) — зөвхөн бичвэр, хэн бичсэн нь харагдахгүй ─────────── */
function Note({
  idea,
  dragging,
  dropping,
  editing,
  onEdit,
  tilt = 0,
  fluid,
  children,
}: {
  idea: Idea;
  dragging?: boolean;
  /** Стикер энэ санаан дээр буух гэж байна */
  dropping?: boolean;
  editing: boolean;
  onEdit: (on: boolean) => void;
  tilt?: number;
  fluid?: boolean;
  /** Наалт дээрх стикер, сэтгэгдлийн бөмбөлөг */
  children?: React.ReactNode;
}) {
  const { me, updateIdea, deleteIdea } = useStore();
  const canEdit = !!me && (idea.created_by === me.id || isAdmin(me));
  const c = colorOf(idea.color);

  return (
    <div
      data-idea-id={idea.id}
      className={cn(
        "group relative flex flex-col rounded-[6px] text-neutral-900 transition-[box-shadow,transform] duration-150",
        dropping && "ring-4 ring-brand-500/60",
        fluid ? "min-h-[170px] w-full" : "min-h-[170px]",
        dragging ? "cursor-grabbing shadow-lift" : "cursor-grab shadow-[0_1px_2px_rgb(0_0_0/0.08),0_10px_24px_-12px_rgb(0_0_0/0.35)]",
      )}
      style={{
        background: c.bg,
        width: fluid ? undefined : NOTE_W,
        transform: fluid ? (dropping ? "scale(1.03)" : undefined) : `rotate(${dragging || dropping ? 0 : tilt}deg) scale(${dragging || dropping ? 1.04 : 1})`,
      }}
      onDoubleClick={() => canEdit && !editing && onEdit(true)}
    >
      {/* Бариул + үйлдлүүд */}
      <div data-handle className="flex h-7 shrink-0 touch-none items-center gap-1 rounded-t-[6px] px-2" style={{ background: c.edge + "55" }}>
        <span className="mx-auto h-1 w-8 rounded-full bg-black/15" />
        <div className="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          {IDEA_COLORS.map((x) => (
            <button
              key={x.id}
              onClick={() => void updateIdea(idea.id, { color: x.id })}
              aria-label={x.label}
              title={x.label}
              className={cn("size-3.5 cursor-pointer rounded-full border border-black/15", x.id === idea.color && "ring-2 ring-black/30")}
              style={{ background: x.bg }}
            />
          ))}
          {canEdit && (
            <button
              onClick={() => void deleteIdea(idea.id)}
              title="Устгах"
              aria-label="Устгах"
              className="ml-1 grid size-5 cursor-pointer place-items-center rounded-full text-black/45 hover:bg-black/10 hover:text-red-600"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 px-3.5 pt-2 pb-4">
        {editing ? (
          <NoteText
            initial={idea.body}
            onDone={(text) => {
              onEdit(false);
              const body = text.trim();
              if (body && body !== idea.body) void updateIdea(idea.id, { body });
            }}
          />
        ) : (
          <p className="text-[15px] leading-snug font-medium break-words whitespace-pre-wrap select-none">{idea.body}</p>
        )}
      </div>
      {children}
    </div>
  );
}

/* ─────────── Шинэ (хадгалагдаагүй) наалт ─────────── */
function DraftNote({ draft, onDone, onColor }: { draft: Draft; onDone: (body: string) => void; onColor: (c: string) => void }) {
  const c = colorOf(draft.color);
  return (
    <div
      className="animate-pop flex min-h-[170px] flex-col rounded-[6px] text-neutral-900 shadow-lift ring-2 ring-black/10"
      style={{ background: c.bg, width: NOTE_W }}
    >
      <div className="flex h-7 items-center gap-1 rounded-t-[6px] px-2" style={{ background: c.edge + "55" }}>
        {IDEA_COLORS.map((x) => (
          <button
            key={x.id}
            // Textarea-гийн blur-ээс өмнө ажиллана — ноорог алга болохгүй
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onColor(x.id)}
            aria-label={x.label}
            className={cn("size-3.5 cursor-pointer rounded-full border border-black/15", x.id === draft.color && "ring-2 ring-black/30")}
            style={{ background: x.bg }}
          />
        ))}
      </div>
      <div className="flex-1 px-3.5 pt-2 pb-2">
        <NoteText initial="" placeholder="Санаагаа чөлөөтэй бич…" onDone={onDone} />
      </div>
      <div className="flex items-center gap-1.5 px-2.5 pb-2.5 text-[11px] text-black/50">
        <Lock size={11} /> Нэргүй нийтлэгдэнэ
        <span className="ml-auto">Enter ↵</span>
      </div>
    </div>
  );
}

/** Наалтын бичвэр засагч: Enter — хадгална, Shift+Enter — шинэ мөр, Esc — цуцална */
function NoteText({ initial, placeholder, onDone }: { initial: string; placeholder?: string; onDone: (text: string) => void }) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const finish = (value: string) => {
    if (done.current) return;
    done.current = true;
    onDone(value);
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  return (
    <textarea
      ref={ref}
      value={text}
      placeholder={placeholder}
      maxLength={1000}
      rows={3}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => finish(text)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          finish(text);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(initial);
        }
      }}
      className="block w-full resize-none bg-transparent text-[14.5px] leading-snug font-medium outline-none placeholder:text-black/35"
    />
  );
}

/* ─────────── Сэтгэгдлийн бөмбөлөг (FigJam шиг) — бүгд нэргүй, амьтны хочоор ─────────── */
function Pin({
  spot,
  root,
  replies,
  idea,
  open,
  onToggle,
  onClose,
  onCreated,
}: {
  spot: { x: number; y: number; idea_id: string | null };
  /** null — дөнгөж тавьж буй, хадгалагдаагүй бөмбөлөг */
  root: IdeaComment | null;
  replies: IdeaComment[];
  /** Наалт дээр бол тэр санаа — «Санааны эзэн»-ийг танихад */
  idea: Idea | null;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const { me, createComment, deleteComment } = useStore();
  const ref = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const items = root ? [root, ...replies] : [];

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open, onClose]);
  useEffect(() => {
    if (open) list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [open, items.length]);

  const who = (c: IdeaComment) => {
    if (idea && c.created_by && c.created_by === idea.created_by) return { emoji: "✍️", name: "Санааны эзэн" };
    return aliasOf(c.created_by, root?.id ?? "new");
  };
  const face = root ? who(root).emoji : "💬";

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    const saved = root
      ? await createComment({ thread_id: root.id, body })
      : await createComment({ idea_id: spot.idea_id, x: spot.x, y: spot.y, thread_id: null, body });
    setSending(false);
    if (!saved) return;
    setText("");
    if (!root) onCreated?.(saved.id);
  }

  return (
    <div ref={ref} data-nodrag className="pointer-events-auto absolute" style={{ left: spot.x, top: spot.y, zIndex: open ? 40 : 6 }} onDoubleClick={(e) => e.stopPropagation()}>
      <button
        onClick={onToggle}
        title={items.length ? `${items.length} сэтгэгдэл` : "Шинэ сэтгэгдэл"}
        className={cn(
          "absolute bottom-0 left-0 flex cursor-pointer items-center gap-1 rounded-full rounded-bl-[4px] bg-surface-solid p-1 text-zinc-800 shadow-lift ring-1 ring-line transition hover:scale-105",
          open && "ring-2 ring-brand-500",
        )}
      >
        <span className="grid size-7 place-items-center rounded-full bg-zinc-100 text-[16px] leading-none">{face}</span>
        {items.length > 1 && <span className="tabular pr-1.5 text-xs font-semibold">{items.length}</span>}
      </button>

      {open && (
        <div className="animate-pop absolute -top-14 left-12 w-[min(300px,78vw)] cursor-auto rounded-2xl border border-line bg-surface-solid text-zinc-800 shadow-lift">
          {items.length > 0 && (
            <div ref={list} className="scroll-thin max-h-72 space-y-3 overflow-y-auto p-3">
              {items.map((c, i) => {
                const w = who(c);
                const own = !!me && c.created_by === me.id;
                return (
                  <div key={c.id} className="group/c flex gap-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-zinc-100 text-[15px]">{w.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5 text-[11px]">
                        <span className="font-semibold text-zinc-800">{w.name}</span>
                        {own && <span className="text-zinc-400">(та)</span>}
                        <span className="text-zinc-400">{relativeTime(c.created_at)}</span>
                        {(own || isAdmin(me)) && (
                          <button
                            onClick={() => {
                              void deleteComment(c.id);
                              if (i === 0) onClose();
                            }}
                            title={i === 0 ? "Бүх thread-ийг устгах" : "Устгах"}
                            aria-label="Устгах"
                            className="ml-auto cursor-pointer rounded-full p-0.5 text-zinc-300 opacity-0 transition group-hover/c:opacity-100 hover:text-red-600 [@media(hover:none)]:opacity-100"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 text-[13px] leading-snug break-words whitespace-pre-wrap">{c.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className={cn("flex items-end gap-1.5 p-2", items.length > 0 && "border-t border-zinc-100")}>
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder={root ? "Хариулах…" : "Сэтгэгдэл нэргүй бичих…"}
              className="max-h-28 min-h-9 flex-1 resize-none rounded-xl bg-zinc-50 px-3 py-2 text-[13px] outline-none focus:ring-2 focus:ring-brand-200"
            />
            <button
              onClick={() => void send()}
              disabled={!text.trim() || sending}
              aria-label="Илгээх"
              className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-700 disabled:opacity-40 dark:bg-white dark:text-neutral-900"
            >
              <SendHorizontal size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
