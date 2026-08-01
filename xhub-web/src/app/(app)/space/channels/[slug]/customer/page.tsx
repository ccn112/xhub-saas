import Link from "next/link";
import { notFound } from "next/navigation";
import { ChannelShell } from "@/xhub/shell/ChannelShell";
import { SectionCard } from "@/xhub/ui/Card";
import { StatCard } from "@/xhub/ui/StatCard";
import { Badge } from "@/xhub/ui/Badge";
import { AiRecap } from "@/xhub/ui/AiRecap";
import { collection, byId, where } from "@/xhub/lib/seed";
import { vnd, vndShort, dateVN } from "@/xhub/lib/format";
import { channelBySlug, userName, initials } from "@/xhub/lib/repo";
import type { Channel, Customer, Contact, Opportunity, Contract, Ticket } from "@/xhub/lib/screen-types";

export const metadata = { title: "Khách hàng · X.Space" };

type DocRow = { id: string; title: string; type?: string; updatedAt?: string; customerId?: string };

const docIcon: Record<string, string> = { pdf: "📕", docx: "📘", xlsx: "📗", pptx: "📙" };
const ticketTone: Record<string, "error" | "warning" | "success" | "neutral"> = { open: "error", pending: "warning", resolved: "success", closed: "neutral" };

const STAGES = ["lead", "consulting", "demo", "proposal", "negotiation", "implementation", "active"];
const STAGE_LABEL: Record<string, string> = {
  lead: "Tiềm năng", consulting: "Tư vấn", demo: "Demo", proposal: "Đề xuất",
  negotiation: "Đàm phán", implementation: "Triển khai", active: "Vận hành",
};

