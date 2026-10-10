import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CsvImportError,
  decodeUtf8,
  detectDelimiter,
  parseHouseholdsCsv,
} from './householdsCsv.js';

const HEADER = 'household,side,table_name,guest_name,role,sort_order,display_name';

function problems(fn: () => unknown): string[] {
  try {
    fn();
  } catch (error) {
    if (error instanceof CsvImportError)
      return error.problems.map((p) => `${p.line}: ${p.message}`);
    throw error;
  }
  throw new Error('expected CsvImportError');
}

describe('parseHouseholdsCsv', () => {
  it('parses the example file: a couple, a family with two kids and a single guest', () => {
    const households = parseHouseholdsCsv(decodeUtf8(readFileSync('data/households.example.csv')));
    expect(households.map((h) => [h.key, h.displayName, h.guests.length])).toEqual([
      ['H001', 'Marko i Ana', 2],
      ['H002', 'Porodica Hadžić', 4],
      ['H003', 'Tarik', 1],
    ]);
    expect(households[2]?.tableName).toBeNull();
    expect(households[1]?.guests.filter((g) => g.role === 'dijete')).toHaveLength(2);
  });

  it('accepts ";" (Excel with Bosnian settings), a BOM and diacritics in enum values', () => {
    const csv =
      '\uFEFFhousehold;side;table_name;guest_name;role\r\nH1;Zajednički;Sto 3;Šejla Đozić;Žena\r\n;;;;\r\n';
    const [h] = parseHouseholdsCsv(csv);
    expect(h).toMatchObject({
      key: 'H1',
      side: 'zajednicki',
      tableName: 'Sto 3',
      displayName: 'H1',
    });
    expect(h?.guests).toEqual([{ name: 'Šejla Đozić', role: 'zena', sortOrder: 1, line: 2 }]);
  });

  it('keeps a comma inside a quoted name', () => {
    const csv = `${HEADER}\nH1,adi,,"Begić, Tarik",gost,1,\n`;
    expect(parseHouseholdsCsv(csv)[0]?.guests[0]?.name).toBe('Begić, Tarik');
  });

  it('normalises decomposed (NFD) characters from macOS to NFC', () => {
    const nfd = 'C\u0301azim'; // "Ćazim" as C + combining acute
    const [h] = parseHouseholdsCsv(`${HEADER}\nH1,adi,,${nfd},gost,1,\n`);
    expect(h?.guests[0]?.name).toBe('Ćazim');
  });

  it('fills a missing sort_order with the next free number', () => {
    const csv = `${HEADER}\nH1,adi,,A,muz,2,\nH1,adi,,B,zena,,\nH1,adi,,C,dijete,,\n`;
    expect(parseHouseholdsCsv(csv)[0]?.guests.map((g) => [g.name, g.sortOrder])).toEqual([
      ['A', 2],
      ['B', 1],
      ['C', 3],
    ]);
  });

  it('fails loudly with line numbers on bad rows', () => {
    const csv = [
      HEADER,
      'H1,adi,,Ana,zena,1,',
      'H1,adi,,Bob,ujak,2,', // bad role
      'H2,kum,,Cid,gost,1,', // bad side
      'H3,zerina,,,gost,1,', // missing name
      'H1,zerina,,Dino,gost,3,', // side differs within household
      'H1,adi,,ana,gost,4,', // duplicate name (case-insensitive)
      'H1,adi,,Edo,gost,1,', // duplicate sort_order
      'H4,adi,,Fil,gost,x,', // bad sort_order
    ].join('\n');
    const list = problems(() => parseHouseholdsCsv(csv));
    expect(list).toEqual([
      expect.stringMatching(/^3: role mora biti/),
      expect.stringMatching(/^4: side mora biti/),
      expect.stringMatching(/^5: guest_name je obavezan/),
      expect.stringMatching(/^6: "H1": side "zerina" se razlikuje/),
      expect.stringMatching(/^7: "H1": gost "ana" se ponavlja/),
      expect.stringMatching(/^8: "H1": sort_order 1 već koristi red 2/),
      expect.stringMatching(/^9: sort_order mora biti cijeli broj/),
    ]);
  });

  it('reports missing required columns', () => {
    expect(problems(() => parseHouseholdsCsv('household,guest_name\nH1,Ana\n'))).toEqual([
      expect.stringMatching(/^1: nedostaju kolone: side, role/),
    ]);
  });

  it('rejects conflicting display names within one household', () => {
    const csv = `${HEADER}\nH1,adi,,A,muz,1,Ana i Bob\nH1,adi,,B,zena,2,Bob i Ana\n`;
    expect(problems(() => parseHouseholdsCsv(csv))).toEqual([
      expect.stringMatching(/^3: "H1": display_name "Bob i Ana" se razlikuje/),
    ]);
  });
});

describe('decodeUtf8', () => {
  it('rejects a Windows-1250 file instead of garbling č/ć/ž', () => {
    const cp1250 = Uint8Array.from([0x48, 0x61, 0x64, 0x9e, 0x69, 0xe6]); // "Hadžić" in cp1250
    expect(problems(() => decodeUtf8(cp1250))).toEqual([expect.stringContaining('UTF-8')]);
  });
});

describe('detectDelimiter', () => {
  it('looks at the header only', () => {
    expect(detectDelimiter('household;side;guest_name')).toBe(';');
    expect(detectDelimiter('household,side,guest_name')).toBe(',');
  });
});
