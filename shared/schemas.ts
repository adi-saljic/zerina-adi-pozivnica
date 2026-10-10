import { z } from 'zod';
import { CODE_REGEX } from './code.js';

export const SIDES = ['zerina', 'adi', 'zajednicki'] as const;
export const ROLES = ['muz', 'zena', 'partner', 'dijete', 'gost'] as const;
export const SALUTATIONS = ['Dragi', 'Draga'] as const;
export const MESSAGE_MAX_LENGTH = 500;
export const GUEST_NAME_MAX_LENGTH = 60;
export const MAX_GUESTS_PER_HOUSEHOLD = 30;

export const codeSchema = z.string().regex(CODE_REGEX);
export const sideSchema = z.enum(SIDES);
export const roleSchema = z.enum(ROLES);
export const salutationSchema = z.enum(SALUTATIONS);

export type Side = z.infer<typeof sideSchema>;
export type Role = z.infer<typeof roleSchema>;
export type Salutation = z.infer<typeof salutationSchema>;

// Drop control characters (Postgres rejects NUL) but keep newlines and tabs.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const messageSchema = z
  .string()
  .transform((s) => s.replace(CONTROL_CHARS, '').trim())
  .pipe(z.string().max(MESSAGE_MAX_LENGTH));

/** Name a guest types for a placeholder member: one line, no control characters, max 60. */
export const guestNameSchema = z
  .string()
  .transform((s) =>
    s
      .replace(/\p{Cc}/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
  .pipe(z.string().max(GUEST_NAME_MAX_LENGTH));

// ---- POST /api/rsvp ---------------------------------------------------------

export const rsvpResponseItemSchema = z.strictObject({
  guestId: z.uuid(),
  attending: z.boolean(),
  /** Only for placeholder members ("Pratnja", "Dijete"). Omitted = leave unchanged, "" = clear. */
  name: guestNameSchema.optional(),
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
  /** The name is not real yet ("Ljubo +1"): show a label and let the guest type a name. */
  isPlaceholder: z.boolean(),
  nameFromGuest: z.string().nullable(),
});

export const invitationDtoSchema = z.object({
  salutation: salutationSchema,
  displayName: z.string(),
  /** Cosmetic part of the URL; the code alone authorizes. */
  slug: z.string(),
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
