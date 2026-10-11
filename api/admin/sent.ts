// POST /api/admin/sent — mark a household as "link sent" (or undo it).
// Body: { householdKey, sent }. Requires `Authorization: Bearer <ADMIN_TOKEN>`.

import { z } from 'zod';
import { requireAdmin } from '../_lib/auth.js';
import { HttpError, json, readJsonBody, route } from '../_lib/http.js';
import { enforceRateLimit } from '../_lib/rateLimit.js';
import { setHouseholdSent } from '../_lib/repo.js';

const bodySchema = z.strictObject({
  householdKey: z.string().min(1).max(100),
  sent: z.boolean(),
});

export default route({
  async POST(request) {
    await enforceRateLimit(request, 'admin');
    requireAdmin(request);

    const parsed = bodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) throw new HttpError(400, 'invalid_request');

    const result = await setHouseholdSent(parsed.data.householdKey, parsed.data.sent);
    if (!result) throw new HttpError(404, 'not_found');
    return json(result);
  },
});
