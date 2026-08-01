import { AdminHeader } from "@/features/tenant-admin/AdminHeader";
import { getOrgStructure, getWorkflowSelectors } from "@/features/tenant-admin/identity.server";
import { ResolverClient } from "./ResolverClient";

export const metadata = { title: "Kiểm tra phân công · Quản trị · XHub" };
export const dynamic = "force-dynamic";

export default async function AdminResolverPage() {
  // Live: real workflow nodes drive POST /api/identity/assignment/preview via the
  // route handler. Candidates list + demo amount simulator remain as fallback.
  const [{ positions }, { source, workflows }] = await Promise.all([getOrgStructure(), getWorkflowSelectors()]);
  const candidates = positions.map((p) => ({ code: p.code, name: p.name, person: p.person, orgUnit: p.orgUnit }));
  return (
    <div className="space-y-4">
      <AdminHeader title="Trình kiểm tra phân công" subtitle="Mô phỏng ai sẽ được phân công/duyệt trong một ngữ cảnh — kèm ứng viên, lý do loại và snapshot JSON."
        chip={source === "live" ? { label: "Preview trực tiếp (/api/identity)", tone: "success" } : { label: "Backend chưa sẵn — demo", tone: "warning" }} />
      <ResolverClient candidates={candidates} workflows={workflows} live={source === "live"} />
    </div>
  );
}
