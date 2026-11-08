# A missed weight is noted quietly

## Context

Asked by Erez, 2026-11-08, after trying
`tasks/contracted-weight-and-missed-weight.md` in the browser: "the whole
'missed weight' is something I encounter once a month or two so no need to
be that prominent. functionality works though". Then, to the proposal of a
plain line in the form and a muted note on the pages: "Yes, tone it down".

**Promise.** When a fighter missed weight I still see it beside their name,
but it no longer shouts, and the bout form does not give a rare question a
box of its own.

**Acceptance.**
- [x] The card and the scorecard say "(missed weight)" after the side that
  missed it, small, italic and muted, instead of a yellow badge in capitals
- [x] The bout form asks on one plain line, "Missed weight:" and a tickbox
  per fighter, with no bordered box or heading
- [x] DECISIONS has the change as D47, overriding "prominently" in D26
- [ ] Verified by Erez in the browser

## What was done

2026-11-08. `missedWeightNote` in `front/format.ts` gives the words, or ''
for a side that made weight; `front/side-head.ts` (the scorecard) and
`front/event-page.ts` (the card) both use it, so the two pages say the same
thing. In `front/style.css`, `.missed` is now the muted colour, 0.85rem and
italic, and the `--warn` and `--warn-ink` colours it used are gone, since
nothing else used them. In `front/bout-form.ts` the missed-weight fieldset
and its legend became a `div` with "Missed weight:" before the two
tickboxes, on one wrapping line; a new rule in `front/style.css` makes the
whole line, fighter names included, small and muted. The `div` keeps the
fieldset's grouping for screen readers with `role="group"` and an
`aria-label`. The form's comment says why it is one line. What is stored
and sent is unchanged.

SPEC *Front end* now says the card notes a missed weight quietly and the
scorecard notes it, where it said "marked" and "to stand out"; the bout
form's line says "on one plain line"; the fighter card (task 09) names
`missedWeightNote`. D47 records the change and what it replaced, and PLAN
lists this task.

Tested in `tests/front/shell.test.ts`: the side that missed weight gets
"(missed weight)" and the other gets nothing.
