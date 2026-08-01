// POST /api/admin/controlplane/reconcile → run reconciliation for the tenant.
// xhub-api POST /api/controlplane/reconcile.
import { forwardPost } from "../../_forward";

export async function POST() {
  return forwardPost("/api/controlplane/reconcile", {});
}
