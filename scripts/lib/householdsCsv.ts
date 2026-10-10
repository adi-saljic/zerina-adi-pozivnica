// Reads data/households.csv (one row per guest) into validated households.
// Handles what Excel / Google Sheets typically produce: BOM, ";" or "," as
// delimiter, empty trailing rows, diacritics in enum values.

import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { roleSchema, sideSchema, type Role, type Side } from '../../shared/schemas.js';
import { asciiKey, nameKey, normalizeText } from './text.js';

export interface CsvGuest {
  name: string;
  role: Role;
  sortOrder: number;
  line: number;
}

export interface CsvHousehold {
  key: string;
  displayName: string;
  side: Side;
  tableName: string | null;
  guests: CsvGuest[];
  line: number;
}

export interface CsvProblem {
  line: number | null;
  message: string;
}

export class CsvImportError extends Error {
  constructor(readonly problems: CsvProblem[]) {
    super(problems.map((p) => (p.line ? `red ${p.line}: ${p.message}` : p.message)).join('\n'));
  }
}

const REQUIRED_COLUMNS = ['household', 'side', 'guest_name', 'role'] as const;
const OPTIONAL_COLUMNS = ['table_name', 'sort_order', 'display_name'] as const;

/** Strict UTF-8: a file saved as Windows-1250 would otherwise silently garble č/ć/đ/š/ž. */
export function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new CsvImportError([
      {
        line: null,
        message:
          'Fajl nije sačuvan kao UTF-8. Excel: File → Save As → "CSV UTF-8 (Comma delimited)". ' +
          'Google Sheets: File → Download → CSV.',
      },
    ]);
  }
}

/** Looks at the header line only, so a comma inside a name can't confuse it. */
export function detectDelimiter(headerLine: string): ';' | ',' {
  const semicolons = headerLine.split(';').length - 1;
  const commas = headerLine.split(',').length - 1;
  return semicolons > commas ? ';' : ',';
}

const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && normalizeText(v) === '' ? undefined : v;

const rowSchema = z.object({
  household: z
    .string({ error: 'household je obavezan' })
    .transform(normalizeText)
    .pipe(z.string().min(1, 'household je obavezan').max(100, 'household je predug')),
  side: z
    .string({ error: 'side je obavezan' })
    .transform(asciiKey)
    .pipe(z.enum(sideSchema.options, { error: 'side mora biti: adi, zerina ili zajednicki' })),
  table_name: z.preprocess(emptyToUndefined, z.string().transform(normalizeText).optional()),
  guest_name: z
    .string({ error: 'guest_name je obavezan' })
    .transform(normalizeText)
    .pipe(z.string().min(1, 'guest_name je obavezan').max(200, 'guest_name je predug')),
  role: z
    .string({ error: 'role je obavezan' })
    .transform(asciiKey)
    .pipe(
      z.enum(roleSchema.options, { error: 'role mora biti: muz, zena, partner, dijete ili gost' }),
    ),
  sort_order: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: 'sort_order mora biti cijeli broj' })
      .int('sort_order mora biti cijeli broj')
      .min(0, 'sort_order ne može biti negativan')
      .max(10_000)
      .optional(),
  ),
  display_name: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .transform(normalizeText)
      .pipe(z.string().max(200, 'display_name je predug'))
      .optional(),
  ),
});

type Row = z.infer<typeof rowSchema>;

export function parseHouseholdsCsv(text: string): CsvHousehold[] {
  const content = text.replace(/^\uFEFF/, '');
  const headerLine = content.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = detectDelimiter(headerLine);

  let header: string[] = [];
  let records: { record: Record<string, string>; info: { lines: number } }[];
  try {
    records = parse(content, {
      delimiter,
      columns: (names: string[]) => (header = names.map(asciiKey)),
      skip_empty_lines: true,
      skip_records_with_empty_values: true,
      trim: true,
      info: true,
    }) as typeof records;
  } catch (error) {
    const err = error as { message: string; lines?: number };
    throw new CsvImportError([
      { line: err.lines ?? null, message: `CSV se ne može pročitati: ${err.message}` },
    ]);
  }

  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length > 0) {
    throw new CsvImportError([
      {
        line: 1,
        message: `nedostaju kolone: ${missing.join(', ')} (očekivano: ${[...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].join(', ')})`,
      },
    ]);
  }

  const problems: CsvProblem[] = [];
  const rows: { row: Row; line: number }[] = [];
  for (const { record, info } of records) {
    const parsed = rowSchema.safeParse(record);
    if (parsed.success) rows.push({ row: parsed.data, line: info.lines });
    else
      for (const issue of parsed.error.issues)
        problems.push({ line: info.lines, message: issue.message });
  }

  const byKey = new Map<
    string,
    { household: CsvHousehold; explicitName?: string; explicitOrders: Map<number, number> }
  >();
  for (const { row, line } of rows) {
    let entry = byKey.get(row.household);
    if (!entry) {
      entry = {
        household: {
          key: row.household,
          displayName: row.display_name ?? row.household,
          side: row.side,
          tableName: row.table_name ?? null,
          guests: [],
          line,
        },
        explicitName: row.display_name,
        explicitOrders: new Map(),
      };
      byKey.set(row.household, entry);
    }
    const h = entry.household;

    if (row.side !== h.side) {
      problems.push({
        line,
        message: `"${h.key}": side "${row.side}" se razlikuje od "${h.side}" (red ${h.line})`,
      });
    }
    if ((row.table_name ?? null) !== h.tableName) {
      problems.push({
        line,
        message: `"${h.key}": table_name "${row.table_name ?? ''}" se razlikuje od "${h.tableName ?? ''}" (red ${h.line})`,
      });
    }
    if (row.display_name !== undefined) {
      if (entry.explicitName === undefined) {
        entry.explicitName = row.display_name;
        h.displayName = row.display_name;
      } else if (row.display_name !== entry.explicitName) {
        problems.push({
          line,
          message: `"${h.key}": display_name "${row.display_name}" se razlikuje od "${entry.explicitName}"`,
        });
      }
    }
    if (h.guests.some((g) => nameKey(g.name) === nameKey(row.guest_name))) {
      problems.push({ line, message: `"${h.key}": gost "${row.guest_name}" se ponavlja` });
      continue;
    }
    if (row.sort_order !== undefined) {
      const other = entry.explicitOrders.get(row.sort_order);
      if (other !== undefined) {
        problems.push({
          line,
          message: `"${h.key}": sort_order ${row.sort_order} već koristi red ${other}`,
        });
      }
      entry.explicitOrders.set(row.sort_order, line);
    }
    h.guests.push({ name: row.guest_name, role: row.role, sortOrder: row.sort_order ?? -1, line });
  }

  // Missing sort_order: next free number after the explicit ones, in file order.
  for (const { household } of byKey.values()) {
    const used = new Set(household.guests.map((g) => g.sortOrder).filter((n) => n >= 0));
    let next = 1;
    for (const guest of household.guests) {
      if (guest.sortOrder >= 0) continue;
      while (used.has(next)) next++;
      guest.sortOrder = next;
      used.add(next);
    }
  }

  if (problems.length > 0)
    throw new CsvImportError(problems.sort((a, b) => (a.line ?? 0) - (b.line ?? 0)));
  if (byKey.size === 0)
    throw new CsvImportError([{ line: null, message: 'CSV nema nijednog gosta' }]);

  return [...byKey.values()].map((e) => e.household);
}
