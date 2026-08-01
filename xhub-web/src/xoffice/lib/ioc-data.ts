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

// ---- command-centre insights (DT-05) ---------------------------------------
// Everything below is a PROJECTION computed server-side from Work v2 /
// Identity / ManageOS. The FE never derives a KPI of its own from these rows —
// it only renders them, together with the honesty flags the API ships
// (`omitted`, `heatmap.available`, `forecast.available`, `flowMeta.sources`).

export interface InsightZone {
  zoneId: string;
  name: string;
  label: string;
  orgUnitId: string | null;
  state: ZoneState;
  workload: number;
  areaSqM: number;
  /** Position rows in this zone's org unit (định biên) */
  seats: number;
  /** …of which have a holder — what the desk/person markers are scaled to */
  filled: number;
}

/** One REAL inter-department handoff bundle: owner in `from`, assignee in `to`. */
export interface FlowEdge {
  fromZoneId: string;
  toZoneId: string;
  fromLabel: string;
  toLabel: string;
  items: number;
  samples: string[];
}

export interface InsightAlert {
  severity: "CRITICAL" | "WARNING" | "INFO";
  title: string;
  detail: string;
  zone?: string;
  at: string;
  source: string;
}

export interface IocInsights {
  dashboardCode: string;
  resolvedAt: string;
  zones: InsightZone[];
  flows: FlowEdge[];
  flowMeta: {
    windowDays: number;
    definition: string;
    handoffsInWindow: number;
    unmappedHandoffs: number;
    sources: Array<{ key: string; label: string; available: boolean; reason?: string }>;
  };
  pipeline: Array<{ key: string; label: string; count: number }>;
  pipelineNote: string;
  alerts: InsightAlert[];
  kpi: {
    headcount: { filled: number; seats: number; note: string };
    workload: { total: number; zones: number; note: string };
    onTime: { rate: number; totalWithDue: number; overdueCount: number; onTimeCount: number; note: string };
    overdue: { count: number };
    health: { score: number; formula: string; inputs: { onTimeRate: number; loadBalance: number; penalty: number; zonesWithData: number } };
  };
  forecast:
    | { available: false; reason: string }
    | { available: true; metric: { code: string; name: string; unit: string }; points: Array<{ at: string; value: number }>; delta: number; method: string };
  heatmap: { available: boolean; reason: string };
  arrivalPattern:
    | { available: false; reason: string }
    | { available: true; windowDays: number; hours: Array<{ hour: number; clockIns: number; clockOuts: number }>; note: string };
  omitted: Array<{ key: string; reason: string }>;
  brief: {
    source: "live" | "mock";
    mustRequireHumanApply: boolean;
    bottleneck: string;
    recommendations: string[];
    raw: string;
    inputs: string;
    note: string;
  };
}

// ---- template gallery (DT-04) ----------------------------------------------
// `IocTemplate` is a SHARED platform catalog row (no tenantId, no RLS — same
// posture as Blueprint). Cloning MATERIALISES it as the calling tenant's own
// DRAFT rows; the gallery never exposes another tenant's live twin.

export interface TemplateZoneSpec {
  id: string;
  name: string;
  kind: string;
  icon?: string | null;
  orgHint?: { codes?: string[]; keywords?: string[]; type?: string } | null;
  polygon: Point[];
}

export interface IocTemplate {
  id: string;
  code: string;
  name: string;
  industry?: string | null;
  twinType: string;
  description?: string | null;
  version: number;
  status: string;
  floorPlanSpec: { name?: string; metersPerUnit?: number; walls?: Wall[]; zones?: TemplateZoneSpec[] };
  sceneSpec: { name?: string; themeKey?: string; wallHeightMeters?: number };
  dataLayerSpecs: Array<{ code: string; name: string; entityKey: string; zoneLevel?: boolean; metricCode?: string }>;
  dashboardSpec: { code?: string; name?: string; viewType?: string; widgets?: Widget[] };
  iconSetCodes: string[];
  checksum: string;
  publishedAt?: string | null;
  zoneCount: number;
  dataLayerCount: number;
  widgetCount: number;
}

export interface CloneResult {
  template: { id: string; code: string; name: string; version: number; twinType: string };
  siteId: string;
  floorId: string;
  planId: string;
  sceneId: string;
  dashboardId: string;
  dashboardCode: string;
  status: string;
  zoneCount: number;
  boundZones: Array<{ zoneId: string; zoneName: string; orgUnitId: string; orgCode: string; matchedBy: string }>;
  unmappedZones: Array<{ zoneId: string; zoneName: string; reason: string }>;
  dataLayers: Array<{ id: string; code: string; zoneLevel: boolean }>;
  skippedDataLayers: Array<{ code: string; reason: string }>;
  editorPath: string;
  note: string;
}

export const TWIN_TYPE_LABEL: Record<string, string> = {
  OFFICE: "Văn phòng",
  FACTORY: "Nhà xưởng",
  RETAIL: "Bán lẻ",
  HOSPITALITY: "Lưu trú & dịch vụ",
  WAREHOUSE: "Kho vận",
  CAMPUS: "Khuôn viên",
};

// ---- transport --------------------------------------------------------------

interface Listed<T> { items: T[]; count: number }

async function get<T>(path: string, ctx: XOfficeContext, timeoutMs = 4000): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "x-tenant-id": ctx.tenantId, "x-user-id": ctx.userId, "content-type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
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

