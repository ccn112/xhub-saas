// FE proxy → xhub-api /api/engineering/* (Engineering Governance — Product
// Registry + Version core, DG-01). Catch-all: any GET/POST/PATCH under
// /api/engineering is forwarded to the PLATFORM API base (engineering-
// governance is a Platform module — see
// docs/implementation/engineering-hub/ADR_MODULE_OWNERSHIP.md) with the
// canonical identity headers. FE never touches the DB.
import { forwardGet, forwardPost, forwardPatch, readJson } from "../../admin/_forward";

function target(path: string[] | undefined, search: string): string {
  const suffix = path && path.length ? `/${path.join("/")}` : "";
  return `/api/engineering${suffix}${search}`;
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
