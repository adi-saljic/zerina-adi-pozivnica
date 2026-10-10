import { afterEach, describe, expect, it } from 'vitest';
import { bearerToken, requireAdmin, tokensMatch } from './auth.js';
import { HttpError } from './http.js';

const TOKEN = 'x'.repeat(40);

const withAuth = (value?: string) =>
  new Request('http://x/api/admin/summary', value ? { headers: { authorization: value } } : {});

function statusOf(fn: () => void): number | 'ok' {
  try {
    fn();
    return 'ok';
  } catch (error) {
    if (error instanceof HttpError) return error.status;
    throw error;
  }
}

afterEach(() => {
  process.env.ADMIN_TOKEN = '';
});

describe('tokensMatch', () => {
  it('compares tokens of any length safely', () => {
    expect(tokensMatch(TOKEN, TOKEN)).toBe(true);
    expect(tokensMatch('short', TOKEN)).toBe(false);
    expect(tokensMatch('', TOKEN)).toBe(false);
  });
});

describe('bearerToken', () => {
  it('reads the token from the Authorization header', () => {
    expect(bearerToken(withAuth(`Bearer ${TOKEN}`))).toBe(TOKEN);
    expect(bearerToken(withAuth(`bearer   ${TOKEN}  `))).toBe(TOKEN);
    expect(bearerToken(withAuth(`Basic ${TOKEN}`))).toBe('');
    expect(bearerToken(withAuth())).toBe('');
  });
});

describe('requireAdmin', () => {
  it('accepts the right token and rejects others with 401', () => {
    process.env.ADMIN_TOKEN = TOKEN;
    expect(statusOf(() => requireAdmin(withAuth(`Bearer ${TOKEN}`)))).toBe('ok');
    expect(statusOf(() => requireAdmin(withAuth('Bearer wrong')))).toBe(401);
    expect(statusOf(() => requireAdmin(withAuth()))).toBe(401);
  });

  it('keeps admin closed (404) when no token or a too short token is configured', () => {
    process.env.ADMIN_TOKEN = '';
    expect(statusOf(() => requireAdmin(withAuth('Bearer ')))).toBe(404);
    process.env.ADMIN_TOKEN = 'too-short';
    expect(statusOf(() => requireAdmin(withAuth('Bearer too-short')))).toBe(404);
  });
});
