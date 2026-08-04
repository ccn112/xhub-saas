// Shared BFF forwarder for X.Office business routes (workflow engine/requests/
// directives/tickets/bookings/announcements/records/work/manage/ioc/people/
// delivery). Mirrors src/app/api/admin/_forward.ts exactly, except it targets
// XOFFICE_BASE_SERVER (xhub-api's X.Office process, :4001) instead of
// PLATFORM_BASE_SERVER — those 12 domains no longer live on the Platform
// process since Phase 1.5 Stage B/C split xhub-api in two. FE never touches
// the DB — writes always go through the API base.
import { XOFFICE_BASE_SERVER as API } from "@/lib/api-base";
const HEADERS = { "content-type": "application/json", "x-tenant-id": "tenant-xtech", "x-user-id": "user-nam" } as const;

/** Forward a GET to the BFF. Returns the upstream JSON + status, or 502 on failure. */
export async function forwardGet(path: string): Promise<Response> {
  try {
    const res = await fetch(`${API}${path}`, { method: "GET", headers: HEADERS, cache: "no-store" });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) return Response.json({ error: "backend rejected", detail: data }, { status: res.status });
    return Response.json(data ?? { ok: true });
  } catch {
    return Response.json({ error: "backend unavailable" }, { status: 502 });
  }
}

/** Forward a POST to the BFF. Returns the upstream JSON + status, or 502 on failure. */
export async function forwardPost(path: string, body: unknown): Promise<Response> {
  try {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: HEADERS,
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) return Response.json({ error: "backend rejected", detail: data }, { status: res.status });
    return Response.json(data ?? { ok: true });
  } catch {
    return Response.json({ error: "backend unavailable" }, { status: 502 });
  }
}

/** Forward a PATCH to the BFF. Returns the upstream JSON + status, or 502 on failure. */
export async function forwardPatch(path: string, body: unknown): Promise<Response> {
  try {
    const res = await fetch(`${API}${path}`, {
      method: "PATCH",
      headers: HEADERS,
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) return Response.json({ error: "backend rejected", detail: data }, { status: res.status });
    return Response.json(data ?? { ok: true });
  } catch {
    return Response.json({ error: "backend unavailable" }, { status: 502 });
  }
}

/** Forward a PUT to the BFF. Returns the upstream JSON + status, or 502 on failure. */
export async function forwardPut(path: string, body: unknown): Promise<Response> {
  try {
    const res = await fetch(`${API}${path}`, {
      method: "PUT",
      headers: HEADERS,
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) return Response.json({ error: "backend rejected", detail: data }, { status: res.status });
    return Response.json(data ?? { ok: true });
  } catch {
    return Response.json({ error: "backend unavailable" }, { status: 502 });
  }
}

/** Forward a DELETE to the BFF. Returns the upstream JSON + status, or 502 on failure. */
export async function forwardDelete(path: string): Promise<Response> {
  try {
    const res = await fetch(`${API}${path}`, { method: "DELETE", headers: HEADERS, cache: "no-store" });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) return Response.json({ error: "backend rejected", detail: data }, { status: res.status });
    return Response.json(data ?? { ok: true });
  } catch {
    return Response.json({ error: "backend unavailable" }, { status: 502 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try { return (await request.json()) as Record<string, unknown>; } catch { return {}; }
}
