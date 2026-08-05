import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import {
  getProduct,
  listBuildRecords,
  PRODUCT_TYPE_LABEL,
  VERSION_STATUS_LABEL,
  VERSION_STATUS_TONE,
  BUILD_STATUS_TONE,
} from "@/xhub/engineering/engineering-data";

export const dynamic = "force-dynamic";

// Screen contract per the source handoff's docs/17_SCREEN_CONTRACTS.md
// ("Product 360"): Overview, Components/Repositories, Versions, Features/
// Backlog, Docs, Tests, Releases, Deployments/Tenants, Integrations, Audit.
// Backlog (DG-02), Docs (DG-03-lite), Tests (DG-04-lite), Defects (DG-05) and
// CI/Build (DG-06, below) are now built — linked from here, not duplicated
// in-page. Release readiness cockpit / Deployments-per-tenant / Integrations
// / Audit still have no data model — listed here explicitly as "not built
// yet", not hidden (this app's "cố ý bỏ trống, không bịa" convention).
const NOT_BUILT_YET = ["Release readiness cockpit (phần còn lại của DG-06)", "Triển khai/Tenant (DG-08)", "Tích hợp", "Audit"];

export default async function ProductDetailPage({ params }: { params: Promise<{ idOrCode: string }> }) {
  const { idOrCode } = await params;
  const { product, source } = await getProduct(idOrCode);

  if (source === "api" && !product) notFound();

  const { items: builds } = product ? await listBuildRecords(product.id) : { items: [] };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">
            {product ? product.name : idOrCode}
          </h1>
          {product ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
              {product.code} · {PRODUCT_TYPE_LABEL[product.type] ?? product.type} · version policy {product.versionPolicy}
            </p>
          ) : null}
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>
          {source === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>

      {!product ? (
        <Card className="p-4 text-sm text-gray-400">Không tải được sản phẩm (backend offline).</Card>
      ) : (
        <>
          {product.description ? (
            <Card className="p-4 text-sm text-gray-600 dark:text-dark-200">{product.description}</Card>
          ) : null}

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Version</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
                    <th className="px-3 py-2 font-medium">Version</th>
                    <th className="px-3 py-2 font-medium">Trạng thái</th>
                    <th className="px-3 py-2 font-medium">Kênh</th>
                    <th className="px-3 py-2 font-medium">Ngày phát hành</th>
                  </tr>
                </thead>
                <tbody>
                  {(product.versions ?? []).map((v) => (
                    <tr key={v.id} className="border-b border-gray-100 last:border-0 dark:border-dark-700">
                      <td className="px-3 py-2 font-medium text-gray-800 dark:text-dark-50">{v.version}</td>
                      <td className="px-3 py-2">
                        <Badge tone={VERSION_STATUS_TONE[v.status] ?? "neutral"}>{VERSION_STATUS_LABEL[v.status] ?? v.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{v.releaseChannel ?? "—"}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-dark-200">
                        {v.releasedAt ? new Date(v.releasedAt).toLocaleDateString("vi-VN") : "—"}
                      </td>
                    </tr>
                  ))}
                  {(product.versions ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-gray-400">Chưa có version nào.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Component &amp; Repository</h2>
            <div className="mt-3 space-y-2">
              {(product.components ?? []).map((c) => (
                <div key={c.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-dark-600">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800 dark:text-dark-50">{c.code}</span>
                    <span className="text-xs text-gray-400">{c.type}</span>
                  </div>
                  {c.repositories.length ? (
                    <ul className="mt-1 space-y-0.5 text-xs text-gray-500 dark:text-dark-300">
                      {c.repositories.map((r) => (
                        <li key={r.id}>
                          {r.provider}: {r.repoFullName ?? "—"} ({r.defaultBranch}) — {r.connectorStatus}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-gray-400">Chưa gắn repository.</p>
                  )}
                </div>
              ))}
              {(product.components ?? []).length === 0 ? (
                <p className="text-sm text-gray-400">Chưa có component nào (chỉ seed cho XHUB ở DG-01; sản phẩm khác cần DG-08 mới có repo connector thật).</p>
              ) : null}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Kế hoạch &amp; Chất lượng</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              <Link href={`/engineering/backlog?productId=${product.id}`} className="rounded-full border border-gray-200 px-3 py-1 text-gray-600 hover:border-primary-400 dark:border-dark-600 dark:text-dark-200">Backlog</Link>
              <Link href={`/engineering/docs?productId=${product.id}`} className="rounded-full border border-gray-200 px-3 py-1 text-gray-600 hover:border-primary-400 dark:border-dark-600 dark:text-dark-200">Tài liệu</Link>
              <Link href={`/engineering/tests?productId=${product.id}`} className="rounded-full border border-gray-200 px-3 py-1 text-gray-600 hover:border-primary-400 dark:border-dark-600 dark:text-dark-200">Kiểm thử</Link>
              <Link href={`/engineering/defects?productId=${product.id}`} className="rounded-full border border-gray-200 px-3 py-1 text-gray-600 hover:border-primary-400 dark:border-dark-600 dark:text-dark-200">Lỗi (Defect)</Link>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">CI / Build gần đây (DG-06)</h2>
            <p className="mt-1 text-xs text-gray-400">
              Ghi nhận qua <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-dark-700">POST /api/engineering/ci/callback</code> (chữ ký HMAC) — không phải nhập tay.
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
                    <th className="px-3 py-2 font-medium">Nguồn</th>
                    <th className="px-3 py-2 font-medium">Nhánh / Commit</th>
                    <th className="px-3 py-2 font-medium">Trạng thái</th>
                    <th className="px-3 py-2 font-medium">Cập nhật</th>
                  </tr>
                </thead>
                <tbody>
                  {builds.map((b) => (
                    <tr key={b.id} className="border-b border-gray-100 last:border-0 dark:border-dark-700">
                      <td className="px-3 py-2 text-gray-700 dark:text-dark-100">{b.source}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-dark-200">
                        {b.branch ?? "—"} · <span className="font-mono text-xs">{b.commitSha.slice(0, 10)}</span>
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={BUILD_STATUS_TONE[b.status] ?? "neutral"}>{b.status}</Badge>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-400">
                        {b.workflowRunUrl ? (
                          <a href={b.workflowRunUrl} className="text-primary-600 hover:underline dark:text-primary-400">
                            {new Date(b.updatedAt).toLocaleString("vi-VN")}
                          </a>
                        ) : (
                          new Date(b.updatedAt).toLocaleString("vi-VN")
                        )}
                      </td>
                    </tr>
                  ))}
                  {builds.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-gray-400">Chưa có CI/build nào báo về cho sản phẩm này.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Chưa xây (DG-06 phần còn lại trở đi)</h2>
            <p className="mt-2 text-sm text-gray-400">
              {NOT_BUILT_YET.join(" · ")} — xem{" "}
              <code className="rounded bg-gray-100 px-1 py-0.5 text-xs dark:bg-dark-700">docs/implementation/engineering-hub/IMPLEMENTATION_PLAN.md</code>.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
