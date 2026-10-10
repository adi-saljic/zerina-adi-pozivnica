import { describe, expect, it } from 'vitest';
import { escapeCsvCell, toCsv } from './csv.js';

describe('escapeCsvCell', () => {
  it('neutralises spreadsheet formulas (CSV injection)', () => {
    expect(escapeCsvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(escapeCsvCell('+387 61 000')).toBe("'+387 61 000");
    expect(escapeCsvCell('-1')).toBe("'-1");
    expect(escapeCsvCell('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('quotes delimiters, quotes and newlines', () => {
    expect(escapeCsvCell('a;b')).toBe('"a;b"');
    expect(escapeCsvCell('a,b', ',')).toBe('"a,b"');
    expect(escapeCsvCell('a,b', ';')).toBe('a,b');
    expect(escapeCsvCell('red 1\nred 2')).toBe('"red 1\nred 2"');
  });

  it('writes null/undefined as empty and keeps diacritics', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
    expect(escapeCsvCell('Ćazim Đulić')).toBe('Ćazim Đulić');
  });
});

describe('toCsv', () => {
  it('adds a UTF-8 BOM and CRLF line endings', () => {
    const csv = toCsv(['a', 'b'], [[1, 'x']]);
    expect(csv).toBe('\uFEFFa;b\r\n1;x\r\n');
  });
});
