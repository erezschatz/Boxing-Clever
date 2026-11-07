# The class dropdown shows each limit

## Context

Asked by Erez, 2026-11-07, while the contracted weight was being built:
"Speaking of weights, it would be nice to have weights themselves in the
dropdowns like I had before, like Fooweight (111 lbs / 33 kg)".

**Promise.** When I choose a class for a bout, I see its limit beside its
name, in pounds and kilograms, as the old app showed it.

**Acceptance.**
- [x] The bout form's class dropdown reads "Name (lbs / kg)", in v1's format
- [x] Heavyweight, which has no limit (D17), says so rather than showing Cruiserweight's
- [ ] Verified by Erez in the browser

## What was done

2026-11-07 (D46), in the same commit as
`tasks/contracted-weight-and-missed-weight.md`, whose weight dropdown it
labels.

v1 wrote `{name} ({lbs} lbs / {kg} kg)` (`front/src/components/Event.tsx`
in `~/dev/Boxing-Clever`, read only). `classText` in `front/format.ts` does
the same from the limits migration 002 seeded: "Flyweight (112 lbs /
50.802 kg)". Heavyweight reads "Heavyweight (no limit)", where v1's seed
gave it 200 lbs. `front/bout-form.ts` uses it for every class in the
dropdown. It is the only class dropdown in the app.

Tested in `tests/front/shell.test.ts`, with Flyweight and Heavyweight.
`deno task test` 183/183. Not checked in the browser by Claude.
