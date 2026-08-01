"use client";

import { useEffect, useMemo, useState } from "react";
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, DragOverlay, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { Badge } from "@/xhub/ui/Badge";
import type { WorkItemRow, WorkDimension } from "@/xoffice/lib/work-items-data";
import { STATUS_LABEL, STATUS_TONE, PRIORITY_LABEL, PRIORITY_TONE, TYPE_LABEL } from "./work-states";

const COLUMNS = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "BLOCKED", "DONE"] as const;

/**
 * Kanban board (WK-04). Columns by status; drag a card between columns to change
 * status — applied optimistically and rolled back if the server FSM rejects the
 * transition (400). Swimlanes group rows by any tag or dimension (owner req #2).
 */
export function KanbanClient({ rows, dimensions }: { rows: WorkItemRow[]; dimensions: WorkDimension[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [items, setItems] = useState<WorkItemRow[]>(rows);
  const [swimlane, setSwimlane] = useState<string>("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => setItems(rows), [rows]);

  const laneOptions = [
    { value: "", label: "Không chia làn" },
    { value: "priority", label: "Ưu tiên" },
    { value: "type", label: "Loại việc" },
    ...dimensions.map((d) => ({ value: `dimension:${d.key}`, label: d.label })),
    { value: "tag", label: "Thẻ đầu tiên" },
  ];

  const laneOf = (it: WorkItemRow): string => {
    if (!swimlane) return "__all__";
    if (swimlane === "priority") return it.priority ?? "NORMAL";
    if (swimlane === "type") return it.type;
    if (swimlane === "tag") return it.tags?.[0] ?? "(không thẻ)";
    if (swimlane.startsWith("dimension:")) return it.dimensions?.[swimlane.slice(10)] ?? "(không có)";
    return "__all__";
  };
  const laneLabel = (key: string): string => {
    if (key === "__all__") return "";
    if (swimlane === "priority") return PRIORITY_LABEL[key] ?? key;
    if (swimlane === "type") return TYPE_LABEL[key] ?? key;
    if (swimlane.startsWith("dimension:")) {
      const dim = dimensions.find((d) => `dimension:${d.key}` === swimlane);
      return dim?.allowedValues?.find((a) => a.value === key)?.label ?? key;
    }
    return key;
  };

  const lanes = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(laneOf(it));
    return [...set].sort();
  }, [items, swimlane]);

  async function move(id: string, to: string) {
    const prev = items.find((i) => i.id === id);
    if (!prev || prev.status === to) return;
    setItems((list) => list.map((i) => (i.id === id ? { ...i, status: to } : i)));
    try {
      const res = await fetch(`/api/work/items/${id}/status`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to }) });
      if (!res.ok) {
        const jb = await res.json().catch(() => ({}));
        setItems((list) => list.map((i) => (i.id === id ? { ...i, status: prev.status } : i)));
        setToast(jb?.detail?.message ?? jb?.message ?? `Không thể chuyển sang ${STATUS_LABEL[to] ?? to}`);
        setTimeout(() => setToast(null), 4000);
      }
    } catch {
      setItems((list) => list.map((i) => (i.id === id ? { ...i, status: prev.status } : i)));
      setToast("Backend không phản hồi — đã hoàn tác");
      setTimeout(() => setToast(null), 4000);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    setDragId(null);
    const id = String(e.active.id);
    const over = e.over?.id ? String(e.over.id) : null;
    if (!over) return;
    const to = over.split("::")[1] ?? over; // droppable id = `${lane}::${status}`
    move(id, to);
  }

  if (!mounted) {
    return <div className="rounded-xl border border-dashed border-gray-300 p-16 text-center text-sm text-gray-400 dark:border-dark-500">Đang tải bảng Kanban…</div>;
  }

  const dragItem = items.find((i) => i.id === dragId) ?? null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Kanban công việc</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">{items.length} việc · kéo thẻ để đổi trạng thái</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-500">
          Chia làn theo
          <select value={swimlane} onChange={(e) => setSwimlane(e.target.value)} className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50">
            {laneOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {toast && <div className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">{toast}</div>}

      <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setDragId(String(e.active.id))} onDragEnd={onDragEnd}>
        <div className="space-y-4">
          {lanes.map((lane) => (
            <div key={lane}>
              {swimlane && <p className="mb-1.5 text-xs font-semibold text-gray-500 dark:text-dark-300">{laneLabel(lane) || "—"}</p>}
              <div className="flex gap-3 overflow-x-auto pb-2">
                {COLUMNS.map((status) => {
                  const cards = items.filter((i) => i.status === status && laneOf(i) === lane);
                  return <Column key={status} lane={lane} status={status} cards={cards} />;
                })}
              </div>
            </div>
          ))}
        </div>
        <DragOverlay>{dragItem ? <Card item={dragItem} overlay /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

function Column({ lane, status, cards }: { lane: string; status: string; cards: WorkItemRow[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${lane}::${status}` });
  return (
    <div ref={setNodeRef} className={`w-64 shrink-0 rounded-xl border p-2 ${isOver ? "border-primary-400 bg-primary-50/50 dark:bg-primary-500/10" : "border-gray-200 bg-gray-50/60 dark:border-dark-600 dark:bg-dark-800/40"}`}>
      <div className="mb-2 flex items-center justify-between px-1">
        <Badge tone={STATUS_TONE[status] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>
        <span className="text-xs text-gray-400">{cards.length}</span>
      </div>
      <div className="space-y-2">
        {cards.map((c) => <DraggableCard key={c.id} item={c} />)}
        {cards.length === 0 && <div className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-[11px] text-gray-300 dark:border-dark-600">—</div>}
      </div>
    </div>
  );
}

function DraggableCard({ item }: { item: WorkItemRow }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: item.id });
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={isDragging ? "opacity-40" : ""}>
      <Card item={item} />
    </div>
  );
}

function Card({ item, overlay }: { item: WorkItemRow; overlay?: boolean }) {
  return (
    <div className={`cursor-grab rounded-lg border border-gray-200 bg-white p-2.5 text-left shadow-sm dark:border-dark-600 dark:bg-dark-700 ${overlay ? "shadow-lg" : ""}`}>
      <p className="line-clamp-2 text-xs font-medium text-gray-800 dark:text-dark-100">{item.isMilestone ? "◆ " : ""}{item.title}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {item.priority && <Badge tone={PRIORITY_TONE[item.priority] ?? "neutral"}>{PRIORITY_LABEL[item.priority] ?? item.priority}</Badge>}
        {item.overdue && <Badge tone="error">Trễ</Badge>}
        {(item.tags ?? []).slice(0, 2).map((t) => <span key={t} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-dark-600 dark:text-dark-200">#{t}</span>)}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-150 dark:bg-dark-600">
          <div className="h-full rounded-full bg-primary-500" style={{ width: `${item.progressPercent}%` }} />
        </div>
        <span className="text-[10px] text-gray-400">{item.progressPercent}%</span>
      </div>
    </div>
  );
}
