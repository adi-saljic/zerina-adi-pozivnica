import { describe, expect, it } from 'vitest';
import type { CsvHousehold } from './householdsCsv.js';
import {
  planHasChanges,
  planSeed,
  selectPrunable,
  type DbHousehold,
  type SeedPlan,
} from './seedPlan.js';

let counter = 0;
const newId = () => `new-${++counter}`;

const csvCouple = (): CsvHousehold => ({
  key: 'H001',
  displayName: 'Marko i Ana',
  side: 'adi',
  tableName: 'Sto 1',
  line: 2,
  guests: [
    { name: 'Marko Marković', role: 'muz', sortOrder: 1, line: 2 },
    { name: 'Ana Marković', role: 'zena', sortOrder: 2, line: 3 },
  ],
});

const dbCouple = (overrides: Partial<DbHousehold> = {}): DbHousehold => ({
  id: 'inv-1',
  key: 'H001',
  code: 'Ab3dEf7hJk',
  displayName: 'Marko i Ana',
  side: 'adi',
  tableName: 'Sto 1',
  opened: true,
  responded: true,
  guests: [
    { id: 'g-1', name: 'Marko Marković', role: 'muz', sortOrder: 1, attending: true },
    { id: 'g-2', name: 'Ana Marković', role: 'zena', sortOrder: 2, attending: false },
  ],
  ...overrides,
});

/** Applies a plan to an in-memory copy of the database, the way seed.ts does in SQL. */
function apply(db: DbHousehold[], plan: SeedPlan): DbHousehold[] {
  const next = structuredClone(db);
  for (const h of plan.newHouseholds) {
    next.push({ ...h, code: `code-${h.id}`, opened: false, responded: false, guests: [] });
  }
  for (const u of plan.updatedHouseholds) {
    Object.assign(
      next.find((h) => h.id === u.id)!,
      {
        displayName: u.displayName,
        side: u.side,
        tableName: u.tableName,
      },
    );
  }
  for (const g of plan.newGuests) {
    next
      .find((h) => h.id === g.invitationId)!
      .guests.push({
        id: g.id,
        name: g.name,
        role: g.role,
        sortOrder: g.sortOrder,
        attending: null,
      });
  }
  for (const u of plan.updatedGuests) {
    const guest = next.flatMap((h) => h.guests).find((g) => g.id === u.id)!;
    Object.assign(guest, { name: u.name, role: u.role, sortOrder: u.sortOrder });
  }
  return next;
}

describe('planSeed', () => {
  it('creates households and guests on an empty database', () => {
    const plan = planSeed([csvCouple()], [], newId);
    expect(plan.newHouseholds).toHaveLength(1);
    expect(plan.newGuests.map((g) => g.name)).toEqual(['Marko Marković', 'Ana Marković']);
    expect(plan.newGuests.every((g) => g.invitationId === plan.newHouseholds[0]?.id)).toBe(true);
  });

  it('is idempotent: re-running with the same CSV changes nothing', () => {
    const first = apply([], planSeed([csvCouple()], [], newId));
    const second = planSeed([csvCouple()], first, newId);
    expect(planHasChanges(second)).toBe(false);
    expect(second.unchangedHouseholds).toEqual(['H001']);
  });

  it('never wipes answers or codes when the CSV is edited', () => {
    const edited: CsvHousehold = {
      ...csvCouple(),
      displayName: 'Marko i Ana Marković',
      tableName: 'Sto 5',
      guests: [
        { name: 'Marko Markovic', role: 'muz', sortOrder: 1, line: 2 }, // typo fix → matched by position
        { name: 'Ana Marković', role: 'partner', sortOrder: 3, line: 3 }, // role and order change
        { name: 'Luka Marković', role: 'dijete', sortOrder: 4, line: 4 }, // new
      ],
    };
    const before = [dbCouple()];
    const plan = planSeed([edited], before, newId);
    const after = apply(before, plan);

    const household = after[0]!;
    expect(household.code).toBe('Ab3dEf7hJk');
    expect(household.tableName).toBe('Sto 5');
    expect(household.guests.find((g) => g.id === 'g-1')).toMatchObject({
      name: 'Marko Markovic',
      attending: true,
    });
    expect(household.guests.find((g) => g.id === 'g-2')).toMatchObject({
      role: 'partner',
      attending: false,
    });
    expect(household.guests.find((g) => g.name === 'Luka Marković')?.attending).toBeNull();
    expect(plan.updatedGuests.find((g) => g.id === 'g-1')).toMatchObject({
      renamed: true,
      attending: true,
    });

    // The plan has no way to express a change of code or attending.
    for (const u of [...plan.updatedGuests, ...plan.updatedHouseholds]) {
      expect(Object.keys(u)).not.toContain('code');
      expect(u.changes.join(' ')).not.toMatch(/attending/);
    }
  });

  it('matches by name before position, so reordering keeps answers with the right person', () => {
    const swapped: CsvHousehold = {
      ...csvCouple(),
      guests: [
        { name: 'Ana Marković', role: 'zena', sortOrder: 1, line: 2 },
        { name: 'Marko Marković', role: 'muz', sortOrder: 2, line: 3 },
      ],
    };
    const after = apply([dbCouple()], planSeed([swapped], [dbCouple()], newId));
    expect(after[0]!.guests.find((g) => g.name === 'Marko Marković')?.attending).toBe(true);
    expect(after[0]!.guests.find((g) => g.name === 'Ana Marković')?.attending).toBe(false);
  });

  it('reports rows that disappeared from the CSV without deleting them', () => {
    const onlyMarko: CsvHousehold = { ...csvCouple(), guests: [csvCouple().guests[0]!] };
    const other = dbCouple({
      id: 'inv-2',
      key: 'H009',
      code: 'Zz3dEf7hJk',
      opened: false,
      responded: false,
    });
    const plan = planSeed([onlyMarko], [dbCouple(), other], newId);
    expect(plan.extraGuests).toEqual([
      { id: 'g-2', householdKey: 'H001', name: 'Ana Marković', attending: false },
    ]);
    expect(plan.extraHouseholds.map((h) => h.key)).toEqual(['H009']);
    expect(planHasChanges(plan)).toBe(false);
  });
});

describe('selectPrunable', () => {
  const plan = planSeed(
    [{ ...csvCouple(), guests: [] }],
    [
      dbCouple({
        guests: [
          ...dbCouple().guests,
          { id: 'g-3', name: 'X', role: 'gost', sortOrder: 9, attending: null },
        ],
      }),
      dbCouple({ id: 'inv-2', key: 'H002', code: 'Zz3dEf7hJk', opened: false, responded: false }),
      dbCouple({ id: 'inv-3', key: 'H003', code: 'Yy3dEf7hJk', opened: true, responded: false }),
    ],
    newId,
  );

  it('only deletes untouched households and unanswered guests', () => {
    const selection = selectPrunable(plan, false);
    expect(selection.invitationIds).toEqual(['inv-2']);
    expect(selection.guestIds).toEqual(['g-3']);
    expect(selection.protectedItems).toHaveLength(3); // H003 opened, g-1 and g-2 answered
  });

  it('deletes everything extra with --force', () => {
    const selection = selectPrunable(plan, true);
    expect(selection.invitationIds).toEqual(['inv-2', 'inv-3']);
    expect(selection.guestIds.sort()).toEqual(['g-1', 'g-2', 'g-3']);
    expect(selection.protectedItems).toEqual([]);
  });
});
