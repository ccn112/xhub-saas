// POST /api/admin/controlplane/tenant-applications → enable/disable an app for
// the tenant. xhub-api POST /api/controlplane/tenant-applications.
import { forwardPost, readJson } from "../../_forward";

export async function POST(request: Request) {
  const body = await readJson(request);
  return forwardPost("/api/controlplane/tenant-applications", {
    applicationCode: body.applicationCode,
    status: body.status ?? "enabled",
    config: body.config ?? {},
  });
}
