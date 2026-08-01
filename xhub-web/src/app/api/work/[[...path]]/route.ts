// FE proxy → xhub-api /api/work/items/* (NativeWorkItem module, X.Office Work v2
// W1). Catch-all: GET/POST/PATCH under /api/work is forwarded to the API base
// with the canonical identity headers. FE never touches the DB. Mirrors
// src/app/api/directives.
import { forwardGet, forwardPost, forwardPatch, forwardDelete, readJson } from "../../admin/_forward";

function target(path: string[] | undefined, search: string): string {
  const suffix = path && path.length ? `/${path.join("/")}` : "/items";
  // path already includes "items/..." because nav/data-lib call /api/work/items/*.
  const base = suffix.startsWith("/items") ? `/api/work${suffix}` : `/api/work${suffix}`;
  return `${base}${search}`;
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

export async function DELETE(request: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path } = await ctx.params;
  const search = new URL(request.url).search;
  return forwardDelete(target(path, search));
}
