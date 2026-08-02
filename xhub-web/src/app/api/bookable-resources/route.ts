// FE proxy → xhub-api /api/bookable-resources (Booking module, PH-02d). Same
// catch-all pattern as src/app/api/bookings — the resource catalog is a
// sibling top-level route on the backend, not nested under /api/bookings/*,
// so it needs its own proxy file rather than reusing that one.
import { forwardGet, forwardPost, readJson } from "../admin/_forward";

export async function GET(request: Request) {
  const search = new URL(request.url).search;
  return forwardGet(`/api/bookable-resources${search}`);
}

export async function POST(request: Request) {
  const body = await readJson(request);
  return forwardPost(`/api/bookable-resources`, body);
}
