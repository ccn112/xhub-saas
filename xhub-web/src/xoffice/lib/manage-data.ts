// X.Office Management Operating System — MG-01 reference slice. Server-side data
// access (:4000, tenant-scoped). Reuses the XOffice tenant context. On backend
// down we degrade to empty with source='offline' (no fake data). Every read goes
// through the API; metric observation VALUES are computed by the API from the
// existing Work data (read model, #12) — the FE never fabricates numbers.
import { xofficeContext, type XOfficeContext } from "./workflow-data";

const API_BASE = process.env.XOFFICE_API_BASE ?? "http://localhost:4000";

export interface StrategicObjective {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  perspective?: string | null;
  ownerId: string;
  status: string;
  reviewCadence?: string | null;
  linkedMetricIds: string[];
  linkedMetrics?: MetricDefinition[];
}

export interface MetricDefinition {
  id: string;
  code: string;
  name: string;
  formula: string;
  unit: string;
  direction: string;
  sourceSystem: string;
  frequency: string;
  target?: number | null;
  thresholdAmber?: number | null;
  thresholdRed?: number | null;
}

export interface MetricObservation {
  id: string;
  metricId: string;
  periodStart: string;
  periodEnd: string;
  value: number;
  source: string;
  confidence?: number | null;
  computedAt: string;
}

export interface BusinessReview {
  id: string;
  title?: string | null;
  type: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  ownerId: string;
  metricObservationIds: string[];
  decisionIds: string[];
  actionIds: string[];
}

export interface ReviewPreReadItem extends MetricObservation {
  metricCode?: string;
  metricName?: string;
  unit?: string;
  rag: "GREEN" | "AMBER" | "RED" | "UNKNOWN";
}

export interface DecisionRecord {
  id: string;
  reviewId?: string | null;
  question: string;
  decision: string;
  deciderId: string;
  recommenderId?: string | null;
  rationale?: string | null;
  decidedAt: string;
  status: string;
  rapid?: Record<string, unknown>;
  evidenceRefs: string[];
  ageDays?: number;
  actions?: ActionCommitment[];
}

export interface ActionCommitment {
  id: string;
  title: string;
  ownerId: string;
  dueAt?: string | null;
  status: string;
  decisionId?: string | null;
  reviewId?: string | null;
  nativeWorkItemId?: string | null;
  workItem?: { id: string; title: string; type: string; status: string; progressPercent: number; dueAt?: string | null } | null;
}

// ---- MG-03 (KPI / OKR / Scorecard) ----------------------------------------

export interface ScorecardPerspective {
  code: string;
  name: string;
  objectiveIds: string[];
}

export interface Scorecard {
  id: string;
  name: string;
  period: string;
  perspectives: ScorecardPerspective[];
}

export type Rag = "GREEN" | "YELLOW" | "RED" | "STALE" | "UNKNOWN";

export interface ScorecardKpiNode {
  metricId: string;
  metricCode?: string;
  rag: Rag;
  value: number | null;
}

export interface ScorecardObjectiveView extends StrategicObjective {
  kpis: ScorecardKpiNode[];
}

export interface ScorecardPerspectiveView {
  code: string;
  name: string;
  objectives: ScorecardObjectiveView[];
  rollup: Rag;
  redItems: Array<{ objectiveId: string; metricId: string; metricCode?: string; rag: Rag; value: number | null }>;
}

export interface ScorecardDetail extends Scorecard {
  perspectiveViews: ScorecardPerspectiveView[];
}

