// /api/admin/identity/role-bindings
//   GET  → list role bindings (live, tenant-scoped).
//   POST → create a role binding (NX-011). Forwards to xhub-api with the
//          canonical admin identity headers. FE never touches the DB.
import { forwardGet, forwardPost, readJson } from "../../_forward";

export async function GET() {
  return forwardGet("/api/identity/role-bindings");
}

export async function POST(request: Request) {
  const body = await readJson(request);
  const payload: Record<string, unknown> = {
    subjectType: String(body.subjectType ?? ""),
    subjectId: String(body.subjectId ?? ""),
    roleCode: String(body.roleCode ?? ""),
  };
  if ("scope" in body) payload.scope = body.scope;
  if ("effectiveFrom" in body) payload.effectiveFrom = body.effectiveFrom ?? null;
  if ("effectiveTo" in body) payload.effectiveTo = body.effectiveTo ?? null;
  return forwardPost("/api/identity/role-bindings", payload);
}
