import { describe, expect, it } from 'vitest';
import { getCodeFromUrl } from './getCodeFromUrl';

const at = (url: string) => {
  const { pathname, search } = new URL(url, 'https://pozivnica.example');
  return getCodeFromUrl({ pathname, search });
};

describe('getCodeFromUrl', () => {
  it('reads ?g= and the /p/ alias', () => {
    expect(at('/?g=Ab3dEf7hJk')).toBe('Ab3dEf7hJk');
    expect(at('/p/Ab3dEf7hJk')).toBe('Ab3dEf7hJk');
    expect(at('/p/Ab3dEf7hJk/')).toBe('Ab3dEf7hJk');
  });

  it('ignores extra parameters added by messengers (e.g. fbclid)', () => {
    expect(at('/?g=Ab3dEf7hJk&fbclid=IwAR123')).toBe('Ab3dEf7hJk');
  });

  it('returns null for missing or malformed codes', () => {
    expect(at('/')).toBeNull();
    expect(at('/?g=')).toBeNull();
    expect(at('/?g=Ab3dEf7hJ0')).toBeNull();
    expect(at('/p/Ab3dEf7hJk/extra')).toBeNull();
    expect(at('/p/%3Cscript%3E')).toBeNull();
  });
});
