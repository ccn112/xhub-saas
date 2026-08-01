// FE proxy → xhub-api /api/platform/* (Platform Console — tenant registry).
// Catch-all: any GET/POST/PATCH under /api/platform is forwarded to the API base
// with the canonical identity headers. FE never touches the DB. The platform
// plane reads/writes the SHARED Tenant table (cross-tenant metadata) server-side.
import { forwardGet, forwardPost, forwardPatch, forwardPut, readJson } from "../../admin/_forward";

function target(path: string[] | undefined, search: string): string {
  const suffix = path && path.length ? `/${path.join("/")}` : "";
  return `/api/platform${suffix}${search}`;
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

export async function PUT(request: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  const body = await readJson(request);
  return forwardPut(target(path, ""), body);
}
