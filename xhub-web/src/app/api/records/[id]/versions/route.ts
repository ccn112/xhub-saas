// FE proxy → xhub-api POST /api/records/:id/versions (append immutable version).
import { forwardPost, readJson } from "../../../_xoffice-forward";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await readJson(request);
  return forwardPost(`/api/records/${id}/versions`, body);
}
