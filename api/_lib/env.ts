// Server-only configuration. Read lazily (per request) so that a missing
// optional variable never crashes a function at import time.
// NEVER import this file from src/: these values must not reach the browser.

import { z } from 'zod';
import { event } from '../../shared/event.js';

const deadlineSchema = z.iso.datetime({ offset: true });

export const MIN_ADMIN_TOKEN_LENGTH = 32;

export function databaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL is not set');
  return value;
}

/** null when unset or too short: admin endpoints then stay closed. */
export function adminToken(): string | null {
  const value = process.env.ADMIN_TOKEN?.trim();
  if (!value) return null;
  if (value.length < MIN_ADMIN_TOKEN_LENGTH) {
    console.error(
      `ADMIN_TOKEN is shorter than ${MIN_ADMIN_TOKEN_LENGTH} characters; admin is disabled`,
    );
    return null;
  }
  return value;
}

/** RSVP_DEADLINE env var if set, otherwise shared/event.ts. Must carry a timezone offset. */
export function rsvpDeadline(): Date {
  const raw = process.env.RSVP_DEADLINE?.trim() || event.rsvpDeadline;
  const parsed = deadlineSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `RSVP deadline "${raw}" must be ISO 8601 with offset, e.g. 2027-05-15T23:59:59+02:00`,
    );
  }
  return new Date(parsed.data);
}

export function rateLimitSecret(): string {
  return process.env.RATE_LIMIT_SECRET?.trim() || `rate-limit:${databaseUrl()}`;
}

/** Public site URL without trailing slash; falls back to the request origin. */
export function publicBaseUrl(request?: Request): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  if (request) return new URL(request.url).origin;
  return 'http://localhost:5173';
}
