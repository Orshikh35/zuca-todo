"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMemo, useState, type ReactNode } from "react";
import { between, cn } from "@/lib/utils";

export interface BoardColumn {
  id: string;
  label: string;
  hint?: string;
  dot: string; // tailwind bg-*
  accent?: string; // column tint
}

interface BoardProps<T extends { id: string; position: number }> {
  columns: BoardColumn[];
  items: T[];
  getColumn: (item: T) => string;
  onMove: (item: T, toColumn: string, position: number) => void;
  renderCard: (item: T, state: { overlay: boolean }) => ReactNode;
  renderColumnFooter?: (columnId: string) => ReactNode;
  renderColumnMeta?: (columnId: string, items: T[]) => ReactNode;
  columnWidth?: string;
}

type ColMap = Record<string, string[]>;

export function Board<T extends { id: string; position: number }>({
  columns,
  items,
  getColumn,
  onMove,
  renderCard,
  renderColumnFooter,
  renderColumnMeta,
  columnWidth = "w-[300px]",
}: BoardProps<T>) {
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const derived = useMemo<ColMap>(() => {
    const m: ColMap = Object.fromEntries(columns.map((c) => [c.id, []]));
    [...items]
      .sort((a, b) => a.position - b.position)
      .forEach((i) => m[getColumn(i)]?.push(i.id));
    return m;
  }, [items, columns, getColumn]);

  const [dragCols, setDragCols] = useState<ColMap | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const view = dragCols ?? derived;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findCol = (id: string, map: ColMap) => (id in map ? id : Object.keys(map).find((k) => map[k].includes(id)));

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setDragCols(derived);
    setOverCol(findCol(String(e.active.id), derived) ?? null);
  }

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const aId = String(active.id);
    const oId = String(over.id);
    if (dragCols) setOverCol(findCol(oId, dragCols) ?? null);
    setDragCols((prev) => {
      if (!prev) return prev;
      const from = findCol(aId, prev);
      const to = findCol(oId, prev);
      if (!from || !to || from === to) return prev;
      const fromArr = prev[from].filter((x) => x !== aId);
      const toArr = [...prev[to]];
      const overIdx = toArr.indexOf(oId);
      const isBelow =
        over.rect && active.rect.current.translated
          ? active.rect.current.translated.top > over.rect.top + over.rect.height / 2
          : false;
      const insertAt = overIdx >= 0 ? overIdx + (isBelow ? 1 : 0) : toArr.length;
      toArr.splice(insertAt, 0, aId);
      return { ...prev, [from]: fromArr, [to]: toArr };
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const aId = String(active.id);
    const item = byId.get(aId);
    const cols = dragCols;
    const lastOver = overCol;
    reset();
    if (!item || !cols) return;

    // Буух баганыг чирэх үеийн map-аас тодорхойлно.
    // dnd-kit хоосон багана дээр тавихад over = null буцааж мэддэг тул зөвхөн түүнд найдахгүй.
    const to = (over ? findCol(String(over.id), cols) : undefined) ?? findCol(aId, cols) ?? lastOver ?? undefined;
    if (!to || !cols[to]) return;

    let arr = cols[to];
    const oldIdx = arr.indexOf(aId);
    const overIdx = over ? arr.indexOf(String(over.id)) : -1;
    if (oldIdx >= 0 && overIdx >= 0 && oldIdx !== overIdx) arr = arrayMove(arr, oldIdx, overIdx);

    let idx = arr.indexOf(aId);
    if (idx < 0) {
      // onDragOver ажиллаагүй (шууд хоосон багана руу) — эцэст нь нэмнэ
      arr = [...arr, aId];
      idx = arr.length - 1;
    }

    const fromCol = getColumn(item);
    const originalIdx = derived[fromCol]?.indexOf(aId);
    if (fromCol === to && originalIdx === idx) return;

    const prevPos = idx > 0 ? byId.get(arr[idx - 1])?.position : undefined;
    const nextPos = idx < arr.length - 1 ? byId.get(arr[idx + 1])?.position : undefined;
    onMove(item, to, between(prevPos, nextPos));
  }

  function reset() {
    setActiveId(null);
    setDragCols(null);
    setOverCol(null);
  }

  const active = activeId ? byId.get(activeId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={reset}
    >
      <div className="scroll-thin -mx-3 flex gap-4 overflow-x-auto px-3 pb-4 sm:-mx-6 sm:px-6 lg:-mx-1 lg:px-1">
        {columns.map((col) => (
          <Column
            key={col.id}
            col={col}
            ids={view[col.id] ?? []}
            highlight={!!activeId && overCol === col.id}
            width={columnWidth}
            meta={renderColumnMeta?.(col.id, (view[col.id] ?? []).map((id) => byId.get(id)!).filter(Boolean))}
            footer={renderColumnFooter?.(col.id)}
          >
            {(view[col.id] ?? []).map((id) => {
              const it = byId.get(id);
              return it ? (
                <SortableCard key={id} id={id}>
                  {renderCard(it, { overlay: false })}
                </SortableCard>
              ) : null;
            })}
          </Column>
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        {active ? <div className="rotate-[1.5deg] cursor-grabbing rounded-[1.25rem] shadow-lift">{renderCard(active, { overlay: true })}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  col,
  ids,
  highlight,
  width,
  meta,
  footer,
  children,
}: {
  col: BoardColumn;
  ids: string[];
  highlight: boolean;
  width: string;
  meta?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: col.id });
  return (
    // Droppable нь бүтэн багана — хоосон багана руу чирэхэд онох талбай том байна
    <section
      ref={setNodeRef}
      data-col={col.id}
      className={cn(
        "flex shrink-0 flex-col rounded-[1.75rem] transition-colors duration-150",
        width,
        highlight ? "lane ring-2 ring-brand-300" : "lane",
      )}
    >
      <header className="flex items-center gap-2 px-4 pt-4 pb-2">
        <span className={cn("size-2.5 rounded-full", col.dot)} />
        <h3 className="text-[15px] font-medium text-zinc-900">{col.label}</h3>
        <sup className="tabular text-xs font-medium text-zinc-500">{ids.length}</sup>
        <div className="ml-auto">{meta}</div>
      </header>
      {col.hint && <p className="-mt-1 px-4 pb-2 text-[11px] text-zinc-400">{col.hint}</p>}
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2.5 pb-2.5">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {children}
        </SortableContext>
        {ids.length === 0 && (
          <div
            className={cn(
              "flex h-20 items-center justify-center rounded-[1.25rem] border-2 border-dashed text-xs transition",
              highlight ? "border-brand-300 text-brand-600" : "border-zinc-200 text-zinc-400",
            )}
          >
            Энд чирж оруулна уу
          </div>
        )}
      </div>
      {footer && <div className="px-2.5 pb-2.5">{footer}</div>}
    </section>
  );
}

function SortableCard({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("touch-none", isDragging && "opacity-40 [&>*]:border-dashed [&>*]:border-brand-300 [&>*]:shadow-none")}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}
