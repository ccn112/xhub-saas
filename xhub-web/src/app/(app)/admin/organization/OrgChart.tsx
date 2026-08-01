"use client";

// Sơ đồ tổ chức (org chart) — a top-down visual "cây thừa kế": org units as
// cards, parent→child inheritance edges, positions/holders on expand. React
// Flow + ELK, mount-gated for SSR (mirrors the xoffice builder). A "Chế độ
// thiết lập" toggle enables drag-and-drop re-parenting persisted via the BFF
// proxy PATCH route; failures revert, backend-unreachable degrades gracefully.
//
// Clicking a node selects it and reveals a "Cấu hình" action column beside the
// chart; right-clicking opens a floating context menu with the same actions.
// Each action is wired to the identity BFF (rename/retype, change head, add
// child, move, delete) with optimistic UI + toast + router.refresh().
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowsPointingOutIcon, ArrowsPointingInIcon } from "@heroicons/react/24/outline";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { useToast } from "@/components/ui/Toast";
import { FormDrawer, FormSection, TextField, SelectField, type SelectFieldOption } from "@/xhub/ui/form";
import type { OrgGraph, OrgGraphNode, OrgGraphPosition } from "@/features/tenant-admin/identity.server";
import { layoutOrg, ORG_NODE_W, ORG_NODE_H } from "./orgLayout";
import { StaffOrgChart } from "./StaffOrgChart";

export interface OrgPerson { id: string; name: string }

const TYPE_LABEL: Record<string, string> = { LEGAL_ENTITY: "Pháp nhân", DIVISION: "Khối", DEPARTMENT: "Phòng/Ban", TEAM: "Nhóm" };
const TYPE_TONE: Record<string, "primary" | "info" | "neutral"> = { LEGAL_ENTITY: "primary", DIVISION: "info", DEPARTMENT: "neutral" };
const TYPE_OPTIONS: SelectFieldOption[] = [
  { value: "DIVISION", label: "Khối" },
  { value: "DEPARTMENT", label: "Phòng/Ban" },
  { value: "TEAM", label: "Nhóm" },
  { value: "LEGAL_ENTITY", label: "Pháp nhân" },
];

interface OrgNodeData extends Record<string, unknown> {
  item: OrgGraphNode;
  setup: boolean;
  selected: boolean;
  onSelect: (id: string) => void;
}
type OrgFlowNode = Node<OrgNodeData, "org">;

// ---- custom node ----------------------------------------------------------
function OrgUnitNode({ data }: NodeProps<OrgFlowNode>) {
  const { item, setup, selected, onSelect } = data;
  return (
    <div
      onClick={() => onSelect(item.id)}
      className={[
        "w-[236px] rounded-xl border bg-white px-3 py-2.5 shadow-soft transition dark:bg-dark-700",
        selected ? "border-primary-500 ring-2 ring-primary-500/40" : "border-gray-200 dark:border-dark-500",
        setup ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
      ].join(" ")}
      style={{ height: ORG_NODE_H }}
    >
      <Handle type="target" position={Position.Top} className="!h-1.5 !w-1.5 !border-0 !bg-gray-300 dark:!bg-dark-400" />
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-sm font-semibold text-gray-800 dark:text-dark-50" title={item.name}>{item.name}</p>
        <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-dark-600 dark:text-dark-200">{item.code}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <Badge tone={TYPE_TONE[item.type] ?? "neutral"}>{TYPE_LABEL[item.type] ?? item.type}</Badge>
      </div>
      <p className="mt-1 truncate text-xs text-gray-500 dark:text-dark-300">
        {item.headName ? (
          <>
            <span className="text-gray-600 dark:text-dark-100">{item.headName}</span>
            {item.headTitle && <span className="text-gray-400 dark:text-dark-400"> · {item.headTitle}</span>}
          </>
        ) : (
          <span className="text-warning">Khuyết trưởng đơn vị</span>
        )}
      </p>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-400 dark:text-dark-300">
        <span title="Số vị trí">💼 {item.positionCount} vị trí</span>
        <span title="Số nhân sự phụ thuộc">👤 {item.staffCount} nhân sự</span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !border-0 !bg-gray-300 dark:!bg-dark-400" />
    </div>
  );
}

const nodeTypes: NodeTypes = { org: OrgUnitNode };

