/**
 * X.Office Management Operating System — MG-01 reference slice. Allowed values for
 * the String-with-comment "enums" on the manage models (project convention — no
 * Prisma enum blocks). Validated in the services with BadRequestException, mirrors
 * the handoff contracts (strategic-objective / metric-definition / decision-record
 * / business-review .schema.json). Keeping these DISTINCT is Constitution #3/#9:
 * an Objective is not a Metric is not a Review is not a Decision is not an Action.
 */

export const OBJECTIVE_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'AT_RISK',
  'ACHIEVED',
  'CANCELLED',
  'ARCHIVED',
] as const;

export const METRIC_DIRECTIONS = ['UP', 'DOWN', 'RANGE', 'ZERO'] as const;

/**
 * The connector plane. Today only XOFFICE_WORK is a REAL read model (computed off
 * the existing NativeWorkItem data). The others are declared for the catalog but
 * remain mock connectors — MG must never direct-DB / dual-write them (#12).
 */
export const METRIC_SOURCE_SYSTEMS = [
  'XOFFICE_WORK',
  'FINERP',
  'X2BMS',
  'XBOOKING',
  'MATTERMOST',
  'MANUAL',
] as const;

export const REVIEW_TYPES = [
  'DAILY',
  'WEEKLY',
  'MONTHLY_BUSINESS',
  'MONTHLY_STRATEGY',
  'QUARTERLY_STRATEGY',
  'PIR',
] as const;

export const REVIEW_STATUSES = [
  'PLANNING',
  'PRE_READ',
  'LIVE',
  'FOLLOW_UP',
  'CLOSED',
] as const;

export const DECISION_STATUSES = [
  'PROPOSED',
  'DECIDED',
  'IN_EXECUTION',
  'REALIZED',
  'SUPERSEDED',
  'REVERSED',
] as const;

export const ACTION_STATUSES = ['OPEN', 'IN_PROGRESS', 'DONE', 'CANCELLED'] as const;

// MG-03 — KPI/OKR/Scorecard (mirrors contracts/okr.schema.json + design doc).
export const OKR_CYCLE_STATUSES = ['PLANNING', 'ACTIVE', 'GRADING', 'CLOSED'] as const;
export const OKR_OBJECTIVE_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'AT_RISK',
  'ACHIEVED',
  'CANCELLED',
  'CLOSED',
] as const;
export const KPI_STATUSES = ['GREEN', 'YELLOW', 'RED', 'STALE'] as const;

export type ObjectiveStatus = (typeof OBJECTIVE_STATUSES)[number];
export type MetricDirection = (typeof METRIC_DIRECTIONS)[number];
export type ReviewType = (typeof REVIEW_TYPES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type DecisionStatus = (typeof DECISION_STATUSES)[number];
export type ActionStatus = (typeof ACTION_STATUSES)[number];
export type OkrCycleStatus = (typeof OKR_CYCLE_STATUSES)[number];
export type OkrObjectiveStatus = (typeof OKR_OBJECTIVE_STATUSES)[number];
export type KpiStatus = (typeof KPI_STATUSES)[number];

// MG-04 — Portfolio & Benefit. Initiative is a stage-gate FSM; gate transitions
// only move forward or to STOPPED (no going back — a stopped/closed initiative
// is re-opened as a NEW one, matching ExecutionProject's own immutable-history
// convention).
export const INITIATIVE_STATUSES = [
  'INTAKE',
  'DISCOVERY',
  'APPROVED',
  'FUNDED',
  'DELIVERY',
  'BENEFIT_REVIEW',
  'CLOSED',
  'STOPPED',
] as const;

export const INITIATIVE_GATE_ORDER: Record<string, string[]> = {
  INTAKE: ['DISCOVERY', 'STOPPED'],
  DISCOVERY: ['APPROVED', 'STOPPED'],
  APPROVED: ['FUNDED', 'STOPPED'],
  FUNDED: ['DELIVERY', 'STOPPED'],
  DELIVERY: ['BENEFIT_REVIEW', 'STOPPED'],
  BENEFIT_REVIEW: ['CLOSED', 'STOPPED'],
  CLOSED: [],
  STOPPED: [],
};

// BenefitProfile.status is DERIVED (service-computed from realizationSchedule
// vs the metric's actual MetricObservation), never hand-set to REALIZED.
export const BENEFIT_STATUSES = ['PLANNED', 'TRACKING', 'REALIZED', 'MISSED'] as const;

export type InitiativeStatus = (typeof INITIATIVE_STATUSES)[number];
export type BenefitStatus = (typeof BENEFIT_STATUSES)[number];
