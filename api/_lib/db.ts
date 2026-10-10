import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { databaseUrl } from './env.js';

let client: NeonQueryFunction<false, false> | undefined;

/** Neon HTTP client. Every value interpolated into sql`...` is sent as a bind parameter. */
export function db(): NeonQueryFunction<false, false> {
  client ??= neon(databaseUrl());
  return client;
}

/** Postgres timestamps come back as Date (top level) or string (inside json). */
export function toIso(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}
