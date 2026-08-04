// FE forgot-password proxy (PH-00b). Forwards { email|userId } to the backend,
// which returns a SURFACED reset token + link for `.local` accounts (no email
// delivery in the internal pilot). We pass that straight back to the page.
import { API_BASE_SERVER as API_BASE } from "@/lib/api-base";

export async function POST(request: Request) {
  let body: { email?: string; userId?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body */
  }
  const res = await fetch(`${API_BASE}/api/auth/forgot`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return Response.json(data, { status: res.ok ? 200 : res.status });
}
