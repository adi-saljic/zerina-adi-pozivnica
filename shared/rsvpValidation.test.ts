import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isRsvpClosed, validateRsvp } from './rsvpValidation.js';

const deadline = new Date('2027-05-15T23:59:59+02:00');
const before = new Date('2027-05-15T21:00:00Z'); // 23:00 in Sarajevo
const after = new Date('2027-05-15T22:00:01Z'); // 00:00:01 next day in Sarajevo

const [a, b, c] = [randomUUID(), randomUUID(), randomUUID()];
// a = real guest, b = placeholder member ("Ljubo +1")
const household = [
  { id: a, isPlaceholder: false },
  { id: b, isPlaceholder: true },
];
const both = [
  { guestId: a, attending: true },
  { guestId: b, attending: true },
];

const check = (responses: Parameters<typeof validateRsvp>[0]['responses'], now = before) =>
  validateRsvp({ householdGuests: household, responses, deadline, now });

describe('validateRsvp', () => {
  it('accepts answers for exactly the household guests', () => {
    expect(
      check([
        { guestId: b, attending: false },
        { guestId: a, attending: true },
      ]),
    ).toEqual({ ok: true });
  });

  it('rejects an unknown code', () => {
    expect(validateRsvp({ householdGuests: null, responses: [], deadline, now: before })).toEqual({
      ok: false,
      error: 'not_found',
    });
  });

  it('rejects a guestId from another household', () => {
    expect(check([...both, { guestId: c, attending: true }])).toEqual({
      ok: false,
      error: 'unknown_guest',
      guestIds: [c],
    });
  });

  it('rejects a foreign guestId even when the count matches', () => {
    expect(check([both[0]!, { guestId: c, attending: true }])).toMatchObject({
      ok: false,
      error: 'unknown_guest',
    });
  });

  it('rejects when a guest is missing', () => {
    expect(check([both[0]!])).toEqual({ ok: false, error: 'missing_guest', guestIds: [b] });
  });

  it('rejects duplicate answers for one guest', () => {
    expect(check([...both, { guestId: a, attending: false }])).toEqual({
      ok: false,
      error: 'duplicate_guest',
      guestIds: [a],
    });
  });

  it('enforces the deadline (in Sarajevo time, via the offset)', () => {
    expect(check(both, after)).toEqual({ ok: false, error: 'closed' });
    expect(check(both, deadline)).toEqual({ ok: true });
  });

  it('accepts a typed-in name only for placeholder members', () => {
    expect(check([both[0]!, { guestId: b, attending: true, name: 'Amra' }])).toEqual({ ok: true });
    expect(check([both[0]!, { guestId: b, attending: true, name: '' }])).toEqual({ ok: true });
    expect(check([{ guestId: a, attending: true, name: 'Hacker' }, both[1]!])).toEqual({
      ok: false,
      error: 'name_not_allowed',
      guestIds: [a],
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
