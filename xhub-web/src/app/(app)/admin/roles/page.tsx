import { AdminHeader } from "@/features/tenant-admin/AdminHeader";
import { ROLE_CATALOG, ALL_PERMISSIONS } from "@/features/tenant-admin/data";
import { getRoleBindings } from "@/features/tenant-admin/identity.server";
import { RolesClient } from "./RolesClient";

export const metadata = { title: "Vai trò & quyền · Quản trị · XHub" };
export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  // Live role-bindings drive the connectivity chip. The permission MATRIX keeps
  // the demo ROLE_CATALOG: there is no GET endpoint exposing per-role permission
  // policies (only POST permissions/check + GET permissions/effective per user).
  const { source } = await getRoleBindings();
  return (
    <div className="space-y-4">
      <AdminHeader title="Vai trò & quyền" subtitle="Danh mục vai trò quản trị và ma trận quyền hiệu lực (cho phép · bị hạn chế). Mọi ràng buộc có xem trước tác động."
        chip={source === "live"
          ? { label: "Role-binding trực tiếp (/api/identity) · ma trận demo", tone: "success" }
          : { label: "Backend chưa sẵn — demo", tone: "warning" }} />
      <RolesClient roles={ROLE_CATALOG} allPermissions={ALL_PERMISSIONS} />
    </div>
  );
}
