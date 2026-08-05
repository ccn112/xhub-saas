// FE proxy → xhub-api /api/opportunities/* (Phase 2, BO-0202).
import { forwardGet, forwardPatch, forwardPost, readJson } from "../../_xoffice-forward";

function target(path: string[] | undefined, search: string): string {
  const suffix = path && path.length ? `/${path.join("/")}` : "";
  return `/api/opportunities${suffix}${search}`;
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
