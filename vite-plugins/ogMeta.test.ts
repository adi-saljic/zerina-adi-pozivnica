import { describe, expect, it } from 'vitest';
import { resolveBaseUrl } from './ogMeta.js';

describe('resolveBaseUrl', () => {
  it('prefers PUBLIC_BASE_URL and strips trailing slashes', () => {
    expect(
      resolveBaseUrl({
        PUBLIC_BASE_URL: 'https://pozivnica.example/',
        VERCEL_PROJECT_PRODUCTION_URL: 'x.vercel.app',
      }),
    ).toBe('https://pozivnica.example');
  });

  it('falls back to the Vercel production domain', () => {
    expect(resolveBaseUrl({ VERCEL_PROJECT_PRODUCTION_URL: 'zerina-adi.vercel.app' })).toBe(
      'https://zerina-adi.vercel.app',
    );
  });

  it('returns null when nothing is configured', () => {
    expect(resolveBaseUrl({})).toBeNull();
  });
});
