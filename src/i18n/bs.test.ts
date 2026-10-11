import { describe, expect, it } from 'vitest';
import { bs } from './bs';

describe('bs texts', () => {
  it('uses the right Bosnian plural for the countdown', () => {
    expect(bs.invitation.countdown(1)).toBe('Do vjenčanja još 1 dan');
    expect(bs.invitation.countdown(21)).toBe('Do vjenčanja još 21 dan');
    expect(bs.invitation.countdown(11)).toBe('Do vjenčanja još 11 dana');
    expect(bs.invitation.countdown(223)).toBe('Do vjenčanja još 223 dana');
  });

  it('always names Zerina first', () => {
    const all = JSON.stringify(bs) + bs.og.title + bs.whatsapp.invite({ salutation: 'Dragi', displayName: 'X', url: 'u' });
    expect(all).not.toMatch(/Adi (i|&|&amp;) Zerin/);
    expect(all).not.toMatch(/Adiju ili Zerini/);
    expect(bs.og.title.startsWith('Zerina & Adi')).toBe(true);
  });
});
