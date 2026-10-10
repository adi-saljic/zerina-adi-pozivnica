// CSV writing for files that will be opened in Excel / Google Sheets / Numbers.
//
// - UTF-8 BOM so Excel shows č, ć, đ, š, ž correctly.
// - ";" by default: Excel with Bosnian/Croatian regional settings expects it.
//   Use "," for Excel with English settings (or for Google Sheets, which handles both).
// - CRLF line endings.
// - Cells starting with = + - @ (or tab/CR) are prefixed with ' so a spreadsheet
//   never runs a guest-written message as a formula (CSV injection).

export type CsvDelimiter = ';' | ',';

const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvCell(value: unknown, delimiter: CsvDelimiter = ';'): string {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  const mustQuote =
    text.includes(delimiter) || text.includes('"') || text.includes('\n') || text.includes('\r');
  return mustQuote ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(
  header: readonly string[],
  rows: readonly (readonly unknown[])[],
  delimiter: CsvDelimiter = ';',
): string {
  const lines = [header, ...rows].map((row) =>
    row.map((cell) => escapeCsvCell(cell, delimiter)).join(delimiter),
  );
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