export interface OKRCycle {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

export interface KeyResultCheckIn {
  id: string;
  keyResultId: string;
  checkedAt: string;
  value: number;
  confidence?: number | null;
  note?: string | null;
  authorId?: string | null;
  evidenceUrl?: string | null;
}

export interface KeyResult {
  id: string;
  okrObjectiveId: string;
  description: string;
  baseline: number;
  target: number;
  current: number;
  unit: string;
  evidenceUrl?: string | null;
  linkedActionIds: string[];
  checkIns?: KeyResultCheckIn[];
}

export interface OKRObjective {
  id: string;
  cycleId: string;
  objective: string;
  ownerId: string;
  status: string;
  confidence?: number | null;
  strategicObjectiveIds: string[];
  keyResults: KeyResult[];
}

export interface KpiTreeNode {
  metricCode: string;
  metricId: string;
  name: string;
  unit: string;
  direction: string;
  objectiveId: string;
  objectiveCode: string;
  baseline?: number | null;
  target?: number | null;
  value: number | null;
  observedAt: string | null;
  status: Rag;
}

export interface KpiTreeGroup {
  perspective: string;
  kpis: KpiTreeNode[];
  redCount: number;
  staleCount: number;
  count: number;
}

async function get<T>(path: string, ctx: XOfficeContext): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { "x-tenant-id": ctx.tenantId, "x-user-id": ctx.userId, "content-type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type Listed<T> = { items: T[]; count: number };

export async function listObjectives() {
  const ctx = xofficeContext();
  const data = await get<Listed<StrategicObjective>>(`/api/manage/objectives`, ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as "api" | "offline" };
}

export async function getObjective(id: string) {
  const ctx = xofficeContext();
  return get<StrategicObjective>(`/api/manage/objectives/${id}`, ctx);
}

export async function listMetrics() {
  const ctx = xofficeContext();
  const data = await get<Listed<MetricDefinition>>(`/api/manage/metrics`, ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as "api" | "offline" };
}

export async function getMetricObservations(id: string) {
  const ctx = xofficeContext();
  return get<{ metric: MetricDefinition; observations: MetricObservation[]; latest: MetricObservation | null }>(
    `/api/manage/metrics/${id}/observations`,
    ctx,
  );
}

export async function listReviews() {
  const ctx = xofficeContext();
  const data = await get<Listed<BusinessReview>>(`/api/manage/reviews`, ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as "api" | "offline" };
}

export async function getReview(id: string) {
  const ctx = xofficeContext();
  return get<BusinessReview & { preRead: ReviewPreReadItem[]; exceptions: ReviewPreReadItem[]; decisions: DecisionRecord[]; actions: ActionCommitment[] }>(
    `/api/manage/reviews/${id}`,
    ctx,
  );
}

export async function listDecisions() {
  const ctx = xofficeContext();
  const data = await get<Listed<DecisionRecord>>(`/api/manage/decisions`, ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as "api" | "offline" };
}

export async function listActions() {
  const ctx = xofficeContext();
  const data = await get<Listed<ActionCommitment>>(`/api/manage/actions`, ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as "api" | "offline" };
}

// ---- MG-03 (KPI / OKR / Scorecard) ----------------------------------------

export async function listScorecards() {
  const ctx = xofficeContext();
  const data = await get<Listed<Scorecard>>(`/api/manage/scorecards`, ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as "api" | "offline" };
}

export async function getScorecard(id: string) {
  const ctx = xofficeContext();
  return get<ScorecardDetail>(`/api/manage/scorecards/${id}`, ctx);
}

export async function listOkrCycles() {
  const ctx = xofficeContext();
  const data = await get<Listed<OKRCycle>>(`/api/manage/okr-cycles`, ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as "api" | "offline" };
}

export async function listOkrs(cycleId?: string) {
  const ctx = xofficeContext();
  const data = await get<Listed<OKRObjective>>(`/api/manage/okrs${cycleId ? `?cycleId=${cycleId}` : ""}`, ctx);
  return { items: data?.items ?? [], source: (data ? "api" : "offline") as "api" | "offline" };
}

export async function getOkr(id: string) {
  const ctx = xofficeContext();
  return get<OKRObjective>(`/api/manage/okrs/${id}`, ctx);
}

export async function getKpiTree(objectiveId?: string) {
  const ctx = xofficeContext();
  const data = await get<{ groups: KpiTreeGroup[]; totalKpis: number }>(
    `/api/manage/kpis${objectiveId ? `?objectiveId=${objectiveId}` : ""}`,
    ctx,
  );
  return { groups: data?.groups ?? [], totalKpis: data?.totalKpis ?? 0, source: (data ? "api" : "offline") as "api" | "offline" };
}
