// XHub Enterprise IOC — Digital Twin (DT-01..DT-03). Server-side data access
// (:4000, tenant-scoped). Reuses the XOffice tenant context. On backend down we
// degrade to empty with source='offline' (no fake data). Every read goes through
// the API — the FE never queries the DB and never sends SQL or a Prisma filter;
// it posts only catalog references, which the backend re-validates.
import { xofficeContext, type XOfficeContext } from "./workflow-data";

const API_BASE = process.env.XOFFICE_API_BASE ?? "http://localhost:4000";

// ---- contracts (mirror contracts/*.schema.json) -----------------------------

export interface Point { x: number; y: number }

export interface Zone {
  id: string;
  name: string;
  kind: string;
  orgUnitId?: string | null;
  polygon: Point[];
}

export interface Wall {
  id: string;
  points: Point[];
  thickness?: number;
  height?: number;
}

export interface Geometry { walls: Wall[]; zones: Zone[] }

export interface TwinFloor {
  id: string;
  code: string;
  name: string;
  buildingLabel?: string | null;
  level: number;
}

export interface TwinSite {
  id: string;
  code: string;
  name: string;
  address?: string | null;
  floors: TwinFloor[];
}

export interface VersionRow {
  id: string;
  versionNo: number;
  checksum: string;
  status: string;
  publishedAt: string;
  publishedBy: string;
  note?: string | null;
}

export interface FloorPlan {
  id: string;
  floorId: string;
  name: string;
  unit: string;
  metersPerUnit: number;
  originX: number;
  originY: number;
  geometry: Geometry;
  status: string;
  activeVersionNo?: number | null;
  revision: number;
  versions?: VersionRow[];
}

export interface SceneBinding {
  id: string;
  zoneId: string;
  bindingType: string;
  bindingId: string;
  iconKey?: string | null;
  materialKey: string;
  dataLayerIds: string[];
  orgUnit?: { id: string; code: string; name: string } | null;
}

export interface TwinScene {
  id: string;
  name: string;
  floorId: string;
  planId: string;
  themeKey: string;
  wallHeightMeters: number;
  status: string;
  activeVersionNo?: number | null;
  revision: number;
  bindings: SceneBinding[];
  plan?: FloorPlan | null;
  geometry?: Geometry;
  versions?: VersionRow[];
}

export interface RuntimeZone extends Zone {
  areaSqM: number;
  binding: { bindingType: string; bindingId: string; iconKey?: string | null; materialKey: string; dataLayerIds: string[] } | null;
  orgUnit: { id: string; code: string; name: string } | null;
}

export interface RuntimeScene {
  sceneId: string;
  name: string;
  themeKey: string;
  wallHeightMeters: number;
  versionNo: number;
  checksum: string;
  publishedAt: string;
  calibration: { metersPerUnit: number; originX: number; originY: number };
  zones: RuntimeZone[];
  walls: Wall[];
}

export type ZoneState = "GOOD" | "NORMAL" | "BUSY" | "OVERLOADED" | "RISK" | "NO_DATA";

export interface LayerRow {
  key: string;
  label?: string;
  value: number;
  count: number;
  state: ZoneState;
}

export interface LayerResult {
  dataLayerId: string;
  code: string;
  name: string;
  entityKey: string;
  ownedBy: string;
  groupBy: string;
  aggregation: { op: string; field: string | null };
  visualMode: string;
  scope: string;
  rows: LayerRow[];
  total: number;
  computedAt: string;
  error?: string;
}

export interface DataLayerDefinition {
  id: string;
  code: string;
  name: string;
  sourceKey: string;
  entityKey: string;
  query: { filters: Array<{ field: string; operator: string; value: unknown }>; timeWindow: string; groupBy: string[] };
  aggregation: { op: string; field: string | null };
  refreshPolicy: string;
  visualMapping: { mode: string; thresholds: Array<{ min: number; max: number | null; state: ZoneState }> };
  sensitivity: string;
  status: string;
}

