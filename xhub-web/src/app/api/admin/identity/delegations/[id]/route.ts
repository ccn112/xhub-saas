// DELETE /api/admin/identity/delegations/:id → revoke a delegation (NX-012).
// Forwards to xhub-api with the canonical admin identity headers.
import { forwardDelete } from "../../../_forward";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardDelete(`/api/identity/delegations/${encodeURIComponent(id)}`);
}
