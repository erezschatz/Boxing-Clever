// Runs the v1 import (IMPORT.md, Source B; task 10) from the dumps in
// data/import/v1/ into the chamber's database, and prints what it did.
//
//   deno task import-v1            the database BOXING_DB names, or data/boxing.db
//   deno task import-v1 -- <dir>   dumps from another directory
//
// Stop the chamber first. The real run starts from a fresh database (D124).
// Running it again writes nothing that is already there.
import { join } from 'node:path';
import { databasePath, openDatabase } from '../server/db/connection.ts';
import { migrate } from '../server/db/migrate.ts';
import { importV1, parseTsv } from '../server/import/v1.ts';

const dir = Deno.args[0] ?? new URL('../data/import/v1/', import.meta.url).pathname;
const table = (name: string) => parseTsv(Deno.readTextFileSync(join(dir, `${name}.tsv`)));

const db = openDatabase(databasePath());
migrate(db);
const report = importV1(db, {
  events: table('event'),
  fighters: table('fighter'),
  weightClasses: table('weight_class'),
  titles: table('title'),
  bouts: table('bout_detail'),
  boutTitles: table('bout_title'),
  docs: JSON.parse(Deno.readTextFileSync(join(dir, 'v1-mongo.json'))),
}, new Date().toISOString());

console.log(`v1 import, batch ${report.batch_id}, into ${databasePath()}`);
console.log(
  `${report.read} bouts read: ${report.written} written, ${report.already} already here, ` +
    `${report.rejects.length} rejected`,
);
for (const line of report.folded) console.log(`folded: ${line}`);
for (const { row_text, reason } of report.rejects) {
  console.log(`rejected: ${row_text}\n    ${reason}`);
}
