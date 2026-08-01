// POST /api/admin/backup/:id/restore → xhub-api POST /api/backup/:id/restore.
// Body: { mode: "dry-run" | "sandbox", targetTenantId?, tamper? }.
import { forwardPost, readJson } from "../../../_forward";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request);
  return forwardPost(`/api/backup/${encodeURIComponent(id)}/restore`, {
    mode: body.mode ?? "dry-run",
    targetTenantId: body.targetTenantId,
    tamper: body.tamper,
  });
}
