// FE proxy for the QA user-test checklist persistence (/docs/test).
// Forwards to the BFF with the canonical admin identity headers so results are
// stored server-side (JSON file per tenant+user). On any failure we return 502
// so TestConsole degrades to its localStorage cache. FE never touches the DB.
import { XOFFICE_BASE_SERVER as API } from "@/lib/api-base";
const HEADERS = {
  "content-type": "application/json",
  "x-tenant-id": "tenant-xtech",
  "x-user-id": "user-nam",
} as const;

export async function GET() {
  try {
    const res = await fetch(`${API}/api/testruns`, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) return Response.json({ error: "backend unavailable" }, { status: 502 });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "backend unavailable" }, { status: 502 });
  }
}

export async function PUT(request: Request) {
  let body: unknown = {};
  try { body = await request.json(); } catch { /* empty */ }
  try {
    const res = await fetch(`${API}/api/testruns`, {
      method: "PUT",
      headers: HEADERS,
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
    if (!res.ok) return Response.json({ error: "backend unavailable" }, { status: 502 });
    return Response.json(await res.json());
  } catch {
    return Response.json({ error: "backend unavailable" }, { status: 502 });
  }
}
