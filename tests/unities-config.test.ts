// The gate's configuration (.claude/hooks/unities.json) and the planted scripts.
// Since the 0.6.5 runbook the gate, its tests and the two compilers are the plugin's
// files, unedited, and what is this repo's own is the configuration alone. So this
// states what the configuration must mean for this repo's paths, and that the
// planted copies are the ones the manifest names. The gate's own behaviour is
// pinned by its own tests (`deno task check-unit-test`), not here.
import { deepStrictEqual, ok, strictEqual as assertEquals } from 'node:assert/strict';

const root = new URL('../', import.meta.url);
const read = (path: string) => Deno.readTextFile(new URL(path, root));

type Config = {
  scene: string;
  rules: Record<string, string>;
  required: string[];
  releaseFiles: string;
  run: string;
};
const config: Config = JSON.parse(await read('.claude/hooks/unities.json'));

// Every role whose rule matches. The gate tests each role on its own, so a path that
// matched two would count twice: a source file that also matched `test` would be its
// own test. So each path below is held to exactly the roles named, never "at least".
function rolesOf(path: string): string[] {
  return Object.keys(config.rules).filter((role) => new RegExp(config.rules[role]).test(path));
}

Deno.test('the staging is strict: the commit is the scene (D12)', () => {
  assertEquals(config.scene, 'commit');
});

Deno.test('the chamber, the browser code and the tools are source', () => {
  for (const path of ['server/rules/score.ts', 'front/app.ts', 'scripts/build.ts', 'mod.ts']) {
    deepStrictEqual(rolesOf(path), ['source'], path);
  }
});

Deno.test('a source change must come with a test, a doc line and a task record', () => {
  deepStrictEqual([...config.required].sort(), ['doc', 'task', 'test']);
  deepStrictEqual(rolesOf('tests/rules.test.ts'), ['test']);
  deepStrictEqual(rolesOf('docs/SPEC.md'), ['doc']);
  deepStrictEqual(rolesOf('README.md'), ['doc']);
  deepStrictEqual(rolesOf('CLAUDE.md'), ['doc']);
  deepStrictEqual(rolesOf('tasks/03-rules.md'), ['task']);
});

Deno.test('what must not count toward a scene does not', () => {
  // docs/reference holds binaries; the format file and the template are not records;
  // the gate's own files and the settings are no role at all.
  for (
    const path of [
      'docs/reference/scorecard.png',
      'tasks/README.md',
      'tasks/_template.md',
      '.claude/hooks/check-unit.mjs',
      '.claude/hooks/check-unit.test.mjs',
      '.claude/hooks/unities.manifest.json',
      '.claude/hooks/unities.json',
      'deno.json',
    ]
  ) {
    deepStrictEqual(rolesOf(path), [], path);
  }
});

Deno.test('the changelog is the compiled file, and nothing here is a tombstone', () => {
  deepStrictEqual(rolesOf('CHANGELOG.md'), ['shared']);
  ok(!new RegExp(config.rules.retired).test('TODO.md'));
});

Deno.test('a release touches the changelog and deno.json and nothing else', () => {
  const release = new RegExp(config.releaseFiles);
  ok(release.test('CHANGELOG.md'));
  ok(release.test('deno.json'));
  ok(!release.test('package.json'));
  ok(!release.test('docs/SPEC.md'));
});

Deno.test('the gate runs the compilers with Deno, without -A', () => {
  ok(config.run.startsWith('deno run '), config.run);
  ok(!/(^|\s)(-A|--allow-all)(\s|$)/.test(config.run), config.run);
});

Deno.test('every planted script is the one the manifest names, unedited', async () => {
  const manifest: { files: Record<string, string> } = JSON.parse(
    await read('.claude/hooks/unities.manifest.json'),
  );
  const planted = Object.keys(manifest.files).sort();
  deepStrictEqual(planted, [
    '.claude/hooks/check-unit.mjs',
    '.claude/hooks/check-unit.test.mjs',
    'scripts/compile-changelog.mjs',
    'scripts/compile-record.mjs',
  ]);
  for (const path of planted) {
    // Line endings are left out of the hash, as the gate leaves them out.
    const text = (await read(path)).replace(/\r\n/g, '\n');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    assertEquals(hex, manifest.files[path], path);
  }
});
