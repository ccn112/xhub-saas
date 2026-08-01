// Public /select-tenant — when a user holds several memberships, pick the active
// tenant. Reads the session from the backend; if there is no session or a single
// membership, guides the user accordingly.
import { getSession } from "@/xhub/lib/session.server";
import { SelectTenantClient } from "./SelectTenantClient";
import { AuthShell, AuthLink } from "../_AuthShell";

export const dynamic = "force-dynamic";

export default async function SelectTenantPage() {
  const session = await getSession();

  if (!session) {
    return (
      <AuthShell title="Chọn tenant" subtitle="Bạn cần đăng nhập trước khi chọn tenant.">
        <p className="mt-6 text-center text-sm">
          <AuthLink href="/login">Đăng nhập</AuthLink>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Chọn tenant" subtitle={`Đăng nhập với tư cách ${session.user.name ?? session.userId}. Chọn tenant để tiếp tục.`}>
      <SelectTenantClient memberships={session.memberships} current={session.tenantId} />
    </AuthShell>
  );
}