/**
 * Command-centre insights for the same published dashboard: real cross-zone
 * flow volume, the derived health score, pipeline/alert feeds and the
 * draft-first AI brief. Returns null when the backend is down — every consumer
 * must degrade to the plain twin rather than invent numbers.
 */
export async function getDashboardInsights(codeOrId: string) {
  const ctx = xofficeContext();
  // Longer budget than the other reads on purpose: when XOFFICE_AI_LIVE is on,
  // this endpoint waits on a real model call for the brief. The API caps that
  // call itself and degrades to its deterministic fallback, so this timeout is
  // the outer guard, not the primary one.
  return get<IocInsights>(`/api/ioc/runtime/dashboards/${codeOrId}/insights`, ctx, 25000);
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

/** The SHARED template gallery — the primary entry point of Twin Studio. */
export async function listTemplates(filter: { industry?: string; twinType?: string } = {}) {
  const ctx = xofficeContext();
  const qs = new URLSearchParams();
  if (filter.industry) qs.set("industry", filter.industry);
  if (filter.twinType) qs.set("twinType", filter.twinType);
  const suffix = qs.toString() ? `?${qs}` : "";
  const data = await get<Listed<IocTemplate>>(`/api/ioc/templates${suffix}`, ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as Source };
}

export async function getTemplate(id: string) {
  const ctx = xofficeContext();
  return get<IocTemplate>(`/api/ioc/templates/${id}`, ctx);
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
  // Workplace (DT-04)
  "space-meeting-room": "🪑",
  "space-workstation": "🖱️",
  "space-reception": "🛎️",
  // Manufacturing
  "facility-factory": "🏭",
  "facility-machine": "🛠️",
  "facility-production-line": "🔩",
  "facility-qc-checkpoint": "🔍",
  "facility-maintenance": "🧰",
  // Warehouse / logistics
  "logistics-warehouse-rack": "🗄️",
  "logistics-forklift": "🚜",
  "logistics-loading-dock": "🚚",
  // Retail
  "retail-shelf": "🏪",
  "retail-pos-counter": "🧾",
  // Hospitality
  "hospitality-hotel-room": "🛏️",
  "hospitality-restaurant": "🍽️",
  "hospitality-housekeeping": "🧹",
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

// ---- occupancy geometry (shared by the 2D plan and the 3D scene) ------------
// The SAME deterministic desk layout feeds both renderers, so a zone that shows
// 4 desks in 2D shows 4 desks in 3D. The desk COUNT is the zone's real Position
// count (định biên) and the OCCUPIED desks are the real holders — nothing here
// invents a headcount, and nothing here is attendance/presence data (AT-012:
// that source is permanently banned).

export interface Bounds { minX: number; maxX: number; minY: number; maxY: number; cx: number; cy: number; w: number; d: number }

export function zoneBounds(polygon: Point[]): Bounds {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, w: maxX - minX, d: maxY - minY };
}

export interface Desk { x: number; y: number; w: number; d: number; occupied: boolean }

const DESK_W = 1.5;
const DESK_D = 0.8;
const DESK_GAP_X = 0.7;
const DESK_GAP_Y = 1.1;
/** Hard ceiling so a 500-seat unit cannot explode the poly budget. */
const MAX_DESKS = 40;

/**
 * Lay `seats` desks out in a deterministic grid inside the zone's bounding box,
 * leaving the LOWER band free for the zone's info card. `filled` of them are
 * marked occupied (drawn with a person marker).
 */
export function deskLayout(polygon: Point[], seats: number, filled: number): Desk[] {
  const b = zoneBounds(polygon);
  const n = Math.min(Math.max(0, Math.round(seats)), MAX_DESKS);
  if (!n) return [];
  const pad = 0.8;
  const usableW = Math.max(DESK_W, b.w - pad * 2);
  const usableD = Math.max(DESK_D, b.d - pad * 2 - 2.2); // 2.2 m reserved for the label card
  const cols = Math.max(1, Math.floor((usableW + DESK_GAP_X) / (DESK_W + DESK_GAP_X)));
  const rows = Math.max(1, Math.ceil(n / cols));
  const gridW = cols * DESK_W + (cols - 1) * DESK_GAP_X;
  const gridD = rows * DESK_D + (rows - 1) * DESK_GAP_Y;
  const scale = Math.min(1, usableD / Math.max(gridD, 0.001));
  const startX = b.cx - gridW / 2;
  const startY = b.minY + pad + 0.4;
  const out: Desk[] = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols);
    const cInRow = Math.min(cols, n - r * cols);
    const rowW = cInRow * DESK_W + (cInRow - 1) * DESK_GAP_X;
    const c = i % cols;
    out.push({
      x: (cInRow === cols ? startX : b.cx - rowW / 2) + c * (DESK_W + DESK_GAP_X),
      y: startY + r * (DESK_D + DESK_GAP_Y) * scale,
      w: DESK_W,
      d: DESK_D,
      occupied: i < filled,
    });
  }
  return out;
}

/**
 * Quadratic-bezier control point for a flow arc A→B, bowed perpendicular to the
 * segment so two opposite-direction edges never overlap.
 */
export function flowArc(a: { x: number; y: number }, b: { x: number; y: number }, bow = 0.18) {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { cx: mx + (-dy / len) * len * bow, cy: my + (dx / len) * len * bow };
}
