// FE switch-tenant proxy (PH-00b). Forwards { tenantId } to the backend WITH the
// current session cookie so the backend re-signs a session for the chosen
// membership; we then replace the FE-origin session cookie with the new JWT.
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/xhub/lib/session.server";

import { API_BASE_SERVER as API_BASE } from "@/lib/api-base";
const MAX_AGE = 60 * 60 * 8;

export async function POST(request: Request) {
  let body: { tenantId?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body */
  }
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const res = await fetch(`${API_BASE}/api/auth/switch-tenant`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { cookie: `${SESSION_COOKIE}=${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.token) {
    return Response.json({ error: data?.message ?? "switch failed" }, { status: res.status || 400 });
  }
  store.set(SESSION_COOKIE, data.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: MAX_AGE,
  });
  return Response.json({ user: data.user, tenantId: data.tenantId, roles: data.roles, memberships: data.memberships });
}
