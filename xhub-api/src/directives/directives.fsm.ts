/**
 * Directive + Commitment finite state machines (PH-02b — NX-025).
 *
 * Two small EXPLICIT transition tables sitting ON TOP of the existing workflow
 * engine (NOT a second engine). Any (action, fromState) pair not listed is
 * ILLEGAL and the service rejects it with 400.
 *
 * Directive lifecycle:
 *   DRAFT → ISSUED → IN_PROGRESS → COMPLETED | CANCELLED
 * Per-assignee Commitment (DirectiveAssignment) lifecycle:
 *   ASSIGNED → ACKNOWLEDGED → IN_PROGRESS → SUBMITTED → ACCEPTED | RETURNED
 *   RETURNED ⇄ IN_PROGRESS (rework loop)
 */

// ---- Directive-level ------------------------------------------------------
export type DirectiveAction = 'issue' | 'progress' | 'complete' | 'cancel';

export const DIRECTIVE_TRANSITIONS: Record<DirectiveAction, { from: string[]; to: string }> = {
  issue: { from: ['DRAFT'], to: 'ISSUED' },
  // progress is an internal marker driven by commitment activity (ISSUED→IN_PROGRESS).
  progress: { from: ['ISSUED'], to: 'IN_PROGRESS' },
  complete: { from: ['ISSUED', 'IN_PROGRESS'], to: 'COMPLETED' },
  cancel: { from: ['DRAFT', 'ISSUED', 'IN_PROGRESS'], to: 'CANCELLED' },
};

export const DIRECTIVE_TERMINAL = ['COMPLETED', 'CANCELLED'];

export function directiveNext(action: DirectiveAction, from: string): string | null {
  const t = DIRECTIVE_TRANSITIONS[action];
  if (!t) return null;
  return t.from.includes(from) ? t.to : null;
}

export function directiveLegalActions(from: string): DirectiveAction[] {
  return (Object.keys(DIRECTIVE_TRANSITIONS) as DirectiveAction[]).filter((a) =>
    DIRECTIVE_TRANSITIONS[a].from.includes(from),
  );
}

// ---- Commitment-level (per assignee) --------------------------------------
export type CommitmentAction = 'acknowledge' | 'start' | 'submit' | 'accept' | 'return';

export const COMMITMENT_TRANSITIONS: Record<CommitmentAction, { from: string[]; to: string }> = {
  acknowledge: { from: ['ASSIGNED'], to: 'ACKNOWLEDGED' },
  start: { from: ['ACKNOWLEDGED', 'RETURNED'], to: 'IN_PROGRESS' },
  submit: { from: ['IN_PROGRESS'], to: 'SUBMITTED' },
  accept: { from: ['SUBMITTED'], to: 'ACCEPTED' },
  return: { from: ['SUBMITTED'], to: 'RETURNED' },
};

export const COMMITMENT_TERMINAL = ['ACCEPTED'];

export function commitmentNext(action: CommitmentAction, from: string): string | null {
  const t = COMMITMENT_TRANSITIONS[action];
  if (!t) return null;
  return t.from.includes(from) ? t.to : null;
}

export function commitmentLegalActions(from: string): CommitmentAction[] {
  return (Object.keys(COMMITMENT_TRANSITIONS) as CommitmentAction[]).filter((a) =>
    COMMITMENT_TRANSITIONS[a].from.includes(from),
  );
}

// ---- SLA / overdue (shared xoffice idiom: dueAt + now) --------------------
/** True when dueAt has passed and the record is not in a terminal/accepted state. */
export function isOverdue(dueAt: Date | string | null | undefined, state: string, terminal: string[]): boolean {
  if (!dueAt) return false;
  if (terminal.includes(state)) return false;
  return new Date(dueAt).getTime() < Date.now();
}
