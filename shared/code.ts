// Invitation codes: 10 characters of base58 (Bitcoin alphabet: no 0, O, I, l).
// Generation lives server-side (scripts/lib/generateCode.ts) because it needs crypto.

export const CODE_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export const CODE_LENGTH = 10;
export const CODE_REGEX = /^[1-9A-HJ-NP-Za-km-z]{10}$/;

export function isValidCode(value: unknown): value is string {
  return typeof value === 'string' && CODE_REGEX.test(value);
}
