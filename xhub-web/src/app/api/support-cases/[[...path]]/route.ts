// FE proxy → xhub-api /api/support-cases/* (Product Customer Support module,
// 2026-08-06). Catch-all: any GET/POST under /api/support-cases is forwarded
// to the X.Office API base with the canonical identity headers. Mirrors
// customers' proxy route.
import { forwardGet, forwardPost, readJson } from "../../_xoffice-forward";

function target(path: string[] | undefined, search: string): string {
  const suffix = path && path.length ? `/${path.join("/")}` : "";
  return `/api/support-cases${suffix}${search}`;
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
