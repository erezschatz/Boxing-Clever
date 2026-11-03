// server/rules/ is pure (CLAUDE.md Code rules, SPEC Architecture): the browser
// imports it as it is, and its tests need nothing running. So it may import
// only its own files, and never reach for Deno's I/O.
import { deepStrictEqual } from 'node:assert/strict';

const RULES = new URL('../../server/rules/', import.meta.url);

Deno.test('server/rules/ imports nothing outside itself and does no I/O', () => {
  const offences: string[] = [];
  for (const entry of Deno.readDirSync(RULES)) {
    if (!entry.name.endsWith('.ts')) continue;
    const source = Deno.readTextFileSync(new URL(entry.name, RULES));
    // `… from 'x'`, a bare `import 'x'`, and a dynamic `import('x')`
    const specifiers = source.matchAll(/(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g);
    for (const [, specifier] of specifiers) {
      if (!/^\.\/[\w-]+\.ts$/.test(specifier)) offences.push(`${entry.name} imports ${specifier}`);
    }
    for (const [call] of source.matchAll(/\bDeno\.\w+|\bfetch\(/g)) {
      offences.push(`${entry.name} uses ${call}`);
    }
  }
  deepStrictEqual(offences, []);
});
