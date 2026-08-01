import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { listDataLayers, getCatalog, executeLayer, STATE_LABEL, STATE_TONE, type ZoneState, type LayerResult } from "@/xoffice/lib/ioc-data";

export const metadata = { title: "Lớp dữ liệu có kiểm soát · XHub IOC" };
export const dynamic = "force-dynamic";

// IOC-S04 — Data Layer Builder (DT-03). Shows the COMPILED server catalog (the
// only vocabulary a query may use) alongside each saved layer and its live
// result. The catalog is read-only in the UI on purpose: a tenant can compose a
// query, never extend the surface (Constitution #6).
export default async function DataLayersPage() {
  const [layers, catalog] = await Promise.all([listDataLayers(), getCatalog()]);
  const results = await Promise.all(layers.items.map((l) => executeLayer(l.id)));
  const byId: Record<string, LayerResult> = {};
  results.forEach((r, i) => { if (r) byId[layers.items[i].id] = r; });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Lớp dữ liệu có kiểm soát</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            Mỗi lớp chỉ tham chiếu tới catalog biên dịch sẵn ở máy chủ. Frontend không gửi SQL hay bộ lọc Prisma thô.
          </p>
        </div>
        <Badge tone={layers.source === "api" ? "success" : "warning"}>{layers.source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <SectionCard title={`Lớp dữ liệu (${layers.items.length})`} accent="primary">
        <div className="space-y-3">
          {layers.items.map((l) => {
            const res = byId[l.id];
            return (
              <div key={l.id} className="rounded-lg border border-gray-200 p-3 dark:border-dark-600">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-dark-50">{l.code} · {l.name}</p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {l.entityKey} · {l.aggregation.op}{l.aggregation.field ? `(${l.aggregation.field})` : ""} · nhóm theo {l.query.groupBy.join(", ")} · {l.query.timeWindow} · làm mới {l.refreshPolicy}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone="neutral">{l.visualMapping.mode}</Badge>
                    <Badge tone={l.sensitivity === "AGGREGATE" ? "success" : "warning"}>{l.sensitivity === "AGGREGATE" ? "Tổng hợp" : "Cá nhân (cần quyền)"}</Badge>
                  </div>
                </div>

                {l.query.filters.length ? (
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-dark-300">
                    Bộ lọc:{" "}
                    {l.query.filters.map((f, i) => (
                      <code key={i} className="mr-1.5 rounded bg-gray-100 px-1.5 py-0.5 dark:bg-dark-600">
                        {f.field} {f.operator} {Array.isArray(f.value) ? (f.value as unknown[]).join("/") : String(f.value)}
                      </code>
                    ))}
                  </p>
                ) : null}

                {res ? (
                  <div className="mt-2">
                    <div className="mb-1 flex items-center justify-between text-xs text-gray-400">
                      <span>Kết quả trực tiếp · tổng {res.total} · nguồn: {res.ownedBy}</span>
                      <span>{res.rows.length} nhóm</span>
                    </div>
                    <ul className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                      {res.rows.map((r) => (
                        <li key={r.key} className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1 text-xs dark:bg-dark-800">
                          <span className="truncate text-gray-600 dark:text-dark-200">{r.label}</span>
                          <span className="flex items-center gap-1.5">
                            <span className="font-semibold tabular-nums text-gray-800 dark:text-dark-50">{r.value}</span>
                            <Badge tone={STATE_TONE[r.state as ZoneState]}>{STATE_LABEL[r.state as ZoneState]}</Badge>
                          </span>
                        </li>
                      ))}
                      {res.rows.length === 0 ? <li className="text-xs text-gray-400">Không có dữ liệu trong phạm vi</li> : null}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-400">Không thực thi được lớp này.</p>
                )}
              </div>
            );
          })}
          {layers.items.length === 0 ? <p className="text-sm text-gray-400">Chưa có lớp dữ liệu — chạy <code>npm run seed:ioc</code>.</p> : null}
        </div>
      </SectionCard>

      <SectionCard title="Catalog nguồn (biên dịch trong máy chủ — chỉ đọc)" accent="neutral">
        {catalog ? (
          <>
            <p className="mb-2 text-xs text-gray-500 dark:text-dark-300">{catalog.note}</p>
            <div className="space-y-3">
              {catalog.entities.map((e) => (
                <div key={e.entityKey} className="rounded-lg border border-gray-200 p-3 dark:border-dark-600">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-dark-50">{e.label} <span className="text-xs font-normal text-gray-400">({e.entityKey})</span></p>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">SoR: {e.ownedBy}</Badge>
                      {e.personal ? <Badge tone="warning">Có chiều cá nhân — mặc định tổng hợp</Badge> : null}
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Phép gộp: {e.aggregations.join(", ")} · nhóm theo: {e.groupBy.join(", ")}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {e.fields.map((f) => (
                      <span key={f.key} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 dark:bg-dark-600 dark:text-dark-100" title={`${f.type} · ${f.operators.join("/")}`}>
                        {f.key}{f.derived ? " (suy diễn)" : ""}{f.measure ? " ∑" : ""}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 rounded-lg bg-error/10 px-3 py-2 text-xs text-error-darker dark:text-error-lighter">
              Cấm vĩnh viễn: camera / VMS / chấm công / sinh trắc học / kiểm soát ra vào không được đăng ký làm nguồn chỉ số.
              Máy chủ từ chối (403) mọi entityKey thuộc nhóm này — đây là ràng buộc mã, không phải chỉ tài liệu.
            </p>
          </>
        ) : (
          <p className="text-sm text-gray-400">Không tải được catalog (backend offline).</p>
        )}
      </SectionCard>
    </div>
  );
}
