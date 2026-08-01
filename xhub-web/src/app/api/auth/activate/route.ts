// FE activate proxy (PH-00b). The /activate page posts { token, password }; we
// forward to the backend which sets the internal password + returns a signed
// session JWT. We then set that JWT as the httpOnly cookie on the FE origin
// (mirrors the /api/auth/login route), landing the user signed-in.
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/xhub/lib/session.server";

const API_BASE = process.env.XHUB_API_URL ?? "http://localhost:4000";
const MAX_AGE = 60 * 60 * 8; // 8h, matches backend expiry

export async function POST(request: Request) {
  let body: { token?: string; password?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body → 400 below */
  }

  const res = await fetch(`${API_BASE}/api/auth/activate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.token) {
    return Response.json({ error: data?.message ?? "activation failed" }, { status: res.status || 400 });
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: MAX_AGE,
  });

  return Response.json({ user: data.user, tenantId: data.tenantId, roles: data.roles, memberships: data.memberships });
}
