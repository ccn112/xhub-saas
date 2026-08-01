"use client";

import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { ArrowsPointingInIcon, ArrowsPointingOutIcon } from "@heroicons/react/24/outline";
import { STATE_FILL, STATE_LABEL, ICON_GLYPHS, type ZoneMetric, type RuntimeScene, type InsightZone, type FlowEdge } from "@/xoffice/lib/ioc-data";

// Client-only: Babylon touches `window` at import time (ADR-0002).
const TwinScene3D = dynamic(() => import("./TwinScene3D.client"), {
  ssr: false,
  loading: () => <div className="flex h-[460px] items-center justify-center text-sm text-gray-400">Đang tải bộ dựng 3D…</div>,
});

/** Renderer error boundary — a 3D crash must never take the page down (AT-007). */
class RendererBoundary extends Component<{ children: ReactNode; onError: (m: string) => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error.message);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The Office Twin viewer (DT-02).
 *
 * Constitution #9: the 2D SVG plan and the zone list are rendered by the SERVER
 * and passed in as `plan2d` / children — they are ALWAYS present. This component
 * only adds the optional 3D canvas. If WebGL is missing, Babylon fails to load,
 * or the renderer throws, `mode` snaps back to 2D and the user loses nothing but
 * the canvas.
 */
