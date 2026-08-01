// /api/admin/identity/delegations
//   GET  → list delegations (live, tenant-scoped).
//   POST → create a delegation (NX-012) with self/overlap/cycle guardrails.
// Forwards to xhub-api with the canonical admin identity headers.
import { forwardGet, forwardPost, readJson } from "../../_forward";

export async function GET() {
  return forwardGet("/api/identity/delegations");
}

export async function POST(request: Request) {
  const body = await readJson(request);
  return forwardPost("/api/identity/delegations", {
    fromUserId: String(body.fromUserId ?? ""),
    toUserId: String(body.toUserId ?? ""),
    fromAt: body.fromAt ?? null,
    toAt: body.toAt ?? null,
    reason: body.reason ?? null,
  });
}
