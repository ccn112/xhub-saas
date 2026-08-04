// FE reset-password proxy (PH-00b). Forwards { token, password } to the backend,
// which validates + consumes the single-use RESET token and stores the new
// argon2 hash. No cookie is set here — the user then signs in from /login.
import { PLATFORM_BASE_SERVER as API_BASE } from "@/lib/api-base";

export async function POST(request: Request) {
  let body: { token?: string; password?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body */
  }
  const res = await fetch(`${API_BASE}/api/auth/reset`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return Response.json({ error: data?.message ?? "reset failed" }, { status: res.status || 400 });
  return Response.json(data);
}
