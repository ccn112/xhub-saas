// PATCH /api/admin/identity/positions/:id → move a position to another org unit
// (setup mode). Forwards to xhub-api PATCH /api/identity/positions/:id with the
// canonical admin identity headers. FE never touches the DB.
import { forwardPatch, readJson } from "../../../_forward";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request);
  const orgUnitId = String(body.orgUnitId ?? "");
  return forwardPatch(`/api/identity/positions/${encodeURIComponent(id)}`, { orgUnitId });
}
