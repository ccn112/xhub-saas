/**
 * NativeWorkItem status finite-state machine (X.Office Work & PM v2 — W1).
 *
 * An explicit transition table for the durable PM work item (NOT the workflow
 * runtime ApprovalTask). Any (from → to) pair not listed is ILLEGAL and the
 * service rejects it with 400. Kept small + data-driven, mirroring
 * directives.fsm.ts.
 *
 * Lifecycle:
 *   BACKLOG → TODO → IN_PROGRESS ⇄ REVIEW → DONE
 *   (IN_PROGRESS/TODO/REVIEW) ⇄ BLOCKED ; anything non-terminal → CANCELLED
 *   DONE/CANCELLED may reopen → IN_PROGRESS/TODO.
 */
export const WORK_STATUSES = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'REVIEW',
  'BLOCKED',
  'DONE',
  'CANCELLED',
] as const;
export type WorkStatus = (typeof WORK_STATUSES)[number];

export const WORK_TERMINAL: string[] = ['DONE', 'CANCELLED'];

export const WORK_TRANSITIONS: Record<string, string[]> = {
  BACKLOG: ['TODO', 'IN_PROGRESS', 'CANCELLED'],
  TODO: ['IN_PROGRESS', 'BLOCKED', 'BACKLOG', 'CANCELLED'],
  IN_PROGRESS: ['REVIEW', 'BLOCKED', 'DONE', 'TODO', 'CANCELLED'],
  REVIEW: ['DONE', 'IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'TODO', 'CANCELLED'],
  DONE: ['IN_PROGRESS', 'TODO'],
  CANCELLED: ['TODO', 'BACKLOG'],
};

export function isLegalStatusChange(from: string, to: string): boolean {
  if (from === to) return false;
  return (WORK_TRANSITIONS[from] ?? []).includes(to);
}

export function legalStatusTargets(from: string): string[] {
  return WORK_TRANSITIONS[from] ?? [];
}

/** True when dueAt has passed and the item is not in a terminal status. */
export function isOverdue(
  dueAt: Date | string | null | undefined,
  status: string,
): boolean {
  if (!dueAt) return false;
  if (WORK_TERMINAL.includes(status)) return false;
  return new Date(dueAt).getTime() < Date.now();
}
