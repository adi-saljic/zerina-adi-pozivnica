// GET /api/admin/summary — totals, per side/table counts, who hasn't opened/answered.
// Requires `Authorization: Bearer <ADMIN_TOKEN>`.

import { isRsvpClosed } from '../../shared/rsvpValidation.js';
import { requireAdmin } from '../_lib/auth.js';
import { publicBaseUrl, rsvpDeadline } from '../_lib/env.js';
import { json, route } from '../_lib/http.js';
import { enforceRateLimit } from '../_lib/rateLimit.js';
import { adminSummary } from '../_lib/repo.js';

export default route({
  async GET(request) {
    await enforceRateLimit(request, 'admin');
    requireAdmin(request);

    const deadline = rsvpDeadline();
    const summary = await adminSummary({
      baseUrl: publicBaseUrl(request),
      deadline,
      isClosed: isRsvpClosed(deadline, new Date()),
    });
    return json(summary);
  },
});
