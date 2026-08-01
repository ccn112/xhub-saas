"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/xhub/ui/Badge";
import { SectionCard } from "@/xhub/ui/Card";
import type { CoordinationGantt, GanttBar, ProjectDetail, ProjectWorkItem, WorkDependencyRow } from "@/xoffice/lib/work-projects-data";
import { STATUS_LABEL, STATUS_TONE, TYPE_LABEL, fmtDate } from "./work-states";
import { DEP_LABEL } from "./project-states";

const DAY = 86400000;
const ROW_H = 34;
const LABEL_W = 260;

type Row = {
  id: string;
  title: string;
  type: string;
  status: string;
  isMilestone: boolean;
  progress: number;
  plannedStart?: string | null;
  dueAt?: string | null;
  actualStart?: string | null;
  completedAt?: string | null;
  parentId?: string | null;
  depth: number;
  hasChildren: boolean;
  overdue?: boolean;
  summary?: boolean;
};

/**
 * Project Gantt (WK-08) — a linear-time schedule editor. The X axis is real time
 * (day/week/month zoom), NOT auto-layout. Renders a planned bar (light) with an
 * actual/progress overlay (solid), milestone diamonds, and FS/SS/FF/SF dependency
 * edges. Dragging/resizing a FULL-access bar issues a server-validated reschedule
 * (POST /items/:id/schedule) applied optimistically and rolled back on a 4xx.
 *
 * Coordination mode (owner requirement #1): renders the rolled-up parent SUMMARY
 * bars returned by the server (children absent, description never shipped). A
 * summary viewer is locked to this mode.
 */
