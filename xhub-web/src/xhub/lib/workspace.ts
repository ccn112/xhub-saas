// Workspace context: canonical tenant + current actor (persona) for the demo.
// Every repository read is scoped by tenantId from here.
import { CANONICAL_TENANT_ID, byId, collection } from "./seed";
import type { Tenant, User } from "./types";

/** Default actor per demo. XH-01 (executive) is the landing screen. */
export const DEFAULT_ACTOR_ID = "user-nam";

export interface WorkspaceContext {
  tenantId: string;
  tenant: Tenant;
  actor: User;
}

export function getWorkspaceContext(actorId: string = DEFAULT_ACTOR_ID): WorkspaceContext {
  const tenantId = CANONICAL_TENANT_ID;
  const tenant = collection<Tenant>("tenants", tenantId).find((t) => t.id === tenantId)
    ?? collection<Tenant>("tenants", tenantId)[0];
  const actor = byId<User>("users", actorId, tenantId) ?? collection<User>("users", tenantId)[0];
  return { tenantId, tenant: tenant as Tenant, actor: actor as User };
}
