import Link from "next/link";
import { notFound } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { byId, where } from "@/xhub/lib/seed";
import { vnd, dateVN } from "@/xhub/lib/format";
import { userName } from "@/xhub/lib/repo";
import type { Tone } from "@/xhub/ui/Badge";
import type { Opportunity, Contract, Ticket, Contact, Document } from "@/xhub/lib/screen-types";

interface Customer {
  id: string; code: string; name: string; industry?: string; segment: string;
  status: string; ownerId?: string; healthScore?: number; satisfaction?: number;
}

const statusLabel: Record<string, string> = {
  implementing: "Đang triển khai", proposal: "Đề xuất", negotiation: "Đàm phán",
  consulting: "Tư vấn", demo: "Demo", lead: "Tiềm năng", active: "Đang hoạt động",
};
const segmentTone: Record<string, Tone> = { A: "success", B: "info", C: "neutral" };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = byId<Customer>("customers", id);
  return { title: `${c?.name ?? "Khách hàng"} · XHub` };
}

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = byId<Customer>("customers", id);
  if (!c) notFound();

  const contacts = where<Contact>("contacts", "customerId", id);
  const opps = where<Opportunity>("opportunities", "customerId", id);
  const contracts = where<Contract>("contracts", "customerId", id);
  const tickets = where<Ticket>("tickets", "customerId", id);
  const documents = where<Document>("documents", "customerId", id);
  const recap = byId<{ bullets: string[]; generatedAt: string }>("aiInsights", "ai-customer-recap");

  const contractValue = contracts.reduce((a, k) => a + (k.value ?? 0), 0);
  const pipeline = opps.reduce((a, o) => a + (o.amount ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/customers" className="text-sm text-primary-600 hover:underline">← Khách hàng</Link>
          </div>
          <h1 className="font-heading mt-1 text-xl font-bold text-gray-800 dark:text-dark-50">{c.name}</h1>
          <p className="text-sm text-gray-500 dark:text-dark-300">
            {c.code} · {c.industry ?? "—"} · Phụ trách {userName(c.ownerId)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={segmentTone[c.segment] ?? "neutral"}>Phân khúc {c.segment}</Badge>
          <Badge tone="primary">{statusLabel[c.status] ?? c.status}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Health score" value={`${c.healthScore ?? "—"}`} sub="trên 100" icon="❤️" tone={(c.healthScore ?? 0) >= 80 ? "success" : (c.healthScore ?? 0) >= 60 ? "warning" : "error"} />
        <StatCard label="Hài lòng" value={`${c.satisfaction ?? "—"}`} sub="trên 5" icon="⭐" tone="warning" />
        <StatCard label="Giá trị hợp đồng" value={vnd(contractValue)} icon="📄" tone="success" />
        <StatCard label="Pipeline cơ hội" value={vnd(pipeline)} icon="📈" tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <SectionCard title="Cơ hội bán hàng" bodyClassName="p-0">
            {opps.length ? (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase dark:border-dark-600 dark:text-dark-300">
                  <tr><th className="px-4 py-3">Cơ hội</th><th className="px-4 py-3">Giai đoạn</th><th className="px-4 py-3">Giá trị</th><th className="px-4 py-3">Xác suất</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                  {opps.map((o) => (
                    <tr key={o.id}>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-dark-100">{o.name}</td>
                      <td className="px-4 py-3"><Badge tone="info">{o.stage}</Badge></td>
                      <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{vnd(o.amount)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{o.probability != null ? `${Math.round(o.probability * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="p-4 text-sm text-gray-400">Chưa có cơ hội.</p>}
          </SectionCard>

          <SectionCard accent="success" title="Hợp đồng" bodyClassName="p-0">
            {contracts.length ? (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase dark:border-dark-600 dark:text-dark-300">
                  <tr><th className="px-4 py-3">Hợp đồng</th><th className="px-4 py-3">Giá trị</th><th className="px-4 py-3">Hiệu lực</th><th className="px-4 py-3">Trạng thái</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                  {contracts.map((k) => (
                    <tr key={k.id}>
                      <td className="px-4 py-3"><span className="font-medium text-gray-800 dark:text-dark-100">{k.name}</span><p className="text-xs text-gray-400">{k.code}</p></td>
                      <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{vnd(k.value)}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{dateVN(k.effectiveFrom)} – {dateVN(k.effectiveTo)}</td>
                      <td className="px-4 py-3"><Badge tone={k.status === "active" ? "success" : "neutral"}>{k.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="p-4 text-sm text-gray-400">Chưa có hợp đồng.</p>}
          </SectionCard>

          <SectionCard accent="warning" title="Ticket hỗ trợ" bodyClassName="p-0">
            {tickets.length ? (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase dark:border-dark-600 dark:text-dark-300">
                  <tr><th className="px-4 py-3">Ticket</th><th className="px-4 py-3">Ưu tiên</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Phụ trách</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                  {tickets.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3"><span className="font-medium text-gray-800 dark:text-dark-100">{t.title}</span><p className="text-xs text-gray-400">{t.code}</p></td>
                      <td className="px-4 py-3"><Badge tone={t.priority === "high" ? "error" : "warning"}>{t.priority}</Badge></td>
                      <td className="px-4 py-3"><Badge tone={t.status === "open" ? "warning" : "neutral"}>{t.status}</Badge></td>
                      <td className="px-4 py-3 text-gray-600 dark:text-dark-200">{userName(t.assigneeId)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="p-4 text-sm text-gray-400">Không có ticket.</p>}
          </SectionCard>
        </div>

        <div className="space-y-4">
          {recap ? <AiRecap points={recap.bullets} footnote={`X.AI tạo lúc ${dateVN(recap.generatedAt)} · chỉ hỗ trợ đọc.`} /> : null}

          <SectionCard accent="neutral" title="Liên hệ">
            {contacts.length ? (
              <div className="space-y-3">
                {contacts.map((ct) => (
                  <div key={ct.id} className="flex items-start gap-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary-600/10 text-primary-600">👤</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-dark-100">{ct.name} {ct.isPrimary ? <Badge tone="primary" className="ml-1">Chính</Badge> : null}</p>
                      <p className="text-xs text-gray-400">{ct.title ?? ""}{ct.department ? ` · ${ct.department}` : ""}</p>
                      <p className="text-xs text-gray-400">{ct.email ?? ""} {ct.phone ?? ""}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">Chưa có liên hệ.</p>}
          </SectionCard>

          <SectionCard accent="neutral" title="Tài liệu" action={<Link href="/documents" className="text-sm text-primary-600 hover:underline">Kho tài liệu</Link>}>
            {documents.length ? (
              <div className="space-y-2">
                {documents.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-lg border border-gray-200 p-2.5 dark:border-dark-600">
                    <span className="text-lg">📄</span>
                    <span className="flex-1 truncate text-sm text-gray-700 dark:text-dark-100">{(d as unknown as { title?: string }).title ?? d.name}</span>
                    <span className="text-xs text-gray-400 uppercase">{d.type}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">Chưa có tài liệu.</p>}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
