// PATCH /api/admin/identity/org-units/:id → re-parent an org unit (drag-and-drop
// in the Sơ đồ tổ chức screen). Forwards to xhub-api PATCH
// /api/identity/org-units/:id with the canonical admin identity headers.
// FE never touches the DB — writes always go through the API base.
import { forwardDelete, forwardPatch, readJson } from "../../../_forward";

// PATCH → update an org unit: any subset of { name, type, headId, parentId }.
// Only forwards keys that were actually sent so the backend can distinguish
// "not provided" from "clear to null" (headId/parentId presence matters).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request);
  const payload: Record<string, unknown> = {};
  if ("name" in body) payload.name = body.name;
  if ("type" in body) payload.type = body.type;
  if ("headId" in body) payload.headId = body.headId ?? null;
  if ("parentId" in body) payload.parentId = body.parentId ?? null;
  return forwardPatch(`/api/identity/org-units/${encodeURIComponent(id)}`, payload);
}

// DELETE → remove a leaf/empty org unit (backend 409 if it has children/positions).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardDelete(`/api/identity/org-units/${encodeURIComponent(id)}`);
}
