import {
  STATE_FILL,
  STATE_LABEL,
  ICON_GLYPHS,
  deskLayout,
  zoneBounds,
  flowArc,
  type ZoneMetric,
  type RuntimeScene,
  type InsightZone,
  type FlowEdge,
} from "@/xoffice/lib/ioc-data";

/**
 * 2D floor-plan runtime — the PRIMARY render path (Constitution #9, AT-007).
 *
 * Deliberately plain SVG rendered on the SERVER: it needs no WebGL, no canvas,
 * no renderer library and no client JS, so the Office Twin stays fully usable
 * when 3D is unavailable. Babylon's 3D view is an OPT-IN overlay on top of this.
 *
 * Coordinates are METERS straight from the published, checksummed geometry; the
 * only transform is a viewBox fit (doc 04: "pixels only viewport transform").
 *
 * What this draws, and where every mark comes from:
 *   · zone polygon + colour  ← the published ZONE_COLOR data layer's state
 *   · desks per zone         ← Position rows of the bound OrgUnit (định biên)
 *   · occupied desk marker   ← Position.holderPersonId (a seat with a holder).
 *                              NOT attendance/presence — that source is banned
 *                              platform-wide (AT-012).
 *   · flow arcs A→B          ← REAL cross-department handoffs (a NativeWorkItem
 *                              owned in A, assigned into B). Thickness/opacity
 *                              scale with the real item count; the dash
 *                              animation is pure SVG SMIL, so direction reads
 *                              even with JavaScript disabled.
 *
 * `insightZones` / `flows` are OPTIONAL: without them this renders exactly the
 * plain plan it always did.
 */
