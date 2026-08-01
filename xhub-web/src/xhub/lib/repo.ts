// Shared join/lookup helpers over the tenant-scoped seed. Server-safe.
import { collection, byId, indexById } from "./seed";
import type { User, Channel } from "./types";

export function userName(id?: string | null, tenantId?: string): string {
  if (!id) return "—";
  if (id === "xai") return "X.AI";
  if (id === "system") return "Hệ thống";
  return byId<User>("users", id, tenantId)?.name ?? id;
}

export function user(id?: string | null, tenantId?: string): User | undefined {
  if (!id) return undefined;
  return byId<User>("users", id, tenantId);
}

export function usersIndex(tenantId?: string): Map<string, User> {
  return indexById<User>("users", tenantId);
}

export function orgName(id?: string | null, tenantId?: string): string {
  if (!id) return "—";
  const o = byId<{ name: string }>("organizations", id, tenantId);
  return o?.name ?? id;
}

export function channelBySlug(slug: string, tenantId?: string): Channel | undefined {
  return collection<Channel>("channels", tenantId).find((c) => c.slug === slug);
}

export function initials(name?: string): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return (parts[parts.length - 2]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "");
}
