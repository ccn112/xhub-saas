// FE proxy → xhub-api POST /api/records (create document + first version).
// Mirrors src/app/api/admin/_forward.ts: forward with the canonical identity
// headers. FE never touches the DB — writes always go through XHUB_API_URL.
import { forwardPost, readJson } from "../admin/_forward";

export async function POST(request: Request) {
  const body = await readJson(request);
  return forwardPost("/api/records", body);
}
