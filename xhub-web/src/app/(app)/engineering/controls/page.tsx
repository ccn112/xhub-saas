import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import {
  listProducts,
  listControls,
  listControlImplementations,
  CONTROL_IMPL_STATUS_LABEL,
  CONTROL_IMPL_STATUS_TONE,
} from "@/xhub/engineering/engineering-data";

export const metadata = { title: "Khung kiểm soát (Control Framework) · Phát triển & Chất lượng" };
export const dynamic = "force-dynamic";

export default async function EngineeringControlsPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  const sp = await searchParams;
  const { items: products, source: productsSource } = await listProducts();
  const productId = sp.productId ?? products[0]?.id ?? "";
  const { items: controls, source } = await listControls();
  const { items: implementations } = productId ? await listControlImplementations(productId) : { items: [] };
  const implByControlId = new Map(implementations.map((i) => [i.controlId, i]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Khung kiểm soát (Control Framework)</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Danh mục kiểm soát tham chiếu tới chuẩn quốc tế (ISO/NIST/OWASP...) + trạng thái áp dụng theo sản phẩm
            (DG-09). Đây là đối chiếu đã thiết kế và có bằng chứng, KHÔNG phải chứng nhận.
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-dark-300">Sản phẩm:</span>
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/engineering/controls?productId=${p.id}`}
              className={`rounded-full border px-3 py-1 ${p.id === productId ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-600 dark:border-dark-600 dark:text-dark-200"}`}
            >
              {p.code}
            </Link>
          ))}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Domain</th>
              <th className="px-3 py-2 font-medium">Tên kiểm soát</th>
              <th className="px-3 py-2 font-medium">Khung tham chiếu</th>
              <th className="px-3 py-2 font-medium">Trạng thái áp dụng</th>
            </tr>
          </thead>
          <tbody>
            {controls.map((c) => {
              const impl = implByControlId.get(c.id);
              return (
                <tr key={c.id} className="border-b border-gray-100 last:border-0 dark:border-dark-700">
                  <td className="px-3 py-2 font-medium text-gray-800 dark:text-dark-50">{c.code}</td>
                  <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{c.domain}</td>
                  <td className="px-3 py-2 text-gray-700 dark:text-dark-100">{c.title}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {c.frameworkFamilies.map((f) => (
                        <span key={f} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-dark-700 dark:text-dark-300">
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {impl ? (
                      <Badge tone={CONTROL_IMPL_STATUS_TONE[impl.status] ?? "neutral"}>{CONTROL_IMPL_STATUS_LABEL[impl.status] ?? impl.status}</Badge>
                    ) : (
                      <span className="text-xs text-gray-400">Chưa đánh giá</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {controls.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  {source === "offline" ? "Backend offline." : "Chưa có control nào."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
