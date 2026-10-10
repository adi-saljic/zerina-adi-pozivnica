import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, CODE_LENGTH, isValidCode } from '../../shared/code.js';
import { generateCode, generateUniqueCode } from './generateCode.js';

describe('generateCode', () => {
  it('uses the base58 alphabet without 0, O, I, l', () => {
    expect(CODE_ALPHABET).toHaveLength(58);
    for (const ch of '0OIl') expect(CODE_ALPHABET).not.toContain(ch);
  });

  it('produces 10 characters from the alphabet, always valid', () => {
    for (let i = 0; i < 2_000; i++) {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(isValidCode(code)).toBe(true);
      for (const ch of code) expect(CODE_ALPHABET).toContain(ch);
    }
  });

  it('does not repeat over 100k runs', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 100_000; i++) seen.add(generateCode());
    expect(seen.size).toBe(100_000);
  });

  it('uses every character with roughly equal frequency (no modulo bias)', () => {
    const counts = new Map<string, number>();
    const runs = 20_000;
    for (let i = 0; i < runs; i++) {
      for (const ch of generateCode()) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    const expected = (runs * CODE_LENGTH) / CODE_ALPHABET.length; // ~3448
    expect(counts.size).toBe(58);
    for (const n of counts.values()) {
      expect(n).toBeGreaterThan(expected * 0.85);
      expect(n).toBeLessThan(expected * 1.15);
    }
  });
});

describe('generateUniqueCode', () => {
  it('never returns a code that is already taken', () => {
    const taken = new Set(['Ab3dEf7hJk']);
    const code = generateUniqueCode(taken);
    expect(code).not.toBe('Ab3dEf7hJk');
    expect(taken.has(code)).toBe(true);
  });
});
