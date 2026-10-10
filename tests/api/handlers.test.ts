// Handler tests with the database layer mocked: routing, status codes,
// validation and deadline enforcement exactly as Vercel would run them.

import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Household } from '../../api/_lib/repo.js';
import type { InvitationDto } from '../../shared/schemas.js';

const repo = vi.hoisted(() => ({
  openInvitation: vi.fn(),
  findHouseholdByCode: vi.fn(),
  saveRsvp: vi.fn(),
  adminSummary: vi.fn(),
  exportGuests: vi.fn(),
}));
vi.mock('../../api/_lib/repo.js', () => repo);
vi.mock('../../api/_lib/rateLimit.js', () => ({ enforceRateLimit: vi.fn(async () => {}) }));

const { default: invitation } = await import('../../api/invitation.js');
const { default: rsvp } = await import('../../api/rsvp.js');
const { default: summary } = await import('../../api/admin/summary.js');

const CODE = 'Ab3dEf7hJk';
const ids = [randomUUID(), randomUUID()] as const;
// ids[0] is a real guest, ids[1] a placeholder member ("Zoka +1").
const household: Household = {
  id: randomUUID(),
  salutation: 'Dragi',
  displayName: 'Zoka i Danijela',
  slug: 'zoka-i-danijela',
  message: null,
  respondedAt: null,
  guests: [
    {
      id: ids[0],
      name: 'Zoka',
      role: 'muz',
      attending: null,
      isPlaceholder: false,
      nameFromGuest: null,
    },
    {
      id: ids[1],
      name: 'Zoka +1',
      role: 'partner',
      attending: null,
      isPlaceholder: true,
      nameFromGuest: null,
    },
  ],
};

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost:5173/api/rsvp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', host: 'localhost:5173', ...headers },
    body: JSON.stringify(body),
  });

const answers = (attending: [boolean, boolean]) => ({
  code: CODE,
  responses: [
    { guestId: ids[0], attending: attending[0] },
    { guestId: ids[1], attending: attending[1] },
  ],
  message: '  Vidimo se!  ',
});

beforeEach(() => {
  process.env.RSVP_DEADLINE = '2999-01-01T00:00:00+01:00';
  repo.openInvitation.mockResolvedValue(household);
  repo.findHouseholdByCode.mockResolvedValue(household);
  repo.saveRsvp.mockImplementation(async ({ responses, message }) => ({
    ...household,
    message,
    respondedAt: new Date().toISOString(),
    guests: household.guests.map((g) => ({
      ...g,
      attending: responses.find((r: { guestId: string }) => r.guestId === g.id).attending,
    })),
  }));
});

afterEach(() => {
  vi.clearAllMocks();
  process.env.RSVP_DEADLINE = '';
  process.env.ADMIN_TOKEN = '';
  vi.spyOn(console, 'error').mockRestore();
});

describe('GET /api/invitation', () => {
  it('returns only the household fields', async () => {
    const res = await invitation.fetch(new Request(`http://x/api/invitation?code=${CODE}`));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = (await res.json()) as InvitationDto;
    expect(Object.keys(body).sort()).toEqual([
      'deadline',
      'displayName',
      'guests',
      'isClosed',
      'message',
      'respondedAt',
      'salutation',
      'slug',
    ]);
    expect(body).toMatchObject({
      salutation: 'Dragi',
      displayName: 'Zoka i Danijela',
      slug: 'zoka-i-danijela',
      isClosed: false,
    });
    expect(body.guests[1]).toMatchObject({ isPlaceholder: true, nameFromGuest: null });
  });

  it('answers 404 with the same body for malformed and unknown codes', async () => {
    repo.openInvitation.mockResolvedValue(null);
    const unknown = await invitation.fetch(new Request(`http://x/api/invitation?code=${CODE}`));
    const malformed = await invitation.fetch(
      new Request('http://x/api/invitation?code=1%27%20or%201=1'),
    );
    const missing = await invitation.fetch(new Request('http://x/api/invitation'));
    for (const res of [unknown, malformed, missing]) {
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: 'not_found' });
    }
    expect(repo.openInvitation).toHaveBeenCalledTimes(1); // malformed codes never reach the database
  });

  it('rejects other methods', async () => {
    const res = await invitation.fetch(
      new Request('http://x/api/invitation', { method: 'DELETE' }),
    );
    expect(res.status).toBe(405);
  });

  it('hides internal errors behind a generic 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    repo.openInvitation.mockRejectedValue(new Error('connection to ep-secret.neon.tech failed'));
    const res = await invitation.fetch(new Request(`http://x/api/invitation?code=${CODE}`));
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('{"error":"server_error"}');
  });
});

