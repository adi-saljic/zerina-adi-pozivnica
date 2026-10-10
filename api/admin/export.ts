// GET /api/admin/export.csv (rewritten to /api/admin/export in vercel.json)
// All guests with household, side, table, role and attending status. For placeholder
// members the name the guest typed in is shown instead of the CSV placeholder.
// Requires `Authorization: Bearer <ADMIN_TOKEN>`. Add ?sep=comma for "," instead of ";".

import { toCsv } from '../../shared/csv.js';
import { requireAdmin } from '../_lib/auth.js';
import { toIso } from '../_lib/db.js';
import { publicBaseUrl } from '../_lib/env.js';
import { route } from '../_lib/http.js';
import { enforceRateLimit } from '../_lib/rateLimit.js';
import { exportGuests, invitationUrl } from '../_lib/repo.js';

const HEADER = [
  'household',
  'household_key',
  'side',
  'table_name',
  'guest_name',
  'role',
  'is_placeholder',
  'attending',
  'responded_at',
  'message',
  'url',
] as const;

export default route({
  async GET(request) {
    await enforceRateLimit(request, 'admin');
    requireAdmin(request);

    const delimiter = new URL(request.url).searchParams.get('sep') === 'comma' ? ',' : ';';
    const rows = await exportGuests();
    const baseUrl = publicBaseUrl(request);
    const csv = toCsv(
      HEADER,
      rows.map((r) => [
        r.household,
        r.household_key,
        r.side,
        r.table_name,
        r.guest_name,
        r.role,
        r.is_placeholder ? 'da' : 'ne',
        r.attending === null ? '' : r.attending ? 'da' : 'ne',
        toIso(r.responded_at),
        r.message,
        invitationUrl(baseUrl, r.slug, r.code),
      ]),
      delimiter,
    );

    const date = new Date().toISOString().slice(0, 10);
    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="gosti-${date}.csv"`,
      },
    });
  },
});
