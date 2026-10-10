import { describe, expect, it } from 'vitest';
import type { CsvGuest, CsvHousehold } from './householdsCsv.js';
import {
  planHasChanges,
  planSeed,
  selectPrunable,
  type DbGuest,
  type DbHousehold,
  type SeedPlan,
} from './seedPlan.js';

let counter = 0;
const newId = () => `new-${++counter}`;

const csvGuest = (name: string, sortOrder: number, extra: Partial<CsvGuest> = {}): CsvGuest => ({
  name,
  role: 'gost',
  isPlaceholder: false,
  tableName: 'Najbliži Adi',
  sortOrder,
  line: sortOrder + 1,
  ...extra,
});

const csvZoka = (overrides: Partial<CsvHousehold> = {}): CsvHousehold => ({
  key: 'Zoka i Danijela',
  displayName: 'Zoka i Danijela',
  salutation: 'Dragi',
  side: 'adi',
  line: 2,
  guests: [
    csvGuest('Zoka', 1),
    csvGuest('Danijela', 2, { role: 'partner' }),
    csvGuest('Zokino dijete 1', 3, { role: 'dijete', isPlaceholder: true }),
  ],
  ...overrides,
});

/**
 * Applies a plan to an in-memory copy of the database, the way seed.ts does in
 * SQL: only the columns the plan carries are written.
 */
function apply(
  db: DbHousehold[],
  plan: SeedPlan,
  codes: Map<string, string> = new Map(),
): DbHousehold[] {
  const next = structuredClone(db);
  for (const h of plan.newHouseholds) {
    const code = `code-${h.id}`;
    codes.set(h.key, code);
    next.push({ ...h, code, opened: false, responded: false, guests: [] });
  }
  for (const u of plan.updatedHouseholds) {
    const h = next.find((x) => x.id === u.id)!;
    Object.assign(h, {
      displayName: u.displayName,
      salutation: u.salutation,
      side: u.side,
      slug: u.slug,
    });
  }
  for (const g of plan.newGuests) {
    const guest: DbGuest = {
      id: g.id,
      name: g.name,
      role: g.role,
      sortOrder: g.sortOrder,
      tableName: g.tableName,
      isPlaceholder: g.isPlaceholder,
      attending: null,
      nameFromGuest: null,
    };
    next.find((h) => h.id === g.invitationId)!.guests.push(guest);
  }
  for (const u of plan.updatedGuests) {
    const guest = next.flatMap((h) => h.guests).find((g) => g.id === u.id)!;
    Object.assign(guest, {
      name: u.name,
      role: u.role,
      tableName: u.tableName,
      isPlaceholder: u.isPlaceholder,
    });
  }
  return next;
}

/** Simulates guests answering on the page (attending + a typed-in name). */
function answer(db: DbHousehold[]): DbHousehold[] {
  const next = structuredClone(db);
  for (const h of next) {
    h.opened = true;
    h.responded = true;
    for (const g of h.guests) {
      g.attending = g.sortOrder !== 2;
      if (g.isPlaceholder) g.nameFromGuest = 'Lana';
    }
  }
  return next;
}

