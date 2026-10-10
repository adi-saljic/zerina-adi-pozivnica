// Pure diff between the CSV and the database. The seed script prints and
// applies this plan; tests check it directly.
//
// Safety rules (by construction, the plan has no field for them):
// - codes are generated once and never changed. A changed display_name only
//   updates the slug, so links that were already sent keep working;
// - attending, message, name_from_guest and the open/response timestamps are never written;
// - nothing is deleted unless pruning is explicitly requested (selectPrunable).
//
// Households are matched by household_key, guests within a household by sort_order.

import type { Role, Salutation, Side } from '../../shared/schemas.js';
import { slugify } from '../../shared/slug.js';
import type { CsvHousehold } from './householdsCsv.js';

export interface DbGuest {
  id: string;
  name: string;
  role: Role;
  sortOrder: number;
  tableName: string | null;
  isPlaceholder: boolean;
  attending: boolean | null;
  nameFromGuest: string | null;
}

export interface DbHousehold {
  id: string;
  key: string;
  code: string;
  slug: string;
  displayName: string;
  salutation: Salutation;
  side: Side;
  opened: boolean;
  responded: boolean;
  guests: DbGuest[];
}

interface HouseholdFields {
  displayName: string;
  salutation: Salutation;
  side: Side;
  slug: string;
}

interface GuestFields {
  name: string;
  role: Role;
  tableName: string | null;
  isPlaceholder: boolean;
}

export interface NewGuest extends GuestFields {
  id: string;
  invitationId: string;
  householdKey: string;
  sortOrder: number;
}

export interface SeedPlan {
  newHouseholds: (HouseholdFields & { id: string; key: string })[];
  updatedHouseholds: (HouseholdFields & { id: string; key: string; changes: string[] })[];
  /** Guests of new households and guests added to existing ones. */
  newGuests: NewGuest[];
  updatedGuests: (GuestFields & {
    id: string;
    householdKey: string;
    sortOrder: number;
    changes: string[];
    /** Stays with the guest (shown in the log so a rename is a conscious decision). */
    attending: boolean | null;
  })[];
  unchangedHouseholds: string[];
  /** In the database but no longer in the CSV: reported, deleted only with --prune. */
  extraHouseholds: {
    id: string;
    key: string;
    displayName: string;
    opened: boolean;
    responded: boolean;
  }[];
  extraGuests: {
    id: string;
    householdKey: string;
    name: string;
    sortOrder: number;
    attending: boolean | null;
  }[];
}

const show = (v: string | number | boolean | null) => (v === null ? '—' : `"${v}"`);

function diff<T extends object>(before: T, after: T, labels: Record<keyof T, string>): string[] {
  return (Object.keys(labels) as (keyof T)[])
    .filter((k) => before[k] !== after[k])
    .map(
      (k) =>
        `${labels[k]} ${show(before[k] as string | null)} → ${show(after[k] as string | null)}`,
    );
}

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
    const wanted: HouseholdFields = {
      displayName: row.displayName,
      salutation: row.salutation,
      side: row.side,
      slug: slugify(row.displayName),
    };
    const existing = dbByKey.get(row.key);

    if (!existing) {
      const id = newId();
      plan.newHouseholds.push({ id, key: row.key, ...wanted });
      for (const g of row.guests) {
        plan.newGuests.push({
          id: newId(),
          invitationId: id,
          householdKey: row.key,
          name: g.name,
          role: g.role,
          tableName: g.tableName,
          isPlaceholder: g.isPlaceholder,
          sortOrder: g.sortOrder,
        });
      }
      continue;
    }

    let changed = false;
    const householdChanges = diff<HouseholdFields>(existing, wanted, {
      displayName: 'display_name',
      salutation: 'salutation',
      side: 'side',
      slug: 'slug',
    });
    if (householdChanges.length > 0) {
      changed = true;
      plan.updatedHouseholds.push({
        id: existing.id,
        key: row.key,
        ...wanted,
        changes: householdChanges,
      });
    }

    const dbByOrder = new Map(existing.guests.map((g) => [g.sortOrder, g]));
    const csvOrders = new Set(row.guests.map((g) => g.sortOrder));

    for (const g of row.guests) {
      const wantedGuest: GuestFields = {
        name: g.name,
        role: g.role,
        tableName: g.tableName,
        isPlaceholder: g.isPlaceholder,
      };
      const d = dbByOrder.get(g.sortOrder);
      if (!d) {
        changed = true;
        plan.newGuests.push({
          id: newId(),
          invitationId: existing.id,
          householdKey: row.key,
          sortOrder: g.sortOrder,
          ...wantedGuest,
        });
        continue;
      }
      const changes = diff<GuestFields>(d, wantedGuest, {
        name: 'ime',
        role: 'role',
        tableName: 'table_name',
        isPlaceholder: 'is_placeholder',
      });
      if (changes.length === 0) continue;
      changed = true;
      plan.updatedGuests.push({
        id: d.id,
        householdKey: row.key,
        sortOrder: g.sortOrder,
        ...wantedGuest,
        changes,
        attending: d.attending,
      });
    }

    for (const d of existing.guests) {
      if (csvOrders.has(d.sortOrder)) continue;
      changed = true;
      plan.extraGuests.push({
        id: d.id,
        householdKey: row.key,
        name: d.name,
        sortOrder: d.sortOrder,
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
  /** Human-readable list of what will be deleted (for the confirmation prompt). */
  toDelete: string[];
  /** Kept because they already opened/answered; delete them with --force. */
  protectedItems: string[];
}

/**
 * What --prune may delete. Without --force, households that already opened
 * the link or answered, and guests with an answer, are kept.
 */
export function selectPrunable(plan: SeedPlan, force: boolean): PruneSelection {
  const selection: PruneSelection = {
    invitationIds: [],
    guestIds: [],
    toDelete: [],
    protectedItems: [],
  };
  for (const h of plan.extraHouseholds) {
    const label = `domaćinstvo "${h.key}" (${h.displayName})`;
    const touched = h.opened || h.responded;
    if (force || !touched) {
      selection.invitationIds.push(h.id);
      selection.toDelete.push(
        touched ? `${label} ⚠ već ${h.responded ? 'odgovorilo' : 'otvorilo link'}` : label,
      );
    } else {
      selection.protectedItems.push(`${label}: ${h.responded ? 'odgovorilo' : 'otvorilo link'}`);
    }
  }
  for (const g of plan.extraGuests) {
    const label = `gost "${g.name}" (sort_order ${g.sortOrder}) u "${g.householdKey}"`;
    if (force || g.attending === null) {
      selection.guestIds.push(g.id);
      selection.toDelete.push(g.attending === null ? label : `${label} ⚠ već odgovorio`);
    } else {
      selection.protectedItems.push(`${label}: već odgovorio`);
    }
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