// ---- helpers --------------------------------------------------------------
function descendantsOf(items: OrgGraphNode[], id: string): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const it of items) {
    if (!it.parentId) continue;
    const arr = childrenOf.get(it.parentId) ?? [];
    arr.push(it.id);
    childrenOf.set(it.parentId, arr);
  }
  const out = new Set<string>();
  const stack = [...(childrenOf.get(id) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    if (out.has(cur)) continue;
    out.add(cur);
    for (const c of childrenOf.get(cur) ?? []) stack.push(c);
  }
  return out;
}

// ---- action descriptors ---------------------------------------------------
type ActionKey = "detail" | "rename" | "head" | "addChild" | "move" | "delete";
interface ActionDef { key: ActionKey; label: string; icon: string; mutating: boolean; danger?: boolean }
const ACTIONS: ActionDef[] = [
  { key: "detail", label: "Xem chi tiết", icon: "🔍", mutating: false },
  { key: "rename", label: "Đổi tên / Đổi loại", icon: "✏️", mutating: true },
  { key: "head", label: "Đổi trưởng đơn vị", icon: "👤", mutating: true },
  { key: "addChild", label: "Thêm đơn vị con", icon: "➕", mutating: true },
  { key: "move", label: "Di chuyển (đổi đơn vị cha)", icon: "🔀", mutating: true },
  { key: "delete", label: "Xoá đơn vị", icon: "🗑️", mutating: true, danger: true },
];

type Drawer = { kind: ActionKey; node: OrgGraphNode } | null;

