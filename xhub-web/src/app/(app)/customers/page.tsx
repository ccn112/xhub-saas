import { StatCard } from "@/xhub/ui/StatCard";
import { collection } from "@/xhub/lib/seed";
import { userName } from "@/xhub/lib/repo";
import type { Tone } from "@/xhub/ui/Badge";
import { CustomersTable, type CustomerRow } from "./CustomersTable";

export const metadata = { title: "Khách hàng · XHub" };

interface Customer {
  id: string; code: string; name: string; industry?: string; segment: string;
  status: string; ownerId?: string; healthScore?: number; satisfaction?: number;
}

function healthTone(score: number): Tone {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "error";
}

export default function CustomersPage() {
  const customers = collection<Customer>("customers");
  const contracts = collection<{ customerId: string }>("contracts");
  const opps = collection<{ customerId: string }>("opportunities");
  const tickets = collection<{ customerId: string; status: string }>("tickets");

  const total = customers.length;
  const bySegment = (["A", "B", "C"] as const).map((s) => ({
    segment: s,
    count: customers.filter((c) => c.segment === s).length,
  }));
  const avgHealth = total
    ? Math.round(customers.reduce((a, c) => a + (c.healthScore ?? 0), 0) / total)
    : 0;
  const avgSatisfaction = total
    ? (customers.reduce((a, c) => a + (c.satisfaction ?? 0), 0) / total).toFixed(1)
    : "—";

  const countBy = (id: string, rows: { customerId: string }[]) =>
    rows.filter((r) => r.customerId === id).length;
  const openTickets = (id: string) =>
    tickets.filter((t) => t.customerId === id && t.status !== "closed" && t.status !== "resolved").length;

  const rows: CustomerRow[] = customers.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    industry: c.industry ?? "",
    segment: c.segment,
    status: c.status,
    ownerName: userName(c.ownerId),
    healthScore: c.healthScore ?? null,
    satisfaction: c.satisfaction ?? null,
    contracts: countBy(c.id, contracts),
    opportunities: countBy(c.id, opps),
    openTickets: openTickets(c.id),
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-heading text-xl font-bold text-gray-800 dark:text-dark-50">Khách hàng</h1>
        <p className="text-sm text-gray-500 dark:text-dark-300">Danh mục khách hàng, sức khỏe quan hệ và hồ sơ nhanh</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Tổng khách hàng" value={String(total)} icon="👥" tone="primary" />
        <StatCard label="Phân khúc A" value={String(bySegment[0].count)} icon="🅰️" tone="success" />
        <StatCard label="Phân khúc B" value={String(bySegment[1].count)} icon="🅱️" tone="info" />
        <StatCard label="Phân khúc C" value={String(bySegment[2].count)} icon="🇨" tone="neutral" />
        <StatCard label="Health TB" value={`${avgHealth}`} sub="trên 100" icon="❤️" tone={healthTone(avgHealth)} />
        <StatCard label="Hài lòng TB" value={`${avgSatisfaction}`} sub="trên 5" icon="⭐" tone="warning" />
      </div>

      <CustomersTable rows={rows} />
    </div>
  );
}
