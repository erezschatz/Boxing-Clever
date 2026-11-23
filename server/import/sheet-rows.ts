// The Numbers sheet's CSV export read as bouts (IMPORT.md, Source A; task
// 11). The table is one row per line: a row that holds a `Category/Title`
// (and, for the first bout of a card, the `Date/Location`), then the two
// fighters' rows, then a blank one. Nothing here judges a value; it only
// says which cells belong to which bout, and on which line of the file they
// were found, so a reject can name the line.
//
// Pure: no I/O.

// A CSV as Numbers writes it: fields separated by commas, a field holding a
// comma, a quote or a line break wrapped in quotes, a quote inside doubled.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export type SheetFighterRow = {
  line: number; // the line of the CSV, the header being line 1 (D64)
  name: string; // as typed, with `(c)` and whatever else Erez wrote beside it
  colors: string;
  weight: string;
  record: string;
  cells: string[]; // the twelve round cells, trimmed
  total: string;
  decision: string;
  refs: [string, string, string];
};

export type SheetBout = {
  line: number; // of fighter A's row
  // The `Date/Location` cell the bout stands under; '' when none came before it.
  dateCell: string;
  // The `Category/Title` cell of the row above the two fighters; '' when there is none.
  category: string;
  order: number; // 1 for the first bout under a date cell, 2 for the next…
  a: SheetFighterRow;
  b: SheetFighterRow;
};

const COLUMNS = [
  'Date/Location',
  'Category/Title',
  'Boxer Name',
  'Colors',
  'Weight',
  'Record',
  ...Array.from({ length: 12 }, (_, i) => String(i + 1)),
  'Total',
  'Decision',
  'Ref 1',
  'Ref 2',
  'Ref 3',
];

// The bouts of the export, in the order of the file, and the rows that are
// part of no bout (a fighter with no opponent under him).
export function sheetBouts(
  rows: string[][],
): { bouts: SheetBout[]; stray: { line: number; text: string }[] } {
  const header = (rows[0] ?? []).map((h) => h.trim());
  if (COLUMNS.some((name, i) => header[i] !== name)) {
    throw new Error(`sheet.csv does not start with the table's header: ${COLUMNS.join(', ')}`);
  }
  const cell = (row: string[], i: number) => (row[i] ?? '').trim();
  const fighter = (row: string[], line: number): SheetFighterRow => ({
    line,
    name: cell(row, 2),
    colors: cell(row, 3),
    weight: cell(row, 4),
    record: cell(row, 5),
    cells: Array.from({ length: 12 }, (_, i) => cell(row, 6 + i)),
    total: cell(row, 18),
    decision: cell(row, 19),
    refs: [cell(row, 20), cell(row, 21), cell(row, 22)],
  });

  const bouts: SheetBout[] = [];
  const stray: { line: number; text: string }[] = [];
  let dateCell = '';
  let category = '';
  let order = 0;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 1;
    if (cell(row, 2) === '') {
      // Not a fighter's row: a category row, or the blank between bouts.
      if (cell(row, 0) !== '') {
        dateCell = cell(row, 0);
        order = 0;
      }
      category = cell(row, 1);
      continue;
    }
    const next = rows[i + 1];
    if (!next || cell(next, 2) === '') {
      stray.push({ line, text: cell(row, 2) });
      continue;
    }
    order++;
    bouts.push({
      line,
      dateCell,
      category,
      order,
      a: fighter(row, line),
      b: fighter(next, line + 1),
    });
    category = ''; // a category names the one bout under it
    i++;
  }
  return { bouts, stray };
}

// `13/11/2021. Honda Center. Anaheim. CA`: the day, then the place. The day
// is DD/MM/YYYY; a year the sheet cannot mean (`1014`) is refused.
export function sheetDate(cell: string): { date: string; location: string } | { problem: string } {
  const m = cell.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*[.,]?\s*(.*)$/s);
  if (!m) return { problem: `"${cell}" does not start with a date, DD/MM/YYYY` };
  const [day, month, year] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const real = new Date(Date.UTC(year, month - 1, day));
  const exists = real.getUTCFullYear() === year && real.getUTCMonth() === month - 1 &&
    real.getUTCDate() === day;
  if (!exists || year < 1900) return { problem: `"${m[0].slice(0, 10)}" is not a day` };
  return { date, location: m[4].trim() };
}
