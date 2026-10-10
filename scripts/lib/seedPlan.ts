// Pure diff between the CSV and the database. The seed script prints and
// applies this plan; tests check it directly.
//
// Guarantees (by construction, the plan has no field for them):
// - existing invitation codes are never changed;
// - existing `attending` answers are never changed;
// - nothing is deleted unless pruning is explicitly requested (selectPrunable).

import type { Role, Side } from '../../shared/schemas.js';
import type { CsvHousehold } from './householdsCsv.js';
import { nameKey } from './text.js';

export interface DbGuest {
  id: string;
  name: string;
  role: Role;
  sortOrder: number;
  attending: boolean | null;
}

export interface DbHousehold {
  id: string;
  key: string;
  code: string;
  displayName: string;
  side: Side;
  tableName: string | null;
  opened: boolean;
  responded: boolean;
  guests: DbGuest[];
}

export interface NewGuest {
  id: string;
  invitationId: string;
  householdKey: string;
  name: string;
  role: Role;
  sortOrder: number;
}

export interface SeedPlan {
  newHouseholds: {
    id: string;
    key: string;
    displayName: string;
    side: Side;
    tableName: string | null;
  }[];
  updatedHouseholds: {
    id: string;
    key: string;
    displayName: string;
    side: Side;
    tableName: string | null;
    changes: string[];
  }[];
  /** Guests of new households and guests added to existing ones. */
  newGuests: NewGuest[];
  updatedGuests: {
    id: string;
    householdKey: string;
    name: string;
    role: Role;
    sortOrder: number;
    changes: string[];
    /** Matched by position after a rename: the existing answer stays with this guest. */
    renamed: boolean;
    attending: boolean | null;
  }[];
  unchangedHouseholds: string[];
  /** In the database but no longer in the CSV. */
  extraHouseholds: {
    id: string;
    key: string;
    displayName: string;
    opened: boolean;
    responded: boolean;
  }[];
  extraGuests: { id: string; householdKey: string; name: string; attending: boolean | null }[];
}

const show = (v: string | number | null) => (v === null ? '—' : `"${v}"`);

export function planSeed(
  csv: readonly CsvHousehold[],
  database: readonly DbHousehold[],
  newId: () => string,
): SeedPlan {
  const plan: SeedPlan = {
    newHouseholds: [],
    updatedHouseholds: [],
    newGuests: [],
    updatedGuests: [],
    unchangedHouseholds: [],
    extraHouseholds: [],
    extraGuests: [],
  };
  const dbByKey = new Map(database.map((h) => [h.key, h]));
  const csvKeys = new Set(csv.map((h) => h.key));

  for (const row of csv) {
    const existing = dbByKey.get(row.key);

    if (!existing) {
      const id = newId();
      plan.newHouseholds.push({
        id,
        key: row.key,
        displayName: row.displayName,
        side: row.side,
        tableName: row.tableName,
      });
      for (const g of row.guests) {
        plan.newGuests.push({
          id: newId(),
          invitationId: id,
          householdKey: row.key,
          name: g.name,
          role: g.role,
          sortOrder: g.sortOrder,
        });
      }
      continue;
    }

    let changed = false;
    const householdChanges: string[] = [];
    if (existing.displayName !== row.displayName) {
      householdChanges.push(
        `display_name ${show(existing.displayName)} → ${show(row.displayName)}`,
      );
    }
    if (existing.side !== row.side)
      householdChanges.push(`side ${show(existing.side)} → ${show(row.side)}`);
    if (existing.tableName !== row.tableName) {
      householdChanges.push(`table_name ${show(existing.tableName)} → ${show(row.tableName)}`);
    }
    if (householdChanges.length > 0) {
      changed = true;
      plan.updatedHouseholds.push({
        id: existing.id,
        key: row.key,
        displayName: row.displayName,
        side: row.side,
        tableName: row.tableName,
        changes: householdChanges,
      });
    }

    // Match guests: 1) same name, 2) same sort_order (a corrected typo keeps its answer).
    const remaining = [...existing.guests];
    const take = (predicate: (g: DbGuest) => boolean): DbGuest | undefined => {
      const index = remaining.findIndex(predicate);
      return index >= 0 ? remaining.splice(index, 1)[0] : undefined;
    };
    const byName = row.guests.map((g) => ({
      csv: g,
      db: take((d) => nameKey(d.name) === nameKey(g.name)),
    }));
    const matches = byName.map((m) =>
      m.db
        ? { ...m, renamed: false }
        : { csv: m.csv, db: take((d) => d.sortOrder === m.csv.sortOrder), renamed: true },
    );

    for (const { csv: g, db: d, renamed } of matches) {
      if (!d) {
        changed = true;
        plan.newGuests.push({
          id: newId(),
          invitationId: existing.id,
          householdKey: row.key,
          name: g.name,
          role: g.role,
          sortOrder: g.sortOrder,
        });
        continue;
      }
      const changes: string[] = [];
      if (d.name !== g.name) changes.push(`ime ${show(d.name)} → ${show(g.name)}`);
      if (d.role !== g.role) changes.push(`role ${show(d.role)} → ${show(g.role)}`);
      if (d.sortOrder !== g.sortOrder) changes.push(`sort_order ${d.sortOrder} → ${g.sortOrder}`);
      if (changes.length === 0) continue;
      changed = true;
      plan.updatedGuests.push({
        id: d.id,
        householdKey: row.key,
        name: g.name,
        role: g.role,
        sortOrder: g.sortOrder,
        changes,
        renamed: renamed && d.name !== g.name,
        attending: d.attending,
      });
    }

    for (const d of remaining) {
      changed = true;
      plan.extraGuests.push({
        id: d.id,
        householdKey: row.key,
        name: d.name,
        attending: d.attending,
      });
    }

    if (!changed) plan.unchangedHouseholds.push(row.key);
  }

  for (const h of database) {
    if (!csvKeys.has(h.key)) {
      plan.extraHouseholds.push({
        id: h.id,
        key: h.key,
        displayName: h.displayName,
        opened: h.opened,
        responded: h.responded,
      });
    }
  }

  return plan;
}

export interface PruneSelection {
  invitationIds: string[];
  guestIds: string[];
  /** Kept because they already opened/answered; delete them with --force. */
  protectedItems: string[];
}

/**
 * What --prune may delete. Without --force, households that already opened
 * the link or answered, and guests with an answer, are kept.
 */
export function selectPrunable(plan: SeedPlan, force: boolean): PruneSelection {
  const selection: PruneSelection = { invitationIds: [], guestIds: [], protectedItems: [] };
  for (const h of plan.extraHouseholds) {
    if (force || (!h.opened && !h.responded)) selection.invitationIds.push(h.id);
    else
      selection.protectedItems.push(
        `domaćinstvo "${h.key}" (${h.responded ? 'odgovorilo' : 'otvorilo link'})`,
      );
  }
  for (const g of plan.extraGuests) {
    if (force || g.attending === null) selection.guestIds.push(g.id);
    else selection.protectedItems.push(`gost "${g.name}" u "${g.householdKey}" (već odgovorio)`);
  }
  return selection;
}

export function planHasChanges(plan: SeedPlan): boolean {
  return (
    plan.newHouseholds.length > 0 ||
    plan.updatedHouseholds.length > 0 ||
    plan.newGuests.length > 0 ||
    plan.updatedGuests.length > 0
  );
}
