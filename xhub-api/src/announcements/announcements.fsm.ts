/**
 * Announcement finite state machine (PH-02e — NX-028).
 *
 * ONE explicit transition table sitting ON TOP of the shared workflow idiom
 * (NOT a second engine). Any (action, fromState) pair not listed is ILLEGAL and
 * the service rejects it with 400.
 *
 * Lifecycle:
 *   DRAFT → PUBLISHED → (ARCHIVED)
 *       plus CANCELLED (from DRAFT or PUBLISHED).
 *
 * Only `publish` fans the audience out into AnnouncementReceipts (in the
 * service). Recipient read / acknowledge are NOT state transitions — they stamp
 * the receipt, not the announcement.
 */

export type AnnouncementAction = 'publish' | 'archive' | 'cancel';

export const ANNOUNCEMENT_TRANSITIONS: Record<AnnouncementAction, { from: string[]; to: string }> = {
  publish: { from: ['DRAFT'], to: 'PUBLISHED' },
  archive: { from: ['PUBLISHED'], to: 'ARCHIVED' },
  cancel: { from: ['DRAFT', 'PUBLISHED'], to: 'CANCELLED' },
};

export const ANNOUNCEMENT_TERMINAL = ['ARCHIVED', 'CANCELLED'];

/** States in which the announcement is live / visible to recipients. */
export const ANNOUNCEMENT_LIVE = ['PUBLISHED'];

export function announcementNext(action: AnnouncementAction, from: string): string | null {
  const t = ANNOUNCEMENT_TRANSITIONS[action];
  if (!t) return null;
  return t.from.includes(from) ? t.to : null;
}

export function announcementLegalActions(from: string): AnnouncementAction[] {
  return (Object.keys(ANNOUNCEMENT_TRANSITIONS) as AnnouncementAction[]).filter((a) =>
    ANNOUNCEMENT_TRANSITIONS[a].from.includes(from),
  );
}
