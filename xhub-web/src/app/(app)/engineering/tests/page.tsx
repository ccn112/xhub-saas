import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { TestCaseTable } from "@/xhub/engineering/TestCaseTable.client";
import {
  listProducts,
  getProduct,
  listTestSuites,
  listTestCases,
  VERSION_STATUS_LABEL,
  TEST_RESULT_STATUS_LABEL,
} from "@/xhub/engineering/engineering-data";

export const metadata = { title: "Kiểm thử · Phát triển & Chất lượng" };
export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["", "NOT_RUN", "PASS", "FAIL", "BLOCKED", "NOT_APPLICABLE", "NEEDS_CLARIFICATION"];

function pillHref(base: string, params: Record<string, string | undefined>) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

export default async function EngineeringTestsPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string; versionId?: string; suiteId?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const { items: products, source: productsSource } = await listProducts();
  const productId = sp.productId ?? products[0]?.id ?? "";
  const { product } = productId ? await getProduct(productId) : { product: null };
  const versions = product?.versions ?? [];
  const versionId = sp.versionId ?? versions[0]?.id ?? "";
  const { items: suites } = productId ? await listTestSuites(productId) : { items: [] };
  const suiteId = sp.suiteId ?? suites[0]?.id ?? "";
  const status = sp.status ?? "";

  const { items: cases, source: casesSource } =
    suiteId ? await listTestCases(suiteId, { productVersionId: versionId || undefined, status: status || undefined }) : { items: [], source: "offline" as const };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Kiểm thử</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Sản phẩm → Phiên bản → Module → test case, lọc theo trạng thái. Ghi kết quả PASS/FAIL/... trực tiếp
            (append-only, không sửa lịch sử cũ).
          </p>
        </div>
        <Badge tone={productsSource === "api" ? "success" : "warning"}>
          {productsSource === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>

      <Card className="space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-20 shrink-0 text-gray-500 dark:text-dark-300">Sản phẩm</span>
          {products.map((p) => (
            <Link
              key={p.id}
              href={pillHref("/engineering/tests", { productId: p.id })}
              className={`rounded-full border px-3 py-1 ${p.id === productId ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-600 dark:border-dark-600 dark:text-dark-200"}`}
            >
              {p.code}
            </Link>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-20 shrink-0 text-gray-500 dark:text-dark-300">Phiên bản</span>
          {versions.map((v) => (
            <Link
              key={v.id}
              href={pillHref("/engineering/tests", { productId, versionId: v.id, suiteId })}
              className={`rounded-full border px-3 py-1 ${v.id === versionId ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-600 dark:border-dark-600 dark:text-dark-200"}`}
            >
              {v.version} · {VERSION_STATUS_LABEL[v.status] ?? v.status}
            </Link>
          ))}
          {versions.length === 0 ? <span className="text-gray-400">Chưa có version.</span> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-20 shrink-0 text-gray-500 dark:text-dark-300">Module</span>
          {suites.map((s) => (
            <Link
              key={s.id}
              href={pillHref("/engineering/tests", { productId, versionId, suiteId: s.id })}
              className={`rounded-full border px-3 py-1 ${s.id === suiteId ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-600 dark:border-dark-600 dark:text-dark-200"}`}
            >
              {s.name}
              {s._count ? <span className="ml-1 text-[11px] text-gray-400">({s._count.cases})</span> : null}
            </Link>
          ))}
          {suites.length === 0 ? <span className="text-gray-400">Chưa có module nào.</span> : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-20 shrink-0 text-gray-500 dark:text-dark-300">Trạng thái</span>
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s || "ALL"}
              href={pillHref("/engineering/tests", { productId, versionId, suiteId, status: s || undefined })}
              className={`rounded-full border px-3 py-1 ${s === status ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-600 dark:border-dark-600 dark:text-dark-200"}`}
            >
              {s ? TEST_RESULT_STATUS_LABEL[s] ?? s : "Tất cả"}
            </Link>
          ))}
        </div>
      </Card>

      <Card className="p-4">
        {casesSource === "offline" ? (
          <p className="text-sm text-gray-400">Backend offline.</p>
        ) : (
          <TestCaseTable cases={cases} productId={productId} productVersionId={versionId || undefined} />
        )}
      </Card>
    </div>
  );
}
