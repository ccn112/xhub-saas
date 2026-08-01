"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Stage, Layer, Line, Circle, Text, Rect, Group } from "react-konva";
import type { FloorPlan, Geometry, Point, Zone, SceneBinding } from "@/xoffice/lib/ioc-data";
import { ICON_GLYPHS } from "@/xoffice/lib/ioc-data";

/**
 * Floor Plan Editor (DT-01, IOC-S02) — React-Konva, client-only (ADR-0001).
 *
 * Geometry is authored and stored in METERS; pixels exist only in the viewport
 * transform (`scale` + `offset`), per doc 04. Tools: select, draw room polygon,
 * move vertex, delete zone, calibrate metersPerUnit, undo/redo, autosave.
 *
 * Autosave carries the `revision` the editor loaded; a concurrent edit makes the
 * API answer 409 and the editor surfaces it instead of silently overwriting.
 * The API re-validates every polygon (AT-004) — the editor's client-side checks
 * are UX only and are never the security boundary.
 */

const GRID_M = 1;

interface Props {
  plan: FloorPlan;
  orgUnits: Array<{ id: string; code: string; name: string }>;
  bindings: SceneBinding[];
  sceneId: string | null;
  iconKeys: string[];
}

type Tool = "select" | "room";

function snap(v: number, step = 0.5) {
  return Math.round(v / step) * step;
}

function centroid(poly: Point[]) {
  return {
    x: poly.reduce((s, p) => s + p.x, 0) / poly.length,
    y: poly.reduce((s, p) => s + p.y, 0) / poly.length,
  };
}

/** Client-side mirror of the server rule — UX feedback only, never the gate. */
function selfIntersects(poly: Point[]): boolean {
  const n = poly.length;
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const sgn = (v: number) => (Math.abs(v) < 1e-9 ? 0 : v > 0 ? 1 : -1);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if ((j + 1) % n === i || (i + 1) % n === j) continue;
      const a1 = poly[i], a2 = poly[(i + 1) % n], b1 = poly[j], b2 = poly[(j + 1) % n];
      const d1 = sgn(cross(b1, b2, a1)), d2 = sgn(cross(b1, b2, a2));
      const d3 = sgn(cross(a1, a2, b1)), d4 = sgn(cross(a1, a2, b2));
      if (d1 !== d2 && d3 !== d4) return true;
    }
  }
  return false;
}

