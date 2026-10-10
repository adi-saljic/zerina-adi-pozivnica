// npm run db:seed [-- --file data/x.csv] [--dry-run] [--prune [--force]]
//
// Reads the guest list CSV and creates/updates invitations and guests.
// Idempotent: run it again after editing the CSV.
//
// Safety rules:
// - households are matched by household_key, guests within a household by sort_order;
// - it never writes attending, message, name_from_guest, code or the open/response
//   timestamps. A changed display_name updates only the slug, so sent links keep working;
// - rows that disappeared from the CSV are only reported. --prune lists what it would
//   delete and asks for confirmation; opened/answered ones also need --force.

import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { parseArgs } from 'node:util';
import { neon } from '@neondatabase/serverless';
import { loadDotEnv, requireEnv } from './lib/env.js';
import { generateUniqueCode } from './lib/generateCode.js';
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
  select i.id, i.code, i.slug, i.household_key, i.display_name, i.salutation, i.side,
    i.first_opened_at is not null as opened, i.responded_at is not null as responded,
    coalesce(json_agg(json_build_object(
      'id', g.id, 'name', g.name, 'role', g.role, 'sortOrder', g.sort_order,
      'tableName', g.table_name, 'isPlaceholder', g.is_placeholder,
      'attending', g.attending, 'nameFromGuest', g.name_from_guest
    )) filter (where g.id is not null), '[]'::json) as guests
  from invitations i left join guests g on g.invitation_id = i.id
  group by i.id`) as {
  id: string;
  code: string;
  slug: string;
  household_key: string;
  display_name: string;
  salutation: DbHousehold['salutation'];
  side: DbHousehold['side'];
  opened: boolean;
  responded: boolean;
  guests: DbHousehold['guests'];
}[];

const database: DbHousehold[] = rows.map((r) => ({
  id: r.id,
  key: r.household_key,
  code: r.code,
  slug: r.slug,
  displayName: r.display_name,
  salutation: r.salutation,
  side: r.side,
  opened: r.opened,
  responded: r.responded,
  guests: r.guests,
}));

// ---- 3. Plan -----------------------------------------------------------------------

const plan = planSeed(households, database, randomUUID);
const prune = args.prune ? selectPrunable(plan, args.force) : null;

const idsOfNew = new Set(plan.newHouseholds.map((h) => h.id));
const addedToExisting = plan.newGuests.filter((g) => !idsOfNew.has(g.invitationId));

console.log('');
for (const h of plan.newHouseholds) {
  const n = plan.newGuests.filter((g) => g.invitationId === h.id).length;
  console.log(`  + novo domaćinstvo "${h.key}" → /${h.slug}-…, ${count(n, GUESTS)}`);
}
for (const h of plan.updatedHouseholds) console.log(`  ~ "${h.key}": ${h.changes.join(', ')}`);
for (const g of addedToExisting) {
  console.log(`  + gost "${g.name}" (sort_order ${g.sortOrder}) u "${g.householdKey}"`);
}
for (const g of plan.updatedGuests) {
  const kept = g.attending !== null && g.changes.some((c) => c.startsWith('ime'));
  console.log(
    `  ~ gost ${g.sortOrder} u "${g.householdKey}": ${g.changes.join(', ')}${kept ? ' (odgovor zadržan)' : ''}`,
  );
}

const extras = plan.extraHouseholds.length + plan.extraGuests.length;
if (extras > 0) {
  console.warn(`\n⚠ U bazi, ali ne i u CSV-u${prune ? ':' : ' (ne brišem bez --prune):'}`);
  for (const h of plan.extraHouseholds)
    console.warn(`  - domaćinstvo "${h.key}" (${h.displayName})`);
  for (const g of plan.extraGuests) {
    console.warn(`  - gost "${g.name}" (sort_order ${g.sortOrder}) u "${g.householdKey}"`);
  }
}

const both = (h: number, g: number) => `${count(h, HOUSEHOLDS)}, ${count(g, GUESTS)}`;
console.log('\nSažetak:');
console.log(`  kreirano:       ${both(plan.newHouseholds.length, plan.newGuests.length)}`);
console.log(`  ažurirano:      ${both(plan.updatedHouseholds.length, plan.updatedGuests.length)}`);
console.log(`  nepromijenjeno: ${count(plan.unchangedHouseholds.length, HOUSEHOLDS)}`);
if (extras > 0) {
  console.log(`  samo u bazi:    ${both(plan.extraHouseholds.length, plan.extraGuests.length)}`);
}

if (prune) {
  if (prune.toDelete.length > 0) {
    console.log(`\n--prune bi obrisao (${prune.toDelete.length}):`);
    for (const item of prune.toDelete) console.log(`  ✖ ${item}`);
  }
  for (const item of prune.protectedItems) {
    console.log(`  ! ne brišem ${item}; dodaj --force ako si siguran`);
  }
}

const deletes = prune ? prune.invitationIds.length + prune.guestIds.length : 0;
if (!planHasChanges(plan) && deletes === 0) {
  console.log('\n✓ Baza je već usklađena sa CSV-om.');
  process.exit(0);
}
if (dryRun) {
  console.log('\n(dry run: ništa nije upisano)');
  process.exit(0);
}

if (prune && deletes > 0) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`\nObrisati navedeno (${deletes})? Upiši "da" za potvrdu: `);
  rl.close();
  if (answer.trim().toLowerCase() !== 'da') {
    console.log(
      'Prekinuto: ništa nije upisano ni obrisano. Pokreni ponovo bez --prune za ostale izmjene.',
    );
    process.exit(1);
  }
}

// ---- 4. Apply in one transaction -----------------------------------------------------
// Only the columns listed here are ever written. attending, message, name_from_guest,
// code (of existing rows) and the timestamps are deliberately absent.

const takenCodes = new Set(database.map((h) => h.code));
const newHouseholds = plan.newHouseholds.map((h) => ({
  ...h,
  code: generateUniqueCode(takenCodes),
}));

const queries = [];
if (newHouseholds.length > 0) {
  const n = newHouseholds;
  queries.push(sql`
    insert into invitations (id, code, household_key, display_name, salutation, side, slug)
    select * from unnest(
      ${n.map((h) => h.id)}::uuid[], ${n.map((h) => h.code)}::text[],
      ${n.map((h) => h.key)}::text[], ${n.map((h) => h.displayName)}::text[],
      ${n.map((h) => h.salutation)}::text[], ${n.map((h) => h.side)}::text[],
      ${n.map((h) => h.slug)}::text[])`);
}
if (plan.updatedHouseholds.length > 0) {
  const u = plan.updatedHouseholds;
  queries.push(sql`
    update invitations as i
    set display_name = v.display_name, salutation = v.salutation, side = v.side,
        slug = v.slug, updated_at = now()
    from unnest(${u.map((h) => h.id)}::uuid[], ${u.map((h) => h.displayName)}::text[],
      ${u.map((h) => h.salutation)}::text[], ${u.map((h) => h.side)}::text[],
      ${u.map((h) => h.slug)}::text[]) as v(id, display_name, salutation, side, slug)
    where i.id = v.id`);
}
if (plan.newGuests.length > 0) {
  const g = plan.newGuests;
  queries.push(sql`
    insert into guests (id, invitation_id, name, role, sort_order, table_name, is_placeholder)
    select * from unnest(${g.map((x) => x.id)}::uuid[], ${g.map((x) => x.invitationId)}::uuid[],
      ${g.map((x) => x.name)}::text[], ${g.map((x) => x.role)}::text[],
      ${g.map((x) => x.sortOrder)}::int[], ${g.map((x) => x.tableName)}::text[],
      ${g.map((x) => x.isPlaceholder)}::boolean[])`);
}
if (plan.updatedGuests.length > 0) {
  const g = plan.updatedGuests;
  queries.push(sql`
    update guests as t
    set name = v.name, role = v.role, table_name = v.table_name,
        is_placeholder = v.is_placeholder, updated_at = now()
    from unnest(${g.map((x) => x.id)}::uuid[], ${g.map((x) => x.name)}::text[],
      ${g.map((x) => x.role)}::text[], ${g.map((x) => x.tableName)}::text[],
      ${g.map((x) => x.isPlaceholder)}::boolean[]) as v(id, name, role, table_name, is_placeholder)
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
