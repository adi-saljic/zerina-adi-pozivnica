import { describe, expect, it } from 'vitest';
import { canonicalizeUrl, getCodeFromLocation } from './invitationUrl';

const CODE = 'k7x2p9Qa3m';

const at = (url: string) => {
  const { pathname, search } = new URL(url, 'https://zerinaiadi.example');
  return getCodeFromLocation({ pathname, search });
};

describe('getCodeFromLocation', () => {
  it('reads the code from /<slug>-<code>', () => {
    expect(at(`/zoka-i-danijela-${CODE}`)).toBe(CODE);
    expect(at(`/zoka-i-danijela-${CODE}/`)).toBe(CODE);
  });

  it('works with slugs that contain dashes and digits', () => {
    expect(at(`/mama-i-tata-2-${CODE}`)).toBe(CODE);
    expect(at(`/zokino-dijete-1-i-2-${CODE}`)).toBe(CODE);
    expect(at(`/2027-${CODE}`)).toBe(CODE);
  });

  it('ignores the slug: a wrong or outdated slug still resolves', () => {
    expect(at(`/stari-naziv-${CODE}`)).toBe(CODE);
    expect(at(`/${CODE}`)).toBe(CODE);
  });

  it('still supports the old ?g= and /p/ formats', () => {
    expect(at(`/?g=${CODE}`)).toBe(CODE);
    expect(at(`/?g=${CODE}&fbclid=IwAR123`)).toBe(CODE);
    expect(at(`/p/${CODE}`)).toBe(CODE);
  });

  it('returns null for anything without a valid code', () => {
    expect(at('/')).toBeNull();
    expect(at('/zoka-i-danijela')).toBeNull(); // last part is not a code
    expect(at(`/zoka-i-danijela-${CODE}x`)).toBeNull(); // 11 characters
    expect(at('/zoka-i-danijela-k7x2p9Qa30')).toBeNull(); // 0 is not base58
    expect(at(`/a/zoka-${CODE}`)).toBeNull(); // nested path
    expect(at('/?g=')).toBeNull();
    expect(at('/%E0%A4%A')).toBeNull(); // malformed escape
  });
});

describe('canonicalizeUrl', () => {
  function run(url: string, slug = 'zoka-i-danijela') {
    const { pathname, search, hash } = new URL(url, 'https://zerinaiadi.example');
    const calls: string[] = [];
    const changed = canonicalizeUrl(
      { pathname, search, hash },
      { state: null, replaceState: (_s, _t, u) => calls.push(String(u)) },
      slug,
      CODE,
    );
    return { changed, calls };
  }

  it('leaves the canonical URL alone', () => {
    expect(run(`/zoka-i-danijela-${CODE}`)).toEqual({ changed: false, calls: [] });
  });

  it('replaces a wrong slug, old formats and extra parameters with the canonical URL', () => {
    const canonical = `/zoka-i-danijela-${CODE}`;
    expect(run(`/stari-naziv-${CODE}`).calls).toEqual([canonical]);
    expect(run(`/?g=${CODE}`).calls).toEqual([canonical]);
    expect(run(`/p/${CODE}`).calls).toEqual([canonical]);
    expect(run(`/zoka-i-danijela-${CODE}?fbclid=1`).calls).toEqual([canonical]);
  });

  it('uses /<code> when the household has no slug', () => {
    expect(run(`/whatever-${CODE}`, '').calls).toEqual([`/${CODE}`]);
  });
});
