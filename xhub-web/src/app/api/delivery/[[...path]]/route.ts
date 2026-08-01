// FE proxy → xhub-api /api/delivery/* (Solution Delivery Workspace, SaaS step 5).
// Catch-all: any GET/POST under /api/delivery is forwarded to the API base with
// the canonical T001 identity headers. FE never touches the DB. Mirrors the
// tickets / platform proxies.
import { forwardGet, forwardPost, readJson } from "../../admin/_forward";

function target(path: string[] | undefined, search: string): string {
  const suffix = path && path.length ? `/${path.join("/")}` : "";
  return `/api/delivery${suffix}${search}`;
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
