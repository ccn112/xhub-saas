// FE proxy — read back a saved test-evidence screenshot and re-serve it as
// raw image bytes (so <img src="/api/testruns/evidence/.../file.png"> works
// directly). The BFF returns { contentBase64, mimeType } JSON (same
// convention as records/getVersionContent); we decode it here once so the
// browser never has to.
import { XOFFICE_BASE_SERVER as API } from "@/lib/api-base";
const HEADERS = {
  "x-tenant-id": "tenant-xtech",
  "x-user-id": "user-nam",
} as const;

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ userId: string; testCaseId: string; filename: string }> },
) {
  const { userId, testCaseId, filename } = await ctx.params;
  try {
    const res = await fetch(
      `${API}/api/testruns/evidence/${encodeURIComponent(userId)}/${encodeURIComponent(testCaseId)}/${encodeURIComponent(filename)}`,
      { headers: HEADERS, cache: "no-store" },
    );
    if (!res.ok) return new Response(null, { status: res.status });
    const data = (await res.json()) as { contentBase64: string; mimeType: string };
    const buf = Buffer.from(data.contentBase64, "base64");
    return new Response(buf, {
      headers: {
        "content-type": data.mimeType,
        "cache-control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response(null, { status: 502 });
  }
}
