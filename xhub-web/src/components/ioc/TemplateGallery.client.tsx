"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ICON_GLYPHS, TWIN_TYPE_LABEL, type CloneResult, type IocTemplate, type TemplateZoneSpec } from "@/xoffice/lib/ioc-data";

/**
 * IOC-S07 — Template gallery + "Nhân bản" (DT-04).
 *
 * The workflow the owner asked for: xem bộ template mẫu/chuẩn → nhân bản → sửa.
 * The gallery is a SHARED platform catalog (no tenant data), so browsing leaks
 * nothing; "Nhân bản" POSTs to /api/ioc/templates/:id/clone which materialises
 * the template as THIS tenant's own DRAFT rows and returns the new scene id, and
 * we route straight into the editor on that copy.
 *
 * The preview thumbnail is rendered from the template's own meter-space polygons
 * as static SVG — the same geometry the clone will write, so what you see is
 * literally what you get. No renderer, no WebGL, no extra request.
 */

const TWIN_TONE: Record<string, string> = {
  OFFICE: "bg-primary-600/10 text-primary-700 dark:text-primary-300",
  FACTORY: "bg-warning/15 text-warning-darker dark:text-warning-lighter",
  RETAIL: "bg-success/15 text-success-darker dark:text-success-lighter",
  HOSPITALITY: "bg-info/15 text-info-darker dark:text-info-lighter",
};

