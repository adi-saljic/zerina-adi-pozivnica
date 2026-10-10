// POST /api/rsvp — save (or change) the answers of one household until the deadline.

import { validateRsvp } from '../shared/rsvpValidation.js';
import { rsvpRequestSchema } from '../shared/schemas.js';
import { toInvitationDto } from './_lib/dto.js';
import { rsvpDeadline } from './_lib/env.js';
import { HttpError, json, readJsonBody, route } from './_lib/http.js';
import { enforceRateLimit } from './_lib/rateLimit.js';
import { findHouseholdByCode, saveRsvp } from './_lib/repo.js';

export default route({
  async POST(request) {
    await enforceRateLimit(request, 'rsvp');

    const body = await readJsonBody(request);
    const parsed = rsvpRequestSchema.safeParse(body);
    if (!parsed.success) {
      // A malformed code is reported like an unknown one.
      const badCode = parsed.error.issues.some((issue) => issue.path[0] === 'code');
      throw badCode ? new HttpError(404, 'not_found') : new HttpError(400, 'invalid_request');
    }
    const { code, responses, message } = parsed.data;

    const household = await findHouseholdByCode(code);
    const deadline = rsvpDeadline();
    const now = new Date();

    const result = validateRsvp({
      householdGuests: household?.guests ?? null,
      responses,
      deadline,
      now,
    });
    if (!result.ok) {
      if (result.error === 'not_found') throw new HttpError(404, 'not_found');
      if (result.error === 'closed') throw new HttpError(409, 'closed');
      console.warn(`[rsvp] rejected: ${result.error}`, { guestIds: result.guestIds });
      throw new HttpError(400, 'invalid_request');
    }
    if (!household) throw new HttpError(404, 'not_found'); // already covered above; narrows the type

    const saved = await saveRsvp({
      invitationId: household.id,
      responses,
      message: message ? message : null,
    });
    return json(toInvitationDto(saved, deadline, now));
  },
});