export default async function CustomerChannel({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const channel = channelBySlug(slug);
  if (!channel || !channel.customerId) notFound();

  const customer = byId<Customer>("customers", channel.customerId);
  if (!customer) notFound();

  const members = where<{ userId: string }>("channelMembers", "channelId", channel.id);
  const contacts = where<Contact>("contacts", "customerId", customer.id);
  const opportunities = where<Opportunity>("opportunities", "customerId", customer.id);
  const contracts = where<Contract>("contracts", "customerId", customer.id);
  const tickets = where<Ticket>("tickets", "customerId", customer.id);
  const docs = collection<DocRow>("documents").filter((d) => d.customerId === customer.id).slice(0, 6);
  const recap = collection<{ id: string; scopeId?: string; bullets?: string[]; generatedAt?: string }>("aiInsights").find((a) => a.scopeId === customer.id);

  const opp = opportunities[0];
  const contract = contracts[0];
  const pipeline = opportunities.reduce((s, o) => s + (o.amount ?? 0), 0);
  const currentStageIdx = opp ? STAGES.indexOf(opp.stage) : -1;

  return (
    <ChannelShell channel={channel as Channel} active="customer" memberCount={members.length}>
      <div className="space-y-5">
        {/* Customer summary */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-xl bg-primary-600 text-lg font-bold text-white">{initials(customer.name)}</span>
            <div>
              <h2 className="font-heading text-lg font-bold text-gray-800 dark:text-dark-50">{customer.name}</h2>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-dark-300">
                {customer.code} · {customer.industry} · Phân khúc {customer.segment} · Phụ trách {userName(customer.ownerId)}
              </p>
            </div>
          </div>
          <Badge tone="info">{customer.status}</Badge>
        </div>

        {/* CRM metrics */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard label="Sức khỏe" value={`${customer.healthScore ?? "—"}`} icon="❤️" tone={((customer.healthScore ?? 0) >= 80) ? "success" : "warning"} />
          <StatCard label="Hài lòng" value={customer.satisfaction ? `${customer.satisfaction}/5` : "—"} icon="⭐" tone="primary" />
          <StatCard label="Pipeline" value={vndShort(pipeline)} icon="💰" tone="info" />
          <StatCard label="Ticket mở" value={`${tickets.filter((t) => t.status === "open").length}`} icon="🎫" tone="warning" />
        </div>

        {/* Customer journey */}
        <SectionCard title="Hành trình khách hàng">
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {STAGES.map((st, i) => {
              const done = i <= currentStageIdx;
              const current = i === currentStageIdx;
              return (
                <div key={st} className="flex items-center">
                  <div className={`flex flex-col items-center ${current ? "" : ""}`}>
                    <span className={`flex size-7 items-center justify-center rounded-full text-tiny-plus font-bold ${done ? "bg-primary-600 text-white" : "bg-gray-150 text-gray-400 dark:bg-dark-500"}`}>{i + 1}</span>
                    <span className={`mt-1 whitespace-nowrap text-tiny-plus ${current ? "font-semibold text-primary-700 dark:text-primary-300" : "text-gray-400"}`}>{STAGE_LABEL[st]}</span>
                  </div>
                  {i < STAGES.length - 1 ? <span className={`mx-1 h-0.5 w-8 ${i < currentStageIdx ? "bg-primary-600" : "bg-gray-150 dark:bg-dark-500"}`} /> : null}
                </div>
              );
            })}
          </div>
        </SectionCard>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
          <div className="space-y-5 xl:col-span-2">
            {/* Deal status */}
            {opp ? (
              <SectionCard title="Cơ hội bán hàng">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 dark:text-dark-50">{opp.name}</p>
                  <Badge tone="primary">{STAGE_LABEL[opp.stage] ?? opp.stage}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                  <div><p className="text-xs text-gray-400">Giá trị</p><p className="font-semibold text-gray-800 dark:text-dark-50">{vnd(opp.amount)}</p></div>
                  <div><p className="text-xs text-gray-400">Xác suất</p><p className="font-semibold text-gray-800 dark:text-dark-50">{Math.round((opp.probability ?? 0) * 100)}%</p></div>
                  <div><p className="text-xs text-gray-400">Dự kiến chốt</p><p className="font-semibold text-gray-800 dark:text-dark-50">{dateVN(opp.expectedCloseDate)}</p></div>
                </div>
              </SectionCard>
            ) : null}

            {/* Contract */}
            {contract ? (
              <SectionCard accent="success" title="Hợp đồng">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 dark:text-dark-50">{contract.name}</p>
                  <Badge tone={contract.status === "active" ? "success" : "warning"}>{contract.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-gray-400">{contract.code} · hiệu lực {dateVN(contract.effectiveFrom)} → {dateVN(contract.effectiveTo)}</p>
                <p className="mt-2 text-lg font-semibold text-gray-800 dark:text-dark-50">{vnd(contract.value)}</p>
              </SectionCard>
            ) : null}

            {/* Ticket SLA */}
            <SectionCard accent="warning" title="Ticket & SLA" bodyClassName="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 text-left text-xs text-gray-400 uppercase dark:border-dark-600 dark:text-dark-300">
                  <tr><th className="px-4 py-2.5">Ticket</th><th className="px-4 py-2.5">Phụ trách</th><th className="px-4 py-2.5">SLA</th><th className="px-4 py-2.5">Trạng thái</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-dark-600">
                  {tickets.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-2.5"><span className="text-gray-800 dark:text-dark-100">{t.title}</span><span className="block text-tiny-plus text-gray-400">{t.code}</span></td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-dark-200">{userName(t.assigneeId)}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-dark-200">{dateVN(t.slaDueAt)}</td>
                      <td className="px-4 py-2.5"><Badge tone={ticketTone[t.status] ?? "neutral"}>{t.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </SectionCard>

            {/* Follow-up + recent conversation link */}
            <SectionCard title="Trao đổi gần đây" action={<Link href={`/space/channels/${channel.slug}`} className="text-sm text-primary-600 hover:underline">Mở hội thoại</Link>}>
              <p className="text-sm text-gray-500 dark:text-dark-300">
                Tất cả trao đổi bán hàng, triển khai và hỗ trợ với {customer.name} được tập trung trong hội thoại của channel này.
              </p>
            </SectionCard>
          </div>

          <div className="space-y-5">
            {recap?.bullets ? <AiRecap title="X.AI tóm tắt khách hàng" points={recap.bullets} footnote={`Tạo lúc ${dateVN(recap.generatedAt)}`} /> : null}

            {/* Primary contacts */}
            <SectionCard accent="neutral" title="Đầu mối liên hệ">
              <div className="space-y-3">
                {contacts.map((c) => (
                  <div key={c.id} className="flex items-start gap-2.5">
                    <span className="flex size-8 items-center justify-center rounded-full bg-gray-150 text-tiny-plus font-semibold text-gray-600 dark:bg-dark-500 dark:text-dark-100">{initials(c.name)}</span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-gray-800 dark:text-dark-50">{c.name}{c.isPrimary ? <Badge tone="primary">Chính</Badge> : null}</p>
                      <p className="text-xs text-gray-400">{c.title} · {c.department}</p>
                      <p className="truncate text-tiny-plus text-gray-400">{c.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Customer files */}
            <SectionCard accent="neutral" title="Tài liệu khách hàng" bodyClassName="p-0">
              <ul className="divide-y divide-gray-100 dark:divide-dark-600">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 px-4 py-2.5">
                    <span>{docIcon[d.type ?? ""] ?? "📄"}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-700 dark:text-dark-100">{d.title}</span>
                    <span className="text-tiny-plus text-gray-400">{dateVN(d.updatedAt)}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        </div>
      </div>
    </ChannelShell>
  );
}
