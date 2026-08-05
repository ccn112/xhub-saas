import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { listProducts, listDocuments, DOCUMENT_TYPE_LABEL, DOC_STATUS_TONE } from "@/xhub/engineering/engineering-data";

export const metadata = { title: "Tài liệu · Phát triển & Chất lượng" };
export const dynamic = "force-dynamic";

export default async function EngineeringDocsPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string }>;
}) {
  const sp = await searchParams;
  const { items: products, source: productsSource } = await listProducts();
  const productId = sp.productId ?? products[0]?.id ?? "";
  const { items, source } = productId ? await listDocuments(productId) : { items: [], source: "offline" as const };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Tài liệu</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Tài liệu do Engineering Hub sở hữu (DG-03-lite) — khác với X.Office Records. Mỗi tài liệu ghi rõ tiêu
            chuẩn/khung áp dụng (standardsRefs) nếu có.
          </p>
        </div>
        <Badge tone={productsSource === "api" ? "success" : "warning"}>
          {productsSource === "api" ? "Kết nối backend" : "Backend offline"}
        </Badge>
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-dark-300">Sản phẩm:</span>
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/engineering/docs?productId=${p.id}`}
              className={`rounded-full border px-3 py-1 ${p.id === productId ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-600 dark:border-dark-600 dark:text-dark-200"}`}
            >
              {p.code}
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {items.map((d) => (
          <Link key={d.id} href={`/engineering/docs/${d.code}`}>
            <Card className="p-4 hover:border-primary-400">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-800 dark:text-dark-50">{d.title}</span>
                <Badge tone={DOC_STATUS_TONE[d.status] ?? "neutral"}>{d.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {d.code} · {DOCUMENT_TYPE_LABEL[d.documentType] ?? d.documentType} · v{d.version} · {d.classification}
              </p>
              {d.standardsRefs.length > 0 ? (
                <p className="mt-2 flex flex-wrap gap-1">
                  {d.standardsRefs.slice(0, 4).map((s) => (
                    <span key={s} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-dark-700 dark:text-dark-300">
                      {s}
                    </span>
                  ))}
                  {d.standardsRefs.length > 4 ? <span className="text-[11px] text-gray-400">+{d.standardsRefs.length - 4}</span> : null}
                </p>
              ) : null}
            </Card>
          </Link>
        ))}
        {items.length === 0 ? (
          <Card className="p-4 text-sm text-gray-400 md:col-span-2">
            {source === "offline" ? "Backend offline." : "Chưa có tài liệu nào cho sản phẩm này."}
          </Card>
        ) : null}
      </div>
    </div>
  );
}