/** Static preview: the template's zones in meter space, fitted to a viewBox. */
function TemplatePreview({ tpl }: { tpl: IocTemplate }) {
  const zones: TemplateZoneSpec[] = tpl.floorPlanSpec?.zones ?? [];
  const pts = zones.flatMap((z) => z.polygon ?? []);
  if (!pts.length) return <div className="flex h-32 items-center justify-center text-xs text-gray-400">Không có hình học xem trước</div>;
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxX = Math.max(...pts.map((p) => p.x));
  const maxY = Math.max(...pts.map((p) => p.y));
  const pad = 1;
  const palette = ["#2563eb", "#0891b2", "#7c3aed", "#16a34a", "#f59e0b", "#dc2626", "#0ea5e9", "#a855f7"];

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`}
      role="img"
      aria-label={`Xem trước mặt bằng mẫu ${tpl.name}: ${zones.length} vùng`}
      className="h-32 w-full rounded-md bg-slate-50 dark:bg-dark-800"
      preserveAspectRatio="xMidYMid meet"
    >
      {(tpl.floorPlanSpec?.walls ?? []).map((w) => (
        <polyline key={w.id} points={(w.points ?? []).map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#64748b" strokeWidth={0.25} />
      ))}
      {zones.map((z, i) => {
        const cx = z.polygon.reduce((s, p) => s + p.x, 0) / z.polygon.length;
        const cy = z.polygon.reduce((s, p) => s + p.y, 0) / z.polygon.length;
        const fill = palette[i % palette.length];
        return (
          <g key={z.id}>
            <polygon points={z.polygon.map((p) => `${p.x},${p.y}`).join(" ")} fill={fill} fillOpacity={0.22} stroke={fill} strokeWidth={0.15} />
            {z.icon && ICON_GLYPHS[z.icon] ? (
              <text x={cx} y={cy + 1} textAnchor="middle" fontSize={2.4} style={{ pointerEvents: "none" }}>
                {ICON_GLYPHS[z.icon]}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function TemplateCard({ tpl }: { tpl: IocTemplate }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CloneResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const zones: TemplateZoneSpec[] = tpl.floorPlanSpec?.zones ?? [];

  async function clone() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/ioc/templates/${tpl.id}/clone`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      setBusy(false);
      setError(json?.detail?.message ?? json?.error ?? `Không nhân bản được (HTTP ${res.status})`);
      return;
    }
    const clone = json as CloneResult;
    setResult(clone);
    // Land the user straight in the editor on THEIR copy, carrying the
    // unmapped-zone count so the editor can show an honest banner.
    const qs = new URLSearchParams({ cloned: clone.template.code, unmapped: String(clone.unmappedZones.length) });
    router.push(`${clone.editorPath}?${qs}`);
  }

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3 dark:border-dark-600">
      <TemplatePreview tpl={tpl} />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TWIN_TONE[tpl.twinType] ?? "bg-gray-100 text-gray-600 dark:bg-dark-600 dark:text-dark-200"}`}>
          {TWIN_TYPE_LABEL[tpl.twinType] ?? tpl.twinType}
        </span>
        {tpl.industry ? (
          <span className="truncate rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600 dark:bg-dark-600 dark:text-dark-200">{tpl.industry}</span>
        ) : null}
        <span className="ml-auto text-[11px] text-gray-400">
          {tpl.code} · v{tpl.version}
        </span>
      </div>

      <div>
        <h3 className="font-heading text-sm font-semibold text-gray-800 dark:text-dark-50">{tpl.name}</h3>
        <p className="mt-1 line-clamp-3 text-xs text-gray-500 dark:text-dark-300">{tpl.description}</p>
      </div>

      <dl className="grid grid-cols-3 gap-1 text-center text-[11px]">
        <div className="rounded-md bg-gray-50 py-1.5 dark:bg-dark-700">
          <dt className="text-gray-400">Vùng</dt>
          <dd className="font-semibold text-gray-800 tabular-nums dark:text-dark-50">{tpl.zoneCount}</dd>
        </div>
        <div className="rounded-md bg-gray-50 py-1.5 dark:bg-dark-700">
          <dt className="text-gray-400">Lớp dữ liệu</dt>
          <dd className="font-semibold text-gray-800 tabular-nums dark:text-dark-50">{tpl.dataLayerCount}</dd>
        </div>
        <div className="rounded-md bg-gray-50 py-1.5 dark:bg-dark-700">
          <dt className="text-gray-400">Widget</dt>
          <dd className="font-semibold text-gray-800 tabular-nums dark:text-dark-50">{tpl.widgetCount}</dd>
        </div>
      </dl>

      {open ? (
        <ul className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-gray-100 p-2 text-xs dark:border-dark-600">
          {zones.map((z) => (
            <li key={z.id} className="flex items-center justify-between gap-2">
              <span className="truncate text-gray-700 dark:text-dark-100">
                {z.icon && ICON_GLYPHS[z.icon] ? `${ICON_GLYPHS[z.icon]} ` : ""}
                {z.name}
              </span>
              <code className="shrink-0 text-[10px] text-gray-400">{(z.orgHint?.codes ?? []).slice(0, 2).join("/") || "—"}</code>
            </li>
          ))}
          <li className="border-t border-gray-100 pt-1 text-[11px] text-gray-400 dark:border-dark-600">
            Mã đơn vị bên phải là GỢI Ý — khi nhân bản, hệ thống dò trong cây tổ chức thật của bạn; vùng không khớp sẽ để trống để bạn tự gán.
          </li>
        </ul>
      ) : null}

      {error ? <p className="rounded-md bg-error/10 px-2 py-1.5 text-xs text-error">{error}</p> : null}
      {result ? (
        <p className="rounded-md bg-success/10 px-2 py-1.5 text-xs text-success-darker dark:text-success-lighter">
          Đã nhân bản — {result.boundZones.length}/{result.zoneCount} vùng gán tự động. Đang mở trình vẽ…
        </p>
      ) : null}

      <div className="mt-auto flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 dark:border-dark-500 dark:text-dark-100"
        >
          {open ? "Ẩn chi tiết" : "Xem trước"}
        </button>
        <button
          type="button"
          onClick={() => void clone()}
          disabled={busy}
          className="flex-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {busy ? "Đang nhân bản…" : "Nhân bản & sửa"}
        </button>
      </div>
    </article>
  );
}

export default function TemplateGallery({ templates }: { templates: IocTemplate[] }) {
  const [twinType, setTwinType] = useState<string>("");
  const types = [...new Set(templates.map((t) => t.twinType))];
  const shown = twinType ? templates.filter((t) => t.twinType === twinType) : templates;

  return (
    <div className="space-y-3">
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-gray-300 p-0.5 dark:border-dark-500">
        <button
          type="button"
          onClick={() => setTwinType("")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium ${twinType === "" ? "bg-primary-600 text-white" : "text-gray-600 dark:text-dark-200"}`}
        >
          Tất cả ({templates.length})
        </button>
        {types.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTwinType(t)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium ${twinType === t ? "bg-primary-600 text-white" : "text-gray-600 dark:text-dark-200"}`}
          >
            {TWIN_TYPE_LABEL[t] ?? t}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {shown.map((t) => (
          <TemplateCard key={t.id} tpl={t} />
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-gray-400">
          Chưa có template nào — chạy <code>npm run seed:ioc-templates</code> ở xhub-api.
        </p>
      ) : null}
    </div>
  );
}
