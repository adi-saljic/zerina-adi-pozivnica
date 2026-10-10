import { isValidCode } from '../../shared/code';

/**
 * Invitation code from `/?g=XXXX` or `/p/XXXX` (the Vercel rewrite keeps the
 * original path in the address bar). Returns null when missing or malformed.
 */
export function getCodeFromUrl(location: Pick<Location, 'pathname' | 'search'>): string | null {
  const fromQuery = new URLSearchParams(location.search).get('g')?.trim();
  const fromPath = /^\/p\/([^/]+)\/?$/.exec(location.pathname)?.[1];
  const code = fromQuery || (fromPath ? decodeURIComponent(fromPath) : null);
  return isValidCode(code) ? code : null;
}
