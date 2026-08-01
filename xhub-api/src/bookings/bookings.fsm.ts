/**
 * Booking finite state machine (PH-02d — NX-027).
 *
 * ONE explicit transition table sitting ON TOP of the shared workflow idiom
 * (NOT a second engine). Any (action, fromState) pair not listed is ILLEGAL and
 * the service rejects it with 400.
 *
 * Lifecycle:
 *   REQUESTED → APPROVED → (CHECKED_IN → CHECKED_OUT | NO_SHOW)
 *       plus REJECTED (from REQUESTED) and CANCELLED (from any active state).
 *
 * CONFLICT rule (enforced in the service, NOT here): creating OR approving a
 * booking that overlaps [startAt,endAt) with an existing ACTIVE booking
 * (REQUESTED/APPROVED/CHECKED_IN) for the SAME resource → 409.
 */

export type BookingAction =
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'check-in'
  | 'check-out'
  | 'no-show';

export const BOOKING_TRANSITIONS: Record<BookingAction, { from: string[]; to: string }> = {
  approve: { from: ['REQUESTED'], to: 'APPROVED' },
  reject: { from: ['REQUESTED'], to: 'REJECTED' },
  cancel: { from: ['REQUESTED', 'APPROVED', 'CHECKED_IN'], to: 'CANCELLED' },
  'check-in': { from: ['APPROVED'], to: 'CHECKED_IN' },
  'check-out': { from: ['CHECKED_IN'], to: 'CHECKED_OUT' },
  'no-show': { from: ['APPROVED'], to: 'NO_SHOW' },
};

export const BOOKING_TERMINAL = ['CHECKED_OUT', 'NO_SHOW', 'REJECTED', 'CANCELLED'];

/** States that still hold the resource slot (used for the conflict check). */
export const BOOKING_ACTIVE = ['REQUESTED', 'APPROVED', 'CHECKED_IN'];

export function bookingNext(action: BookingAction, from: string): string | null {
  const t = BOOKING_TRANSITIONS[action];
  if (!t) return null;
  return t.from.includes(from) ? t.to : null;
}

export function bookingLegalActions(from: string): BookingAction[] {
  return (Object.keys(BOOKING_TRANSITIONS) as BookingAction[]).filter((a) =>
    BOOKING_TRANSITIONS[a].from.includes(from),
  );
}

/** Half-open interval overlap: [aStart,aEnd) intersects [bStart,bEnd). */
export function overlaps(
  aStart: Date | string,
  aEnd: Date | string,
  bStart: Date | string,
  bEnd: Date | string,
): boolean {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as < be && bs < ae;
}

/**
 * True when a booking is OVERDUE: it was approved but its window has already
 * ended without a check-out (never checked in, or checked in but not out).
 */
export function isOverdue(endAt: Date | string | null | undefined, state: string): boolean {
  if (!endAt) return false;
  if (!['APPROVED', 'CHECKED_IN'].includes(state)) return false;
  return new Date(endAt).getTime() < Date.now();
}
