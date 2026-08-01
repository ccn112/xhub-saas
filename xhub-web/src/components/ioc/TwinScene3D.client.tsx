"use client";

import { useEffect, useRef, useState } from "react";
import { STATE_FILL, deskLayout, zoneBounds, type ZoneMetric, type RuntimeScene, type InsightZone, type FlowEdge } from "@/xoffice/lib/ioc-data";

/**
 * ZONE_HEIGHT encoding (data-layer-definition visualMapping enum).
 *
 * The 3D view must ADD information the 2D plan cannot show, otherwise it is just
 * a slower flat map. So a zone is a real extruded VOLUME whose HEIGHT encodes
 * load state while its COLOUR keeps the existing status mapping — the two cues
 * reinforce each other: tall + red = clearly critical, short + green = clearly
 * fine, and the silhouette is readable from across the room.
 *
 * Metres of extrusion per state, before the plan-scale factor.
 */
const STATE_HEIGHT: Record<string, number> = {
  NO_DATA: 0.6,
  NORMAL: 1.8,
  GOOD: 3.0,
  BUSY: 5.5,
  RISK: 7.0,
  OVERLOADED: 9.0,
};

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
  insightZones = [],
  flows = [],
  height = 460,
  onUnavailable,
}: {
  scene: RuntimeScene;
  zones: ZoneMetric[];
  /** real Position headcount per zone — drives the desk/occupancy meshes */
  insightZones?: InsightZone[];
  /** real cross-department handoff volume — drives the animated flow arcs */
  flows?: FlowEdge[];
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

        // ISOMETRIC / three-quarter view. A straight top-down camera renders an
        // image indistinguishable from the 2D plan, which is exactly what makes a
        // 3D view feel worthless — so we tilt (~50° from vertical) AND rotate off
        // the axis (~35°) so the extruded volumes read as volumes.
        const camera = new BABYLON.ArcRotateCamera(
          "cam",
          -Math.PI / 2 + Math.PI / 5.2,
          Math.PI / 3.6,
          span * 1.5,
          new BABYLON.Vector3(cx, 0, cz),
          babylonScene,
        );
        camera.attachControl(canvasRef.current, true);
        camera.lowerRadiusLimit = span * 0.35;
        camera.upperRadiusLimit = span * 3;
        camera.lowerBetaLimit = 0.12; // still allow a near-top view on demand…
        camera.upperBetaLimit = Math.PI / 2.15; // …but never below the floor plane
        camera.wheelDeltaPercentage = 0.02;
        camera.useAutoRotationBehavior = false;

        // Lighting: soft ambient + a keyed directional light that casts real
        // shadows, so height differences are visible even between same-colour
        // zones (a shadow is the cue that says "this block is TALL").
        const ambient = new BABYLON.HemisphericLight("ambient", new BABYLON.Vector3(0.2, 1, 0.15), babylonScene);
        ambient.intensity = 0.72;
        ambient.groundColor = BABYLON.Color3.FromHexString("#0f172a");
        const key = new BABYLON.DirectionalLight("key", new BABYLON.Vector3(-0.55, -1, 0.4), babylonScene);
        key.position = new BABYLON.Vector3(cx + span, span * 1.4, cz - span);
        key.intensity = 1.15;
        const shadows = new BABYLON.ShadowGenerator(1024, key);
        shadows.useBlurExponentialShadowMap = true;
        shadows.blurKernel = 24;

        // --- ground context -------------------------------------------------
        // A raised base platform (so the building sits ON something) plus a 5 m
        // reference grid — without it the boxes look like they float in a void.
        const padM = 3;
        const slab = BABYLON.MeshBuilder.CreateBox(
          "slab",
          { width: maxX - minX + padM * 2, depth: maxY - minY + padM * 2, height: 0.35 },
          babylonScene,
        );
        slab.position = new BABYLON.Vector3(cx, -0.175, cz);
        const slabMat = new BABYLON.StandardMaterial("slabMat", babylonScene);
        slabMat.diffuseColor = BABYLON.Color3.FromHexString("#334155");
        slabMat.specularColor = BABYLON.Color3.Black();
        slab.material = slabMat;
        slab.receiveShadows = true;

        const gridLines: Array<Array<InstanceType<typeof BABYLON.Vector3>>> = [];
        for (let x = Math.ceil(minX / 5) * 5; x <= maxX; x += 5) {
          gridLines.push([new BABYLON.Vector3(x, 0.01, minY - padM), new BABYLON.Vector3(x, 0.01, maxY + padM)]);
        }
        for (let y = Math.ceil(minY / 5) * 5; y <= maxY; y += 5) {
          gridLines.push([new BABYLON.Vector3(minX - padM, 0.01, y), new BABYLON.Vector3(maxX + padM, 0.01, y)]);
        }
        if (gridLines.length) {
          const grid = BABYLON.MeshBuilder.CreateLineSystem("grid", { lines: gridLines }, babylonScene);
          grid.color = BABYLON.Color3.FromHexString("#64748b");
          grid.alpha = 0.35;
          grid.isPickable = false;
        }

        // --- perimeter walls -------------------------------------------------
        // Kept LOW and translucent: they give the building an outline without
        // hiding the zone volumes behind them, plus a bright top edge line.
        const wallH = Math.min(1.4, scene.wallHeightMeters ?? 3);
        for (const w of scene.walls) {
          const edge: Array<InstanceType<typeof BABYLON.Vector3>> = w.points.map((p) => new BABYLON.Vector3(p.x, wallH, p.y));
          if (edge.length > 1) {
            const outline = BABYLON.MeshBuilder.CreateLines(`edge-${w.id}`, { points: edge }, babylonScene);
            outline.color = BABYLON.Color3.FromHexString("#94a3b8");
            outline.isPickable = false;
          }
          for (let i = 0; i < w.points.length - 1; i++) {
            const a = w.points[i];
            const b = w.points[i + 1];
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            if (len < 0.01) continue;
            const seg = BABYLON.MeshBuilder.CreateBox(`wall-${w.id}-${i}`, { width: len, depth: w.thickness ?? 0.2, height: wallH }, babylonScene);
            seg.position = new BABYLON.Vector3((a.x + b.x) / 2, wallH / 2, (a.y + b.y) / 2);
            seg.rotation.y = -Math.atan2(b.y - a.y, b.x - a.x);
            const wm = new BABYLON.StandardMaterial(`wm-${w.id}-${i}`, babylonScene);
            wm.diffuseColor = BABYLON.Color3.FromHexString("#475569");
            wm.alpha = 0.32;
            seg.material = wm;
            seg.isPickable = false;
          }
        }

        // --- zone volumes (the actual information) ----------------------------
        // Height = ZONE_HEIGHT(state) blended with the continuous metric, then
        // scaled to the plan so a 60 m factory does not look flatter than a 20 m
        // office. Colour = the SAME status mapping the 2D plan and the list use.
        const maxValue = Math.max(1, ...zones.map((z) => z.primaryValue));
        const planScale = Math.max(1, span / 40);
        const zoneTop = new Map<string, number>();

        // --- INTERIOR PROPS: one master mesh each, hardware-instanced --------
        // A grid of desks (+ a marker on the seats that have a holder) turns an
        // abstract block into a room you can read as an office. Poly budget is
        // kept sane by instancing off TWO master meshes for the whole floor, so
        // 200 desks are still 2 draw calls, not 200.
        const insightById = new Map(insightZones.map((z) => [z.zoneId, z]));
        const deskMaster = BABYLON.MeshBuilder.CreateBox("deskMaster", { width: 1.5, depth: 0.8, height: 0.14 }, babylonScene);
        const deskMat = new BABYLON.StandardMaterial("deskMat", babylonScene);
        deskMat.diffuseColor = BABYLON.Color3.FromHexString("#cbd5e1");
        deskMat.emissiveColor = BABYLON.Color3.FromHexString("#94a3b8").scale(0.25);
        deskMat.specularColor = BABYLON.Color3.Black();
        deskMaster.material = deskMat;
        deskMaster.isPickable = false;
        deskMaster.isVisible = false;
        deskMaster.registerInstancedBuffer("color", 4);
        deskMaster.instancedBuffers.color = new BABYLON.Color4(0.8, 0.85, 0.9, 1);

        const personMaster = BABYLON.MeshBuilder.CreateCylinder("personMaster", { diameter: 0.42, height: 0.9, tessellation: 8 }, babylonScene);
        const personMat = new BABYLON.StandardMaterial("personMat", babylonScene);
        personMat.diffuseColor = BABYLON.Color3.FromHexString("#e2e8f0");
        personMat.specularColor = BABYLON.Color3.Black();
        personMaster.material = personMat;
        personMaster.isPickable = false;
        personMaster.isVisible = false;
        personMaster.registerInstancedBuffer("color", 4);
        personMaster.instancedBuffers.color = new BABYLON.Color4(0.9, 0.93, 0.96, 1);

        for (const zm of zones) {
          const poly = zm.zone.polygon;
          const zMinX = Math.min(...poly.map((p) => p.x));
          const zMaxX = Math.max(...poly.map((p) => p.x));
          const zMinY = Math.min(...poly.map((p) => p.y));
          const zMaxY = Math.max(...poly.map((p) => p.y));
          const base = STATE_HEIGHT[zm.state] ?? STATE_HEIGHT.NORMAL;
          // ±20% continuous nudge so two BUSY zones are still comparable.
          const h = base * planScale * (0.85 + 0.3 * (zm.primaryValue / maxValue));
          const colour = BABYLON.Color3.FromHexString(STATE_FILL[zm.state]);

          // Axis-aligned extrusion of the zone bounds — a deterministic volume
          // that needs no earcut tessellator dependency.
          const box = BABYLON.MeshBuilder.CreateBox(
            `zone-${zm.zone.id}`,
            { width: Math.max(0.4, zMaxX - zMinX - 0.4), depth: Math.max(0.4, zMaxY - zMinY - 0.4), height: h },
            babylonScene,
          );
          box.position = new BABYLON.Vector3((zMinX + zMaxX) / 2, h / 2, (zMinY + zMaxY) / 2);
          const mat = new BABYLON.StandardMaterial(`mat-${zm.zone.id}`, babylonScene);
          mat.diffuseColor = colour;
          mat.emissiveColor = colour.scale(0.22);
          mat.specularColor = BABYLON.Color3.FromHexString("#e2e8f0").scale(0.25);
          // TRANSLUCENT so the interior (desks + occupancy) is visible THROUGH
          // the load volume. The height encoding and the shadow it casts are
          // untouched — a tall block still reads as tall — but the zone is no
          // longer an opaque brick with nothing inside it.
          // needDepthPrePass fixes the self-sorting artefacts transparency
          // would otherwise cause on a box seen from the outside.
          mat.alpha = 0.34;
          mat.needDepthPrePass = true;
          mat.backFaceCulling = false;
          box.material = mat;
          box.receiveShadows = true;
          shadows.addShadowCaster(box);
          zoneTop.set(zm.zone.id, h);

          // Solid, emissive CAP on top of the volume: because the body is now
          // translucent, the cap is what makes the top edge (= the load level)
          // unambiguous from any angle.
          const cap = BABYLON.MeshBuilder.CreateBox(
            `cap-${zm.zone.id}`,
            { width: Math.max(0.4, zMaxX - zMinX - 0.4), depth: Math.max(0.4, zMaxY - zMinY - 0.4), height: 0.18 },
            babylonScene,
          );
          cap.position = new BABYLON.Vector3((zMinX + zMaxX) / 2, h, (zMinY + zMaxY) / 2);
          const capMat = new BABYLON.StandardMaterial(`capm-${zm.zone.id}`, babylonScene);
          capMat.diffuseColor = colour;
          capMat.emissiveColor = colour.scale(0.45);
          capMat.specularColor = BABYLON.Color3.Black();
          cap.material = capMat;
          cap.isPickable = false;
          shadows.addShadowCaster(cap);

          // Desks + occupancy for THIS zone (real Position numbers).
          const iz = insightById.get(zm.zone.id);
          if (iz) {
            const desks = deskLayout(zm.zone.polygon, iz.seats, iz.filled);
            for (const [i, d] of desks.entries()) {
              const di = deskMaster.createInstance(`desk-${zm.zone.id}-${i}`);
              di.position = new BABYLON.Vector3(d.x + d.w / 2, 0.38, d.y + d.d / 2);
              di.isPickable = false;
              di.instancedBuffers.color = d.occupied
                ? new BABYLON.Color4(colour.r + 0.25, colour.g + 0.25, colour.b + 0.25, 1)
                : new BABYLON.Color4(0.45, 0.51, 0.58, 1);
              shadows.addShadowCaster(di);
              if (!d.occupied) continue;
              const pi = personMaster.createInstance(`person-${zm.zone.id}-${i}`);
              pi.position = new BABYLON.Vector3(d.x + d.w / 2, 0.45, d.y + d.d / 2 + 0.75);
              pi.isPickable = false;
              pi.instancedBuffers.color = new BABYLON.Color4(0.93, 0.95, 0.98, 1);
              shadows.addShadowCaster(pi);
            }
          }

          // Footprint outline on the slab: the zone's real extent stays visible
          // even where the volume is short.
          const foot = BABYLON.MeshBuilder.CreateLines(
            `foot-${zm.zone.id}`,
            { points: [...poly, poly[0]].map((p) => new BABYLON.Vector3(p.x, 0.02, p.y)) },
            babylonScene,
          );
          foot.color = colour;
          foot.alpha = 0.8;
          foot.isPickable = false;

          // Floating billboard label: name + the metric that drove the height.
          // This is what makes the 3D view genuinely more informative than 2D.
          const dt = new BABYLON.DynamicTexture(`lbl-${zm.zone.id}`, { width: 512, height: 128 }, babylonScene, true);
          dt.hasAlpha = true;
          const ctx2d = dt.getContext() as CanvasRenderingContext2D;
          ctx2d.clearRect(0, 0, 512, 128);
          ctx2d.fillStyle = "rgba(15,23,42,0.78)";
          ctx2d.fillRect(0, 0, 512, 128);
          ctx2d.fillStyle = STATE_FILL[zm.state];
          ctx2d.fillRect(0, 0, 10, 128);
          ctx2d.fillStyle = "#f8fafc";
          ctx2d.font = "bold 40px sans-serif";
          ctx2d.fillText(String(zm.label).slice(0, 20), 26, 52);
          ctx2d.font = "34px sans-serif";
          ctx2d.fillStyle = STATE_FILL[zm.state];
          ctx2d.fillText(String(zm.primaryValue), 26, 104);
          dt.update();

          const labelW = Math.max(4, span / 9);
          const label = BABYLON.MeshBuilder.CreatePlane(`lblp-${zm.zone.id}`, { width: labelW, height: labelW / 4 }, babylonScene);
          label.position = new BABYLON.Vector3((zMinX + zMaxX) / 2, h + labelW / 6, (zMinY + zMaxY) / 2);
          label.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
          const lm = new BABYLON.StandardMaterial(`lblm-${zm.zone.id}`, babylonScene);
          lm.diffuseTexture = dt;
          lm.opacityTexture = dt;
          lm.emissiveColor = BABYLON.Color3.White();
          lm.disableLighting = true;
          lm.backFaceCulling = false;
          label.material = lm;
          label.isPickable = false;
        }

        // --- FLOW LAYER: real cross-department handoffs ----------------------
        // One arc per (from → to) pair, bowed above the floor so it clears the
        // volumes, with a pulse travelling from source to target — that motion
        // IS the direction cue (the 2D plan uses an arrow marker instead).
        // Volume drives the tube radius; nothing here is decorative filler.
        const boundsOf = new Map(scene.zones.map((z) => [z.id, zoneBounds(z.polygon)]));
        const maxFlow = Math.max(1, ...flows.map((f) => f.items));
        const pulses: Array<{ mesh: any; curve: any[]; offset: number }> = [];
        for (const [fi, f] of flows.entries()) {
          const a = boundsOf.get(f.fromZoneId);
          const b = boundsOf.get(f.toZoneId);
          if (!a || !b) continue;
          const lift = Math.max(2.5, (Math.max(zoneTop.get(f.fromZoneId) ?? 0, zoneTop.get(f.toZoneId) ?? 0) + 2) * planScale * 0.35);
          const p0 = new BABYLON.Vector3(a.cx, 0.6, a.cy);
          const p2 = new BABYLON.Vector3(b.cx, 0.6, b.cy);
          const p1 = new BABYLON.Vector3((a.cx + b.cx) / 2, lift, (a.cy + b.cy) / 2);
          const curve = BABYLON.Curve3.CreateQuadraticBezier(p0, p1, p2, 28).getPoints();
          const tube = BABYLON.MeshBuilder.CreateTube(
            `flow-${fi}`,
            { path: curve, radius: 0.06 + 0.14 * (f.items / maxFlow), tessellation: 6, updatable: false },
            babylonScene,
          );
          const fm = new BABYLON.StandardMaterial(`flowm-${fi}`, babylonScene);
          fm.diffuseColor = BABYLON.Color3.FromHexString("#38bdf8");
          fm.emissiveColor = BABYLON.Color3.FromHexString("#38bdf8").scale(0.75);
          fm.specularColor = BABYLON.Color3.Black();
          fm.alpha = 0.55;
          tube.material = fm;
          tube.isPickable = false;

          const pulse = BABYLON.MeshBuilder.CreateSphere(`pulse-${fi}`, { diameter: 0.55, segments: 8 }, babylonScene);
          const pm = new BABYLON.StandardMaterial(`pulsem-${fi}`, babylonScene);
          pm.emissiveColor = BABYLON.Color3.FromHexString("#e0f2fe");
          pm.diffuseColor = BABYLON.Color3.FromHexString("#7dd3fc");
          pm.disableLighting = true;
          pulse.material = pm;
          pulse.isPickable = false;
          pulses.push({ mesh: pulse, curve, offset: fi / Math.max(1, flows.length) });
        }
        if (pulses.length) {
          let t = 0;
          babylonScene.onBeforeRenderObservable.add(() => {
            t += (babylonScene.getEngine().getDeltaTime() ?? 16) / 2600;
            for (const p of pulses) {
              const u = (t + p.offset) % 1;
              p.mesh.position = p.curve[Math.min(p.curve.length - 1, Math.floor(u * p.curve.length))];
            }
          });
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
  }, [scene, zones, insightZones, flows, onUnavailable]);

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
