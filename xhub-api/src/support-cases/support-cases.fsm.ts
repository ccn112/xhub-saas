/**
 * SupportCase finite state machine (Product Customer Support, 2026-08-06).
 *
 * A support case is raised by an internal agent on behalf of an EXTERNAL
 * customer (of X2, X1, or any other product this company operates/supports),
 * arriving from any channel — Zalo support group, phone, email, portal.
 * Mirrors the Ticket FSM shape (tickets.fsm.ts) but renamed for this audience:
 * PENDING_REQUESTER → WAITING_CUSTOMER (the "requester" here is an external
 * customer, not the acting employee).
 *
 * Lifecycle:
 *   NEW → TRIAGED → IN_PROGRESS ⇄ WAITING_CUSTOMER → RESOLVED → CLOSED
 *   plus CANCELLED from any active (non-terminal) state.
 *
 * Escalation (escalate → BacklogItem/Defect in the Engineering Governance
 * Hub) is a SIDE ACTION, not a state transition — it can happen from any
 * active state and does not by itself move the case forward. See
 * SupportCasesService.escalate().
 */

export type SupportCaseAction =
  | 'triage'
  | 'start'
  | 'wait'
  | 'resume'
  | 'resolve'
  | 'close'
  | 'cancel';

export const SUPPORT_CASE_TRANSITIONS: Record<SupportCaseAction, { from: string[]; to: string }> = {
  triage: { from: ['NEW'], to: 'TRIAGED' },
  start: { from: ['TRIAGED', 'WAITING_CUSTOMER'], to: 'IN_PROGRESS' },
  wait: { from: ['IN_PROGRESS'], to: 'WAITING_CUSTOMER' },
  resume: { from: ['WAITING_CUSTOMER'], to: 'IN_PROGRESS' },
  resolve: { from: ['IN_PROGRESS', 'WAITING_CUSTOMER'], to: 'RESOLVED' },
  close: { from: ['RESOLVED'], to: 'CLOSED' },
  cancel: { from: ['NEW', 'TRIAGED', 'IN_PROGRESS', 'WAITING_CUSTOMER'], to: 'CANCELLED' },
};

export const SUPPORT_CASE_TERMINAL = ['CLOSED', 'CANCELLED'];

export function supportCaseNext(action: SupportCaseAction, from: string): string | null {
  const t = SUPPORT_CASE_TRANSITIONS[action];
  if (!t) return null;
  return t.from.includes(from) ? t.to : null;
}

export function supportCaseLegalActions(from: string): SupportCaseAction[] {
  return (Object.keys(SUPPORT_CASE_TRANSITIONS) as SupportCaseAction[]).filter((a) =>
    SUPPORT_CASE_TRANSITIONS[a].from.includes(from),
  );
}

export const SUPPORT_CASE_CHANNELS = ['ZALO', 'EMAIL', 'PHONE', 'PORTAL', 'OTHER'];
export const SUPPORT_CASE_CATEGORIES = [
  'OPERATION_SUPPORT',
  'DATA_FIX',
  'USAGE_QUESTION',
  'BUG_REPORT',
  'FEATURE_REQUEST',
  'OTHER',
];
export const SUPPORT_CASE_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
