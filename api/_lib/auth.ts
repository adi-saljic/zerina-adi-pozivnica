import { createHash, timingSafeEqual } from 'node:crypto';
import { adminToken } from './env.js';
import { HttpError } from './http.js';

/** Constant-time comparison: both sides are hashed first so lengths always match. */
export function tokensMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b) && provided.length > 0;
}

export function bearerToken(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match?.[1]?.trim() ?? '';
}

/** Throws unless the request carries `Authorization: Bearer <ADMIN_TOKEN>`. */
export function requireAdmin(request: Request): void {
  const expected = adminToken();
  // Admin disabled (no or too short token configured): pretend it doesn't exist.
  if (!expected) throw new HttpError(404, 'not_found');
  if (!tokensMatch(bearerToken(request), expected)) {
    throw new HttpError(401, 'unauthorized', { 'www-authenticate': 'Bearer' });
  }
}
