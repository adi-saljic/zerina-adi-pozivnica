// Personalized invitation URLs: /<slug>-<code>, e.g. /zoka-i-danijela-k7x2p9Qa3m
//
// The slug is decoration only. Authorization relies solely on the 10-character
// code after the final "-". A link with an outdated slug still works, and the
// app then replaces the address with the canonical one.

const MAX_SLUG_LENGTH = 60;

/** "Šejla i Eldar" -> "sejla-i-eldar", "Anđelija" -> "andjelija", "Čika Pige" -> "cika-pige". */
export function slugify(displayName: string): string {
  return displayName
    .normalize('NFC')
    .toLowerCase()
    .replaceAll('đ', 'dj') // Đ is already lower-cased here
    .replace(/[čć]/g, 'c')
    .replaceAll('š', 's')
    .replaceAll('ž', 'z')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // any other accents (é, ü, ...)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/^-+|-+$/g, '');
}

/** Canonical path of an invitation. Without a slug it is just /<code>. */
export function invitationPath(slug: string, code: string): string {
  return slug ? `/${slug}-${code}` : `/${code}`;
}
