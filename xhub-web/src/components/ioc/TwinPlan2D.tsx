import { STATE_FILL, ICON_GLYPHS, type ZoneMetric, type RuntimeScene } from "@/xoffice/lib/ioc-data";

/**
 * 2D floor-plan runtime — the PRIMARY render path (Constitution #9, AT-007).
 *
 * Deliberately plain SVG rendered on the SERVER: it needs no WebGL, no canvas,
 * no client JS and no renderer library, so the Office Twin remains fully usable
 * when 3D is unavailable or fails. Babylon's 3D view is an OPT-IN overlay on top
 * of this, never a prerequisite.
 *
 * Coordinates are METERS straight from the published, checksummed geometry; the
 * only transform is a viewBox fit (doc 04: "pixels only viewport transform").
 */
export function TwinPlan2D({
  scene,
  zones,
  height = 420,
}: {
  scene: RuntimeScene;
  zones: ZoneMetric[];
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

  return (
    <svg
      viewBox={vb}
      role="img"
      aria-label={`Sơ đồ mặt bằng 2D: ${scene.name}, ${scene.zones.length} vùng`}
      style={{ height, width: "100%" }}
      className="rounded-lg bg-slate-50 dark:bg-dark-800"
    >
      {/* 1 m grid — a real scale reference, since geometry is stored in meters */}
      <defs>
        <pattern id="ioc-grid-1m" width="1" height="1" patternUnits="userSpaceOnUse">
          <path d="M 1 0 L 0 0 0 1" fill="none" stroke="currentColor" strokeWidth="0.02" className="text-gray-300 dark:text-dark-500" />
        </pattern>
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

      {zones.map(({ zone, label, state, primaryValue }) => {
        const cx = zone.polygon.reduce((s, p) => s + p.x, 0) / zone.polygon.length;
        const cy = zone.polygon.reduce((s, p) => s + p.y, 0) / zone.polygon.length;
        const fill = STATE_FILL[state];
        const glyph = zone.binding?.iconKey ? ICON_GLYPHS[zone.binding.iconKey] : undefined;
        return (
          <g key={zone.id}>
            <polygon
              points={zone.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
              fill={fill}
              fillOpacity={0.28}
              stroke={fill}
              strokeWidth={0.12}
            />
            {glyph ? (
              <text x={cx} y={cy - 1.1} textAnchor="middle" fontSize="1.5" style={{ pointerEvents: "none" }}>
                {glyph}
              </text>
            ) : null}
            <text x={cx} y={cy + 0.3} textAnchor="middle" fontSize="0.85" fontWeight="600" fill="currentColor" className="text-gray-800 dark:text-dark-50">
              {label}
            </text>
            <text x={cx} y={cy + 1.5} textAnchor="middle" fontSize="0.75" fill={fill} fontWeight="700">
              {primaryValue}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
