// FE proxy → xhub-api GET /api/records/:id/versions/:versionNo/content.
// Returns the stored content (base64 + metadata) for a "Tải nội dung" action.
import { XOFFICE_BASE_SERVER as API } from "@/lib/api-base";
const HEADERS = { "x-tenant-id": "tenant-xtech", "x-user-id": "user-nam" };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionNo: string }> },
) {
  const { id, versionNo } = await params;
  try {
    const res = await fetch(`${API}/api/records/${id}/versions/${versionNo}/content`, {
      headers: HEADERS,
      cache: "no-store",
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) return Response.json({ error: "backend rejected", detail: data }, { status: res.status });
    return Response.json(data);
  } catch {
    return Response.json({ error: "backend unavailable" }, { status: 502 });
  }
}
