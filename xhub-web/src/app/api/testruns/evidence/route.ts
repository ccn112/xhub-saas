// FE proxy — upload a pasted/uploaded screenshot as evidence for one test-case
// row in the QA console (paste-to-attach flow). Mirrors src/app/api/testruns/
// route.ts's identity headers; forwards straight to the BFF, which stores the
// image on disk (storage/testruns/<tenantId>/evidence/<userId>/<testCaseId>/).
import { XOFFICE_BASE_SERVER as API } from "@/lib/api-base";
const HEADERS = {
  "content-type": "application/json",
  "x-tenant-id": "tenant-xtech",
  "x-user-id": "user-nam",
} as const;

export async function POST(request: Request) {
  let body: unknown = {};
  try { body = await request.json(); } catch { /* empty */ }
  try {
    const res = await fetch(`${API}/api/testruns/evidence`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      return Response.json({ error: data?.message ?? "backend rejected" }, { status: res.status });
    }
    return Response.json(data);
  } catch {
    return Response.json({ error: "backend unavailable" }, { status: 502 });
  }
}