export function GanttClient({
  projectId,
  detail,
  coordination,
  canEdit,
}: {
  projectId: string;
  detail: ProjectDetail | null;
  coordination: CoordinationGantt | null;
  canEdit: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [mode, setMode] = useState<"full" | "coordination">(canEdit ? "full" : "coordination");
  const [dayWidth, setDayWidth] = useState(18);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [overrides, setOverrides] = useState<Record<string, { plannedStart?: string | null; dueAt?: string | null }>>({});
  const [toast, setToast] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fullItems: ProjectWorkItem[] = detail?.access === "FULL" ? detail.workItems : [];
  const summaryBars: GanttBar[] = coordination?.bars ?? (detail?.access === "SUMMARY" ? (detail.workItems as unknown as GanttBar[]) : []);
  const dependencies: WorkDependencyRow[] = detail?.dependencies ?? [];

  // Build display rows (WBS tree for full; flat roots for coordination).
  const rows: Row[] = useMemo(() => {
    const applyOv = (id: string, ps?: string | null, da?: string | null) => {
      const o = overrides[id];
      return { plannedStart: o?.plannedStart !== undefined ? o.plannedStart : ps, dueAt: o?.dueAt !== undefined ? o.dueAt : da };
    };
    if (mode === "coordination") {
      return summaryBars.map((b) => {
        const ov = applyOv(b.id, b.plannedStart, b.dueAt);
        return {
          id: b.id, title: b.title, type: b.type, status: b.status, isMilestone: b.isMilestone,
          progress: b.progressPercent ?? 0, plannedStart: ov.plannedStart, dueAt: ov.dueAt,
          parentId: null, depth: 0, hasChildren: false, overdue: b.overdue, summary: true,
        } as Row;
      });
    }
    // full WBS tree
    const byId = new Map(fullItems.map((i) => [i.id, i]));
    const childrenOf = new Map<string, ProjectWorkItem[]>();
    for (const i of fullItems) {
      const key = i.parentId && byId.has(i.parentId) ? i.parentId : "__root__";
      if (!childrenOf.has(key)) childrenOf.set(key, []);
      childrenOf.get(key)!.push(i);
    }
    const out: Row[] = [];
    const walk = (parentKey: string, depth: number) => {
      for (const i of childrenOf.get(parentKey) ?? []) {
        const kids = childrenOf.get(i.id) ?? [];
        const anyI = i as unknown as { actualStart?: string | null; completedAt?: string | null };
        const ov = applyOv(i.id, i.plannedStart, i.dueAt);
        out.push({
          id: i.id, title: i.title, type: i.type, status: i.status, isMilestone: !!i.isMilestone,
          progress: i.rolledUpProgress ?? i.progressPercent ?? 0, plannedStart: ov.plannedStart, dueAt: ov.dueAt,
          actualStart: anyI.actualStart, completedAt: anyI.completedAt,
          parentId: i.parentId, depth, hasChildren: kids.length > 0, overdue: i.overdue,
        });
        if (kids.length && !collapsed.has(i.id)) walk(i.id, depth + 1);
      }
    };
    walk("__root__", 0);
    return out;
  }, [mode, summaryBars, fullItems, collapsed, overrides]);

  // Time domain.
  const { t0, t1 } = useMemo(() => {
    const ds: number[] = [];
    for (const r of rows) {
      for (const v of [r.plannedStart, r.dueAt, r.actualStart, r.completedAt]) {
        if (v) { const t = new Date(v).getTime(); if (!Number.isNaN(t)) ds.push(t); }
      }
    }
    if (!ds.length) { const now = Date.now(); return { t0: now - 7 * DAY, t1: now + 21 * DAY }; }
    const min = Math.min(...ds) - 2 * DAY;
    const max = Math.max(...ds) + 2 * DAY;
    return { t0: min, t1: Math.max(max, min + 14 * DAY) };
  }, [rows]);

  const totalDays = Math.ceil((t1 - t0) / DAY);
  const canvasW = totalDays * dayWidth;
  const x = (v?: string | null) => (v ? ((new Date(v).getTime() - t0) / DAY) * dayWidth : null);
  const rowIndex = new Map(rows.map((r, idx) => [r.id, idx]));

  // Month gridlines.
  const months = useMemo(() => {
    const out: { left: number; label: string }[] = [];
    const d = new Date(t0); d.setDate(1); d.setHours(0, 0, 0, 0);
    while (d.getTime() < t1) {
      out.push({ left: ((d.getTime() - t0) / DAY) * dayWidth, label: d.toLocaleDateString("vi-VN", { month: "short", year: "2-digit" }) });
      d.setMonth(d.getMonth() + 1);
    }
    return out;
  }, [t0, t1, dayWidth]);
  const todayLeft = ((Date.now() - t0) / DAY) * dayWidth;

  async function reschedule(id: string, next: { plannedStart?: string | null; dueAt?: string | null }, prev: { plannedStart?: string | null; dueAt?: string | null }) {
    // optimistic
    setOverrides((o) => ({ ...o, [id]: next }));
    try {
      const res = await fetch(`/api/work/items/${id}/schedule`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(next),
      });
      if (!res.ok) {
        const jb = await res.json().catch(() => ({}));
        setOverrides((o) => ({ ...o, [id]: prev })); // rollback
        setToast(jb?.detail?.message ?? jb?.message ?? "Lịch không hợp lệ — đã hoàn tác");
        setTimeout(() => setToast(null), 4000);
      } else {
        setToast(null);
      }
    } catch {
      setOverrides((o) => ({ ...o, [id]: prev }));
      setToast("Backend không phản hồi — đã hoàn tác");
      setTimeout(() => setToast(null), 4000);
    }
  }

  // Pointer drag/resize on a bar.
  function onBarPointerDown(e: React.PointerEvent, r: Row, kind: "move" | "resize") {
    if (!canEdit || mode !== "full" || r.isMilestone || !r.plannedStart || !r.dueAt) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const startX = e.clientX;
    const origStart = new Date(r.plannedStart).getTime();
    const origDue = new Date(r.dueAt).getTime();
    const prev: { plannedStart?: string | null; dueAt?: string | null } = { plannedStart: r.plannedStart, dueAt: r.dueAt };
    let nextVal: { plannedStart?: string | null; dueAt?: string | null } = prev;
    const onMove = (ev: PointerEvent) => {
      const deltaDays = Math.round((ev.clientX - startX) / dayWidth);
      const shift = deltaDays * DAY;
      if (kind === "move") nextVal = { plannedStart: new Date(origStart + shift).toISOString(), dueAt: new Date(origDue + shift).toISOString() };
      else nextVal = { plannedStart: r.plannedStart, dueAt: new Date(Math.max(origStart + DAY, origDue + shift)).toISOString() };
      setOverrides((o) => ({ ...o, [r.id]: nextVal }));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (nextVal.plannedStart !== prev.plannedStart || nextVal.dueAt !== prev.dueAt) reschedule(r.id, nextVal, prev);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const empty = rows.length === 0;

  if (!mounted) {
    return <SectionCard title="Gantt" accent="primary"><p className="py-16 text-center text-sm text-gray-400">Đang tải sơ đồ…</p></SectionCard>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-300 dark:border-dark-500">
            <button
              onClick={() => canEdit && setMode("full")}
              disabled={!canEdit}
              className={`px-3 py-1.5 text-xs font-medium ${mode === "full" ? "bg-primary-600 text-white" : "bg-white text-gray-600 disabled:opacity-40 dark:bg-dark-700 dark:text-dark-200"}`}
            >
              Điều hành
            </button>
            <button
              onClick={() => setMode("coordination")}
              className={`px-3 py-1.5 text-xs font-medium ${mode === "coordination" ? "bg-primary-600 text-white" : "bg-white text-gray-600 dark:bg-dark-700 dark:text-dark-200"}`}
            >
              Chế độ phối hợp
            </button>
          </div>
          {mode === "coordination" && <Badge tone="info">Chia sẻ phối hợp — chỉ mức tổng hợp</Badge>}
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Zoom</span>
          <button onClick={() => setDayWidth((w) => Math.max(6, w - 4))} className="rounded border border-gray-300 px-2 py-0.5 dark:border-dark-500">−</button>
          <button onClick={() => setDayWidth((w) => Math.min(48, w + 4))} className="rounded border border-gray-300 px-2 py-0.5 dark:border-dark-500">+</button>
        </div>
      </div>

      {toast && <div className="rounded-lg border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">{toast}</div>}

      <SectionCard title={`Sơ đồ Gantt — ${mode === "coordination" ? "phối hợp (roll-up)" : "điều hành"}`} accent="primary" bodyClassName="p-0">
        {empty ? (
          <p className="py-16 text-center text-sm text-gray-400">Chưa có công việc có lịch trong dự án.</p>
        ) : (
          <div ref={scrollRef} className="overflow-x-auto">
            <div className="relative" style={{ width: LABEL_W + canvasW, minWidth: "100%" }}>
              {/* header: months */}
              <div className="sticky top-0 z-10 flex border-b border-gray-200 bg-white dark:border-dark-600 dark:bg-dark-800" style={{ height: 28 }}>
                <div className="shrink-0 border-r border-gray-200 dark:border-dark-600" style={{ width: LABEL_W }} />
                <div className="relative" style={{ width: canvasW }}>
                  {months.map((m, i) => (
                    <div key={i} className="absolute top-0 h-7 border-l border-gray-200 pl-1 text-[10px] text-gray-400 dark:border-dark-600" style={{ left: m.left }}>{m.label}</div>
                  ))}
                </div>
              </div>

              {/* body */}
              <div className="relative">
                {/* today line */}
                {todayLeft >= 0 && todayLeft <= canvasW && (
                  <div className="pointer-events-none absolute top-0 z-0 w-px bg-error/60" style={{ left: LABEL_W + todayLeft, height: rows.length * ROW_H }} />
                )}

                {/* dependency edges (full mode) */}
                {mode === "full" && (
                  <svg className="pointer-events-none absolute left-0 top-0 z-[5]" width={LABEL_W + canvasW} height={rows.length * ROW_H} style={{ overflow: "visible" }}>
                    {dependencies.map((d) => {
                      const pi = rowIndex.get(d.predecessorId); const si = rowIndex.get(d.successorId);
                      if (pi === undefined || si === undefined) return null;
                      const pr = rows[pi]; const sr = rows[si];
                      const px = x(pr.dueAt ?? pr.plannedStart); const sx = x(sr.plannedStart ?? sr.dueAt);
                      if (px === null || sx === null) return null;
                      const y1 = pi * ROW_H + ROW_H / 2; const y2 = si * ROW_H + ROW_H / 2;
                      const X1 = LABEL_W + px; const X2 = LABEL_W + sx;
                      return (
                        <g key={d.id}>
                          <path d={`M ${X1} ${y1} C ${X1 + 16} ${y1}, ${X2 - 16} ${y2}, ${X2} ${y2}`} fill="none" stroke="#94a3b8" strokeWidth={1.3} strokeDasharray={d.type === "FS" ? undefined : "4 3"} />
                          <circle cx={X2} cy={y2} r={2.5} fill="#94a3b8" />
                        </g>
                      );
                    })}
                  </svg>
                )}

                {rows.map((r, idx) => {
                  const px = x(r.plannedStart); const pdue = x(r.dueAt);
                  const barLeft = px ?? 0;
                  const barW = px !== null && pdue !== null ? Math.max(dayWidth * 0.6, pdue - px) : dayWidth;
                  const ax = x(r.actualStart); const adue = x(r.completedAt);
                  return (
                    <div key={r.id} className="flex items-stretch border-b border-gray-100 hover:bg-gray-50/60 dark:border-dark-700 dark:hover:bg-dark-700/40" style={{ height: ROW_H }}>
                      {/* label */}
                      <div className="flex shrink-0 items-center gap-1 border-r border-gray-200 pr-2 dark:border-dark-600" style={{ width: LABEL_W, paddingLeft: 8 + r.depth * 16 }}>
                        {r.hasChildren ? (
                          <button onClick={() => setCollapsed((s) => { const n = new Set(s); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n; })} className="w-4 shrink-0 text-gray-400">{collapsed.has(r.id) ? "▸" : "▾"}</button>
                        ) : <span className="w-4 shrink-0" />}
                        <span className="truncate text-xs text-gray-700 dark:text-dark-100" title={r.title}>{r.isMilestone ? "◆ " : ""}{r.title}</span>
                      </div>
                      {/* canvas */}
                      <div className="relative" style={{ width: canvasW }}>
                        {r.isMilestone ? (
                          pdue !== null && <div className="absolute top-1/2 z-10 -translate-y-1/2 rotate-45 bg-amber-500" style={{ left: pdue - 6, width: 12, height: 12 }} title={`Mốc · ${fmtDate(r.dueAt)}`} />
                        ) : px !== null && pdue !== null ? (
                          <>
                            {/* planned (baseline) light bar */}
                            <div
                              className={`absolute top-1/2 z-10 -translate-y-1/2 rounded ${r.summary ? "bg-primary-300/60" : "bg-primary-200/70 dark:bg-primary-500/20"} ${canEdit && mode === "full" ? "cursor-grab" : ""}`}
                              style={{ left: barLeft, width: barW, height: 16 }}
                              onPointerDown={(e) => onBarPointerDown(e, r, "move")}
                              title={`${r.title} · ${fmtDate(r.plannedStart)} → ${fmtDate(r.dueAt)}`}
                            >
                              {/* progress overlay */}
                              <div className={`h-full rounded ${r.overdue ? "bg-error/70" : "bg-primary-600"}`} style={{ width: `${Math.min(100, r.progress)}%` }} />
                              {canEdit && mode === "full" && (
                                <span onPointerDown={(e) => { e.stopPropagation(); onBarPointerDown(e, r, "resize"); }} className="absolute right-0 top-0 h-full w-1.5 cursor-ew-resize rounded-r bg-primary-700/40" />
                              )}
                            </div>
                            {/* actual overlay (thin, solid) */}
                            {ax !== null && adue !== null && adue > ax && (
                              <div className="absolute z-[8] rounded bg-success/50" style={{ left: ax, width: Math.max(3, adue - ax), height: 5, top: "calc(50% + 9px)" }} title={`Thực tế: ${fmtDate(r.actualStart)} → ${fmtDate(r.completedAt)}`} />
                            )}
                          </>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Keyboard-accessible fallback (Gate C): edit schedule without the canvas. */}
      <SectionCard title="Bảng lịch (bàn phím)" accent="neutral">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600">
                <th className="py-2 pr-3 font-medium">Công việc</th>
                <th className="px-2 py-2 font-medium">Loại</th>
                <th className="px-2 py-2 font-medium">Trạng thái</th>
                <th className="px-2 py-2 font-medium">Bắt đầu (KH)</th>
                <th className="px-2 py-2 font-medium">Kết thúc (KH)</th>
                <th className="px-2 py-2 text-right font-medium">Tiến độ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 dark:border-dark-700">
                  <td className="py-1.5 pr-3" style={{ paddingLeft: 4 + r.depth * 14 }}>
                    <span className="text-gray-700 dark:text-dark-100">{r.isMilestone ? "◆ " : ""}{r.title}</span>
                  </td>
                  <td className="px-2 py-1.5 text-xs text-gray-500">{TYPE_LABEL[r.type] ?? r.type}</td>
                  <td className="px-2 py-1.5"><Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{STATUS_LABEL[r.status] ?? r.status}</Badge></td>
                  <td className="px-2 py-1.5">
                    {canEdit && mode === "full" && !r.isMilestone ? (
                      <input type="date" defaultValue={r.plannedStart ? r.plannedStart.slice(0, 10) : ""} onChange={(e) => reschedule(r.id, { plannedStart: e.target.value ? new Date(e.target.value).toISOString() : null, dueAt: r.dueAt }, { plannedStart: r.plannedStart, dueAt: r.dueAt })} className="h-7 rounded border border-gray-300 bg-white px-1 text-xs dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
                    ) : <span className="text-xs text-gray-500">{fmtDate(r.plannedStart)}</span>}
                  </td>
                  <td className="px-2 py-1.5">
                    {canEdit && mode === "full" ? (
                      <input type="date" defaultValue={r.dueAt ? r.dueAt.slice(0, 10) : ""} onChange={(e) => reschedule(r.id, { plannedStart: r.plannedStart, dueAt: e.target.value ? new Date(e.target.value).toISOString() : null }, { plannedStart: r.plannedStart, dueAt: r.dueAt })} className="h-7 rounded border border-gray-300 bg-white px-1 text-xs dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
                    ) : <span className="text-xs text-gray-500">{fmtDate(r.dueAt)}</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right text-xs tabular-nums text-gray-600 dark:text-dark-200">{r.progress}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mode === "full" && dependencies.length > 0 && (
          <p className="mt-3 text-xs text-gray-400">Phụ thuộc: {dependencies.map((d) => DEP_LABEL[d.type] ?? d.type).join(" · ")} ({dependencies.length} liên kết)</p>
        )}
      </SectionCard>
    </div>
  );
}
