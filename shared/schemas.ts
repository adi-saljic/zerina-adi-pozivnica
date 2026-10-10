import { z } from 'zod';
import { CODE_REGEX } from './code.js';

export const SIDES = ['adi', 'zerina', 'zajednicki'] as const;
export const ROLES = ['muz', 'zena', 'partner', 'dijete', 'gost'] as const;
export const MESSAGE_MAX_LENGTH = 500;
export const MAX_GUESTS_PER_HOUSEHOLD = 30;

export const codeSchema = z.string().regex(CODE_REGEX);
export const sideSchema = z.enum(SIDES);
export const roleSchema = z.enum(ROLES);

export type Side = z.infer<typeof sideSchema>;
export type Role = z.infer<typeof roleSchema>;

// Drop control characters (Postgres rejects NUL) but keep newlines and tabs.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const messageSchema = z
  .string()
  .transform((s) => s.replace(CONTROL_CHARS, '').trim())
  .pipe(z.string().max(MESSAGE_MAX_LENGTH));

// ---- POST /api/rsvp ---------------------------------------------------------

export const rsvpResponseItemSchema = z.strictObject({
  guestId: z.uuid(),
  attending: z.boolean(),
});

export const rsvpRequestSchema = z.strictObject({
  code: codeSchema,
  responses: z.array(rsvpResponseItemSchema).min(1).max(MAX_GUESTS_PER_HOUSEHOLD),
  message: messageSchema.optional(),
});

export type RsvpRequest = z.infer<typeof rsvpRequestSchema>;
export type RsvpResponseItem = z.infer<typeof rsvpResponseItemSchema>;

// ---- GET /api/invitation response (also returned by POST /api/rsvp) --------

const isoDateTime = z.iso.datetime({ offset: true });

export const guestDtoSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: roleSchema,
  attending: z.boolean().nullable(),
});

export const invitationDtoSchema = z.object({
  displayName: z.string(),
  guests: z.array(guestDtoSchema),
  message: z.string().nullable(),
  respondedAt: isoDateTime.nullable(),
  deadline: isoDateTime,
  isClosed: z.boolean(),
});

export type GuestDto = z.infer<typeof guestDtoSchema>;
export type InvitationDto = z.infer<typeof invitationDtoSchema>;

// ---- Errors -----------------------------------------------------------------

export const API_ERROR_CODES = [
  'not_found',
  'invalid_request',
  'closed',
  'rate_limited',
  'unauthorized',
  'forbidden',
  'method_not_allowed',
  'unsupported_media_type',
  'payload_too_large',
  'server_error',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const apiErrorSchema = z.object({ error: z.enum(API_ERROR_CODES) });