export interface CatalogField {
  key: string;
  label: string;
  type: string;
  operators: string[];
  values?: string[];
  derived: boolean;
  measure: boolean;
}

export interface CatalogEntity {
  entityKey: string;
  sourceKey: string;
  label: string;
  ownedBy: string;
  personal: boolean;
  aggregations: string[];
  groupBy: string[];
  fields: CatalogField[];
}

export interface Catalog {
  entities: CatalogEntity[];
  timeWindows: string[];
  visualModes: string[];
  zoneStates: string[];
  refreshPolicies: string[];
  note: string;
}

export interface Widget {
  id: string;
  type: string;
  title?: string | null;
  dataLayerId?: string | null;
  layout: { x: number; y: number; w: number; h: number };
}

export interface DashboardDefinition {
  id: string;
  code: string;
  name: string;
  viewType: string;
  sceneId?: string | null;
  globalFilters: string[];
  widgets: Widget[];
  status: string;
  activeVersionNo?: number | null;
  versions?: VersionRow[];
}

export interface DashboardRuntime {
  dashboard: { id: string; code: string; name: string; viewType: string; versionNo: number; checksum: string; publishedAt: string; globalFilters: string[] };
  widgets: Widget[];
  scene: RuntimeScene | null;
  dataLayers: Record<string, LayerResult>;
  resolvedAt: string;
}

export interface IconAsset { id: string; key: string; label: string; type: string; status: string }

// ---- transport --------------------------------------------------------------

interface Listed<T> { items: T[]; count: number }

async function get<T>(path: string, ctx: XOfficeContext): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "x-tenant-id": ctx.tenantId, "x-user-id": ctx.userId, "content-type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export type Source = "api" | "offline";

// ---- reads ------------------------------------------------------------------

export async function listSites() {
  const ctx = xofficeContext();
  const data = await get<Listed<TwinSite>>("/api/ioc/sites", ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as Source };
}

export async function listPlans() {
  const ctx = xofficeContext();
  const data = await get<Listed<FloorPlan>>("/api/ioc/floor-plans", ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as Source };
}

export async function getPlan(id: string) {
  const ctx = xofficeContext();
  return get<FloorPlan>(`/api/ioc/floor-plans/${id}`, ctx);
}

export async function listScenes() {
  const ctx = xofficeContext();
  const data = await get<Listed<TwinScene>>("/api/ioc/scenes", ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as Source };
}

export async function getScene(id: string) {
  const ctx = xofficeContext();
  return get<TwinScene>(`/api/ioc/scenes/${id}`, ctx);
}

export async function getRuntimeScene(id: string) {
  const ctx = xofficeContext();
  return get<RuntimeScene>(`/api/ioc/scenes/${id}/runtime`, ctx);
}

export async function listDataLayers() {
  const ctx = xofficeContext();
  const data = await get<Listed<DataLayerDefinition>>("/api/ioc/data-layers", ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as Source };
}

export async function getCatalog() {
  const ctx = xofficeContext();
  return get<Catalog>("/api/ioc/data-layers/catalog", ctx);
}

export async function executeLayer(id: string) {
  const ctx = xofficeContext();
  return get<LayerResult>(`/api/ioc/data-layers/${id}/execute`, ctx);
}

export async function listDashboards() {
  const ctx = xofficeContext();
  const data = await get<Listed<DashboardDefinition>>("/api/ioc/dashboards", ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as Source };
}

export async function getDashboard(id: string) {
  const ctx = xofficeContext();
  return get<DashboardDefinition>(`/api/ioc/dashboards/${id}`, ctx);
}

export async function getDashboardRuntime(codeOrId: string) {
  const ctx = xofficeContext();
  return get<DashboardRuntime>(`/api/ioc/runtime/dashboards/${codeOrId}`, ctx);
}

