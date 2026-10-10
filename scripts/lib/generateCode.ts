import { randomBytes } from 'node:crypto';
import { CODE_ALPHABET, CODE_LENGTH } from '../../shared/code.js';

// 232 = 58 * 4: bytes >= 232 are thrown away so every character is equally likely
// (a plain `byte % 58` would favour the first characters of the alphabet).
const UNBIASED_LIMIT = 256 - (256 % CODE_ALPHABET.length);

/** Random, unguessable invitation code: 10 base58 characters (~58 bits of entropy). */
export function generateCode(length: number = CODE_LENGTH): string {
  let code = '';
  while (code.length < length) {
    for (const byte of randomBytes(length * 2)) {
      if (byte >= UNBIASED_LIMIT) continue;
      code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (code.length === length) break;
    }
  }
  return code;
}

/** Generates a code that is not in `taken` and adds it there. */
export function generateUniqueCode(taken: Set<string>): string {
  for (;;) {
    const code = generateCode();
    if (!taken.has(code)) {
      taken.add(code);
      return code;
    }
  }
}
