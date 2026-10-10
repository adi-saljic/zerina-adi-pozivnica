// npm run db:migrate — applies db/migrations/*.sql in order, each in its own
// transaction, and records them in schema_migrations so they run only once.
// Uses a WebSocket connection (Client) because migration files contain many statements.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@neondatabase/serverless';
import { loadDotEnv, requireEnv } from './lib/env.js';

const MIGRATIONS_DIR = 'db/migrations';

loadDotEnv();
const client = new Client(requireEnv('DATABASE_URL'));
await client.connect();

try {
  await client.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null default now()
    )`);
  const { rows } = await client.query<{ name: string }>('select name from schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_[\w-]+\.sql$/.test(f))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      console.log(`  ✓ ${file} (već primijenjena)`);
      continue;
    }
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    try {
      await client.query('begin');
      await client.query(sql);
      await client.query('insert into schema_migrations (name) values ($1)', [file]);
      await client.query('commit');
      console.log(`  ➜ ${file} primijenjena`);
      count++;
    } catch (error) {
      await client.query('rollback');
      console.error(`✖ ${file} nije uspjela, ništa iz nje nije primijenjeno.`);
      throw error;
    }
  }
  console.log(count === 0 ? 'Baza je već ažurna.' : `Gotovo: ${count} nova migracija.`);
} finally {
  await client.end();
}
