import { AdminHeader } from "@/features/tenant-admin/AdminHeader";
import { getOrgStructure } from "@/features/tenant-admin/identity.server";
import { PositionsClient } from "./PositionsClient";

export const metadata = { title: "Vị trí & người giữ · Quản trị · XHub" };
export const dynamic = "force-dynamic";

export default async function AdminPositionsPage() {
  const { source, units, positions: pos, people } = await getOrgStructure();
  const unitName = (code: string) => units.find((u) => u.code === code)?.name ?? code;
  const positions = pos.map((p) => ({ ...p, orgUnitName: unitName(p.orgUnit) }));
  return (
    <div className="space-y-4">
      <AdminHeader title="Vị trí & người giữ" subtitle="Chức danh, người giữ hiện tại, ngày hiệu lực và phân công tạm quyền (acting)."
        chip={source === "live" ? { label: "Dữ liệu trực tiếp (/api/identity)", tone: "success" } : { label: "Backend chưa sẵn — demo", tone: "warning" }} />
      <PositionsClient positions={positions} people={people} />
    </div>
  );
}
