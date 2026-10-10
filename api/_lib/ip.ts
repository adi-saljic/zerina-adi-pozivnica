/**
 * Client IP as seen by Vercel. Vercel overwrites x-forwarded-for with the real
 * client address, so the first entry can be trusted there. Locally the dev
 * server sets it from the socket.
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip')?.trim() || 'unknown';
}

/**
 * Rate-limit key for an IP: IPv4 as-is, IPv6 reduced to its /64 prefix
 * (one phone or home router usually owns a whole /64).
 */
export function ipKey(ip: string): string {
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapped?.[1]) return mapped[1];
  if (!ip.includes(':')) return ip;

  const address = ip.split('%')[0] ?? ip; // drop zone id (fe80::1%en0)
  let groups: string[];
  if (address.includes('::')) {
    const [head = '', tail = ''] = address.split('::');
    const headGroups = head ? head.split(':') : [];
    const tailGroups = tail ? tail.split(':') : [];
    const zeros = Math.max(8 - headGroups.length - tailGroups.length, 0);
    groups = [...headGroups, ...Array<string>(zeros).fill('0'), ...tailGroups];
  } else {
    groups = address.split(':');
  }
  const prefix = groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '').toLowerCase());
  return `${prefix.join(':')}::/64`;
}
