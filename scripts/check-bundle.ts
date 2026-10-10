// npm run check:bundle — run after `npm run build`. Fails if any server secret
// (or anything that looks like a database URL) ended up in dist/.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { loadDotEnv } from './lib/env.js';

loadDotEnv();

if (!existsSync('dist')) {
  console.error('✖ dist/ ne postoji. Prvo pokreni: npm run build');
  process.exit(1);
}

const needles = new Map<string, string>([
  ['postgres://', 'database URL'],
  ['postgresql://', 'database URL'],
  ['neon.tech', 'Neon host'],
  ['DATABASE_URL', 'env var name'],
  ['ADMIN_TOKEN', 'env var name'],
  ['RATE_LIMIT_SECRET', 'env var name'],
]);
for (const name of ['DATABASE_URL', 'ADMIN_TOKEN', 'RATE_LIMIT_SECRET']) {
  const value = process.env[name]?.trim();
  if (value && value.length >= 8) needles.set(value, `value of ${name}`);
}
const dbPassword = process.env.DATABASE_URL ? URL.parse(process.env.DATABASE_URL)?.password : '';
if (dbPassword) needles.set(decodeURIComponent(dbPassword), 'database password');

function* files(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* files(path);
    else yield path;
  }
}

let hits = 0;
let scanned = 0;
for (const path of files('dist')) {
  scanned++;
  const content = readFileSync(path, 'latin1');
  for (const [needle, label] of needles) {
    if (content.includes(needle)) {
      console.error(`✖ ${path} sadrži ${label}`);
      hits++;
    }
  }
}

if (hits > 0) process.exit(1);
console.log(
  `✓ ${scanned} fajlova u dist/ provjereno, nijedna tajna nije pronađena (${needles.size} provjera).`,
);
