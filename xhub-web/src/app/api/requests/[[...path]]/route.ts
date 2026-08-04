// FE proxy → xhub-api /api/requests/* (Request module, PH-02a). Catch-all: any
// GET/POST under /api/requests is forwarded to the API base with the canonical
// identity headers. FE never touches the DB. Uses src/app/api/_xoffice-forward.
import { forwardGet, forwardPost, readJson } from "../../_xoffice-forward";

function target(path: string[] | undefined, search: string): string {
  const suffix = path && path.length ? `/${path.join("/")}` : "";
  return `/api/requests${suffix}${search}`;
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
