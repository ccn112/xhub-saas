// DELETE /api/admin/identity/positions/:id/assignments/:assignmentId → revoke an
// assignment (+ re-derive current primary on the backend). Forwards to xhub-api
// with the canonical admin identity headers (PH-01 / NX-013).
import { forwardDelete } from "../../../../../_forward";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const { id, assignmentId } = await params;
  return forwardDelete(
    `/api/identity/positions/${encodeURIComponent(id)}/assignments/${encodeURIComponent(assignmentId)}`,
  );
}
