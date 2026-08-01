// Public /login route (outside the (app) shell). Internal auth: sign in with an
// email/userId + password (credentials verified against the internal argon2 hash
// on the backend). The dev quick-select list keeps the passwordless personas for
// local work. New accounts arrive via an invite link (/activate).
import { collection } from "@/xhub/lib/seed";
import { LoginForm } from "./LoginForm";
import { AuthShell, AuthLink } from "../_AuthShell";

interface SeedUser {
  id: string;
  name?: string;
  email?: string;
  title?: string;
  primaryRole?: string;
}

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const users = collection<SeedUser>("users").map((u) => ({
    id: u.id,
    name: u.name ?? u.id,
    email: u.email ?? "",
    title: u.title ?? u.primaryRole ?? "",
  }));

  return (
    <AuthShell
      title="Đăng nhập XHub"
      subtitle="Nhập email/userId và mật khẩu nội bộ. Tài khoản mới kích hoạt qua liên kết lời mời."
      footer={
        <span className="text-slate-500 dark:text-slate-400">
          Có liên kết lời mời? <AuthLink href="/activate">Kích hoạt tài khoản</AuthLink>
        </span>
      }
    >
      <LoginForm users={users} />
    </AuthShell>
  );
}
