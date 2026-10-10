import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isRsvpClosed, validateRsvp } from './rsvpValidation.js';

const deadline = new Date('2027-05-15T23:59:59+02:00');
const before = new Date('2027-05-15T21:00:00Z'); // 23:00 in Sarajevo
const after = new Date('2027-05-15T22:00:01Z'); // 00:00:01 next day in Sarajevo

const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()];
const household = [a, b];

describe('validateRsvp', () => {
  it('accepts answers for exactly the household guests', () => {
    const result = validateRsvp({
      householdGuestIds: household,
      responses: [
        { guestId: b, attending: false },
        { guestId: a, attending: true },
      ],
      deadline,
      now: before,
    });
    expect(result).toEqual({ ok: true });
  });

  it('rejects an unknown code', () => {
    const result = validateRsvp({ householdGuestIds: null, responses: [], deadline, now: before });
    expect(result).toEqual({ ok: false, error: 'not_found' });
  });

  it('rejects a guestId from another household', () => {
    const result = validateRsvp({
      householdGuestIds: household,
      responses: [
        { guestId: a, attending: true },
        { guestId: b, attending: true },
        { guestId: c, attending: true },
      ],
      deadline,
      now: before,
    });
    expect(result).toEqual({ ok: false, error: 'unknown_guest', guestIds: [c] });
  });

  it('rejects a foreign guestId even when the count matches', () => {
    const result = validateRsvp({
      householdGuestIds: household,
      responses: [
        { guestId: a, attending: true },
        { guestId: c, attending: true },
      ],
      deadline,
      now: before,
    });
    expect(result).toMatchObject({ ok: false, error: 'unknown_guest' });
  });

  it('rejects when a guest is missing', () => {
    const result = validateRsvp({
      householdGuestIds: household,
      responses: [{ guestId: a, attending: true }],
      deadline,
      now: before,
    });
    expect(result).toEqual({ ok: false, error: 'missing_guest', guestIds: [b] });
  });

  it('rejects duplicate answers for one guest', () => {
    const result = validateRsvp({
      householdGuestIds: household,
      responses: [
        { guestId: a, attending: true },
        { guestId: a, attending: false },
        { guestId: b, attending: true },
      ],
      deadline,
      now: before,
    });
    expect(result).toEqual({ ok: false, error: 'duplicate_guest', guestIds: [a] });
  });

  it('enforces the deadline (in Sarajevo time, via the offset)', () => {
    const responses = [
      { guestId: a, attending: true },
      { guestId: b, attending: true },
    ];
    expect(validateRsvp({ householdGuestIds: household, responses, deadline, now: after })).toEqual(
      {
        ok: false,
        error: 'closed',
      },
    );
    expect(
      validateRsvp({ householdGuestIds: household, responses, deadline, now: deadline }),
    ).toEqual({
      ok: true,
    });
  });
});

describe('isRsvpClosed', () => {
  it('is open until and including the deadline instant', () => {
    expect(isRsvpClosed(deadline, before)).toBe(false);
    expect(isRsvpClosed(deadline, deadline)).toBe(false);
    expect(isRsvpClosed(deadline, after)).toBe(true);
  });
});
