// Public /reset?token=… — set a new password with a single-use reset token.
import { ResetForm } from "./ResetForm";
import { AuthShell } from "../_AuthShell";

export const dynamic = "force-dynamic";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <AuthShell title="Đặt lại mật khẩu" subtitle="Chọn mật khẩu mới cho tài khoản của bạn.">
      <ResetForm token={token ?? ""} />
    </AuthShell>
  );
}
