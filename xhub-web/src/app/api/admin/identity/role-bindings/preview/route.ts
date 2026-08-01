// POST /api/admin/identity/role-bindings/preview → impact preview (no write)
// for a prospective binding. Forwards to xhub-api with admin identity headers.
import { forwardPost, readJson } from "../../../_forward";

export async function POST(request: Request) {
  const body = await readJson(request);
  return forwardPost("/api/identity/role-bindings/preview", {
    subjectId: String(body.subjectId ?? ""),
    roleCode: String(body.roleCode ?? ""),
  });
}
