// npm run links:export [-- --sep=comma]
// Writes out/links.csv: one row per household with its personal link, a
// ready-to-paste WhatsApp message and a wa.me link that opens WhatsApp with it.

import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { neon } from '@neondatabase/serverless';
import { toCsv } from '../shared/csv.js';
import { bs } from '../src/i18n/bs.js';
import { loadDotEnv, publicBaseUrl, requireEnv } from './lib/env.js';
import { count } from './lib/text.js';

const { values: args } = parseArgs({ options: { sep: { type: 'string', default: 'semicolon' } } });

loadDotEnv();
const baseUrl = publicBaseUrl();
const sql = neon(requireEnv('DATABASE_URL'));

const rows = (await sql`
  select i.code, i.household_key, i.display_name, i.side, i.table_name, count(g.id)::int as guests
  from invitations i left join guests g on g.invitation_id = i.id
  group by i.id
  order by i.side, i.display_name`) as {
  code: string;
  household_key: string;
  display_name: string;
  side: string;
  table_name: string | null;
  guests: number;
}[];

const csv = toCsv(
  ['household', 'household_key', 'side', 'guests', 'link', 'whatsapp_message', 'whatsapp_url'],
  rows.map((r) => {
    const link = `${baseUrl}/?g=${r.code}`;
    const message = bs.whatsapp.invite({ displayName: r.display_name, link });
    return [
      r.display_name,
      r.household_key,
      r.side,
      r.guests,
      link,
      message,
      `https://wa.me/?text=${encodeURIComponent(message)}`,
    ];
  }),
  args.sep === 'comma' ? ',' : ';',
);

mkdirSync('out', { recursive: true });
writeFileSync('out/links.csv', csv);
console.log(`✓ out/links.csv: ${count(rows.length, ['link', 'linka', 'linkova'])} (${baseUrl})`);
if (!baseUrl.startsWith('https://')) {
  console.log('! PUBLIC_BASE_URL nije https: ovo su lokalni linkovi, ne šalji ih gostima.');
}
