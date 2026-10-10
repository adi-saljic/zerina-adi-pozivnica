import { describe, expect, it } from 'vitest';
import { invitationPath, slugify } from './slug.js';

describe('slugify', () => {
  it.each([
    ['Šejla i Eldar', 'sejla-i-eldar'],
    ['Anđelija', 'andjelija'],
    ['Čika Pige', 'cika-pige'],
    ['Ćata i Lejla', 'cata-i-lejla'],
    ['Žuti i Dženita', 'zuti-i-dzenita'],
    ['ĐURO ŠĆEPANOVIĆ', 'djuro-scepanovic'],
    ['Zoka i Danijela', 'zoka-i-danijela'],
    ['Mama i tata', 'mama-i-tata'],
    ['Pratnja – Keno', 'pratnja-keno'],
    ['  Tetka   Zuhra  ', 'tetka-zuhra'],
    ['Mina & Ena (2)', 'mina-ena-2'],
    ['Renée Müller', 'renee-muller'],
  ])('%j → %j', (input, slug) => {
    expect(slugify(input)).toBe(slug);
  });

  it('handles decomposed (NFD) input from macOS the same way', () => {
    expect(slugify('Šejla i Eldar'.normalize('NFD'))).toBe('sejla-i-eldar');
  });

  it('only ever produces a-z, 0-9 and single dashes', () => {
    for (const name of ['!!!', '—', 'A--B', 'x'.repeat(200), 'Ćć Đđ Šš Žž Čč']) {
      const slug = slugify(name);
      expect(slug).toMatch(/^([a-z0-9]+(-[a-z0-9]+)*)?$/);
      expect(slug.length).toBeLessThanOrEqual(60);
    }
  });
});

describe('invitationPath', () => {
  it('joins slug and code with a dash, or uses the code alone', () => {
    expect(invitationPath('zoka-i-danijela', 'k7x2p9Qa3m')).toBe('/zoka-i-danijela-k7x2p9Qa3m');
    expect(invitationPath('', 'k7x2p9Qa3m')).toBe('/k7x2p9Qa3m');
  });
});
