/**
 * Engagement finite state machine (SaaS step 5 — Solution Delivery Workspace).
 *
 * ONE explicit transition table for the customer-delivery lifecycle of X-TECH
 * (T001). It rides ON TOP of the existing module primitives (requests /
 * directives / tickets / bookings / announcements / launch) — it is NOT a new
 * engine. Any (action, fromStage) pair not listed is ILLEGAL and the service
 * rejects it with 400. Each transition writes an EngagementEvent + AuditLog.
 *
 * Lifecycle (stage):
 *   LEAD → QUALIFIED → SURVEY → SOLUTION_DESIGN → PROPOSAL → WON
 *        → IMPLEMENTATION → MIGRATION → UAT → GO_LIVE → HYPERCARE
 *        → CUSTOMER_SUCCESS
 *   branch: LOST (from any presales stage).
 *
 * ON_HOLD is a STATUS overlay, not a stage: hold() flips status→ON_HOLD keeping
 * the stage; resume() restores the stage-derived status. A held engagement
 * cannot take a forward transition until it resumes (enforced in the service).
 */

export type EngagementAction =
  | 'qualify'
  | 'survey'
  | 'design'
  | 'propose'
  | 'win'
  | 'implement'
  | 'migrate'
  | 'uat'
  | 'golive'
  | 'hypercare'
  | 'success'
  | 'lose';

/** Ordered pipeline stages (for pipeline overview + status rollup). */
export const STAGE_ORDER = [
  'LEAD',
  'QUALIFIED',
  'SURVEY',
  'SOLUTION_DESIGN',
  'PROPOSAL',
  'WON',
  'IMPLEMENTATION',
  'MIGRATION',
  'UAT',
  'GO_LIVE',
  'HYPERCARE',
  'CUSTOMER_SUCCESS',
] as const;

export type Stage = (typeof STAGE_ORDER)[number] | 'LOST';

const PRESALES = ['LEAD', 'QUALIFIED', 'SURVEY', 'SOLUTION_DESIGN', 'PROPOSAL'];

export const ENGAGEMENT_TRANSITIONS: Record<EngagementAction, { from: string[]; to: Stage }> = {
  qualify: { from: ['LEAD'], to: 'QUALIFIED' },
  survey: { from: ['QUALIFIED'], to: 'SURVEY' },
  design: { from: ['SURVEY'], to: 'SOLUTION_DESIGN' },
  propose: { from: ['SOLUTION_DESIGN'], to: 'PROPOSAL' },
  win: { from: ['PROPOSAL'], to: 'WON' },
  implement: { from: ['WON'], to: 'IMPLEMENTATION' },
  migrate: { from: ['IMPLEMENTATION'], to: 'MIGRATION' },
  uat: { from: ['MIGRATION'], to: 'UAT' },
  golive: { from: ['UAT'], to: 'GO_LIVE' },
  hypercare: { from: ['GO_LIVE'], to: 'HYPERCARE' },
  success: { from: ['HYPERCARE'], to: 'CUSTOMER_SUCCESS' },
  lose: { from: PRESALES, to: 'LOST' },
};

export const ENGAGEMENT_TERMINAL: Stage[] = ['LOST', 'CUSTOMER_SUCCESS'];

export function engagementNext(action: EngagementAction, from: string): Stage | null {
  const t = ENGAGEMENT_TRANSITIONS[action];
  if (!t) return null;
  return t.from.includes(from) ? t.to : null;
}

export function engagementLegalActions(from: string): EngagementAction[] {
  return (Object.keys(ENGAGEMENT_TRANSITIONS) as EngagementAction[]).filter((a) =>
    ENGAGEMENT_TRANSITIONS[a].from.includes(from),
  );
}

/** Coarse status rollup derived from the stage (used for list filters + KPIs). */
export function statusForStage(stage: string): string {
  if (stage === 'LOST') return 'LOST';
  if (['WON', 'IMPLEMENTATION', 'MIGRATION', 'UAT'].includes(stage)) return 'WON';
  if (['GO_LIVE', 'HYPERCARE', 'CUSTOMER_SUCCESS'].includes(stage)) return 'LIVE';
  return 'OPEN';
}

/** GO_LIVE (or later) is the point where a customer tenant launch may be triggered. */
export function isLaunchReady(stage: string): boolean {
  return ['GO_LIVE', 'HYPERCARE', 'CUSTOMER_SUCCESS'].includes(stage);
}
