import { describe, expect, it } from 'vitest';
import { clientIp, ipKey } from './ip.js';

describe('clientIp', () => {
  it('takes the first x-forwarded-for entry', () => {
    const request = new Request('http://x/', {
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' },
    });
    expect(clientIp(request)).toBe('203.0.113.7');
  });

  it('falls back to x-real-ip and then "unknown"', () => {
    expect(clientIp(new Request('http://x/', { headers: { 'x-real-ip': '198.51.100.2' } }))).toBe(
      '198.51.100.2',
    );
    expect(clientIp(new Request('http://x/'))).toBe('unknown');
  });
});

describe('ipKey', () => {
  it('keeps IPv4 addresses (also IPv4-mapped IPv6)', () => {
    expect(ipKey('203.0.113.7')).toBe('203.0.113.7');
    expect(ipKey('::ffff:203.0.113.7')).toBe('203.0.113.7');
  });

  it('groups IPv6 addresses by /64', () => {
    expect(ipKey('2001:db8:abcd:12:1:2:3:4')).toBe('2001:db8:abcd:12::/64');
    expect(ipKey('2001:0db8:abcd:0012:ffff::1')).toBe('2001:db8:abcd:12::/64');
    expect(ipKey('2001:db8::1')).toBe('2001:db8:0:0::/64');
    expect(ipKey('fe80::1%en0')).toBe('fe80:0:0:0::/64');
  });
});
