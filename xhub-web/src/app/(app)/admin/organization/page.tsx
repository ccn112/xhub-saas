import { AdminHeader } from "@/features/tenant-admin/AdminHeader";
import { getOrgGraph, getPeople } from "@/features/tenant-admin/identity.server";
import { OrgChart } from "./OrgChart";

export const metadata = { title: "Sơ đồ tổ chức · Quản trị · XHub" };
export const dynamic = "force-dynamic";

export default async function AdminOrgPage() {
  // Live id-based org graph (units → positions → nhân sự) drives the visual
  // cây thừa kế + drag-and-drop; degrades to the demo graph on any failure.
  const [graph, peopleRes] = await Promise.all([getOrgGraph(), getPeople()]);
  const people = peopleRes.users.map((u) => ({ id: u.id, name: u.name }));
  return (
    <div className="space-y-4">
      <AdminHeader
        title="Sơ đồ tổ chức"
        subtitle="Cây thừa kế đơn vị → vị trí → nhân sự phụ thuộc. Bật Chế độ thiết lập để kéo-thả sắp xếp lại đơn vị cha."
        chip={graph.source === "live" ? { label: "Dữ liệu trực tiếp (/api/identity)", tone: "success" } : { label: "Backend chưa sẵn — demo", tone: "warning" }}
      />
      <OrgChart graph={graph} people={people} />
    </div>
  );
}
