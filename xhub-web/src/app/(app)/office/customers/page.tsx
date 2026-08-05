import Link from "next/link";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { listCustomers, CUSTOMER_STATUS_LABEL, CUSTOMER_STATUS_TONE } from "@/xoffice/lib/customers-data";

export const metadata = { title: "Khách hàng · X.Office" };
export const dynamic = "force-dynamic";

const STATUS_FILTERS = ["", "PROSPECT", "ACTIVE", "INACTIVE", "BLOCKED"];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const { items, source } = await listCustomers({ status: status || undefined, q: sp.q });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">Khách hàng</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
            Sổ khách hàng &amp; đầu mối liên hệ (Phase 2, BO-0201) — mỗi khách hàng có xem 360: thông tin, liên hệ,
            lịch sử hoạt động.
          </p>
        </div>
        <Badge tone={source === "api" ? "success" : "warning"}>{source === "api" ? "Kết nối backend" : "Backend offline"}</Badge>
      </div>

      <Card className="p-3">
        <form className="flex flex-wrap items-center gap-2 text-sm" action="/office/customers">
          <input
            type="text"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Tìm theo tên khách hàng..."
            className="rounded-full border border-gray-200 px-3 py-1 text-sm dark:border-dark-600 dark:bg-dark-800"
          />
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <button type="submit" className="rounded-full bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700">
            Tìm
          </button>
        </form>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-dark-300">Trạng thái:</span>
          {STATUS_FILTERS.map((s) => (
            <Link
              key={s || "ALL"}
              href={`/office/customers?${new URLSearchParams({ ...(s ? { status: s } : {}), ...(sp.q ? { q: sp.q } : {}) }).toString()}`}
              className={`rounded-full border px-3 py-1 ${s === status ? "border-primary-500 bg-primary-50 font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300" : "border-gray-200 text-gray-600 dark:border-dark-600 dark:text-dark-200"}`}
            >
              {s ? CUSTOMER_STATUS_LABEL[s] ?? s : "Tất cả"}
            </Link>
          ))}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-dark-600 dark:text-dark-300">
              <th className="px-3 py-2 font-medium">Mã</th>
              <th className="px-3 py-2 font-medium">Tên khách hàng</th>
              <th className="px-3 py-2 font-medium">Ngành</th>
              <th className="px-3 py-2 font-medium">Đầu mối chính</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 dark:border-dark-700 dark:hover:bg-dark-800">
                <td className="px-3 py-2">
                  <Link href={`/office/customers/${c.id}`} className="font-medium text-primary-600 hover:underline dark:text-primary-400">
                    {c.code}
                  </Link>
                </td>
                <td className="px-3 py-2 text-gray-700 dark:text-dark-100">{c.name}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{c.industryCode ?? "—"}</td>
                <td className="px-3 py-2 text-gray-600 dark:text-dark-200">{c.contacts?.[0]?.displayName ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge tone={CUSTOMER_STATUS_TONE[c.status] ?? "neutral"}>{CUSTOMER_STATUS_LABEL[c.status] ?? c.status}</Badge>
                </td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                  {source === "offline" ? "Backend offline." : "Chưa có khách hàng nào khớp bộ lọc."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
