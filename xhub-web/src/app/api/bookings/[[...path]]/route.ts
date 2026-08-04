// FE proxy → xhub-api /api/bookings/* (Booking / resource booking module, PH-02d).
// Catch-all: any GET/POST under /api/bookings is forwarded to the API base with
// the canonical identity headers. FE never touches the DB. Mirrors src/app/api/tickets.
import { forwardGet, forwardPost, readJson } from "../../_xoffice-forward";

function target(path: string[] | undefined, search: string): string {
  const suffix = path && path.length ? `/${path.join("/")}` : "";
  return `/api/bookings${suffix}${search}`;
}

export async function GET(request: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  const search = new URL(request.url).search;
  return forwardGet(target(path, search));
}

export async function POST(request: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  const body = await readJson(request);
  return forwardPost(target(path, ""), body);
}
