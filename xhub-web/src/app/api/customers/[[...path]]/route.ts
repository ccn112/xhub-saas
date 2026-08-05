// FE proxy → xhub-api /api/customers/* (Customer/Contact module, Phase 2
// BO-0201). Catch-all: any GET/POST/PATCH under /api/customers is forwarded
// to the X.Office API base with the canonical identity headers. Mirrors
// announcements' proxy route.
import { forwardGet, forwardPatch, forwardPost, readJson } from "../../_xoffice-forward";

function target(path: string[] | undefined, search: string): string {
  const suffix = path && path.length ? `/${path.join("/")}` : "";
  return `/api/customers${suffix}${search}`;
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

export async function PATCH(request: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  const body = await readJson(request);
  return forwardPatch(target(path, ""), body);
}
