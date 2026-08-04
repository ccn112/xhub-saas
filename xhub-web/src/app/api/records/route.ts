// FE proxy → xhub-api POST /api/records (create document + first version).
// Uses src/app/api/_xoffice-forward.ts: forward with the canonical identity
// headers. FE never touches the DB — writes always go through XHUB_API_URL.
import { forwardPost, readJson } from "../_xoffice-forward";

export async function POST(request: Request) {
  const body = await readJson(request);
  return forwardPost("/api/records", body);
}
