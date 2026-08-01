// Connector catalog access (data-driven mapping editor).
// Client-usable: tries the backend, falls back to the committed seed so the
// mapping editor always has targetFields to render. Never hardcodes fields.
import seedCatalog from "@/data/xoffice/connector-catalog.json";
import seedRoles from "@/data/xoffice/role-bindings.json";

const API_BASE = process.env.NEXT_PUBLIC_XHUB_API_URL ?? "http://localhost:4000";

export interface ConnectorTargetField {
  key: string;
  label: string;
  type: string;
  required?: boolean;
}

export interface ConnectorAction {
  code: string;
  name: string;
  eventOnComplete?: string;
  targetFields: ConnectorTargetField[];
}

export interface Connector {
  code: string;
  name: string;
  ownerSystem?: string;
  boundary?: string;
  actions: ConnectorAction[];
}

interface CatalogShape {
  connectors: Connector[];
}

export const SEED_CONNECTORS: Connector[] = (seedCatalog as CatalogShape).connectors;

/** Fetch connectors from the backend; fall back to the seed catalog. */
export async function fetchConnectors(): Promise<{
  connectors: Connector[];
  source: "api" | "seed";
}> {
  try {
    const res = await fetch(`${API_BASE}/api/xoffice/connectors`, {
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const data = (await res.json()) as CatalogShape | Connector[];
      const list = Array.isArray(data) ? data : data.connectors;
      if (Array.isArray(list) && list.length > 0) {
        return { connectors: list, source: "api" };
      }
    }
  } catch {
    /* fall through to seed */
  }
  return { connectors: SEED_CONNECTORS, source: "seed" };
}

export interface RoleBinding {
  tenantSlug: string;
  code: string;
  name: string;
  userEmail?: string;
}

/** Roles available for approval assignment (seed role-bindings, xtech tenant). */
export const SEED_ROLES: RoleBinding[] = (seedRoles as RoleBinding[]).filter(
  (r) => r.tenantSlug === "xtech",
);
