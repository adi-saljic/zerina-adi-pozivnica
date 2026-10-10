import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { codeSchema, invitationDtoSchema, rsvpRequestSchema } from './schemas.js';

const validCode = 'Ab3dEf7hJk';

describe('codeSchema', () => {
  it('accepts 10 base58 characters', () => {
    expect(codeSchema.safeParse(validCode).success).toBe(true);
  });

  it.each([
    '',
    'short',
    'Ab3dEf7hJkX',
    'Ab3dEf7hJ0',
    'Ab3dEf7hJO',
    'Ab3dEf7hJI',
    'Ab3dEf7hJl',
    'Ab3dEf7h-k',
  ])('rejects %j', (value) => {
    expect(codeSchema.safeParse(value).success).toBe(false);
  });
});

describe('rsvpRequestSchema', () => {
  const base = { code: validCode, responses: [{ guestId: randomUUID(), attending: true }] };

  it('accepts a minimal valid request', () => {
    expect(rsvpRequestSchema.safeParse(base).success).toBe(true);
  });

  it('trims the message and accepts 500 characters', () => {
    const parsed = rsvpRequestSchema.parse({ ...base, message: `  ${'a'.repeat(500)}  ` });
    expect(parsed.message).toHaveLength(500);
  });

  it('rejects a message longer than 500 characters', () => {
    expect(rsvpRequestSchema.safeParse({ ...base, message: 'a'.repeat(501) }).success).toBe(false);
  });

  it('strips control characters such as NUL but keeps newlines', () => {
    const parsed = rsvpRequestSchema.parse({ ...base, message: 'hvala\u0000\nvidimo se' });
    expect(parsed.message).toBe('hvala\nvidimo se');
  });

  it('rejects non-boolean attending (null means "not answered" and cannot be saved)', () => {
    const body = { ...base, responses: [{ guestId: randomUUID(), attending: null }] };
    expect(rsvpRequestSchema.safeParse(body).success).toBe(false);
  });

  it('rejects malformed guest ids, empty responses and unknown fields', () => {
    expect(
      rsvpRequestSchema.safeParse({ ...base, responses: [{ guestId: '1', attending: true }] })
        .success,
    ).toBe(false);
    expect(rsvpRequestSchema.safeParse({ ...base, responses: [] }).success).toBe(false);
    expect(rsvpRequestSchema.safeParse({ ...base, admin: true }).success).toBe(false);
    expect(
      rsvpRequestSchema.safeParse({ ...base, responses: [{ ...base.responses[0], extra: 1 }] })
        .success,
    ).toBe(false);
  });
});

describe('invitationDtoSchema', () => {
  it('accepts the API shape', () => {
    const dto = {
      displayName: 'Zoka i Danijela',
      guests: [{ id: randomUUID(), name: 'Zoka', role: 'muz', attending: null }],
      message: null,
      respondedAt: null,
      deadline: '2027-05-15T21:59:59.000Z',
      isClosed: false,
    };
    expect(invitationDtoSchema.safeParse(dto).success).toBe(true);
  });
});
