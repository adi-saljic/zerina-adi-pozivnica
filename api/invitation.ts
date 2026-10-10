// GET /api/invitation?code=XXXX — one household, and records that the link was opened.

import { isValidCode } from '../shared/code.js';
import { toInvitationDto } from './_lib/dto.js';
import { rsvpDeadline } from './_lib/env.js';
import { HttpError, json, route } from './_lib/http.js';
import { enforceRateLimit } from './_lib/rateLimit.js';
import { openInvitation } from './_lib/repo.js';

export default route({
  async GET(request) {
    // Before the lookup, so failed guesses count against the limit too.
    await enforceRateLimit(request, 'invitation');

    const code = new URL(request.url).searchParams.get('code');
    // Malformed and unknown codes get the same 404: nothing reveals which codes exist.
    if (!isValidCode(code)) throw new HttpError(404, 'not_found');

    const household = await openInvitation(code);
    if (!household) throw new HttpError(404, 'not_found');

    return json(toInvitationDto(household, rsvpDeadline(), new Date()));
  },
});
