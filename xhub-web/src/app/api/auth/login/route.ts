// FE login proxy. The browser posts here (same origin :3000); we forward to the
// backend, take the signed JWT from the response body, and set it as an httpOnly
// cookie on the FE origin so the Next server can read it (the backend cookie is
// on :4000 and invisible to :3000). The backend verifies the same JWT (shared
// AUTH_JWT_SECRET) on subsequent /me and data calls.
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/xhub/lib/session.server";

const API_BASE = process.env.XHUB_API_URL ?? "http://localhost:4000";
const MAX_AGE = 60 * 60 * 8; // 8h, matches backend expiry

export async function POST(request: Request) {
  let body: { email?: string; userId?: string; password?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body → 401 below */
  }

  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.token) {
    return Response.json({ error: data?.message ?? "login failed" }, { status: res.status || 401 });
  }

  const store = await cookies();
  store.set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // dev over http; flip behind TLS
    path: "/",
    maxAge: MAX_AGE,
  });

  return Response.json({
    user: data.user,
    tenantId: data.tenantId,
    roles: data.roles,
    memberships: data.memberships,
  });
}
