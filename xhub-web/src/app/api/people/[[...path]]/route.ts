// FE proxy → xhub-api /api/people/* (People Essentials, PE-01 Leave &
// Availability). Catch-all: GET/POST/PATCH under /api/people is forwarded to
// the API base with the canonical identity headers. FE never touches the DB.
// Mirrors src/app/api/manage.
import { forwardGet, forwardPost, forwardPatch, readJson } from "../../admin/_forward";

function target(path: string[] | undefined, search: string): string {
  const suffix = path && path.length ? `/${path.join("/")}` : "/leave-requests";
  return `/api/people${suffix}${search}`;
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