interface OrgNode { id: string; code: string; name: string; children?: OrgNode[] }

/** Flatten the Identity org-unit TREE into the picker list the studio binds to. */
export async function listOrgUnits(): Promise<Array<{ id: string; code: string; name: string }>> {
  const ctx = xofficeContext();
  const tree = await get<OrgNode[]>("/api/identity/org-units", ctx);
  const out: Array<{ id: string; code: string; name: string }> = [];
  const walk = (nodes: OrgNode[] | undefined) => {
    for (const n of nodes ?? []) {
      out.push({ id: n.id, code: n.code, name: n.name });
      walk(n.children);
    }
  };
  walk(Array.isArray(tree) ? tree : []);
  return out.sort((a, b) => a.code.localeCompare(b.code));
}

export async function listIcons() {
  const ctx = xofficeContext();
  const data = await get<Listed<IconAsset>>("/api/ioc/icons", ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as Source };
}

// ---- presentation tokens ----------------------------------------------------
// The ONLY place a semantic icon key or zone state becomes a visual. Keys come
// from the seeded IconAsset catalog — never a hardcoded department name
// (Constitution #10).

export const ICON_GLYPHS: Record<string, string> = {
  "department-executive": "🏛️",
  "department-sales": "💼",
  "department-finance": "💰",
  "department-hr": "👥",
  "department-it": "🖥️",
  "department-operations": "⚙️",
  "department-pmo": "📐",
  "department-support": "🎧",
  "object-task": "✅",
  "object-approval": "🗳️",
  "object-ticket": "🎫",
  "object-project": "📁",
  "object-kpi": "📈",
  "object-risk": "⚠️",
};

export const STATE_FILL: Record<ZoneState, string> = {
  GOOD: "#16a34a",
  NORMAL: "#2563eb",
  BUSY: "#f59e0b",
  OVERLOADED: "#dc2626",
  RISK: "#9333ea",
  NO_DATA: "#94a3b8",
};

export const STATE_LABEL: Record<ZoneState, string> = {
  GOOD: "Tốt",
  NORMAL: "Bình thường",
  BUSY: "Bận",
  OVERLOADED: "Quá tải",
  RISK: "Rủi ro",
  NO_DATA: "Chưa có dữ liệu",
};

export const STATE_TONE: Record<ZoneState, "success" | "info" | "warning" | "error" | "primary" | "neutral"> = {
  GOOD: "success",
  NORMAL: "info",
  BUSY: "warning",
  OVERLOADED: "error",
  RISK: "primary",
  NO_DATA: "neutral",
};

/**
 * Fold a set of executed layers into a per-zone view model. The zone→value join
 * is by the BOUND entity id (orgUnitId), so nothing about the mapping is
 * hardcoded in a component.
 */
export function zoneMetrics(scene: RuntimeScene | null, layers: Record<string, LayerResult>) {
  if (!scene) return [];
  return scene.zones.map((z) => {
    const bindingId = z.binding?.bindingId ?? z.orgUnitId ?? null;
    const ids = z.binding?.dataLayerIds ?? [];
    const metrics = ids
      .map((id) => layers[id])
      .filter((l): l is LayerResult => !!l && !l.error)
      .map((l) => {
        const row = bindingId ? l.rows.find((r) => r.key === bindingId) : undefined;
        return { layerId: l.dataLayerId, code: l.code, name: l.name, visualMode: l.visualMode, value: row?.value ?? 0, state: (row?.state ?? "NO_DATA") as ZoneState, hasData: !!row };
      });
    const colorMetric = metrics.find((m) => m.visualMode === "ZONE_COLOR");
    return {
      zone: z,
      label: z.orgUnit?.name ?? z.name,
      metrics,
      state: (colorMetric?.state ?? "NO_DATA") as ZoneState,
      primaryValue: colorMetric?.value ?? 0,
    };
  });
}

export type ZoneMetric = ReturnType<typeof zoneMetrics>[number];
