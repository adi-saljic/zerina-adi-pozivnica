// Reads data/households.csv (one row per guest) into validated households.
// Handles what Excel / Google Sheets typically produce: BOM, ";" or "," as
// delimiter, empty trailing rows, diacritics and capitals in enum values.
//
// Columns: household_key, display_name, salutation, side, guest_name, role,
// is_placeholder, table_name, sort_order. Any other column (e.g. `review`) is ignored.

import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import {
  roleSchema,
  salutationSchema,
  sideSchema,
  type Role,
  type Salutation,
  type Side,
} from '../../shared/schemas.js';
import { asciiKey, normalizeText } from './text.js';

export interface CsvGuest {
  name: string;
  role: Role;
  isPlaceholder: boolean;
  /** Seating is per guest: kids can sit at the kids' table. */
  tableName: string | null;
  /** Identity of the guest within the household (seed matches on it). */
  sortOrder: number;
  line: number;
}

export interface CsvHousehold {
  key: string;
  displayName: string;
  salutation: Salutation;
  side: Side;
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

const REQUIRED_COLUMNS = [
  'household_key',
  'display_name',
  'salutation',
  'side',
  'guest_name',
  'role',
  'sort_order',
] as const;
const OPTIONAL_COLUMNS = ['is_placeholder', 'table_name'] as const;

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

const BOM = String.fromCharCode(0xfeff);

const emptyToUndefined = (v: unknown) =>
  typeof v === 'string' && normalizeText(v) === '' ? undefined : v;

const requiredText = (column: string, max: number) =>
  z
    .string({ error: `${column} je obavezan` })
    .transform(normalizeText)
    .pipe(z.string().min(1, `${column} je obavezan`).max(max, `${column} je predug`));

const BOOLEAN_VALUES: Record<string, boolean> = {
  true: true,
  false: false,
  da: true,
  ne: false,
  '1': true,
  '0': false,
  yes: true,
  no: false,
};

const rowSchema = z.object({
  household_key: requiredText('household_key', 100),
  display_name: requiredText('display_name', 200),
  salutation: z
    .string({ error: 'salutation je obavezan' })
    .transform((v) => {
      const key = asciiKey(v);
      return key.charAt(0).toUpperCase() + key.slice(1);
    })
    .pipe(z.enum(salutationSchema.options, { error: 'salutation mora biti Dragi ili Draga' })),
  side: z
    .string({ error: 'side je obavezan' })
    .transform(asciiKey)
    .pipe(z.enum(sideSchema.options, { error: 'side mora biti: zerina ili adi' })),
  guest_name: requiredText('guest_name', 200),
  role: z
    .string({ error: 'role je obavezan' })
    .transform(asciiKey)
    .pipe(
      z.enum(roleSchema.options, { error: 'role mora biti: muz, zena, partner, dijete ili gost' }),
    ),
  is_placeholder: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() !== '' ? BOOLEAN_VALUES[asciiKey(v)] : false),
    z.boolean({ error: 'is_placeholder mora biti true ili false' }),
  ),
  table_name: z.preprocess(emptyToUndefined, z.string().transform(normalizeText).optional()),
  sort_order: z.preprocess(
    emptyToUndefined,
    z.coerce
      .number({ error: 'sort_order je obavezan cijeli broj' })
      .int('sort_order mora biti cijeli broj')
      .min(0, 'sort_order ne može biti negativan')
      .max(10_000),
  ),
});

type Row = z.infer<typeof rowSchema>;

export function parseHouseholdsCsv(text: string): CsvHousehold[] {
  const content = text.startsWith(BOM) ? text.slice(1) : text;
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
    else {
      for (const issue of parsed.error.issues) {
        problems.push({ line: info.lines, message: issue.message });
      }
    }
  }

  const byKey = new Map<string, { household: CsvHousehold; orders: Map<number, number> }>();
  for (const { row, line } of rows) {
    let entry = byKey.get(row.household_key);
    if (!entry) {
      entry = {
        household: {
          key: row.household_key,
          displayName: row.display_name,
          salutation: row.salutation,
          side: row.side,
          guests: [],
          line,
        },
        orders: new Map(),
      };
      byKey.set(row.household_key, entry);
    }
    const h = entry.household;
    const differs = (column: string, value: string, expected: string) =>
      problems.push({
        line,
        message: `"${h.key}": ${column} "${value}" se razlikuje od "${expected}" (red ${h.line})`,
      });
    if (row.display_name !== h.displayName)
      differs('display_name', row.display_name, h.displayName);
    if (row.salutation !== h.salutation) differs('salutation', row.salutation, h.salutation);
    if (row.side !== h.side) differs('side', row.side, h.side);

    const other = entry.orders.get(row.sort_order);
    if (other !== undefined) {
      problems.push({
        line,
        message: `"${h.key}": sort_order ${row.sort_order} već koristi red ${other}`,
      });
      continue;
    }
    entry.orders.set(row.sort_order, line);
    h.guests.push({
      name: row.guest_name,
      role: row.role,
      isPlaceholder: row.is_placeholder,
      tableName: row.table_name ?? null,
      sortOrder: row.sort_order,
      line,
    });
  }

  if (problems.length > 0) {
    throw new CsvImportError(problems.sort((a, b) => (a.line ?? 0) - (b.line ?? 0)));
  }
  if (byKey.size === 0) {
    throw new CsvImportError([{ line: null, message: 'CSV nema nijednog gosta' }]);
  }

  for (const { household } of byKey.values()) {
    household.guests.sort((a, b) => a.sortOrder - b.sortOrder);
  }
  return [...byKey.values()].map((e) => e.household);
}
