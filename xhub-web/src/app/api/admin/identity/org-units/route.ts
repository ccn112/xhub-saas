// POST /api/admin/identity/org-units → create a child org unit. Forwards to
// xhub-api POST /api/identity/org-units with the canonical admin identity
// headers. FE never touches the DB — writes always go through the API base.
import { forwardPost, readJson } from "../../_forward";

export async function POST(request: Request) {
  const body = await readJson(request);
  return forwardPost("/api/identity/org-units", {
    code: String(body.code ?? ""),
    name: String(body.name ?? ""),
    type: String(body.type ?? "DEPARTMENT"),
    parentId: (body.parentId ?? null) as string | null,
  });
}
