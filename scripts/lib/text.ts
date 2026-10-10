/** NFC (macOS can produce decomposed č/ć), trimmed, single spaces. */
export function normalizeText(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ');
}

/** For comparing names: normalized and lower-cased. */
export function nameKey(value: string): string {
  return normalizeText(value).toLocaleLowerCase('bs');
}

/** For enum-like values and headers: "Zajednički" -> "zajednicki", "Žena" -> "zena". */
export function asciiKey(value: string): string {
  return normalizeText(value)
    .toLowerCase()
    .replaceAll('đ', 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

const pluralRules = new Intl.PluralRules('bs');

/** Bosnian plural: count(1, ['gost', 'gosta', 'gostiju']) → "1 gost", 2 → "2 gosta", 5 → "5 gostiju". */
export function count(n: number, [one, few, many]: readonly [string, string, string]): string {
  const rule = pluralRules.select(n);
  return `${n} ${rule === 'one' ? one : rule === 'few' ? few : many}`;
}

export const GUESTS = ['gost', 'gosta', 'gostiju'] as const;
export const HOUSEHOLDS = ['domaćinstvo', 'domaćinstva', 'domaćinstava'] as const;
