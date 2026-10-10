import type { RsvpResponseItem } from './schemas.js';

export function isRsvpClosed(deadline: Date, now: Date): boolean {
  return now.getTime() > deadline.getTime();
}

export type RsvpValidationResult =
  | { ok: true }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'closed' }
  | { ok: false; error: 'duplicate_guest' | 'unknown_guest' | 'missing_guest'; guestIds: string[] };

/**
 * Server-side RSVP rules (pure, so it is unit-tested without a database):
 * the invitation exists, the deadline has not passed, and the responses cover
 * exactly the guests of this invitation: no foreign ids, no duplicates, none missing.
 */
export function validateRsvp(input: {
  /** Guest ids of the invitation, or null if the code does not exist. */
  householdGuestIds: readonly string[] | null;
  responses: readonly RsvpResponseItem[];
  deadline: Date;
  now: Date;
}): RsvpValidationResult {
  const { householdGuestIds, responses, deadline, now } = input;

  if (householdGuestIds === null) return { ok: false, error: 'not_found' };
  if (isRsvpClosed(deadline, now)) return { ok: false, error: 'closed' };

  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const { guestId } of responses) {
    if (seen.has(guestId)) duplicates.add(guestId);
    seen.add(guestId);
  }
  if (duplicates.size > 0) {
    return { ok: false, error: 'duplicate_guest', guestIds: [...duplicates] };
  }

  const household = new Set(householdGuestIds);
  const unknown = [...seen].filter((id) => !household.has(id));
  if (unknown.length > 0) return { ok: false, error: 'unknown_guest', guestIds: unknown };

  const missing = householdGuestIds.filter((id) => !seen.has(id));
  if (missing.length > 0) return { ok: false, error: 'missing_guest', guestIds: missing };

  return { ok: true };
}
