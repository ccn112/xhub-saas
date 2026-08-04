// FE proxy → xhub-api /api/ioc/* (XHub Enterprise IOC Digital Twin, DT-01..DT-03).
// Catch-all: GET/POST/PATCH/DELETE under /api/ioc is forwarded to the API base
// with the canonical identity headers. The FE NEVER touches the DB and never
// composes SQL or a Prisma filter — it only posts catalog references, which the
// backend re-validates (Constitution #6). Mirrors src/app/api/manage.
import { forwardGet, forwardPost, forwardPatch, forwardDelete, readJson } from "../../_xoffice-forward";

function target(path: string[] | undefined, search: string): string {
  const suffix = path && path.length ? `/${path.join("/")}` : "/scenes";
  return `/api/ioc${suffix}${search}`;
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
  return forwardDelete(target(path, ""));
}