describe('planSeed', () => {
  it('creates households with a slug from display_name', () => {
    const plan = planSeed([csvZoka()], [], newId);
    expect(plan.newHouseholds).toMatchObject([
      { key: 'Zoka i Danijela', slug: 'zoka-i-danijela', salutation: 'Dragi' },
    ]);
    expect(plan.newGuests.map((g) => [g.name, g.isPlaceholder, g.tableName])).toEqual([
      ['Zoka', false, 'Najbliži Adi'],
      ['Danijela', false, 'Najbliži Adi'],
      ['Zokino dijete 1', true, 'Najbliži Adi'],
    ]);
  });

  it('is idempotent: running twice produces no changes', () => {
    const first = apply([], planSeed([csvZoka()], [], newId));
    const second = planSeed([csvZoka()], first, newId);
    expect(planHasChanges(second)).toBe(false);
    expect(second.extraGuests).toEqual([]);
    expect(second.unchangedHouseholds).toEqual(['Zoka i Danijela']);
  });

  it('changing display_name keeps the code and only updates the slug (old links keep working)', () => {
    const codes = new Map<string, string>();
    const db = apply([], planSeed([csvZoka()], [], newId), codes);
    const renamed = planSeed([csvZoka({ displayName: 'Zoran i Danijela' })], db, newId);
    expect(renamed.updatedHouseholds).toMatchObject([
      { slug: 'zoran-i-danijela', displayName: 'Zoran i Danijela' },
    ]);
    expect(renamed.updatedHouseholds[0]?.changes).toEqual([
      'display_name "Zoka i Danijela" → "Zoran i Danijela"',
      'slug "zoka-i-danijela" → "zoran-i-danijela"',
    ]);
    const after = apply(db, renamed);
    expect(after[0]?.code).toBe(codes.get('Zoka i Danijela'));
    expect(after[0]?.slug).toBe('zoran-i-danijela');
  });

  it('never touches answers, typed-in names or codes when the CSV is edited', () => {
    const db = answer(apply([], planSeed([csvZoka()], [], newId)));
    const edited = csvZoka({
      salutation: 'Draga',
      guests: [
        csvGuest('Zoran', 1), // renamed (matched by sort_order → keeps the answer)
        csvGuest('Danijela', 2, { role: 'zena', tableName: 'Sto 5' }),
        csvGuest('Lana', 3, { role: 'dijete', isPlaceholder: false }), // real name now
        csvGuest('Zokino dijete 2', 4, { role: 'dijete', isPlaceholder: true }), // new
      ],
    });
    const plan = planSeed([edited], db, newId);
    const after = apply(db, plan);
    const byOrder = new Map(after[0]!.guests.map((g) => [g.sortOrder, g]));

    expect(after[0]?.code).toBe(db[0]?.code);
    expect(byOrder.get(1)).toMatchObject({ name: 'Zoran', attending: true });
    expect(byOrder.get(2)).toMatchObject({ role: 'zena', tableName: 'Sto 5', attending: false });
    expect(byOrder.get(3)).toMatchObject({
      name: 'Lana',
      isPlaceholder: false,
      attending: true,
      nameFromGuest: 'Lana',
    });
    expect(byOrder.get(4)).toMatchObject({ isPlaceholder: true, attending: null });

    // The plan has no field that could carry these.
    for (const u of [...plan.updatedGuests, ...plan.updatedHouseholds]) {
      for (const field of ['code', 'nameFromGuest', 'message', 'respondedAt', 'openedAt']) {
        expect(Object.keys(u)).not.toContain(field);
      }
      expect(u.changes.join(' ')).not.toMatch(/attending|name_from_guest/);
    }
  });

  it('matches guests by sort_order within a household', () => {
    const db = answer(apply([], planSeed([csvZoka()], [], newId)));
    const plan = planSeed(
      [csvZoka({ guests: [csvGuest('Zoka', 1), csvGuest('Dana', 2, { role: 'partner' })] })],
      db,
      newId,
    );
    expect(plan.updatedGuests).toMatchObject([
      { sortOrder: 2, changes: ['ime "Danijela" → "Dana"'] },
    ]);
    expect(plan.newGuests).toEqual([]);
  });

  it('reports guests and households that disappeared from the CSV without deleting them', () => {
    const db = apply(
      [],
      planSeed([csvZoka(), csvZoka({ key: 'Baka', displayName: 'Baka' })], [], newId),
    );
    const plan = planSeed([csvZoka({ guests: csvZoka().guests.slice(0, 2) })], db, newId);
    expect(plan.extraGuests).toMatchObject([{ name: 'Zokino dijete 1', sortOrder: 3 }]);
    expect(plan.extraHouseholds.map((h) => h.key)).toEqual(['Baka']);
    expect(planHasChanges(plan)).toBe(false);
  });
});

describe('selectPrunable', () => {
  const db = apply(
    [],
    planSeed(
      [
        csvZoka(),
        csvZoka({ key: 'Baka', displayName: 'Baka' }),
        csvZoka({ key: 'Tetak', displayName: 'Tetak' }),
      ],
      [],
      newId,
    ),
  );
  db[0]!.guests[2]!.attending = true; // Zokino dijete 1 answered
  db[2]!.opened = true; // Tetak opened the link
  const plan = planSeed([csvZoka({ guests: csvZoka().guests.slice(0, 2) })], db, newId);

  it('only deletes untouched households and unanswered guests', () => {
    const selection = selectPrunable(plan, false);
    expect(selection.invitationIds).toEqual([db[1]!.id]);
    expect(selection.guestIds).toEqual([]);
    expect(selection.toDelete).toEqual(['domaćinstvo "Baka" (Baka)']);
    expect(selection.protectedItems).toHaveLength(2);
  });

  it('deletes everything extra with --force, marking what was already used', () => {
    const selection = selectPrunable(plan, true);
    expect(selection.invitationIds).toEqual([db[1]!.id, db[2]!.id]);
    expect(selection.guestIds).toEqual([db[0]!.guests[2]!.id]);
    expect(selection.toDelete.filter((t) => t.includes('⚠'))).toHaveLength(2);
    expect(selection.protectedItems).toEqual([]);
  });
});
