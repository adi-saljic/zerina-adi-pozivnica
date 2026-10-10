import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CsvImportError,
  decodeUtf8,
  detectDelimiter,
  parseHouseholdsCsv,
} from './householdsCsv.js';

const HEADER =
  'household_key,display_name,salutation,side,guest_name,role,is_placeholder,table_name,sort_order,review';
const BOM = String.fromCharCode(0xfeff);

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
  it('parses the example file: a couple, a family with placeholder kids and a single guest', () => {
    const households = parseHouseholdsCsv(decodeUtf8(readFileSync('data/households.example.csv')));
    expect(households.map((h) => [h.key, h.displayName, h.salutation, h.guests.length])).toEqual([
      ['Marko i Ana', 'Marko i Ana', 'Dragi', 2],
      ['Porodica Hadžić', 'Porodica Hadžić', 'Dragi', 4],
      ['Šejla', 'Šejla', 'Draga', 2],
    ]);
    const family = households[1]!;
    expect(family.guests.map((g) => [g.name, g.isPlaceholder, g.tableName])).toEqual([
      ['Emir', false, 'Sto 2'],
      ['Lejla', false, 'Sto 2'],
      ['Hadžićevo dijete 1', true, 'Djeca'],
      ['Hadžićevo dijete 2', true, 'Djeca'],
    ]);
  });

  it('keeps household_key and display_name apart (two "Mama i tata" invitations)', () => {
    const csv = [
      HEADER,
      'Mama i tata (Adi),Mama i tata,Dragi,adi,Mama,zena,false,Najbliži Adi,1,',
      'Mama i tata (Zerina),Mama i tata,Dragi,zerina,Mama,zena,false,Najbliži Zerina,1,',
    ].join('\n');
    const households = parseHouseholdsCsv(csv);
    expect(households.map((h) => [h.key, h.displayName, h.side])).toEqual([
      ['Mama i tata (Adi)', 'Mama i tata', 'adi'],
      ['Mama i tata (Zerina)', 'Mama i tata', 'zerina'],
    ]);
  });

  it('ignores the review column and other unknown columns', () => {
    const csv = `${HEADER},telefon\nDula,Dula,Dragi,adi,Dula,gost,false,Generacija sto,1,provjeri obraćanje,061\n`;
    expect(parseHouseholdsCsv(csv)[0]?.guests[0]).toMatchObject({ name: 'Dula' });
  });

  it('accepts ";" (Excel with Bosnian settings), a BOM, diacritics and capitals in enum values', () => {
    const csv = `${BOM}household_key;display_name;salutation;side;guest_name;role;is_placeholder;table_name;sort_order\r\nH1;Šejla;draga;Zerina;Šejla;Žena;DA;;1\r\n;;;;;;;;\r\n`;
    const [h] = parseHouseholdsCsv(csv);
    expect(h).toMatchObject({ key: 'H1', salutation: 'Draga', side: 'zerina' });
    expect(h?.guests).toEqual([
      { name: 'Šejla', role: 'zena', isPlaceholder: true, tableName: null, sortOrder: 1, line: 2 },
    ]);
  });

  it('keeps a comma inside a quoted name and normalises NFD to NFC', () => {
    const nfd = 'Ćazim'.normalize('NFD');
    const csv = `${HEADER}\nH1,H1,Dragi,adi,"Begić, ${nfd}",gost,false,,1,\n`;
    expect(parseHouseholdsCsv(csv)[0]?.guests[0]?.name).toBe('Begić, Ćazim');
  });

  it('orders guests by sort_order', () => {
    const csv = `${HEADER}\nH1,H1,Dragi,adi,B,gost,false,,2,\nH1,H1,Dragi,adi,A,gost,false,,1,\n`;
    expect(parseHouseholdsCsv(csv)[0]?.guests.map((g) => g.name)).toEqual(['A', 'B']);
  });

  it('fails loudly with line numbers on bad rows', () => {
    const csv = [
      HEADER,
      'H1,Ana i Bob,Dragi,adi,Ana,gost,false,,1,',
      'H1,Ana i Bob,Dragi,adi,Bob,ujak,false,,2,', // bad role
      'H2,Cid,Dragi,kum,Cid,gost,false,,1,', // bad side
      'H3,Dado,Dragoj,adi,Dado,gost,false,,1,', // bad salutation
      'H4,Edo,Dragi,adi,,gost,false,,1,', // missing name
      'H1,Ana i Bob,Draga,adi,Fil,gost,false,,3,', // salutation differs within household
      'H1,Drugo ime,Dragi,adi,Goga,gost,false,,4,', // display_name differs
      'H1,Ana i Bob,Dragi,adi,Hana,gost,false,,1,', // duplicate sort_order
      'H5,Iva,Draga,adi,Iva,gost,mozda,,1,', // bad boolean
      'H6,Jan,Dragi,adi,Jan,gost,false,,,', // missing sort_order
    ].join('\n');
    expect(problems(() => parseHouseholdsCsv(csv))).toEqual([
      expect.stringMatching(/^3: role mora biti/),
      expect.stringMatching(/^4: side mora biti/),
      expect.stringMatching(/^5: salutation mora biti Dragi ili Draga/),
      expect.stringMatching(/^6: guest_name je obavezan/),
      expect.stringMatching(/^7: "H1": salutation "Draga" se razlikuje od "Dragi"/),
      expect.stringMatching(/^8: "H1": display_name "Drugo ime" se razlikuje/),
      expect.stringMatching(/^9: "H1": sort_order 1 već koristi red 2/),
      expect.stringMatching(/^10: is_placeholder mora biti true ili false/),
      expect.stringMatching(/^11: sort_order je obavezan/),
    ]);
  });

  it('reports missing required columns', () => {
    expect(problems(() => parseHouseholdsCsv('household_key,guest_name\nH1,Ana\n'))).toEqual([
      expect.stringMatching(
        /^1: nedostaju kolone: display_name, salutation, side, role, sort_order/,
      ),
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
    expect(detectDelimiter('household_key;side;guest_name')).toBe(';');
    expect(detectDelimiter('household_key,side,guest_name')).toBe(',');
  });
});
