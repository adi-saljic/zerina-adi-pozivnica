// Fixed-window rate limiting stored in Neon, so it survives cold starts and is
// shared by all function instances (an in-memory counter would not be).
//
// Limitations (documented in README):
// - Fixed windows allow a burst of up to 2x the limit around a window boundary.
// - Many guests can share one IP (mobile carrier NAT, venue Wi-Fi), so limits
//   are deliberately generous; they only stop scripted guessing/flooding.
// - Costs one extra query per request.

import { createHmac } from 'node:crypto';
import { db } from './db.js';
import { rateLimitSecret } from './env.js';
import { HttpError } from './http.js';
import { clientIp, ipKey } from './ip.js';

export const LIMITS = {
  invitation: { limit: 120, windowSeconds: 600 },
  rsvp: { limit: 30, windowSeconds: 600 },
  // Generous: ticking "Poslano" for every household is one request each.
  admin: { limit: 400, windowSeconds: 600 },
} as const;

export type Bucket = keyof typeof LIMITS;

export function rateLimitKey(bucket: Bucket, ip: string, secret: string): string {
  const hash = createHmac('sha256', secret).update(ipKey(ip)).digest('base64url').slice(0, 32);
  return `${bucket}:${hash}`;
}

export async function enforceRateLimit(request: Request, bucket: Bucket): Promise<void> {
  const { limit, windowSeconds } = LIMITS[bucket];
  const key = rateLimitKey(bucket, clientIp(request), rateLimitSecret());
  const window = `${windowSeconds} seconds`;
  const sql = db();

  const rows = await sql`
    insert into rate_limits (key, window_start, hits)
    values (${key}, date_bin(${window}::interval, now(), timestamptz '2000-01-01'), 1)
    on conflict (key, window_start) do update set hits = rate_limits.hits + 1
    returning hits, ceil(extract(epoch from (window_start + ${window}::interval - now())))::int as retry_after`;

  // Occasionally drop old windows so the table stays tiny.
  if (Math.random() < 0.02) {
    await sql`delete from rate_limits where window_start < now() - interval '1 day'`;
  }

  const row = rows[0] as { hits: number; retry_after: number } | undefined;
  if (row && row.hits > limit) {
    throw new HttpError(429, 'rate_limited', {
      'retry-after': String(Math.max(1, row.retry_after)),
    });
  }
}