export function TwinViewer({
  scene,
  zones,
  plan2d,
  insightZones = [],
  flows = [],
  selectedZoneId,
  onZoneClick,
}: {
  scene: RuntimeScene;
  zones: ZoneMetric[];
  plan2d: ReactNode;
  insightZones?: InsightZone[];
  flows?: FlowEdge[];
  /** Zone drill-down (DT-06): which zone is currently selected, and the handler
   * fired when the user clicks a zone in 2D, 3D, or the accessible list —
   * all three paths share the same selection so switching view modes never
   * loses the drill-down panel's context. */
  selectedZoneId?: string | null;
  onZoneClick?: (zoneId: string) => void;
}) {
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [threeDError, setThreeDError] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  // Fullscreen height for the Babylon canvas. CSS alone is NOT enough: the WebGL
  // drawing buffer keeps its old pixel size until engine.resize() runs, so the
  // canvas would render a stretched, low-res image. Changing this prop resizes
  // the element, and the dispatched `resize` event below drives the engine's own
  // listener (TwinScene3D registers window.addEventListener("resize", …)).
  const canvasHeight = full ? Math.max(320, (typeof window !== "undefined" ? window.innerHeight : 900) - 210) : 460;

  const fail = (m: string) => {
    setThreeDError(m);
    setMode("2d");
  };

  // Event delegation, not a per-zone onClick: `plan2d` is the SERVER-rendered
  // SVG passed in as a prop (Constitution #9 — it must stay JS-free on its
  // own), so TwinPlan2D only tags each zone with `data-zone-id`. One handler
  // here recovers the id via closest(), same technique either mode needs.
  const handlePlan2dClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = (e.target as HTMLElement).closest?.("[data-zone-id]");
    const zoneId = el?.getAttribute("data-zone-id");
    if (zoneId) onZoneClick?.(zoneId);
  };

  // `plan2d` is a SERVER-rendered element (Constitution #9) — once it reaches
  // the client it is inert; re-passing `selectedZoneId` as a prop can't make
  // Next.js re-invoke that Server Component. So the live highlight is applied
  // imperatively here, directly on the already-rendered SVG DOM, via the same
  // `data-zone-id` markers the click handler above reads.
  const plan2dWrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = plan2dWrapRef.current;
    if (!root) return;
    root.querySelectorAll<SVGGElement>("[data-zone-id]").forEach((g) => {
      const isSelected = g.getAttribute("data-zone-id") === selectedZoneId;
      const poly = g.querySelector("polygon");
      poly?.setAttribute("fill-opacity", isSelected ? "0.34" : "0.16");
      poly?.setAttribute("stroke-width", isSelected ? "0.32" : "0.12");
    });
  }, [selectedZoneId, plan2d]);

  // Same fullscreen contract as admin/organization/OrgChart.tsx: refit the
  // renderer on toggle, Esc to exit.
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
    if (!full) return () => clearTimeout(t);
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); };
    window.addEventListener("keydown", onEsc);
    return () => { clearTimeout(t); window.removeEventListener("keydown", onEsc); };
  }, [full, mode]);

  return (
    <div className={full ? "fixed inset-0 z-[70] space-y-3 overflow-y-auto bg-gray-100 p-3 dark:bg-dark-800" : "space-y-3"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg border border-gray-300 p-0.5 dark:border-dark-500" role="tablist" aria-label="Chế độ hiển thị bản sao số">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "2d"}
            onClick={() => setMode("2d")}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${mode === "2d" ? "bg-primary-600 text-white" : "text-gray-600 dark:text-dark-200"}`}
          >
            Mặt bằng 2D
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "3d"}
            onClick={() => setMode("3d")}
            disabled={!!threeDError}
            className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${mode === "3d" ? "bg-primary-600 text-white" : "text-gray-600 dark:text-dark-200"}`}
          >
            Không gian 3D
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {(["GOOD", "NORMAL", "BUSY", "OVERLOADED", "NO_DATA"] as const).map((s) => (
            <span key={s} className="inline-flex items-center gap-1 text-gray-500 dark:text-dark-300">
              <span className="size-2.5 rounded-sm" style={{ background: STATE_FILL[s] }} aria-hidden="true" />
              {STATE_LABEL[s]}
            </span>
          ))}
          {mode === "3d" ? <span className="text-gray-400">· chiều cao khối = mức tải</span> : null}
          {flows.length ? (
            <span className="inline-flex items-center gap-1 text-gray-500 dark:text-dark-300">
              <span className="h-0.5 w-4 rounded-full" style={{ background: "#38bdf8" }} aria-hidden="true" />
              {flows.length} tuyến bàn giao
            </span>
          ) : null}
          {insightZones.length ? <span className="text-gray-400">· ô bàn làm việc = định biên thật</span> : null}
          <button
            type="button"
            onClick={() => setFull((v) => !v)}
            aria-label={full ? "Thu nhỏ bản sao số" : "Mở rộng bản sao số toàn màn hình"}
            title={full ? "Thu nhỏ (Esc)" : "Toàn màn hình"}
            className="flex size-7 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-100 dark:border-dark-500 dark:text-dark-200 dark:hover:bg-dark-600"
          >
            {full ? <ArrowsPointingInIcon className="size-4" /> : <ArrowsPointingOutIcon className="size-4" />}
          </button>
        </div>
      </div>

      {threeDError ? (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-darker dark:text-warning-lighter">
          3D không khả dụng ({threeDError}) — bảng điều khiển vẫn hoạt động đầy đủ với mặt bằng 2D và danh sách bên dưới.
        </p>
      ) : null}

      {/* The 2D plan is ALWAYS in the DOM; 3D merely covers it when selected. */}
      {/* In fullscreen the server-rendered SVG must stretch too — an SVG scales
          by viewBox, so overriding its height is enough (no re-render needed). */}
      <div
        ref={plan2dWrapRef}
        onClick={handlePlan2dClick}
        className={mode === "2d" ? (full ? "[&>svg]:!h-[calc(100dvh-11rem)]" : "") : "hidden"}
      >
        {plan2d}
      </div>
      {mode === "3d" ? (
        <RendererBoundary onError={fail}>
          <TwinScene3D
            scene={scene}
            zones={zones}
            insightZones={insightZones}
            flows={flows}
            height={canvasHeight}
            onUnavailable={fail}
            onZoneClick={onZoneClick}
            selectedZoneId={selectedZoneId}
          />
        </RendererBoundary>
      ) : null}

      {/* Accessible list fallback — the same data without any renderer at all. */}
      <ul className={`grid gap-2 sm:grid-cols-2 lg:grid-cols-4 ${full ? "hidden" : ""}`}>
        {zones.map((zm) => {
          const iz = insightZones.find((z) => z.zoneId === zm.zone.id);
          const isSelected = selectedZoneId === zm.zone.id;
          return (
          <li
            key={zm.zone.id}
            role={onZoneClick ? "button" : undefined}
            tabIndex={onZoneClick ? 0 : undefined}
            onClick={onZoneClick ? () => onZoneClick(zm.zone.id) : undefined}
            onKeyDown={onZoneClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onZoneClick(zm.zone.id); } } : undefined}
            className={`rounded-lg border p-2.5 dark:border-dark-600 ${onZoneClick ? "cursor-pointer hover:border-primary-400" : ""} ${isSelected ? "border-primary-500 ring-1 ring-primary-500" : "border-gray-200"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-gray-800 dark:text-dark-50">
                {zm.zone.binding?.iconKey ? `${ICON_GLYPHS[zm.zone.binding.iconKey] ?? ""} ` : ""}
                {zm.label}
              </span>
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: STATE_FILL[zm.state] }} aria-label={STATE_LABEL[zm.state]} />
            </div>
            <dl className="mt-1.5 space-y-0.5">
              {zm.metrics.map((m) => (
                <div key={m.layerId} className="flex items-baseline justify-between gap-2 text-xs">
                  <dt className="truncate text-gray-500 dark:text-dark-300">{m.name}</dt>
                  <dd className="font-semibold text-gray-800 tabular-nums dark:text-dark-50">{m.hasData ? m.value : "—"}</dd>
                </div>
              ))}
              {zm.metrics.length === 0 ? <div className="text-xs text-gray-400">Chưa gắn lớp dữ liệu</div> : null}
            </dl>
            <p className="mt-1 text-[11px] text-gray-400">
              {zm.zone.areaSqM} m²{iz ? ` · ${iz.filled}/${iz.seats} định biên có người giữ` : ""}
            </p>
          </li>
          );
        })}
      </ul>
    </div>
  );
}
