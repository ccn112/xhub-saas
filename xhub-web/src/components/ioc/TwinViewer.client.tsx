"use client";

import { Component, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { STATE_FILL, STATE_LABEL, ICON_GLYPHS, type ZoneMetric, type RuntimeScene } from "@/xoffice/lib/ioc-data";

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
export function TwinViewer({ scene, zones, plan2d }: { scene: RuntimeScene; zones: ZoneMetric[]; plan2d: ReactNode }) {
  const [mode, setMode] = useState<"2d" | "3d">("2d");
  const [threeDError, setThreeDError] = useState<string | null>(null);

  const fail = (m: string) => {
    setThreeDError(m);
    setMode("2d");
  };

  return (
    <div className="space-y-3">
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
        </div>
      </div>

      {threeDError ? (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning-darker dark:text-warning-lighter">
          3D không khả dụng ({threeDError}) — bảng điều khiển vẫn hoạt động đầy đủ với mặt bằng 2D và danh sách bên dưới.
        </p>
      ) : null}

      {/* The 2D plan is ALWAYS in the DOM; 3D merely covers it when selected. */}
      <div className={mode === "2d" ? "" : "hidden"}>{plan2d}</div>
      {mode === "3d" ? (
        <RendererBoundary onError={fail}>
          <TwinScene3D scene={scene} zones={zones} onUnavailable={fail} />
        </RendererBoundary>
      ) : null}

      {/* Accessible list fallback — the same data without any renderer at all. */}
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {zones.map((zm) => (
          <li key={zm.zone.id} className="rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
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
            <p className="mt-1 text-[11px] text-gray-400">{zm.zone.areaSqM} m²</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
