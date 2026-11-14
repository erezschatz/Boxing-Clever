// The record compiler (scripts/compile-record.mjs) against this repo's own shape:
// D1–D47 were written by hand as `### D<n> · …` before 2026-11-14, and the first
// decision written in a task file must be numbered after them, not from D1 (D48).
// The fixture holds the compiler's output; `--check` proves it still is, and the
// assertions say what that output must contain. The compiler is a script, not a
// module, so it is run as one.
import { match, strictEqual as assertEquals } from 'node:assert/strict';

const fixture = new URL('./fixtures/record/', import.meta.url);
const compiler = new URL('../scripts/compile-record.mjs', import.meta.url).pathname;

async function check(): Promise<{ code: number; stderr: string }> {
  const out = await new Deno.Command('deno', {
    args: ['run', '--allow-read', compiler, '--check'],
    cwd: fixture.pathname,
    stderr: 'piped',
  }).output();
  return { code: out.code, stderr: new TextDecoder().decode(out.stderr) };
}

Deno.test('a decision from a task file is numbered after the hand-written D47', async () => {
  const run = await check();
  assertEquals(run.code, 0, run.stderr);
  const decisions = await Deno.readTextFile(new URL('docs/DECISIONS.md', fixture));
  match(decisions, /### D47 · 2026-11-08 · Also by hand[^]*<!-- Compiled from tasks\//);
  match(decisions, /\n## D48 · 2026-11-14 · The first decision written in a task file\n/);
  match(decisions, /Source: \[tasks\/01-step\.md\]/);
});

Deno.test("the plan lists each task file with its derived status and the decisions' lines", async () => {
  assertEquals((await check()).code, 0);
  const plan = await Deno.readTextFile(new URL('docs/PLAN.md', fixture));
  match(plan, /^# Plan\n\nA head written by hand\.\n/);
  match(plan, /- \[01-step\]\(\.\.\/tasks\/01-step\.md\) — 01 · A step · done\n/);
  match(plan, /- \[02-open\]\(\.\.\/tasks\/02-open\.md\) — 02 · An open step\n/);
  match(plan, /## Not in scope\n\n- tablets \(D48\)/);
});
