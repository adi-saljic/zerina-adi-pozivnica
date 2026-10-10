// npm run links:export [-- --sep=comma]
// Writes, per household, its personal URL (/<slug>-<code>) and a ready-to-paste
// WhatsApp message:
// - out/links.csv: for Excel / Sheets
// - out/links.txt: one block per household, easy to copy by hand on a phone

import { mkdirSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { neon } from '@neondatabase/serverless';
import { toCsv } from '../shared/csv.js';
import type { Salutation, Side } from '../shared/schemas.js';
import { invitationPath } from '../shared/slug.js';
import { bs } from '../src/i18n/bs.js';
import { loadDotEnv, publicBaseUrl, requireEnv } from './lib/env.js';
import { count } from './lib/text.js';

const { values: args } = parseArgs({ options: { sep: { type: 'string', default: 'semicolon' } } });

loadDotEnv();
const baseUrl = publicBaseUrl();
const sql = neon(requireEnv('DATABASE_URL'));

const rows = (await sql`
  select i.code, i.slug, i.household_key, i.display_name, i.salutation, i.side,
    coalesce(string_agg(coalesce(g.name_from_guest, g.name), ', ' order by g.sort_order), '')
      as members
  from invitations i left join guests g on g.invitation_id = i.id
  group by i.id
  order by array_position(array['zerina', 'adi', 'zajednicki'], i.side), i.display_name,
    i.household_key`) as {
  code: string;
  slug: string;
  household_key: string;
  display_name: string;
  salutation: Salutation;
  side: Side;
  members: string;
}[];

const links = rows.map((r) => {
  const url = `${baseUrl}${invitationPath(r.slug, r.code)}`;
  const message = bs.whatsapp.invite({
    salutation: r.salutation,
    displayName: r.display_name,
    url,
  });
  return { ...r, url, message };
});

const csv = toCsv(
  ['side', 'display_name', 'members', 'url', 'whatsapp_message', 'household_key', 'whatsapp_url'],
  links.map((l) => [
    l.side,
    l.display_name,
    l.members,
    l.url,
    l.message,
    l.household_key,
    `https://wa.me/?text=${encodeURIComponent(l.message)}`,
  ]),
  args.sep === 'comma' ? ',' : ';',
);

const txt = links
  .map((l) =>
    [
      `${l.display_name} · ${bs.sides[l.side]} · ${l.household_key}`,
      `Gosti: ${l.members}`,
      l.url,
      '',
      l.message,
    ].join('\n'),
  )
  .join('\n\n────────────────────────\n\n');

mkdirSync('out', { recursive: true });
writeFileSync('out/links.csv', csv);
writeFileSync('out/links.txt', `${txt}\n`);
console.log(
  `✓ out/links.csv i out/links.txt: ${count(links.length, ['link', 'linka', 'linkova'])} (${baseUrl})`,
);
if (!baseUrl.startsWith('https://')) {
  console.log('! PUBLIC_BASE_URL nije https: ovo su lokalni linkovi, ne šalji ih gostima.');
}
