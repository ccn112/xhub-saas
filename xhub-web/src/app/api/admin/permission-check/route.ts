// FE proxy for the RBAC/ABAC check (POST /api/identity/permissions/check). The
// data-scopes "test as user" panel posts here; we forward to the BFF with the
// canonical admin identity headers. On any failure we return 502 so the client
// degrades to its local demo evaluation. FE never touches the DB.
import { API_BASE_SERVER as API } from "@/lib/api-base";
const HEADERS = { "content-type": "application/json", "x-tenant-id": "tenant-xtech", "x-user-id": "user-nam" };

export async function POST(request: Request) {
  let body: unknown = {};
  try { body = await request.json(); } catch { /* empty */ }
  try {
    const res = await fetch(`${API}/api/identity/permissions/check`, { method: "POST", headers: HEADERS, body: JSON.stringify(body), cache: "no-store" });
    if (!res.ok) return Response.json({ error: "backend unavailable" }, { status: 502 });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "backend unavailable" }, { status: 502 });
  }
}
