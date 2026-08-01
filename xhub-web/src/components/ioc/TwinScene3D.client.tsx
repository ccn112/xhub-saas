"use client";

import { useEffect, useRef, useState } from "react";
import { STATE_FILL, type ZoneMetric, type RuntimeScene } from "@/xoffice/lib/ioc-data";

/**
 * Babylon.js 3D twin runtime (DT-02) — client-only, dynamically imported.
 *
 * Constitution #9 / AT-007: this component is an OPT-IN OVERLAY. It probes WebGL
 * BEFORE importing Babylon and reports failure upward via `onUnavailable` so the
 * page can keep showing the 2D plan + zone table. It never renders a broken
 * canvas and never blocks the rest of the dashboard.
 *
 * AT-008: the engine, scene and every mesh/material are disposed on unmount, and
 * the resize listener is removed — navigating away releases renderer resources.
 *
 * Geometry is the SAME published, checksummed meter-space polygon set the 2D
 * view uses — extruded to `wallHeightMeters`. There is one geometry source.
 */
export default function TwinScene3D({
  scene,
  zones,
  height = 460,
  onUnavailable,
}: {
  scene: RuntimeScene;
  zones: ZoneMetric[];
  height?: number;
  onUnavailable?: (reason: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<"probing" | "ready" | "unavailable">("probing");
  const [reason, setReason] = useState<string>("");

  useEffect(() => {
    let disposed = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let engine: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let babylonScene: any = null;
    let onResize: (() => void) | null = null;

    function fail(msg: string) {
      if (disposed) return;
      setReason(msg);
      setStatus("unavailable");
      onUnavailable?.(msg);
    }

    // 1) PROBE before importing ~2 MB of renderer.
    try {
      const probe = document.createElement("canvas");
      const gl = probe.getContext("webgl2") ?? probe.getContext("webgl");
      if (!gl) {
        fail("Trình duyệt không bật WebGL");
        return;
      }
    } catch {
      fail("Không khởi tạo được ngữ cảnh WebGL");
      return;
    }

    (async () => {
      try {
        const BABYLON = await import("@babylonjs/core");
        if (disposed || !canvasRef.current) return;

        engine = new BABYLON.Engine(canvasRef.current, true, { preserveDrawingBuffer: true, stencil: true }, true);
        babylonScene = new BABYLON.Scene(engine);
        babylonScene.clearColor = new BABYLON.Color4(0.06, 0.09, 0.16, 1);

        // Fit the camera to the plan extents (meters).
        const pts = scene.zones.flatMap((z) => z.polygon);
        const minX = Math.min(...pts.map((p) => p.x));
        const maxX = Math.max(...pts.map((p) => p.x));
        const minY = Math.min(...pts.map((p) => p.y));
        const maxY = Math.max(...pts.map((p) => p.y));
        const cx = (minX + maxX) / 2;
        const cz = (minY + maxY) / 2;
        const span = Math.max(maxX - minX, maxY - minY, 10);

        const camera = new BABYLON.ArcRotateCamera("cam", -Math.PI / 2, Math.PI / 3.2, span * 1.35, new BABYLON.Vector3(cx, 0, cz), babylonScene);
        camera.attachControl(canvasRef.current, true);
        camera.lowerRadiusLimit = span * 0.4;
        camera.upperRadiusLimit = span * 3;
        camera.upperBetaLimit = Math.PI / 2.05;
        camera.wheelDeltaPercentage = 0.02;

        const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0.3, 1, 0.2), babylonScene);
        light.intensity = 0.95;

        // Slab
        const slab = BABYLON.MeshBuilder.CreateGround("slab", { width: maxX - minX + 4, height: maxY - minY + 4 }, babylonScene);
        slab.position = new BABYLON.Vector3(cx, -0.02, cz);
        const slabMat = new BABYLON.StandardMaterial("slabMat", babylonScene);
        slabMat.diffuseColor = BABYLON.Color3.FromHexString("#1e293b");
        slabMat.specularColor = BABYLON.Color3.Black();
        slab.material = slabMat;

        // Department zones — extruded from the published meter polygons, height
        // scaled by the ZONE_COLOR metric so load is legible in 3D.
        const maxValue = Math.max(1, ...zones.map((z) => z.primaryValue));
        for (const zm of zones) {
          const poly = zm.zone.polygon;
          const zMinX = Math.min(...poly.map((p) => p.x));
          const zMaxX = Math.max(...poly.map((p) => p.x));
          const zMinY = Math.min(...poly.map((p) => p.y));
          const zMaxY = Math.max(...poly.map((p) => p.y));
          const h = 0.6 + (zm.primaryValue / maxValue) * (scene.wallHeightMeters ?? 3);
          // Axis-aligned extrusion of the zone bounds — a deterministic slab that
          // needs no earcut tessellator dependency.
          const box = BABYLON.MeshBuilder.CreateBox(
            `zone-${zm.zone.id}`,
            { width: Math.max(0.4, zMaxX - zMinX - 0.3), depth: Math.max(0.4, zMaxY - zMinY - 0.3), height: h },
            babylonScene,
          );
          box.position = new BABYLON.Vector3((zMinX + zMaxX) / 2, h / 2, (zMinY + zMaxY) / 2);
          const mat = new BABYLON.StandardMaterial(`mat-${zm.zone.id}`, babylonScene);
          mat.diffuseColor = BABYLON.Color3.FromHexString(STATE_FILL[zm.state]);
          mat.emissiveColor = BABYLON.Color3.FromHexString(STATE_FILL[zm.state]).scale(0.25);
          mat.alpha = 0.85;
          box.material = mat;
        }

        // Perimeter walls
        for (const w of scene.walls) {
          for (let i = 0; i < w.points.length - 1; i++) {
            const a = w.points[i];
            const b = w.points[i + 1];
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            if (len < 0.01) continue;
            const wallH = w.height ?? scene.wallHeightMeters ?? 3;
            const seg = BABYLON.MeshBuilder.CreateBox(`wall-${w.id}-${i}`, { width: len, depth: w.thickness ?? 0.2, height: wallH }, babylonScene);
            seg.position = new BABYLON.Vector3((a.x + b.x) / 2, wallH / 2, (a.y + b.y) / 2);
            seg.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
            const wm = new BABYLON.StandardMaterial(`wm-${w.id}-${i}`, babylonScene);
            wm.diffuseColor = BABYLON.Color3.FromHexString("#475569");
            wm.alpha = 0.5;
            seg.material = wm;
          }
        }

        engine.runRenderLoop(() => babylonScene?.render());
        onResize = () => engine?.resize();
        window.addEventListener("resize", onResize);
        if (!disposed) setStatus("ready");
      } catch (e) {
        fail(`Không tải được bộ dựng 3D: ${(e as Error).message}`);
      }
    })();

    // AT-008 — release renderer resources on route change / unmount.
    return () => {
      disposed = true;
      if (onResize) window.removeEventListener("resize", onResize);
      try {
        babylonScene?.dispose();
        engine?.stopRenderLoop();
        engine?.dispose();
      } catch {
        /* disposal is best-effort */
      }
    };
  }, [scene, zones, onUnavailable]);

  if (status === "unavailable") {
    return (
      <div
        style={{ height }}
        className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-center dark:border-dark-500 dark:bg-dark-800"
      >
        <p className="text-sm font-medium text-gray-700 dark:text-dark-100">Không dựng được 3D — đang dùng bản đồ 2D</p>
        <p className="text-xs text-gray-500 dark:text-dark-300">{reason}</p>
      </div>
    );
  }

  return (
    <div style={{ height }} className="relative overflow-hidden rounded-lg">
      <canvas ref={canvasRef} className="size-full touch-none outline-none" />
      {status === "probing" ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">Đang tải bộ dựng 3D…</div>
      ) : null}
    </div>
  );
}
