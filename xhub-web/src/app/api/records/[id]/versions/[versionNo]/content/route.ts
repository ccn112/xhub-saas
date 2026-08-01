// FE proxy → xhub-api GET /api/records/:id/versions/:versionNo/content.
// Returns the stored content (base64 + metadata) for a "Tải nội dung" action.
const API = process.env.XHUB_API_URL ?? "http://localhost:4000";
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
