// Writes the two files the sheet's import reads (IMPORT.md, Source A; D8,
// D64) from a COPY of docs/reference/boxing.numbers, opening Numbers:
//
//   sheet.csv           the table "Up to 12 rounds" of sheet "Matches", as
//                       Numbers itself exports it to CSV
//   sheet-colours.csv   one line per round cell whose text is coloured:
//                       row,round,colour,boxer
//
//   cp docs/reference/boxing.numbers /tmp/boxing-copy.numbers
//   osascript -l JavaScript scripts/sheet-export.jxa.js /tmp/boxing-copy.numbers "$PWD/data/import"
//
// JavaScript for Automation, not Deno: macOS with Numbers installed. `row` is
// the table's row with the header as row 1, which is the line of sheet.csv.
// Red is a foul and blue a knockdown (D63); the import decides which cells'
// colours mean anything.
ObjC.import('Foundation');

// osascript calls `run` with the arguments.
// deno-lint-ignore no-unused-vars
function run(argv) {
  const [file, outDir] = argv;
  if (!file || !outDir) throw new Error('usage: sheet-export.jxa.js <copy.numbers> <out dir>');
  const SHEET = 'Matches';
  const TABLE = 'Up to 12 rounds';

  const numbers = Application('com.apple.Numbers');
  const doc = numbers.open(Path(file));
  delay(3);
  const table = doc.sheets.byName(SHEET).tables.byName(TABLE);
  const columns = table.columnCount();
  const rows = table.rowCount();
  const shown = table.cells.formattedValue();
  const colour = table.cells.textColor();

  // Numbers exports every table of the document, one file each.
  const exportDir = `${outDir}/numbers-export`;
  doc.export({ to: Path(exportDir), as: 'CSV' });
  doc.close({ saving: 'no' });

  const files = $.NSFileManager.defaultManager;
  const sheetCsv = `${outDir}/sheet.csv`;
  files.removeItemAtPathError(sheetCsv, null);
  if (!files.copyItemAtPathToPathError(`${exportDir}/${SHEET}-${TABLE}.csv`, sheetCsv, null)) {
    throw new Error(`Numbers did not export ${SHEET}-${TABLE}.csv`);
  }
  files.removeItemAtPathError(exportDir, null);

  const quote = (value) => {
    const text = value == null ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const header = shown.slice(0, columns);
  const nameColumn = header.indexOf('Boxer Name');
  const lines = ['row,round,colour,boxer'];
  for (let r = 1; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      if (!/^([1-9]|1[0-2])$/.test(String(header[c]))) continue; // the round columns
      const rgb = colour[r * columns + c];
      if (!rgb || (rgb[0] === 0 && rgb[1] === 0 && rgb[2] === 0)) continue; // black: no colour
      // The sheet has one red and three shades of blue.
      const name = rgb[0] > 0.8 && rgb[2] < 0.3 ? 'red' : rgb[2] > rgb[0] ? 'blue' : null;
      if (name === null) {
        throw new Error(`row ${r + 1}, round ${header[c]}: colour ${rgb} is not red or blue`);
      }
      lines.push([r + 1, header[c], name, quote(shown[r * columns + nameColumn])].join(','));
    }
  }
  $(lines.join('\n') + '\n').writeToFileAtomicallyEncodingError(
    `${outDir}/sheet-colours.csv`,
    true,
    $.NSUTF8StringEncoding,
    null,
  );
  return `${rows} rows; ${lines.length - 1} coloured round cells`;
}
