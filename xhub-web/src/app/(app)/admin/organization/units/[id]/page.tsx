import { notFound } from "next/navigation";
import { SectionCard } from "@/xhub/ui/Card";
import { Badge } from "@/xhub/ui/Badge";
import { AdminHeader, DefRow } from "@/features/tenant-admin/AdminHeader";
import { getOrgStructure } from "@/features/tenant-admin/identity.server";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { LEGAL_ENTITY: "Pháp nhân", DIVISION: "Khối", DEPARTMENT: "Phòng/Ban" };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { units } = await getOrgStructure();
  const u = units.find((o) => o.code === id);
  return { title: `${u?.name ?? "Đơn vị"} · Quản trị · XHub` };
}

export default async function OrgUnitDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { source, units, positions } = await getOrgStructure();
  const unit = units.find((u) => u.code === id);
  if (!unit) notFound();

  const parent = units.find((u) => u.code === unit.parent);
  const children = units.filter((u) => u.parent === unit.code);
  const head = positions.find((p) => p.code === unit.headPosition);
  const members = positions.filter((p) => p.orgUnit === unit.code);

  return (
    <div className="space-y-4">
      <AdminHeader title={unit.name} subtitle={`${unit.code} · ${TYPE_LABEL[unit.type] ?? unit.type}`}
        back={{ href: "/admin/organization", label: "Sơ đồ tổ chức" }}
        chip={source === "live" ? { label: "Dữ liệu trực tiếp (/api/identity)", tone: "success" } : { label: "Backend chưa sẵn — demo", tone: "warning" }} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <SectionCard accent="neutral" title="Thông tin đơn vị">
          <dl className="space-y-2 text-sm">
            <DefRow label="Đơn vị cấp trên" value={parent?.name ?? "— (gốc)"} />
            <DefRow label="Trưởng đơn vị" value={head ? `${head.person}` : "Khuyết"} />
            <DefRow label="Chức danh trưởng" value={head?.name ?? "—"} />
            <DefRow label="Đơn vị con" value={String(children.length)} />
            <DefRow label="Phạm vi mặc định" value={`org_unit = ${unit.code}`} />
          </dl>
        </SectionCard>

        <SectionCard title="Vị trí & người giữ" bodyClassName="p-0">
          <ul className="divide-y divide-gray-100 dark:divide-dark-600">
            {members.length ? members.map((p) => (
              <li key={p.code} className="flex items-center justify-between gap-2 px-4 py-3">
                <div><p className="font-medium text-gray-800 dark:text-dark-100">{p.name}</p><p className="text-xs text-gray-400">{p.code}</p></div>
                <span className="text-right"><p className="text-sm text-gray-700 dark:text-dark-100">{p.person}</p>{p.code === unit.headPosition ? <Badge tone="primary">Trưởng đơn vị</Badge> : null}</span>
              </li>
            )) : <li className="px-4 py-6 text-center text-sm text-gray-400">Chưa có vị trí.</li>}
          </ul>
        </SectionCard>

        <SectionCard title="Đơn vị trực thuộc" bodyClassName="p-0">
          <ul className="divide-y divide-gray-100 dark:divide-dark-600">
            {children.length ? children.map((c) => (
              <li key={c.code} className="px-4 py-3"><p className="font-medium text-gray-800 dark:text-dark-100">{c.name}</p><p className="text-xs text-gray-400">{c.code} · {TYPE_LABEL[c.type] ?? c.type}</p></li>
            )) : <li className="px-4 py-6 text-center text-sm text-gray-400">Không có đơn vị con.</li>}
          </ul>
        </SectionCard>
      </div>

      <SectionCard accent="neutral" title="Lịch sử thay đổi (đường báo cáo & hiệu lực)">
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary-500" /><div><p className="text-gray-700 dark:text-dark-100">Tạo đơn vị · phiên bản v3</p><p className="text-xs text-gray-400">Hiệu lực từ 01/07/2026</p></div></li>
          <li className="flex gap-3"><span className="mt-1.5 size-2 shrink-0 rounded-full bg-gray-300" /><div><p className="text-gray-700 dark:text-dark-100">Cập nhật trưởng đơn vị · phiên bản v2</p><p className="text-xs text-gray-400">Hiệu lực 01/01/2026 – 30/06/2026</p></div></li>
        </ol>
      </SectionCard>
    </div>
  );
}
