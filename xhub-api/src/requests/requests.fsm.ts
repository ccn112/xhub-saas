/**
 * Request-level finite state machine (PH-02a — NX-021).
 *
 * This is a small, EXPLICIT transition table that sits ON TOP of the existing
 * workflow engine — it is NOT a second workflow engine. Each legal transition is
 * an (action, fromState) → toState edge. Any action attempted from a state that
 * is not listed is ILLEGAL and the service rejects it with 400.
 *
 * States:
 *   DRAFT             — created, not yet submitted
 *   SUBMITTED         — routed for approval (engine resolved an approver)
 *   IN_REVIEW         — alias of SUBMITTED for seeded/legacy rows (approvable)
 *   WAITING_SUPPLEMENT— approver asked the requester for more info
 *   RESUBMITTED       — requester supplied the supplement; back under review
 *   APPROVED          — approved; awaiting manual external execution
 *   EXECUTING         — external execution in progress (MANUAL_TASK linked)
 *   DONE / COMPLETED  — executed with evidence; terminal (COMPLETED = seed alias)
 *   REJECTED          — terminal
 *   WITHDRAWN         — requester withdrew; terminal
 *   CANCELLED         — cancelled; terminal
 */

export type RequestAction =
  | 'submit'
  | 'request-supplement'
  | 'resubmit'
  | 'approve'
  | 'reject'
  | 'withdraw'
  | 'cancel'
  | 'execute'
  | 'evidence';

export const REVIEWABLE = ['SUBMITTED', 'RESUBMITTED', 'IN_REVIEW'];

/** action → { from: allowed source states, to: target state }. */
export const TRANSITIONS: Record<RequestAction, { from: string[]; to: string }> = {
  submit: { from: ['DRAFT'], to: 'SUBMITTED' },
  'request-supplement': { from: REVIEWABLE, to: 'WAITING_SUPPLEMENT' },
  resubmit: { from: ['WAITING_SUPPLEMENT'], to: 'RESUBMITTED' },
  approve: { from: REVIEWABLE, to: 'APPROVED' },
  reject: { from: REVIEWABLE, to: 'REJECTED' },
  withdraw: { from: [...REVIEWABLE, 'WAITING_SUPPLEMENT', 'DRAFT'], to: 'WITHDRAWN' },
  cancel: { from: [...REVIEWABLE, 'WAITING_SUPPLEMENT', 'DRAFT'], to: 'CANCELLED' },
  execute: { from: ['APPROVED'], to: 'EXECUTING' },
  evidence: { from: ['EXECUTING'], to: 'DONE' },
};

export const TERMINAL = ['DONE', 'COMPLETED', 'REJECTED', 'WITHDRAWN', 'CANCELLED'];

/** Return the target state for a legal (action, from) pair, or null if illegal. */
export function nextState(action: RequestAction, from: string): string | null {
  const t = TRANSITIONS[action];
  if (!t) return null;
  return t.from.includes(from) ? t.to : null;
}

/** The set of actions currently legal from a given state (for the FE action bar). */
export function legalActions(from: string): RequestAction[] {
  return (Object.keys(TRANSITIONS) as RequestAction[]).filter((a) =>
    TRANSITIONS[a].from.includes(from),
  );
}
