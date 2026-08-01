// FE admin invite proxy (PH-00b). Creates a single-use invite for { userId } via
// the backend, which returns the SURFACED activation link + token (NOT emailed —
// internal `.local` accounts). Forwarded with the canonical admin identity
// headers (same pattern as the other admin BFF write-flows).
import { forwardPost, readJson } from "../../admin/_forward";

export async function POST(request: Request) {
  const body = await readJson(request);
  return forwardPost("/api/auth/invite", { userId: String(body.userId ?? "") });
}
