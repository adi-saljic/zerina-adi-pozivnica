import { describe, expect, it } from 'vitest';
import { guestDisplayName } from './guestName';

describe('guestDisplayName', () => {
  it('shows real guests by name', () => {
    expect(
      guestDisplayName({ name: 'Zoka', role: 'gost', isPlaceholder: false, nameFromGuest: null }),
    ).toBe('Zoka');
  });

  it('never shows the placeholder text, but a label or the typed-in name', () => {
    const plusOne = {
      name: 'Ljubo +1',
      role: 'partner',
      isPlaceholder: true,
      nameFromGuest: null,
    } as const;
    expect(guestDisplayName(plusOne)).toBe('Pratnja');
    expect(guestDisplayName({ ...plusOne, role: 'dijete', name: 'Zokino dijete 1' })).toBe(
      'Dijete',
    );
    expect(guestDisplayName({ ...plusOne, nameFromGuest: 'Amra' })).toBe('Amra');
  });
});
