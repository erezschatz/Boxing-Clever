// Boxing Clever — Atrium chamber entry point.
//
// A chamber is a library: it exports { domain, displayName, fetch } and never
// owns a server (docs/SPEC.md, "Atrium"). Atrium imports this file and calls
// `fetch`; `deno serve mod.ts` does the same for standalone development, which
// is why there is no `import.meta.main` block and no port in here.

import { Hono } from 'hono';
import { serveFront } from './server/static.ts';

export const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true, version: '2.0.0-draft' }));

// An API path nobody registered is a 404, never the front page (D5).
app.all('/api/*', (c) => c.json({ error: 'not found' }, 404));

// Everything else is the front end (task 06 fills front/).
app.get('*', (c) => serveFront(c.req.raw));

export default {
  domain: '', // placeholder — set by Atrium from chambers.json at registration
  displayName: 'Boxing Clever',
  fetch: app.fetch,
};
