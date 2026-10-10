import { isRsvpClosed } from '../../shared/rsvpValidation.js';
import type { InvitationDto } from '../../shared/schemas.js';
import type { Household } from './repo.js';

/** Public shape of a household. Never includes the invitation id, household key, side or tables. */
export function toInvitationDto(household: Household, deadline: Date, now: Date): InvitationDto {
  return {
    salutation: household.salutation,
    displayName: household.displayName,
    slug: household.slug,
    guests: household.guests,
    message: household.message,
    respondedAt: household.respondedAt,
    deadline: deadline.toISOString(),
    isClosed: isRsvpClosed(deadline, now),
  };
}
