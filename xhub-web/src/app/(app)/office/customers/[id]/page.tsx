import { notFound } from "next/navigation";
import { Badge } from "@/xhub/ui/Badge";
import { Card } from "@/xhub/ui/Card";
import { getCustomer, CUSTOMER_STATUS_LABEL, CUSTOMER_STATUS_TONE, CONTACT_CHANNEL_LABEL } from "@/xoffice/lib/customers-data";
import { CustomerActions } from "@/xoffice/customers/CustomerActions.client";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  created: "Tạo khách hàng",
  status_changed: "Đổi trạng thái",
  contact_added: "Thêm liên hệ",
  seeded: "Khởi tạo dữ liệu mẫu",
};

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { detail, source } = await getCustomer(id);
  if (source === "api" && !detail) notFound();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold text-gray-800 dark:text-dark-50">{detail?.customer.name ?? id}</h1>
          {detail ? (
            <p className="mt-1 text-sm text-gray-500 dark:text-dark-300">
              {detail.customer.code}
              {detail.customer.industryCode ? ` · ${detail.customer.industryCode}` : ""}
              {detail.customer.taxCode ? ` · MST ${detail.customer.taxCode}` : ""}
            </p>
          ) : null}
        </div>
        {detail ? <Badge tone={CUSTOMER_STATUS_TONE[detail.customer.status] ?? "neutral"}>{CUSTOMER_STATUS_LABEL[detail.customer.status] ?? detail.customer.status}</Badge> : null}
      </div>

      {!detail ? (
        <Card className="p-4 text-sm text-gray-400">Không tải được khách hàng (backend offline).</Card>
      ) : (
        <>
          <Card className="p-4 space-y-3">
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              {detail.customer.addressLine ? (
                <div>
                  <p className="text-xs text-gray-400">Địa chỉ</p>
                  <p className="text-gray-700 dark:text-dark-100">{detail.customer.addressLine}</p>
                </div>
              ) : null}
              {detail.customer.website ? (
                <div>
                  <p className="text-xs text-gray-400">Website</p>
                  <a href={detail.customer.website} className="text-primary-600 hover:underline dark:text-primary-400">{detail.customer.website}</a>
                </div>
              ) : null}
              {detail.customer.notes ? (
                <div className="sm:col-span-2">
                  <p className="text-xs text-gray-400">Ghi chú</p>
                  <p className="text-gray-700 dark:text-dark-100">{detail.customer.notes}</p>
                </div>
              ) : null}
            </div>
            <div className="border-t border-gray-100 pt-3 dark:border-dark-700">
              <CustomerActions customerId={detail.customer.id} currentStatus={detail.customer.status} />
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Đầu mối liên hệ</h2>
            <div className="mt-3 space-y-2">
              {detail.contacts.map((c) => (
                <div key={c.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-dark-600">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800 dark:text-dark-50">
                      {c.displayName} {c.isPrimary ? <span className="ml-1 rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-medium text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">Chính</span> : null}
                    </span>
                    {c.role ? <span className="text-xs text-gray-400">{c.role}</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-dark-300">
                    {c.email ?? "—"} {c.phone ? `· ${c.phone}` : ""}
                  </p>
                  {c.contactPreference.length > 0 ? (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {c.contactPreference.map((ch) => (
                        <span key={ch} className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-dark-700 dark:text-dark-300">
                          {CONTACT_CHANNEL_LABEL[ch] ?? ch}
                        </span>
                      ))}
                    </p>
                  ) : null}
                </div>
              ))}
              {detail.contacts.length === 0 ? <p className="text-sm text-gray-400">Chưa có đầu mối liên hệ nào.</p> : null}
            </div>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-dark-100">Lịch sử hoạt động</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {detail.events.map((e) => (
                <li key={e.id} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-0 dark:border-dark-700">
                  <span className="text-gray-700 dark:text-dark-100">{EVENT_LABEL[e.type] ?? e.type}</span>
                  <span className="text-xs text-gray-400">{new Date(e.createdAt).toLocaleString("vi-VN")}</span>
                </li>
              ))}
              {detail.events.length === 0 ? <li className="text-gray-400">Chưa có hoạt động nào.</li> : null}
            </ul>
          </Card>
        </>
      )}
    </div>
  );
}
