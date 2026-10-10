// npm run db:seed [-- --file data/x.csv] [--dry-run] [--prune [--force]]
//
// Reads the guest list CSV and creates/updates invitations and guests.
// Idempotent: run it again after editing the CSV. It never changes existing
// codes or answers. Rows that disappeared from the CSV are only reported,
// unless --prune is given.

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { neon } from '@neondatabase/serverless';
import { generateUniqueCode } from './lib/generateCode.js';
import { loadDotEnv, requireEnv } from './lib/env.js';
import { CsvImportError, decodeUtf8, parseHouseholdsCsv } from './lib/householdsCsv.js';
import { planHasChanges, planSeed, selectPrunable, type DbHousehold } from './lib/seedPlan.js';
import { count, GUESTS, HOUSEHOLDS } from './lib/text.js';

const { values: args } = parseArgs({
  options: {
    file: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    prune: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
});

const file =
  args.file ??
  (existsSync('data/households.csv') ? 'data/households.csv' : 'data/households.example.csv');
const dryRun = args['dry-run'];

// ---- 1. Read and validate the CSV ---------------------------------------------

let households;
try {
  households = parseHouseholdsCsv(decodeUtf8(readFileSync(file)));
} catch (error) {
  if (error instanceof CsvImportError) {
    console.error(`✖ ${file} ima greške, ništa nije upisano:`);
    for (const p of error.problems)
      console.error(`  ${p.line ? `red ${p.line}: ` : ''}${p.message}`);
    process.exit(1);
  }
  throw error;
}
const guestCount = households.reduce((n, h) => n + h.guests.length, 0);
console.log(`📄 ${file}: ${count(households.length, HOUSEHOLDS)}, ${count(guestCount, GUESTS)}`);

// ---- 2. Load the current database state -----------------------------------------

loadDotEnv();
const sql = neon(requireEnv('DATABASE_URL'));

const rows = (await sql`
  select i.id, i.code, i.household_key, i.display_name, i.side, i.table_name,
    i.first_opened_at is not null as opened, i.responded_at is not null as responded,
    coalesce(json_agg(json_build_object(
      'id', g.id, 'name', g.name, 'role', g.role, 'sortOrder', g.sort_order, 'attending', g.attending
    )) filter (where g.id is not null), '[]'::json) as guests
  from invitations i left join guests g on g.invitation_id = i.id
  group by i.id`) as {
  id: string;
  code: string;
  household_key: string;
  display_name: string;
  side: DbHousehold['side'];
  table_name: string | null;
  opened: boolean;
  responded: boolean;
  guests: DbHousehold['guests'];
}[];

const database: DbHousehold[] = rows.map((r) => ({
  id: r.id,
  key: r.household_key,
  code: r.code,
  displayName: r.display_name,
  side: r.side,
  tableName: r.table_name,
  opened: r.opened,
  responded: r.responded,
  guests: r.guests,
}));

// ---- 3. Plan -----------------------------------------------------------------------

const plan = planSeed(households, database, randomUUID);
const prune = args.prune ? selectPrunable(plan, args.force) : null;

const guestsOfNew = new Set(plan.newHouseholds.map((h) => h.id));
const addedToExisting = plan.newGuests.filter((g) => !guestsOfNew.has(g.invitationId));

console.log('');
for (const h of plan.newHouseholds) {
  const n = plan.newGuests.filter((g) => g.invitationId === h.id).length;
  console.log(`  + novo domaćinstvo "${h.key}" (${h.displayName}), ${count(n, GUESTS)}`);
}
for (const h of plan.updatedHouseholds) console.log(`  ~ "${h.key}": ${h.changes.join(', ')}`);
for (const g of addedToExisting) console.log(`  + gost "${g.name}" u "${g.householdKey}"`);
for (const g of plan.updatedGuests) {
  const kept = g.renamed && g.attending !== null ? ' (odgovor zadržan)' : '';
  console.log(`  ~ gost u "${g.householdKey}": ${g.changes.join(', ')}${kept}`);
}
for (const h of plan.extraHouseholds) {
  console.log(`  ? "${h.key}" (${h.displayName}) je u bazi, ali ne i u CSV-u`);
}
for (const g of plan.extraGuests) {
  console.log(`  ? gost "${g.name}" u "${g.householdKey}" je u bazi, ali ne i u CSV-u`);
}

console.log('');
console.log('Sažetak:');
const both = (households: number, guests: number) =>
  `${count(households, HOUSEHOLDS)}, ${count(guests, GUESTS)}`;
console.log(`  kreirano:       ${both(plan.newHouseholds.length, plan.newGuests.length)}`);
console.log(`  ažurirano:      ${both(plan.updatedHouseholds.length, plan.updatedGuests.length)}`);
console.log(`  nepromijenjeno: ${count(plan.unchangedHouseholds.length, HOUSEHOLDS)}`);
if (plan.extraHouseholds.length + plan.extraGuests.length > 0) {
  console.log(
    `  samo u bazi:    ${both(plan.extraHouseholds.length, plan.extraGuests.length)}` +
      (prune ? '' : ' (ostaju; obriši ih sa --prune)'),
  );
}
if (prune) {
  console.log(`  za brisanje:    ${both(prune.invitationIds.length, prune.guestIds.length)}`);
  for (const item of prune.protectedItems)
    console.log(`  ! ne brišem ${item}; dodaj --force ako si siguran`);
}

const hasDeletes = !!prune && prune.invitationIds.length + prune.guestIds.length > 0;
if (!planHasChanges(plan) && !hasDeletes) {
  console.log('\n✓ Baza je već usklađena sa CSV-om.');
  process.exit(0);
}
if (dryRun) {
  console.log('\n(dry run: ništa nije upisano)');
  process.exit(0);
}

// ---- 4. Apply in one transaction -----------------------------------------------------

const takenCodes = new Set(database.map((h) => h.code));
const newHouseholds = plan.newHouseholds.map((h) => ({
  ...h,
  code: generateUniqueCode(takenCodes),
}));

const queries = [];
if (newHouseholds.length > 0) {
  queries.push(sql`
    insert into invitations (id, code, household_key, display_name, side, table_name)
    select * from unnest(
      ${newHouseholds.map((h) => h.id)}::uuid[], ${newHouseholds.map((h) => h.code)}::text[],
      ${newHouseholds.map((h) => h.key)}::text[], ${newHouseholds.map((h) => h.displayName)}::text[],
      ${newHouseholds.map((h) => h.side)}::text[], ${newHouseholds.map((h) => h.tableName)}::text[])`);
}
if (plan.updatedHouseholds.length > 0) {
  const u = plan.updatedHouseholds;
  queries.push(sql`
    update invitations as i
    set display_name = v.display_name, side = v.side, table_name = v.table_name, updated_at = now()
    from unnest(${u.map((h) => h.id)}::uuid[], ${u.map((h) => h.displayName)}::text[],
      ${u.map((h) => h.side)}::text[], ${u.map((h) => h.tableName)}::text[])
      as v(id, display_name, side, table_name)
    where i.id = v.id`);
}
if (plan.newGuests.length > 0) {
  const g = plan.newGuests;
  queries.push(sql`
    insert into guests (id, invitation_id, name, role, sort_order)
    select * from unnest(${g.map((x) => x.id)}::uuid[], ${g.map((x) => x.invitationId)}::uuid[],
      ${g.map((x) => x.name)}::text[], ${g.map((x) => x.role)}::text[], ${g.map((x) => x.sortOrder)}::int[])`);
}
if (plan.updatedGuests.length > 0) {
  // Only name/role/sort_order: `attending` is never part of a seed update.
  const g = plan.updatedGuests;
  queries.push(sql`
    update guests as t
    set name = v.name, role = v.role, sort_order = v.sort_order, updated_at = now()
    from unnest(${g.map((x) => x.id)}::uuid[], ${g.map((x) => x.name)}::text[],
      ${g.map((x) => x.role)}::text[], ${g.map((x) => x.sortOrder)}::int[]) as v(id, name, role, sort_order)
    where t.id = v.id`);
}
if (prune && prune.guestIds.length > 0) {
  queries.push(sql`delete from guests where id = any(${prune.guestIds}::uuid[])`);
}
if (prune && prune.invitationIds.length > 0) {
  queries.push(sql`delete from invitations where id = any(${prune.invitationIds}::uuid[])`);
}

await sql.transaction(queries);
console.log('\n✓ Upisano. Linkove izvezi sa: npm run links:export');
