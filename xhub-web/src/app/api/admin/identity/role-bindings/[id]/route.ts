// DELETE /api/admin/identity/role-bindings/:id → remove a role binding (NX-011).
// Forwards to xhub-api with the canonical admin identity headers.
import { forwardDelete } from "../../../_forward";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardDelete(`/api/identity/role-bindings/${encodeURIComponent(id)}`);
}
