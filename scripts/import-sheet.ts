// Runs the Numbers sheet's import (IMPORT.md, Source A; task 11) from
// data/import/sheet.csv and data/import/sheet-colours.csv into the chamber's
// database, and prints what it did.
//
//   deno task import-sheet            the database BOXING_DB names, or data/boxing.db
//   deno task import-sheet -- <dir>   the two files from another directory
//
// Stop the chamber first, and copy the database aside: this batch goes into
// the one v1's import filled. Running it again writes nothing that is
// already there. Both files are written by scripts/sheet-export.jxa.js; without
// the colours every foul would arrive as a knockdown, so there is no run
// without them (D64).
import { join } from 'node:path';
import { databasePath, openDatabase } from '../server/db/connection.ts';
import { migrate } from '../server/db/migrate.ts';
import { importSheet } from '../server/import/sheet.ts';

const dir = Deno.args[0] ?? new URL('../data/import/', import.meta.url).pathname;
const read = (name: string) => Deno.readTextFileSync(join(dir, name));

const db = openDatabase(databasePath());
migrate(db);
const report = importSheet(
  db,
  read('sheet.csv'),
  read('sheet-colours.csv'),
  new Date().toISOString(),
);

console.log(`sheet import, batch ${report.batch_id}, into ${databasePath()}`);
console.log(
  `${report.read} bouts read: ${report.written} written, ${report.already} already here, ` +
    `${report.rejects.length} rejected`,
);
for (const line of report.snapshots) console.log(`record on the night added: ${line}`);
for (const { row_text, reason } of report.rejects) {
  console.log(`rejected: ${row_text}\n    ${reason}`);
}
