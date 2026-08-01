// POST /api/admin/controlplane/app-account-bindings → bind a person to an app
// account. xhub-api POST /api/controlplane/app-account-bindings.
import { forwardPost, readJson } from "../../_forward";

export async function POST(request: Request) {
  const body = await readJson(request);
  return forwardPost("/api/controlplane/app-account-bindings", {
    personId: body.personId,
    applicationCode: body.applicationCode,
    idempotencyKey: body.idempotencyKey,
    correlationId: body.correlationId,
    payload: body.payload ?? {},
  });
}
