import { describe, expect, it } from 'vitest';
import { daysUntil, formatDateTime } from './format';

describe('formatDateTime', () => {
  it('formats in Sarajevo time with Bosnian month names', () => {
    expect(formatDateTime('2027-05-15T21:59:59.000Z')).toBe('15. maj 2027. u 23:59'); // summer, UTC+2
    expect(formatDateTime('2027-01-01T08:05:00.000Z')).toBe('1. januar 2027. u 09:05'); // winter, UTC+1
    expect(formatDateTime('2026-12-31T23:30:00.000Z')).toBe('1. januar 2027. u 00:30'); // crosses midnight
  });
});

describe('daysUntil', () => {
  it('counts calendar days in Sarajevo, never below zero', () => {
    expect(daysUntil('2027-05-22', new Date('2027-05-21T10:00:00Z'))).toBe(1);
    expect(daysUntil('2027-05-22', new Date('2027-05-21T22:30:00Z'))).toBe(0); // already 22nd in Sarajevo
    expect(daysUntil('2027-05-22', new Date('2026-10-11T08:00:00Z'))).toBe(223);
    expect(daysUntil('2027-05-22', new Date('2027-06-01T08:00:00Z'))).toBe(0);
  });
});
