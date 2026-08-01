// GET  /api/admin/identity/positions/:id/assignments → holder/acting history.
// POST /api/admin/identity/positions/:id/assignments → create an assignment
// (PRIMARY|ACTING, effective-dated). Forwards to xhub-api with the canonical
// admin identity headers. FE never touches the DB (PH-01 / NX-013).
import { forwardGet, forwardPost, readJson } from "../../../../_forward";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardGet(`/api/identity/positions/${encodeURIComponent(id)}/assignments`);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request);
  return forwardPost(`/api/identity/positions/${encodeURIComponent(id)}/assignments`, {
    personId: body.personId,
    kind: body.kind,
    effectiveFrom: body.effectiveFrom,
    effectiveTo: body.effectiveTo ?? null,
    reason: body.reason ?? null,
  });
}
