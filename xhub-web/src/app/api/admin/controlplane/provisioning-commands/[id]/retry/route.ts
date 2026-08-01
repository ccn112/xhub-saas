// POST /api/admin/controlplane/provisioning-commands/:id/retry → retry a failed
// provisioning command. xhub-api POST /api/controlplane/provisioning-commands/:id/retry.
import { forwardPost } from "../../../../_forward";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return forwardPost(`/api/controlplane/provisioning-commands/${encodeURIComponent(id)}/retry`, {});
}