export function TwinPlan2D({
  scene,
  zones,
  insightZones = [],
  flows = [],
  height = 460,
}: {
  scene: RuntimeScene;
  zones: ZoneMetric[];
  insightZones?: InsightZone[];
  flows?: FlowEdge[];
  height?: number;
}) {
  const all = scene.zones.flatMap((z) => z.polygon);
  const xs = all.map((p) => p.x);
  const ys = all.map((p) => p.y);
  const minX = Math.min(0, ...xs);
  const minY = Math.min(0, ...ys);
  const maxX = Math.max(1, ...xs);
  const maxY = Math.max(1, ...ys);
  const pad = 1.5;
  const vb = `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;

  const info = new Map(insightZones.map((z) => [z.zoneId, z]));
  const centre = new Map(scene.zones.map((z) => [z.id, zoneBounds(z.polygon)]));
  const maxFlow = Math.max(1, ...flows.map((f) => f.items));

  return (
    <svg
      viewBox={vb}
      role="img"
      aria-label={`Sơ đồ mặt bằng 2D: ${scene.name}, ${scene.zones.length} vùng, ${flows.length} tuyến bàn giao liên phòng ban`}
      style={{ height, width: "100%" }}
      className="rounded-lg bg-slate-100 dark:bg-[#0b1220]"
    >
      <defs>
        <pattern id="ioc-grid-1m" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="currentColor" strokeWidth="0.02" className="text-gray-300 dark:text-dark-500" />
        </pattern>
        <marker id="ioc-flow-head" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#38bdf8" />
        </marker>
      </defs>
      <rect x={minX - pad} y={minY - pad} width={maxX - minX + pad * 2} height={maxY - minY + pad * 2} fill="url(#ioc-grid-1m)" />

      {scene.walls.map((w) => (
        <polyline
          key={w.id}
          points={w.points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="currentColor"
          strokeWidth={w.thickness ?? 0.2}
          strokeLinejoin="round"
          className="text-gray-500 dark:text-dark-300"
        />
      ))}

      {/* ---- zones: floor tint, desk grid, occupancy, info card -------------- */}
      {zones.map(({ zone, label, state, primaryValue }) => {
        const b = centre.get(zone.id)!;
        const fill = STATE_FILL[state];
        const glyph = zone.binding?.iconKey ? ICON_GLYPHS[zone.binding.iconKey] : undefined;
        const iz = info.get(zone.id);
        const desks = iz ? deskLayout(zone.polygon, iz.seats, iz.filled) : [];
        return (
          <g key={zone.id}>
            <polygon points={zone.polygon.map((p) => `${p.x},${p.y}`).join(" ")} fill={fill} fillOpacity={0.16} stroke={fill} strokeWidth={0.12} />

            {/* Desk rows — the zone reads as an occupied room, not a colour block. */}
            {desks.map((d, i) => (
              <g key={i}>
                <rect x={d.x} y={d.y} width={d.w} height={d.d} rx={0.12} fill={d.occupied ? fill : "#94a3b8"} fillOpacity={d.occupied ? 0.55 : 0.22} stroke={fill} strokeWidth={0.03} strokeOpacity={0.5} />
                {d.occupied ? <circle cx={d.x + d.w / 2} cy={d.y - 0.28} r={0.22} fill={fill} fillOpacity={0.95} /> : null}
              </g>
            ))}

            {/* Info card, anchored to the zone's lower band (kept free of desks). */}
            <g>
              <rect x={b.cx - 3.5} y={b.maxY - 2.5} width={7} height={2} rx={0.25} fill="#0f172a" fillOpacity={0.82} />
              <rect x={b.cx - 3.5} y={b.maxY - 2.5} width={0.18} height={2} fill={fill} />
              <text x={b.cx - 3.1} y={b.maxY - 1.62} fontSize="0.62" fontWeight="700" fill="#f8fafc">
                {glyph ? `${glyph} ` : ""}
                {label.length > 20 ? `${label.slice(0, 19)}…` : label}
              </text>
              <text x={b.cx - 3.1} y={b.maxY - 0.82} fontSize="0.52" fill="#cbd5e1">
                {iz ? `${iz.filled}/${iz.seats} định biên` : "—"}
              </text>
              <text x={b.cx + 3.1} y={b.maxY - 0.82} fontSize="0.6" fontWeight="800" textAnchor="end" fill={fill}>
                {primaryValue}
              </text>
              <text x={b.cx + 3.1} y={b.maxY - 1.62} fontSize="0.44" textAnchor="end" fill="#94a3b8">
                {STATE_LABEL[state]}
              </text>
            </g>
          </g>
        );
      })}

      {/* ---- flow layer: REAL cross-department handoffs ---------------------- */}
      {flows.map((f) => {
        const a = centre.get(f.fromZoneId);
        const b = centre.get(f.toZoneId);
        if (!a || !b) return null;
        const arc = flowArc({ x: a.cx, y: a.cy }, { x: b.cx, y: b.cy });
        // Pull the endpoints in so the arrow head lands beside the card, not on it.
        const t = 0.14;
        const sx = a.cx + (arc.cx - a.cx) * t;
        const sy = a.cy + (arc.cy - a.cy) * t;
        const ex = b.cx + (arc.cx - b.cx) * t;
        const ey = b.cy + (arc.cy - b.cy) * t;
        const w = 0.1 + 0.22 * (f.items / maxFlow);
        return (
          <g key={`${f.fromZoneId}>${f.toZoneId}`}>
            <title>{`${f.fromLabel} → ${f.toLabel}: ${f.items} việc bàn giao`}</title>
            <path d={`M ${sx} ${sy} Q ${arc.cx} ${arc.cy} ${ex} ${ey}`} fill="none" stroke="#0ea5e9" strokeOpacity={0.22} strokeWidth={w * 2.4} strokeLinecap="round" />
            <path
              d={`M ${sx} ${sy} Q ${arc.cx} ${arc.cy} ${ex} ${ey}`}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={w}
              strokeLinecap="round"
              strokeDasharray="1.1 0.9"
              markerEnd="url(#ioc-flow-head)"
            >
              {/* SMIL: direction is visible with zero client JavaScript. */}
              <animate attributeName="stroke-dashoffset" from="4" to="0" dur="1.6s" repeatCount="indefinite" />
            </path>
            <circle cx={(sx + ex) / 2 + (arc.cx - (sx + ex) / 2) * 0.5} cy={(sy + ey) / 2 + (arc.cy - (sy + ey) / 2) * 0.5} r={0.44} fill="#0f172a" fillOpacity={0.85} />
            <text
              x={(sx + ex) / 2 + (arc.cx - (sx + ex) / 2) * 0.5}
              y={(sy + ey) / 2 + (arc.cy - (sy + ey) / 2) * 0.5 + 0.18}
              fontSize="0.5"
              fontWeight="700"
              textAnchor="middle"
              fill="#7dd3fc"
            >
              {f.items}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
