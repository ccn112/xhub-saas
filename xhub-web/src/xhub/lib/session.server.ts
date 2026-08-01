// Server-side session reader. Reads the httpOnly `xhub_session` cookie (set on
// the FE origin by the /api/auth/login route handler) and resolves the real
// actor via the backend `GET /api/auth/me`. Returns null when there is no valid
// session so callers keep the demo default actor (app stays usable logged-out).
import { cookies } from "next/headers";

const API_BASE = process.env.XHUB_API_URL ?? "http://localhost:4000";
export const SESSION_COOKIE = "xhub_session";

export interface SessionActor {
  userId: string;
  tenantId: string;
  roles: string[];
  user: { id: string; name?: string; email?: string; title?: string; avatar?: string };
  memberships: { tenantId: string; roles: string[]; status: string }[];
}

export async function getSession(): Promise<SessionActor | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { cookie: `${SESSION_COOKIE}=${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Only trust a JWT-backed session (not the header/default fallback).
    if (data?.source !== "session" || !data?.user?.id) return null;
    return {
      userId: data.user.id,
      tenantId: data.tenantId,
      roles: data.roles ?? [],
      user: data.user,
      memberships: data.memberships ?? [],
    };
  } catch {
    return null;
  }
}