describe('POST /api/rsvp', () => {
  it('saves valid answers and returns the updated household', async () => {
    const res = await rsvp.fetch(post(answers([true, false])));
    expect(res.status).toBe(200);
    const body = (await res.json()) as InvitationDto;
    expect(body.guests.map((g) => g.attending)).toEqual([true, false]);
    expect(repo.saveRsvp).toHaveBeenCalledWith(
      expect.objectContaining({ invitationId: household.id, message: 'Vidimo se!' }),
    );
  });

  it('saves a typed-in name for a placeholder member', async () => {
    const body = answers([true, true]);
    body.responses[1] = { guestId: ids[1], attending: true, name: '  Amra  ' } as never;
    const res = await rsvp.fetch(post(body));
    expect(res.status).toBe(200);
    expect(repo.saveRsvp).toHaveBeenCalledWith(
      expect.objectContaining({
        responses: [
          { guestId: ids[0], attending: true },
          { guestId: ids[1], attending: true, name: 'Amra' },
        ],
      }),
    );
  });

  it('rejects a name for a guest that is not a placeholder', async () => {
    const body = answers([true, true]);
    body.responses[0] = { guestId: ids[0], attending: true, name: 'Neko drugi' } as never;
    const res = await rsvp.fetch(post(body));
    expect(res.status).toBe(400);
    expect(repo.saveRsvp).not.toHaveBeenCalled();
  });

  it('rejects an over-long name', async () => {
    const body = answers([true, true]);
    body.responses[1] = { guestId: ids[1], attending: true, name: 'x'.repeat(61) } as never;
    const res = await rsvp.fetch(post(body));
    expect(res.status).toBe(400);
    expect(repo.saveRsvp).not.toHaveBeenCalled();
  });

  it('rejects a guest id from another household', async () => {
    const body = answers([true, true]);
    body.responses[1]!.guestId = randomUUID();
    const res = await rsvp.fetch(post(body));
    expect(res.status).toBe(400);
    expect(repo.saveRsvp).not.toHaveBeenCalled();
  });

  it('rejects when a guest is missing', async () => {
    const body = { ...answers([true, true]), responses: [{ guestId: ids[0], attending: true }] };
    const res = await rsvp.fetch(post(body));
    expect(res.status).toBe(400);
    expect(repo.saveRsvp).not.toHaveBeenCalled();
  });

  it('enforces the deadline on the server', async () => {
    process.env.RSVP_DEADLINE = '2020-01-01T00:00:00+01:00';
    const res = await rsvp.fetch(post(answers([true, true])));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'closed' });
    expect(repo.saveRsvp).not.toHaveBeenCalled();
  });

  it('refuses a deadline without timezone offset instead of guessing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    process.env.RSVP_DEADLINE = '2999-01-01T00:00:00';
    const res = await rsvp.fetch(post(answers([true, true])));
    expect(res.status).toBe(500);
  });

  it('returns 404 for unknown and malformed codes', async () => {
    repo.findHouseholdByCode.mockResolvedValue(null);
    expect((await rsvp.fetch(post(answers([true, true])))).status).toBe(404);
    expect((await rsvp.fetch(post({ ...answers([true, true]), code: 'nope' }))).status).toBe(404);
  });

  it('rejects cross-site requests, wrong content type and invalid JSON', async () => {
    expect(
      (await rsvp.fetch(post(answers([true, true]), { origin: 'https://evil.example' }))).status,
    ).toBe(403);
    expect(
      (await rsvp.fetch(post(answers([true, true]), { 'sec-fetch-site': 'cross-site' }))).status,
    ).toBe(403);
    expect(
      (await rsvp.fetch(post(answers([true, true]), { 'content-type': 'text/plain' }))).status,
    ).toBe(415);
    const broken = new Request('http://localhost:5173/api/rsvp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    expect((await rsvp.fetch(broken)).status).toBe(400);
  });

  it('accepts same-origin browser requests', async () => {
    const res = await rsvp.fetch(
      post(answers([true, true]), {
        origin: 'http://localhost:5173',
        'sec-fetch-site': 'same-origin',
      }),
    );
    expect(res.status).toBe(200);
  });

  it('rejects oversized bodies', async () => {
    const res = await rsvp.fetch(post({ ...answers([true, true]), message: 'x'.repeat(20_000) }));
    expect(res.status).toBe(413);
  });
});

describe('GET /api/admin/summary', () => {
  it('requires the admin token', async () => {
    process.env.ADMIN_TOKEN = 'a'.repeat(40);
    repo.adminSummary.mockResolvedValue({ totals: {} });
    const noToken = await summary.fetch(new Request('http://x/api/admin/summary'));
    const ok = await summary.fetch(
      new Request('http://x/api/admin/summary', {
        headers: { authorization: `Bearer ${'a'.repeat(40)}` },
      }),
    );
    expect(noToken.status).toBe(401);
    expect(ok.status).toBe(200);
  });
});
