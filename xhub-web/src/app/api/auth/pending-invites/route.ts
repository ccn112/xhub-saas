// FE admin pending-invites proxy (PH-00b). Lists outstanding (unused, unexpired)
// invites for the tenant. Forwarded with the canonical admin identity headers.
import { PLATFORM_BASE_SERVER as API } from "@/lib/api-base";
const HEADERS = { "content-type": "application/json", "x-tenant-id": "tenant-xtech", "x-user-id": "user-nam" } as const;

export async function GET() {
  try {
    const res = await fetch(`${API}/api/auth/pending-invites`, { headers: HEADERS, cache: "no-store" });
    const data = await res.json().catch(() => []);
    if (!res.ok) return Response.json({ error: "backend rejected", detail: data }, { status: res.status });
    return Response.json(data ?? []);
  } catch {
    return Response.json({ error: "backend unavailable" }, { status: 502 });
  }
}