export default function FloorPlanEditor({ plan, orgUnits, bindings, sceneId, iconKeys }: Props) {
  const [geometry, setGeometry] = useState<Geometry>(plan.geometry ?? { walls: [], zones: [] });
  const [history, setHistory] = useState<Geometry[]>([]);
  const [future, setFuture] = useState<Geometry[]>([]);
  const [tool, setTool] = useState<Tool>("select");
  const [draft, setDraft] = useState<Point[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [revision, setRevision] = useState(plan.revision);
  const [metersPerUnit, setMetersPerUnit] = useState(plan.metersPerUnit);
  const [status, setStatus] = useState<string>("");
  const [dirty, setDirty] = useState(false);
  const [bindMap, setBindMap] = useState<Record<string, { orgUnitId: string; iconKey: string }>>(
    Object.fromEntries(bindings.map((b) => [b.zoneId, { orgUnitId: b.bindingId, iconKey: b.iconKey ?? "" }])),
  );
  const [size, setSize] = useState({ w: 900, h: 520 });
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: Math.max(380, Math.round(el.clientWidth * 0.5)) }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: Math.max(380, Math.round(el.clientWidth * 0.5)) });
    return () => ro.disconnect();
  }, []);

  // Fit the meter-space extents to the viewport. This IS the pixel transform.
  const view = useMemo(() => {
    const pts = geometry.zones.flatMap((z) => z.polygon).concat(draft);
    const maxX = Math.max(20, ...pts.map((p) => p.x));
    const maxY = Math.max(12, ...pts.map((p) => p.y));
    const scale = Math.min((size.w - 40) / (maxX + 4), (size.h - 40) / (maxY + 4));
    return { scale, ox: 20, oy: 20, maxX, maxY };
  }, [geometry, draft, size]);

  const toPx = useCallback((p: Point) => ({ x: view.ox + p.x * view.scale, y: view.oy + p.y * view.scale }), [view]);
  const toM = useCallback((x: number, y: number) => ({ x: snap((x - view.ox) / view.scale), y: snap((y - view.oy) / view.scale) }), [view]);

  const commit = useCallback((next: Geometry) => {
    setHistory((h) => [...h.slice(-49), geometry]);
    setFuture([]);
    setGeometry(next);
    setDirty(true);
  }, [geometry]);

  const undo = () => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [geometry, ...f]);
      setGeometry(prev);
      setDirty(true);
      return h.slice(0, -1);
    });
  };
  const redo = () => {
    setFuture((f) => {
      if (!f.length) return f;
      setHistory((h) => [...h, geometry]);
      setGeometry(f[0]);
      setDirty(true);
      return f.slice(1);
    });
  };

  const save = useCallback(async () => {
    setStatus("Đang lưu…");
    const res = await fetch(`/api/ioc/floor-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revision, geometry, metersPerUnit }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setStatus(`Lỗi lưu: ${json?.detail?.message ?? json?.error ?? res.status}`);
      return;
    }
    setRevision(json.revision);
    setDirty(false);
    setStatus(`Đã lưu bản nháp (revision ${json.revision})`);
  }, [plan.id, revision, geometry, metersPerUnit]);

  // Debounced autosave — draft only, never a published version.
  useEffect(() => {
    if (!dirty) return;
    const t = setTimeout(() => { void save(); }, 1500);
    return () => clearTimeout(t);
  }, [dirty, save]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      if (e.key === "Escape") setDraft([]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function onStageClick(e: { evt: MouseEvent }) {
    if (tool !== "room") return;
    const stage = (e as unknown as { target: { getStage: () => { getPointerPosition: () => { x: number; y: number } | null } } }).target.getStage();
    const pos = stage.getPointerPosition();
    if (!pos) return;
    setDraft((d) => [...d, toM(pos.x, pos.y)]);
  }

  function finishRoom() {
    if (draft.length < 3) { setStatus("Cần ít nhất 3 điểm để tạo vùng"); return; }
    if (selfIntersects(draft)) { setStatus("Đa giác tự cắt — hãy vẽ lại (máy chủ sẽ từ chối)"); return; }
    const id = `zone-${Date.now().toString(36)}`;
    commit({ ...geometry, zones: [...geometry.zones, { id, name: `Vùng ${geometry.zones.length + 1}`, kind: "DEPARTMENT", orgUnitId: null, polygon: draft }] });
    setDraft([]);
    setSelected(id);
    setTool("select");
  }

  function deleteZone(id: string) {
    commit({ ...geometry, zones: geometry.zones.filter((z) => z.id !== id) });
    if (selected === id) setSelected(null);
  }

  function renameZone(id: string, name: string) {
    setGeometry((g) => ({ ...g, zones: g.zones.map((z) => (z.id === id ? { ...z, name } : z)) }));
    setDirty(true);
  }

  function moveVertex(zoneId: string, idx: number, p: Point) {
    setGeometry((g) => ({
      ...g,
      zones: g.zones.map((z) => (z.id === zoneId ? { ...z, polygon: z.polygon.map((v, i) => (i === idx ? p : v)) } : z)),
    }));
    setDirty(true);
  }

  async function bindZone(zone: Zone, orgUnitId: string, iconKey: string) {
    if (!sceneId) { setStatus("Chưa có scene cho mặt bằng này — tạo scene trước khi gán phòng ban"); return; }
    setBindMap((m) => ({ ...m, [zone.id]: { orgUnitId, iconKey } }));
    if (!orgUnitId) return;
    const res = await fetch(`/api/ioc/scenes/${sceneId}/bindings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ zoneId: zone.id, bindingType: "ORG_UNIT", bindingId: orgUnitId, iconKey: iconKey || null }),
    });
    const json = await res.json().catch(() => null);
    setStatus(res.ok ? `Đã gán "${zone.name}" → đơn vị` : `Lỗi gán: ${json?.detail?.message ?? res.status}`);
  }

  async function publish() {
    setStatus("Đang xuất bản…");
    await save();
    const res = await fetch(`/api/ioc/floor-plans/${plan.id}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ note: "Xuất bản từ Twin Studio" }),
    });
    const json = await res.json().catch(() => null);
    setStatus(res.ok ? `Đã xuất bản phiên bản v${json.versionNo} (checksum ${String(json.checksum).slice(0, 12)}…) — bản này là bất biến` : `Lỗi xuất bản: ${json?.detail?.message ?? res.status}`);
  }

  const selectedZone = geometry.zones.find((z) => z.id === selected) ?? null;
  const gridLines: number[][] = [];
  for (let x = 0; x <= view.maxX + 2; x += GRID_M) gridLines.push([view.ox + x * view.scale, view.oy, view.ox + x * view.scale, view.oy + (view.maxY + 2) * view.scale]);
  for (let y = 0; y <= view.maxY + 2; y += GRID_M) gridLines.push([view.ox, view.oy + y * view.scale, view.ox + (view.maxX + 2) * view.scale, view.oy + y * view.scale]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-gray-300 p-0.5 dark:border-dark-500">
          <button type="button" onClick={() => { setTool("select"); setDraft([]); }} className={`rounded-md px-3 py-1.5 text-xs font-medium ${tool === "select" ? "bg-primary-600 text-white" : "text-gray-600 dark:text-dark-200"}`}>Chọn</button>
          <button type="button" onClick={() => setTool("room")} className={`rounded-md px-3 py-1.5 text-xs font-medium ${tool === "room" ? "bg-primary-600 text-white" : "text-gray-600 dark:text-dark-200"}`}>Vẽ vùng</button>
        </div>
        {tool === "room" ? (
          <>
            <button type="button" onClick={finishRoom} className="rounded-lg bg-success px-3 py-1.5 text-xs font-medium text-white">Hoàn tất vùng ({draft.length} điểm)</button>
            <button type="button" onClick={() => setDraft([])} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs dark:border-dark-500 dark:text-dark-100">Huỷ</button>
          </>
        ) : null}
        <button type="button" onClick={undo} disabled={!history.length} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-40 dark:border-dark-500 dark:text-dark-100">Hoàn tác</button>
        <button type="button" onClick={redo} disabled={!future.length} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs disabled:opacity-40 dark:border-dark-500 dark:text-dark-100">Làm lại</button>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-dark-200">
          Tỷ lệ (m/đơn vị)
          <input
            type="number" step="0.01" min="0.01" value={metersPerUnit}
            onChange={(e) => { setMetersPerUnit(Number(e.target.value) || 1); setDirty(true); }}
            className="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50"
          />
        </label>
        <button type="button" onClick={() => void save()} className="rounded-lg border border-primary-600 px-3 py-1.5 text-xs font-medium text-primary-600">Lưu nháp</button>
        <button type="button" onClick={() => void publish()} className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white">Xuất bản phiên bản</button>
        {status ? <span className="text-xs text-gray-500 dark:text-dark-300">{status}</span> : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <div ref={wrapRef} className="overflow-hidden rounded-lg border border-gray-200 bg-slate-50 dark:border-dark-600 dark:bg-dark-800">
          <Stage width={size.w} height={size.h} onClick={onStageClick}>
            <Layer listening={false}>
              {gridLines.map((pts, i) => (
                <Line key={i} points={pts} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.5} />
              ))}
            </Layer>
            <Layer>
              {geometry.zones.map((z) => {
                const pts = z.polygon.flatMap((p) => { const q = toPx(p); return [q.x, q.y]; });
                const c = toPx(centroid(z.polygon));
                const isSel = z.id === selected;
                const bind = bindMap[z.id];
                const org = bind ? orgUnits.find((o) => o.id === bind.orgUnitId) : undefined;
                return (
                  <Group key={z.id} onClick={() => { setSelected(z.id); setTool("select"); }}>
                    <Line points={pts} closed fill={isSel ? "#2563eb44" : "#64748b33"} stroke={isSel ? "#2563eb" : "#64748b"} strokeWidth={isSel ? 2 : 1.2} />
                    {bind?.iconKey ? <Text x={c.x - 10} y={c.y - 26} text={ICON_GLYPHS[bind.iconKey] ?? "•"} fontSize={18} /> : null}
                    <Text x={c.x - 60} y={c.y - 6} width={120} align="center" text={org?.name ?? z.name} fontSize={12} fontStyle="600" fill="#0f172a" />
                    {isSel
                      ? z.polygon.map((p, i) => {
                          const q = toPx(p);
                          return (
                            <Circle
                              key={i} x={q.x} y={q.y} radius={5} fill="#ffffff" stroke="#2563eb" strokeWidth={2} draggable
                              onDragEnd={(e) => moveVertex(z.id, i, toM(e.target.x(), e.target.y()))}
                            />
                          );
                        })
                      : null}
                  </Group>
                );
              })}
              {draft.length ? (
                <>
                  <Line points={draft.flatMap((p) => { const q = toPx(p); return [q.x, q.y]; })} stroke="#16a34a" strokeWidth={2} dash={[6, 4]} closed={draft.length > 2} fill="#16a34a22" />
                  {draft.map((p, i) => { const q = toPx(p); return <Circle key={i} x={q.x} y={q.y} radius={4} fill="#16a34a" />; })}
                </>
              ) : null}
              <Rect x={view.ox} y={view.oy + (view.maxY + 1.4) * view.scale} width={view.scale} height={3} fill="#0f172a" />
              <Text x={view.ox + view.scale + 6} y={view.oy + (view.maxY + 1.1) * view.scale} text={`${GRID_M} m`} fontSize={11} fill="#475569" />
            </Layer>
          </Stage>
        </div>

        <aside className="space-y-3 rounded-lg border border-gray-200 p-3 dark:border-dark-600">
          <h3 className="font-heading text-sm font-semibold text-gray-800 dark:text-dark-50">Thuộc tính vùng</h3>
          {selectedZone ? (
            <div className="space-y-2.5">
              <label className="block text-xs text-gray-500 dark:text-dark-300">
                Tên vùng
                <input value={selectedZone.name} onChange={(e) => renameZone(selectedZone.id, e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50" />
              </label>
              <label className="block text-xs text-gray-500 dark:text-dark-300">
                Gán đơn vị (OrgUnit thật từ Identity)
                <select
                  value={bindMap[selectedZone.id]?.orgUnitId ?? ""}
                  onChange={(e) => void bindZone(selectedZone, e.target.value, bindMap[selectedZone.id]?.iconKey ?? "")}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50"
                >
                  <option value="">— chưa gán —</option>
                  {orgUnits.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.name}</option>)}
                </select>
              </label>
              <label className="block text-xs text-gray-500 dark:text-dark-300">
                Biểu tượng (từ danh mục icon)
                <select
                  value={bindMap[selectedZone.id]?.iconKey ?? ""}
                  onChange={(e) => void bindZone(selectedZone, bindMap[selectedZone.id]?.orgUnitId ?? "", e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-dark-500 dark:bg-dark-700 dark:text-dark-50"
                >
                  <option value="">— không —</option>
                  {iconKeys.map((k) => <option key={k} value={k}>{ICON_GLYPHS[k] ?? ""} {k}</option>)}
                </select>
              </label>
              <p className="text-[11px] text-gray-400">{selectedZone.polygon.length} đỉnh · toạ độ theo mét</p>
              <button type="button" onClick={() => deleteZone(selectedZone.id)} className="w-full rounded-lg border border-error px-3 py-1.5 text-xs font-medium text-error">Xoá vùng</button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Chọn một vùng trên mặt bằng, hoặc dùng công cụ “Vẽ vùng” để tạo mới.</p>
          )}
          <div className="border-t border-gray-200 pt-2 text-[11px] text-gray-400 dark:border-dark-600">
            <p>Bản nháp tự lưu sau 1,5 giây. Phiên bản đã xuất bản là bất biến — mọi chỉnh sửa tạo phiên bản mới.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
