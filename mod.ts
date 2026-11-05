// Boxing Clever — Atrium chamber entry point.
//
// A chamber is a library: it exports { domain, displayName, fetch } and never
// owns a server (docs/SPEC.md, "Atrium"). Atrium imports this file and calls
// `fetch`; `deno serve mod.ts` does the same for standalone development, which
// is why there is no `import.meta.main` block and no port in here.

import { dirname } from 'node:path';
import { createApp } from './server/api/app.ts';
import { type Database, databasePath, openDatabase } from './server/db/connection.ts';
import { migrate } from './server/db/migrate.ts';

// Opened on the first request that needs it, not at import, so importing the
// chamber (Atrium, the tests) touches no file. Opening brings the schema up to
// date, so a fresh clone or a deploy serves a current database (D29).
let db: Database | undefined;
function database(): Database {
  if (!db) {
    const path = databasePath();
    Deno.mkdirSync(dirname(path), { recursive: true });
    const opened = openDatabase(path);
    migrate(opened); // cached only once it succeeds, so a failed migration is retried
    db = opened;
  }
  return db;
}

export const app = createApp(database);

export default {
  domain: '', // placeholder — set by Atrium from chambers.json at registration
  displayName: 'Boxing Clever',
  fetch: app.fetch,
};
