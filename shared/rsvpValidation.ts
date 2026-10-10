import type { RsvpResponseItem } from './schemas.js';

export function isRsvpClosed(deadline: Date, now: Date): boolean {
  return now.getTime() > deadline.getTime();
}

export type RsvpValidationResult =
  | { ok: true }
  | { ok: false; error: 'not_found' }
  | { ok: false; error: 'closed' }
  | {
      ok: false;
      error: 'duplicate_guest' | 'unknown_guest' | 'missing_guest' | 'name_not_allowed';
      guestIds: string[];
    };

/**
 * Server-side RSVP rules (pure, so it is unit-tested without a database):
 * the invitation exists, the deadline has not passed, the responses cover
 * exactly the guests of this invitation (no foreign ids, no duplicates, none
 * missing), and a typed-in name is only accepted for placeholder members.
 */
export function validateRsvp(input: {
  /** Guests of the invitation, or null if the code does not exist. */
  householdGuests: readonly { id: string; isPlaceholder: boolean }[] | null;
  responses: readonly RsvpResponseItem[];
  deadline: Date;
  now: Date;
}): RsvpValidationResult {
  const { householdGuests, responses, deadline, now } = input;

  if (householdGuests === null) return { ok: false, error: 'not_found' };
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

  const byId = new Map(householdGuests.map((g) => [g.id, g]));
  const unknown = [...seen].filter((id) => !byId.has(id));
  if (unknown.length > 0) return { ok: false, error: 'unknown_guest', guestIds: unknown };

  const missing = householdGuests.filter((g) => !seen.has(g.id)).map((g) => g.id);
  if (missing.length > 0) return { ok: false, error: 'missing_guest', guestIds: missing };

  const namedRealGuests = responses
    .filter((r) => r.name !== undefined && !byId.get(r.guestId)?.isPlaceholder)
    .map((r) => r.guestId);
  if (namedRealGuests.length > 0) {
    return { ok: false, error: 'name_not_allowed', guestIds: namedRealGuests };
  }

  return { ok: true };
}
