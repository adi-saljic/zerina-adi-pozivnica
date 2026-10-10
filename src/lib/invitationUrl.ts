import { isValidCode } from '../../shared/code';
import { invitationPath } from '../../shared/slug';

type UrlParts = Pick<Location, 'pathname' | 'search'>;

/**
 * Invitation code from any supported URL:
 *   /<slug>-<code>        canonical, e.g. /zoka-i-danijela-k7x2p9Qa3m
 *   /<code>               household whose slug is empty
 *   /?g=<code>, /p/<code> older formats, still supported
 *
 * The code is the last part after the final "-" (base58 has no "-"). The slug
 * is ignored here: it is cosmetic, and only the code identifies the household.
 */
export function getCodeFromLocation(location: UrlParts): string | null {
  const fromQuery = new URLSearchParams(location.search).get('g')?.trim();
  if (fromQuery) return isValidCode(fromQuery) ? fromQuery : null;

  const segment =
    /^\/p\/([^/]+)\/?$/.exec(location.pathname)?.[1] ??
    /^\/([^/]+)\/?$/.exec(location.pathname)?.[1];
  if (!segment) return null;

  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return null;
  }
  const code = decoded.slice(decoded.lastIndexOf('-') + 1);
  return isValidCode(code) ? code : null;
}

/**
 * Replaces the address with the canonical /<slug>-<code>, without a reload or
 * a new history entry. Old links (?g=, /p/, an outdated slug) keep working and
 * end up on the current URL. Returns whether the address changed.
 */
export function canonicalizeUrl(
  location: UrlParts & Pick<Location, 'hash'>,
  history: Pick<History, 'replaceState' | 'state'>,
  slug: string,
  code: string,
): boolean {
  const target = invitationPath(slug, code);
  if (location.pathname === target && location.search === '') return false;
  history.replaceState(history.state, '', `${target}${location.hash}`);
  return true;
}