// ---- inner chart ----------------------------------------------------------
function ChartInner({ graph, people }: { graph: OrgGraph; people: OrgPerson[] }) {
  const router = useRouter();
  const toast = useToast();
  const rfRef = useRef<ReactFlowInstance<OrgFlowNode, Edge> | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [mounted, setMounted] = useState(false);
  const [view, setView] = useState<"unit" | "staff">("unit");
  const [mode, setMode] = useState<"view" | "setup">("view");
  const [full, setFull] = useState(false);
  const [degraded, setDegraded] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(graph.nodes[0]?.id ?? "");
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [confirmDelete, setConfirmDelete] = useState<OrgGraphNode | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menu, setMenu] = useState<{ x: number; y: number; node: OrgGraphNode } | null>(null);

  // The re-parentable source of truth (parentId lives here). RF node positions
  // are derived from this + the ELK layout.
  const [items, setItems] = useState<OrgGraphNode[]>(graph.nodes);
  useEffect(() => { setItems(graph.nodes); }, [graph.nodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState<OrgFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => setMounted(true), []);

  const onSelect = useCallback((id: string) => setSelectedId(id), []);

  // Build edges whenever the tree structure changes.
  useEffect(() => {
    const ids = new Set(items.map((n) => n.id));
    setEdges(
      items
        .filter((n) => n.parentId && ids.has(n.parentId))
        .map((n) => ({
          id: `e-${n.parentId}-${n.id}`,
          source: n.parentId as string,
          target: n.id,
          type: "smoothstep",
          style: { stroke: "var(--color-gray-300, #cbd5e1)", strokeWidth: 1.5 },
        })),
    );
  }, [items, setEdges]);

  // Re-layout (ELK) whenever the tree structure changes, preserving RF node ids.
  const relayout = useCallback(async () => {
    const pos = await layoutOrg(items.map((n) => ({ id: n.id, parentId: n.parentId })));
    setNodes(
      items.map((it) => ({
        id: it.id,
        type: "org" as const,
        position: pos.get(it.id) ?? { x: 0, y: 0 },
        data: { item: it, setup: mode === "setup" && !degraded, selected: it.id === selectedId, onSelect },
        draggable: mode === "setup" && !degraded,
        width: ORG_NODE_W,
        height: ORG_NODE_H,
      })),
    );
    setTimeout(() => rfRef.current?.fitView({ padding: 0.16 }), 30);
  }, [items, mode, degraded, selectedId, onSelect, setNodes]);

  useEffect(() => {
    if (!mounted) return;
    void relayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, items]);

  // Cheap data refresh (selection highlight / mode) without re-layout.
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        draggable: mode === "setup" && !degraded,
        data: { ...n.data, setup: mode === "setup" && !degraded, selected: n.id === selectedId },
      })),
    );
  }, [mode, degraded, selectedId, setNodes]);

  // ---- shared BFF request (toast + graceful degrade) ----------------------
  const request = useCallback(
    async (input: string, init: RequestInit): Promise<{ ok: boolean; status: number; message?: string }> => {
      try {
        const res = await fetch(input, init);
        if (res.ok) return { ok: true, status: res.status };
        if (res.status === 502) {
          setDegraded(true);
          toast.show("Máy chủ không phản hồi — thay đổi chưa được lưu. Tạm khoá chỉnh sửa.", "info");
          return { ok: false, status: 502 };
        }
        const body = (await res.json().catch(() => null)) as { detail?: { message?: string }; error?: string } | null;
        return { ok: false, status: res.status, message: body?.detail?.message ?? body?.error };
      } catch {
        setDegraded(true);
        toast.show("Không kết nối được máy chủ — thay đổi chưa được lưu.", "info");
        return { ok: false, status: 0 };
      }
    },
    [toast],
  );

  const patchUnit = useCallback(
    (id: string, payload: Record<string, unknown>) =>
      request(`/api/admin/identity/org-units/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      }),
    [request],
  );

  // ---- drag-and-drop re-parent -------------------------------------------
  const persist = useCallback(
    async (id: string, parentId: string | null, prevParentId: string | null) => {
      const r = await patchUnit(id, { parentId });
      if (r.ok) { toast.success("Đã cập nhật sơ đồ"); router.refresh(); return; }
      if (r.status === 502) return; // kept on screen, editing locked
      // Rejected (e.g. cycle 400) — revert the optimistic change.
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, parentId: prevParentId } : n)));
      toast.error(r.message ?? "Không thể cập nhật sơ đồ.");
    },
    [patchUnit, router, toast],
  );

  const onNodeDragStop = useCallback(
    (_e: unknown, dragged: OrgFlowNode) => {
      if (mode !== "setup" || degraded) { void relayout(); return; }
      const inst = rfRef.current;
      if (!inst) return;
      const overlaps = inst.getIntersectingNodes(dragged) as OrgFlowNode[];
      const desc = descendantsOf(items, dragged.id);
      const current = items.find((n) => n.id === dragged.id);
      const target = overlaps.find(
        (o) => o.id !== dragged.id && !desc.has(o.id) && current?.parentId !== o.id,
      );
      if (!target) { void relayout(); return; } // no valid drop → snap back
      const prevParentId = current?.parentId ?? null;
      setItems((prev) => prev.map((n) => (n.id === dragged.id ? { ...n, parentId: target.id } : n)));
      void persist(dragged.id, target.id, prevParentId);
    },
    [mode, degraded, items, relayout, persist],
  );

  // ---- context menu -------------------------------------------------------
  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: OrgFlowNode) => {
      e.preventDefault();
      setSelectedId(node.id);
      const item = items.find((n) => n.id === node.id);
      if (!item) return;
      const rect = containerRef.current?.getBoundingClientRect();
      const x = rect ? e.clientX - rect.left : e.clientX;
      const y = rect ? e.clientY - rect.top : e.clientY;
      // Keep the menu inside the container (est. menu 220×236).
      const maxX = (rect?.width ?? 0) - 224;
      const maxY = (rect?.height ?? 0) - 240;
      setMenu({ x: Math.max(4, Math.min(x, maxX > 0 ? maxX : x)), y: Math.max(4, Math.min(y, maxY > 0 ? maxY : y)), node: item });
    },
    [items],
  );

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  // Fullscreen: refit the canvas when toggled, and allow Esc to exit.
  useEffect(() => {
    const t = setTimeout(() => rfRef.current?.fitView({ padding: 0.2, duration: 200 }), 60);
    if (!full) return () => clearTimeout(t);
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onEsc);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onEsc); };
  }, [full]);

  // ---- action dispatch ----------------------------------------------------
  const runAction = useCallback(
    (key: ActionKey, node: OrgGraphNode) => {
      setMenu(null);
      if (key === "detail") { window.open(`/admin/organization/units/${node.code}`, "_blank"); return; }
      if (mode !== "setup" || degraded) { toast.show("Bật Chế độ thiết lập để chỉnh sửa.", "info"); return; }
      if (key === "delete") { setConfirmDelete(node); return; }
      setDrawer({ kind: key, node });
    },
    [mode, degraded, toast],
  );

  const doDelete = useCallback(async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const node = confirmDelete;
    const r = await request(`/api/admin/identity/org-units/${encodeURIComponent(node.id)}`, { method: "DELETE" });
    setDeleting(false);
    if (r.ok) {
      setItems((prev) => prev.filter((n) => n.id !== node.id));
      setConfirmDelete(null);
      toast.success("Đã xoá đơn vị");
      router.refresh();
      return;
    }
    if (r.status === 502) { setConfirmDelete(null); return; }
    toast.error(r.message ?? "Không thể xoá đơn vị.");
  }, [confirmDelete, request, router, toast]);

  // ---- integrity + stats --------------------------------------------------
  const ids = useMemo(() => new Set(items.map((n) => n.id)), [items]);
  const orphans = useMemo(() => items.filter((n) => n.parentId && !ids.has(n.parentId)), [items, ids]);
  const vacant = useMemo(() => graph.positions.filter((p) => !p.holderName), [graph.positions]);
  const selected = items.find((n) => n.id === selectedId) ?? null;
  const selectedPositions = useMemo<OrgGraphPosition[]>(
    () => (selected ? graph.positions.filter((p) => p.orgUnitId === selected.id) : []),
    [selected, graph.positions],
  );

  const canMutate = mode === "setup" && !degraded;

  // A4 landscape printable width at the 12mm @page margin (globals.css), in
  // CSS px @96dpi: (297mm - 2*12mm) * 96/25.4 ≈ 1032px. Used to shrink a wide
  // tree to fit instead of letting it get cut off past the page edge.
  const PRINT_SAFE_WIDTH_PX = 1032;

  // Print / Export PDF: mark <html> so the print stylesheet reveals only the
  // .org-print-root subtree, hides app chrome, then restores after printing.
  // Also measures the tree's real rendered width and sets --org-print-scale
  // so a wide/deep org chart shrinks to fit the A4 page instead of clipping.
  const handlePrint = useCallback(() => {
    if (view !== "staff") setView("staff");
    const root = document.documentElement;
    const cleanup = () => {
      root.classList.remove("org-printing");
      root.style.removeProperty("--org-print-scale");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    // let React flush the staff view before measuring + printing
    setTimeout(() => {
      const tree = document.querySelector<HTMLElement>(".org-tree");
      const contentWidth = tree?.scrollWidth ?? PRINT_SAFE_WIDTH_PX;
      const scale = Math.min(1, PRINT_SAFE_WIDTH_PX / contentWidth);
      root.style.setProperty("--org-print-scale", String(scale));
      root.classList.add("org-printing");
      window.print();
    }, view === "staff" ? 0 : 120);
  }, [view]);

  return (
    <div className="space-y-4">
      {/* View toggle + print — excluded from print output */}
      <div className="org-print-hide flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 text-xs dark:border-dark-500">
          <button
            onClick={() => setView("unit")}
            className={`px-3 py-1.5 font-medium transition ${view === "unit" ? "bg-primary-600 text-white" : "text-gray-500 hover:bg-gray-100 dark:text-dark-200 dark:hover:bg-dark-600"}`}
          >🏢 Sơ đồ đơn vị</button>
          <button
            onClick={() => setView("staff")}
            className={`px-3 py-1.5 font-medium transition ${view === "staff" ? "bg-primary-600 text-white" : "text-gray-500 hover:bg-gray-100 dark:text-dark-200 dark:hover:bg-dark-600"}`}
          >👥 Sơ đồ nhân sự</button>
        </div>
        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-dark-500 dark:text-dark-200 dark:hover:bg-dark-600"
        >🖨 In / Xuất PDF</button>
      </div>

      {view === "staff" ? (
        <SectionCard title="Sơ đồ nhân sự" bodyClassName="p-0" className="org-print-root">
          <StaffOrgChart graph={graph} />
        </SectionCard>
      ) : (
      <>
      <div className={`grid grid-cols-2 gap-3 md:grid-cols-4 ${full ? "hidden" : ""}`}>
        <StatCard label="Đơn vị" value={String(items.length)} icon="🏢" tone="primary" />
        <StatCard label="Vị trí" value={String(graph.positions.length)} icon="💼" tone="info" />
        <StatCard label="Vị trí khuyết" value={String(vacant.length)} icon="⚠️" tone={vacant.length ? "warning" : "success"} />
        <StatCard label="Đơn vị mồ côi" value={String(orphans.length)} icon="🔗" tone={orphans.length ? "error" : "success"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className={full ? "fixed inset-0 z-[70] bg-gray-100 p-2 dark:bg-dark-800" : "xl:col-span-2"}>
          <SectionCard
            title="Cây thừa kế đơn vị"
            bodyClassName="p-0"
            className={full ? "flex h-full flex-col" : undefined}
            action={
              <div className="flex items-center gap-2">
                {degraded && <Badge tone="warning">Chưa lưu máy chủ</Badge>}
                <div className="inline-flex overflow-hidden rounded-lg border border-gray-200 text-xs dark:border-dark-500">
                  <button
                    onClick={() => setMode("view")}
                    className={`px-2.5 py-1 font-medium transition ${mode === "view" ? "bg-primary-600 text-white" : "text-gray-500 hover:bg-gray-100 dark:text-dark-200 dark:hover:bg-dark-600"}`}
                  >👁 Chế độ xem</button>
                  <button
                    onClick={() => !degraded && setMode("setup")}
                    disabled={degraded}
                    className={`px-2.5 py-1 font-medium transition disabled:opacity-40 ${mode === "setup" ? "bg-primary-600 text-white" : "text-gray-500 hover:bg-gray-100 dark:text-dark-200 dark:hover:bg-dark-600"}`}
                  >⚙ Chế độ thiết lập</button>
                </div>
                <button
                  type="button"
                  onClick={() => setFull((v) => !v)}
                  aria-label={full ? "Thu nhỏ sơ đồ" : "Mở rộng sơ đồ toàn màn hình"}
                  title={full ? "Thu nhỏ (Esc)" : "Toàn màn hình"}
                  className="flex size-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-100 dark:border-dark-500 dark:text-dark-200 dark:hover:bg-dark-600"
                >
                  {full ? <ArrowsPointingInIcon className="size-4" /> : <ArrowsPointingOutIcon className="size-4" />}
                </button>
              </div>
            }
          >
            {mode === "setup" && !degraded && (
              <p className="border-b border-primary-200 bg-primary-50/60 px-4 py-2 text-xs text-primary-700 dark:border-primary-900 dark:bg-primary-950/30 dark:text-primary-300">
                Kéo một đơn vị và thả lên đơn vị khác để đặt làm đơn vị cha. Nhấp chuột phải vào một đơn vị để mở menu thao tác (đổi tên, đổi trưởng, thêm/di chuyển/xoá).
              </p>
            )}
            <div ref={containerRef} className={`relative w-full ${full ? "h-[calc(100dvh-6rem)] flex-1" : "h-[560px]"}`} style={{ minHeight: 420 }}>
              {mounted ? (
                <ReactFlow
                  onInit={(inst) => { rfRef.current = inst as ReactFlowInstance<OrgFlowNode, Edge>; }}
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeDragStop={onNodeDragStop}
                  onNodeContextMenu={onNodeContextMenu}
                  nodesConnectable={false}
                  elementsSelectable
                  fitView
                  fitViewOptions={{ padding: 0.16 }}
                  minZoom={0.2}
                  proOptions={{ hideAttribution: true }}
                  className="bg-gray-50 dark:bg-dark-800"
                >
                  <Background gap={16} className="text-gray-200 dark:text-dark-600" />
                  <Controls className="!shadow-soft" showInteractive={false} />
                  <MiniMap pannable zoomable className="!bg-white dark:!bg-dark-700" maskColor="rgba(0,0,0,0.06)" />
                </ReactFlow>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400 dark:text-dark-300">Đang tải sơ đồ tổ chức…</div>
              )}

              {menu && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  onContextMenu={(e) => e.preventDefault()}
                  className="absolute z-20 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-dark-500 dark:bg-dark-700"
                  style={{ left: menu.x, top: menu.y }}
                >
                  <div className="truncate border-b border-gray-100 px-3 py-1.5 text-xs font-medium text-gray-500 dark:border-dark-600 dark:text-dark-300" title={menu.node.name}>
                    {menu.node.name}
                  </div>
                  {ACTIONS.map((a) => {
                    const disabled = a.mutating && !canMutate;
                    return (
                      <button
                        key={a.key}
                        onClick={() => runAction(a.key, menu.node)}
                        disabled={disabled}
                        className={[
                          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition",
                          disabled
                            ? "cursor-not-allowed text-gray-300 dark:text-dark-500"
                            : a.danger
                              ? "text-error hover:bg-error/10"
                              : "text-gray-700 hover:bg-gray-100 dark:text-dark-100 dark:hover:bg-dark-600",
                        ].join(" ")}
                      >
                        <span className="w-4 text-center">{a.icon}</span>
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </SectionCard>
        </div>

        <div className={`space-y-4 ${full ? "hidden" : ""}`}>
          {selected ? (
            <SectionCard
              title="Chi tiết đơn vị"
              accent="neutral"
              action={<Link href={`/admin/organization/units/${selected.code}`} className="text-sm text-primary-600 hover:underline">Mở đầy đủ →</Link>}
            >
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="text-gray-400">Tên</span><span className="font-medium text-gray-800 dark:text-dark-100">{selected.name}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-400">Mã</span><span className="font-mono text-gray-600 dark:text-dark-200">{selected.code}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-400">Loại</span><Badge tone={TYPE_TONE[selected.type] ?? "neutral"}>{TYPE_LABEL[selected.type] ?? selected.type}</Badge></div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Trưởng đơn vị</span>
                  <span className="text-right text-gray-600 dark:text-dark-200">
                    {selected.headName ?? "—"}
                    {selected.headTitle && <span className="block text-xs text-gray-400">{selected.headTitle}</span>}
                  </span>
                </div>
                <div className="flex items-center justify-between"><span className="text-gray-400">Đơn vị con</span><span className="text-gray-600 dark:text-dark-200">{items.filter((n) => n.parentId === selected.id).length}</span></div>
              </div>

              {/* Cấu hình — actions (mirror the right-click menu). */}
              <div className="mt-3 border-t border-gray-100 pt-3 dark:border-dark-600">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-400">Cấu hình</p>
                  {!canMutate && <span className="text-[11px] text-gray-400">Chỉ đọc — bật Chế độ thiết lập</span>}
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {ACTIONS.map((a) => {
                    const disabled = a.mutating && !canMutate;
                    return (
                      <button
                        key={a.key}
                        onClick={() => runAction(a.key, selected)}
                        disabled={disabled}
                        className={[
                          "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-left text-sm transition",
                          disabled
                            ? "cursor-not-allowed border-gray-100 text-gray-300 dark:border-dark-600 dark:text-dark-500"
                            : a.danger
                              ? "border-error/30 text-error hover:bg-error/10"
                              : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-600",
                        ].join(" ")}
                      >
                        <span className="w-4 text-center">{a.icon}</span>
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {selectedPositions.length > 0 && (
                <div className="mt-3 border-t border-gray-100 pt-3 dark:border-dark-600">
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-gray-400">Vị trí & nhân sự phụ thuộc</p>
                  <ul className="space-y-1">
                    {selectedPositions.map((p) => (
                      <li key={p.id} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-dark-200">{p.name}</span>
                        <span className={p.holderName ? "text-gray-500 dark:text-dark-300" : "text-warning"}>{p.holderName ?? "Khuyết"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </SectionCard>
          ) : null}

          <AiRecap
            title="X.AI · Kiểm tra toàn vẹn"
            points={[
              orphans.length ? `${orphans.length} đơn vị tham chiếu cha không tồn tại.` : "Không có đơn vị mồ côi.",
              vacant.length ? `${vacant.length} vị trí khuyết người giữ.` : "Mọi vị trí đều có người giữ.",
              "Không phát hiện vòng lặp trong đường thừa kế (kiểm chứng phía máy chủ khi kéo-thả).",
            ]}
            footnote="Kết quả là gợi ý — cần người xác nhận trước khi chỉnh sơ đồ."
          />
        </div>
      </div>
      </>
      )}

      {/* ---- drawers ---- */}
      {drawer?.kind === "rename" && (
        <RenameDrawer
          node={drawer.node}
          onClose={() => setDrawer(null)}
          onSubmit={async (payload) => {
            const r = await patchUnit(drawer.node.id, payload);
            if (r.ok) {
              setItems((prev) => prev.map((n) => (n.id === drawer.node.id ? { ...n, ...payload } as OrgGraphNode : n)));
              toast.success("Đã cập nhật đơn vị");
              router.refresh();
              return true;
            }
            if (r.status !== 502) toast.error(r.message ?? "Không thể cập nhật đơn vị.");
            return false;
          }}
        />
      )}
      {drawer?.kind === "head" && (
        <HeadDrawer
          node={drawer.node}
          people={people}
          onClose={() => setDrawer(null)}
          onSubmit={async (headId) => {
            const r = await patchUnit(drawer.node.id, { headId });
            if (r.ok) {
              toast.success("Đã cập nhật trưởng đơn vị");
              router.refresh();
              return true;
            }
            if (r.status !== 502) toast.error(r.message ?? "Không thể cập nhật trưởng đơn vị.");
            return false;
          }}
        />
      )}
      {drawer?.kind === "addChild" && (
        <AddChildDrawer
          node={drawer.node}
          onClose={() => setDrawer(null)}
          onSubmit={async (payload) => {
            const r = await request("/api/admin/identity/org-units", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ ...payload, parentId: drawer.node.id }),
            });
            if (r.ok) {
              toast.success("Đã thêm đơn vị con");
              router.refresh();
              return true;
            }
            if (r.status !== 502) toast.error(r.message ?? (r.status === 409 ? "Mã đơn vị đã tồn tại." : "Không thể thêm đơn vị."));
            return false;
          }}
        />
      )}
      {drawer?.kind === "move" && (
        <MoveDrawer
          node={drawer.node}
          items={items}
          onClose={() => setDrawer(null)}
          onSubmit={async (parentId) => {
            const prev = drawer.node.parentId;
            const r = await patchUnit(drawer.node.id, { parentId });
            if (r.ok) {
              setItems((cur) => cur.map((n) => (n.id === drawer.node.id ? { ...n, parentId } : n)));
              toast.success("Đã di chuyển đơn vị");
              router.refresh();
              return true;
            }
            if (r.status !== 502) toast.error(r.message ?? "Không thể di chuyển đơn vị.");
            void prev;
            return false;
          }}
        />
      )}

      {/* ---- delete confirm ---- */}
      {confirmDelete && (
        <ConfirmDialog
          title="Xoá đơn vị"
          message={`Bạn chắc chắn muốn xoá "${confirmDelete.name}"? Chỉ xoá được đơn vị không còn đơn vị con và không còn vị trí.`}
          confirmLabel="Xoá"
          submitting={deleting}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={doDelete}
        />
      )}
    </div>
  );
}

// ---- drawers --------------------------------------------------------------
function RenameDrawer({ node, onClose, onSubmit }: { node: OrgGraphNode; onClose: () => void; onSubmit: (p: { name: string; type: string }) => Promise<boolean> }) {
  const [name, setName] = useState(node.name);
  const [type, setType] = useState(node.type);
  const [submitting, setSubmitting] = useState(false);
  return (
    <FormDrawer
      open
      onClose={onClose}
      title="Đổi tên / Đổi loại"
      description={node.code}
      submitting={submitting}
      submitDisabled={!name.trim()}
      onSubmit={async () => {
        setSubmitting(true);
        const ok = await onSubmit({ name: name.trim(), type });
        setSubmitting(false);
        if (ok) onClose();
      }}
    >
      <FormSection title="Thông tin đơn vị">
        <TextField label="Tên đơn vị" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
        <SelectField label="Loại đơn vị" name="type" value={type} onChange={(e) => setType(e.target.value)} options={TYPE_OPTIONS} />
      </FormSection>
    </FormDrawer>
  );
}

function HeadDrawer({ node, people, onClose, onSubmit }: { node: OrgGraphNode; people: OrgPerson[]; onClose: () => void; onSubmit: (headId: string | null) => Promise<boolean> }) {
  const [headId, setHeadId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const options: SelectFieldOption[] = [{ value: "", label: "— Khuyết —" }, ...people.map((p) => ({ value: p.id, label: p.name }))];
  return (
    <FormDrawer
      open
      onClose={onClose}
      title="Đổi trưởng đơn vị"
      description={node.name}
      submitting={submitting}
      onSubmit={async () => {
        setSubmitting(true);
        const ok = await onSubmit(headId ? headId : null);
        setSubmitting(false);
        if (ok) onClose();
      }}
    >
      <FormSection title="Trưởng đơn vị" description="Chọn người giữ ghế trưởng đơn vị, hoặc để khuyết.">
        <SelectField label="Người giữ" name="headId" value={headId} onChange={(e) => setHeadId(e.target.value)} options={options} />
      </FormSection>
    </FormDrawer>
  );
}

function AddChildDrawer({ node, onClose, onSubmit }: { node: OrgGraphNode; onClose: () => void; onSubmit: (p: { code: string; name: string; type: string }) => Promise<boolean> }) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("DEPARTMENT");
  const [submitting, setSubmitting] = useState(false);
  return (
    <FormDrawer
      open
      onClose={onClose}
      title="Thêm đơn vị con"
      description={`Trực thuộc: ${node.name}`}
      submitting={submitting}
      submitDisabled={!code.trim() || !name.trim()}
      onSubmit={async () => {
        setSubmitting(true);
        const ok = await onSubmit({ code: code.trim().toUpperCase(), name: name.trim(), type });
        setSubmitting(false);
        if (ok) onClose();
      }}
    >
      <FormSection title="Đơn vị mới">
        <TextField label="Mã đơn vị" name="code" value={code} onChange={(e) => setCode(e.target.value)} hint="Duy nhất trong tenant (vd: RND, QA)." required />
        <TextField label="Tên đơn vị" name="name" value={name} onChange={(e) => setName(e.target.value)} required />
        <SelectField label="Loại đơn vị" name="type" value={type} onChange={(e) => setType(e.target.value)} options={TYPE_OPTIONS} />
      </FormSection>
    </FormDrawer>
  );
}

function MoveDrawer({ node, items, onClose, onSubmit }: { node: OrgGraphNode; items: OrgGraphNode[]; onClose: () => void; onSubmit: (parentId: string | null) => Promise<boolean> }) {
  const [parentId, setParentId] = useState<string>(node.parentId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const desc = useMemo(() => descendantsOf(items, node.id), [items, node.id]);
  const options: SelectFieldOption[] = [
    { value: "", label: "— (Gốc, không đơn vị cha) —" },
    ...items.filter((u) => u.id !== node.id && !desc.has(u.id)).map((u) => ({ value: u.id, label: `${u.name} (${u.code})` })),
  ];
  return (
    <FormDrawer
      open
      onClose={onClose}
      title="Di chuyển đơn vị"
      description={node.name}
      submitting={submitting}
      onSubmit={async () => {
        setSubmitting(true);
        const ok = await onSubmit(parentId ? parentId : null);
        setSubmitting(false);
        if (ok) onClose();
      }}
    >
      <FormSection title="Đơn vị cha mới" description="Không thể chọn chính nó hoặc đơn vị con của nó.">
        <SelectField label="Đơn vị cha" name="parentId" value={parentId} onChange={(e) => setParentId(e.target.value)} options={options} />
      </FormSection>
    </FormDrawer>
  );
}

// ---- confirm dialog -------------------------------------------------------
function ConfirmDialog({ title, message, confirmLabel, submitting, onCancel, onConfirm }: { title: string; message: string; confirmLabel: string; submitting: boolean; onCancel: () => void; onConfirm: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !submitting) onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel, submitting]);
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm dark:bg-black/50" onClick={() => !submitting && onCancel()} aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-xl border border-gray-200 bg-white p-5 shadow-xl dark:border-dark-600 dark:bg-dark-700">
        <h3 className="font-heading text-base font-semibold text-gray-800 dark:text-dark-50">{title}</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-dark-300">{message}</p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={submitting} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-dark-500 dark:text-dark-100 dark:hover:bg-dark-600">Huỷ</button>
          <button type="button" onClick={onConfirm} disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-error px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-error/90 disabled:cursor-not-allowed disabled:opacity-50">
            {submitting && <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {submitting ? "Đang xử lý…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function OrgChart({ graph, people }: { graph: OrgGraph; people: OrgPerson[] }) {
  return (
    <ReactFlowProvider>
      <ChartInner graph={graph} people={people} />
    </ReactFlowProvider>
  );
}
