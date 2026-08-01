/**
 * Ticket finite state machine (PH-02c — NX-026).
 *
 * ONE explicit transition table sitting ON TOP of the shared workflow engine
 * (NOT a second engine). Any (action, fromState) pair not listed is ILLEGAL and
 * the service rejects it with 400.
 *
 * Lifecycle:
 *   NEW → TRIAGED → ASSIGNED → IN_PROGRESS → (PENDING_REQUESTER ⇄ IN_PROGRESS)
 *       → RESOLVED → CLOSED
 *   plus CANCELLED from any active (non-terminal) state.
 *
 * SLA: slaDueAt derives from the catalog item's defaultSlaHours at create; a
 * ticket is OVERDUE when slaDueAt has passed and it is not in a terminal state.
 */

export type TicketAction =
  | 'triage'
  | 'assign'
  | 'claim'
  | 'start'
  | 'pending'
  | 'resume'
  | 'resolve'
  | 'close'
  | 'cancel';

export const TICKET_TRANSITIONS: Record<TicketAction, { from: string[]; to: string }> = {
  triage: { from: ['NEW'], to: 'TRIAGED' },
  // assign (manager) and claim (agent self-assign) both land in ASSIGNED.
  assign: { from: ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS'], to: 'ASSIGNED' },
  claim: { from: ['NEW', 'TRIAGED', 'ASSIGNED'], to: 'ASSIGNED' },
  start: { from: ['ASSIGNED', 'PENDING_REQUESTER'], to: 'IN_PROGRESS' },
  pending: { from: ['IN_PROGRESS'], to: 'PENDING_REQUESTER' },
  resume: { from: ['PENDING_REQUESTER'], to: 'IN_PROGRESS' },
  resolve: { from: ['IN_PROGRESS', 'PENDING_REQUESTER'], to: 'RESOLVED' },
  close: { from: ['RESOLVED'], to: 'CLOSED' },
  cancel: { from: ['NEW', 'TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_REQUESTER'], to: 'CANCELLED' },
};

export const TICKET_TERMINAL = ['CLOSED', 'CANCELLED'];

export function ticketNext(action: TicketAction, from: string): string | null {
  const t = TICKET_TRANSITIONS[action];
  if (!t) return null;
  return t.from.includes(from) ? t.to : null;
}

export function ticketLegalActions(from: string): TicketAction[] {
  return (Object.keys(TICKET_TRANSITIONS) as TicketAction[]).filter((a) =>
    TICKET_TRANSITIONS[a].from.includes(from),
  );
}

// ---- SLA / overdue (shared xoffice idiom: slaDueAt + now) -----------------
/** True when slaDueAt has passed and the ticket is not in a terminal state. */
export function isOverdue(slaDueAt: Date | string | null | undefined, state: string): boolean {
  if (!slaDueAt) return false;
  if (TICKET_TERMINAL.includes(state)) return false;
  return new Date(slaDueAt).getTime() < Date.now();
}
