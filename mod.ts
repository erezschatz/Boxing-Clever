// Boxing Clever — Atrium chamber entry point.
//
// A chamber is a library: it exports a fetch handler and never owns a server
// (docs/SPEC.md, "Atrium"). The `import.meta.main` block below is the only
// place a port is opened, and only for standalone development.
//
// Task 01 fills this in. Until then it answers one route so the toolchain
// can be proven green.

import { Hono } from 'hono';

export const app = new Hono();

app.get('/api/health', (c) => c.json({ ok: true, version: '2.0.0-draft' }));

export default {
  domain: '', // placeholder — set by Atrium from chambers.json at registration
  displayName: 'Boxing Clever',
  fetch: app.fetch,
};

if (import.meta.main) {
  const port = Number(Deno.env.get('BOXING_PORT') ?? 8890);
  Deno.serve({ port }, app.fetch);
}
