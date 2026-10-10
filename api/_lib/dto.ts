import { isRsvpClosed } from '../../shared/rsvpValidation.js';
import type { InvitationDto } from '../../shared/schemas.js';
import type { Household } from './repo.js';

/** Public shape of a household. Never includes internal ids of the invitation, side or table. */
export function toInvitationDto(household: Household, deadline: Date, now: Date): InvitationDto {
  return {
    displayName: household.displayName,
    guests: household.guests,
    message: household.message,
    respondedAt: household.respondedAt,
    deadline: deadline.toISOString(),
    isClosed: isRsvpClosed(deadline, now),
  };
}
