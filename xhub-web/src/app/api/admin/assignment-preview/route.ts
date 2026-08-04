// FE proxy for the assignment "who will approve" preview
// (POST /api/identity/assignment/preview). The assignment-resolver screen posts
// here; we forward to the BFF with the canonical admin identity headers. On any
// failure we return 502 so the client degrades to its local demo resolver.
// FE never touches the DB.
import { PLATFORM_BASE_SERVER as API } from "@/lib/api-base";
const HEADERS = { "content-type": "application/json", "x-tenant-id": "tenant-xtech", "x-user-id": "user-nam" };

export async function POST(request: Request) {
  let body: unknown = {};
  try { body = await request.json(); } catch { /* empty */ }
  try {
    const res = await fetch(`${API}/api/identity/assignment/preview`, { method: "POST", headers: HEADERS, body: JSON.stringify(body), cache: "no-store" });
    if (!res.ok) return Response.json({ error: "backend unavailable" }, { status: 502 });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "backend unavailable" }, { status: 502 });
  }
}
