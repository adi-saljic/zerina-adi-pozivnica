import { describe, expect, it } from 'vitest';
import { formatDateTime } from './format';

describe('formatDateTime', () => {
  it('formats in Sarajevo time with Bosnian month names', () => {
    expect(formatDateTime('2027-05-15T21:59:59.000Z')).toBe('15. maj 2027. u 23:59'); // summer, UTC+2
    expect(formatDateTime('2027-01-01T08:05:00.000Z')).toBe('1. januar 2027. u 09:05'); // winter, UTC+1
    expect(formatDateTime('2026-12-31T23:30:00.000Z')).toBe('1. januar 2027. u 00:30'); // crosses midnight
  });
});
