# 08 · Front: forms

## Context

**Promise.** I can add a fighter, an event and a bout — with corners, weight class,
scheduled rounds and titles with who holds them — enter a deduction with a
reason, and end a bout with the decision dialog, all without leaving the
page I am on.

**Acceptance.**
- [x] Dialogs over native `<dialog>`: fighter (create/edit, weight in any unit), event, bout (fighters by search, corners, class, rounds, titles + holder side), deduction (points, reason), decision (type, winner, round, time, three judges)
- [x] Decision dialog sends codes; the stoppage round is handled by the rules, not the form
- [x] Fighter merge from the fighters page
- [ ] Verified by Erez: a full event entered and scored from an empty database, standalone

## What was done

2026-11-07. Every form as a dialog over the page, the decision dialog
with the card's shape left to the rules, and the two guarded dialogs whose
APIs task 04 built (new D36, D37; their records are in
`tasks/guarded-bout-delete.md` and `tasks/merge-asks-before-records-move.md`).

Where things are:
- `front/dialog.ts`: `DialogForm`, a native `<dialog>` made on `open()`
  and removed on close, answering a promise with what the form made, or
  null on Cancel or Escape. `attempt()` runs a request with the form busy
  and shows a refusal in the form. `Confirm` is a question with one action.
  `front/api.ts`'s `ApiError` now carries the body, and its message lists
  zod's issues or the rules' problems, so a form says what to fix. `json()`
  makes a write.
- `front/entry.ts` (pure): `readWeight` and `weightText` (lbs, kg, and
  stone as "S L O"; stored in pounds, D36), `findFighters` (every word,
  any order, accents ignored, shortest name first), `winnersFor`,
  `roundAsked` and `readJudge`.
- `front/event-form.ts` (date defaulting to today, location),
  `front/fighter-form.ts` (names, nickname, colours, weight with unit,
  changing the unit keeps the weight, and the record, correctable on
  edit), `front/bout-form.ts` (each fighter by search, or "+ New fighter
  …" opening the fighter form over it with the typed name split into first
  and last; a finalised bout's fighters locked, D30; corner of A, class,
  rounds; titles of the bout's class with holder A/B/vacant, and "+ New
  title" saving a title for the class on the spot),
  `front/deduction-form.ts` (the round's deductions with remove, and add:
  points 1–10, reason, note; read-only when finalised),
  `front/decision-form.ts` (code with its label, the winners that code
  allows, kept when still allowed after a change; the round asked for a
  stoppage and prefilled from the last typed round, filled with the
  schedule for a distance decision, optional for NC; time; three judges).
- `server/rules/scoring.ts`: `shapeForResult` (§4), the card a result
  implies. `front/scorecard.ts`: `finalCard` (the rounds scored on both
  sides, shaped and checked by the rules) and `lastTyped`.
- `front/bout-page.ts`: the deduction button opens the deduction form;
  "End bout" opens the decision form, which finalises through `finalCard`
  in turn with the draft saves. A finalised bout shows "Change decision"
  and "Reopen as draft" (a `Confirm`; D32 takes the result off the
  records). The task-07 placeholder dialog is gone. The save queue moved to
  `front/card-saves.ts` and the side header to `front/side-head.ts`; the
  page is still ~440 lines, over the ~400 split rule, with the save logic,
  dialog openers and template kept together on purpose.
- `front/events-page.ts`: "New event", which opens the new event's card.
  `front/event-page.ts`: "edit" for the event, "Add bout", and "edit" and
  "delete" per bout (`front/bout-delete.ts`). `front/fighters-page.ts`:
  "New fighter", and "edit" and "merge…" per row (`front/merge-form.ts`).
  `front/style.css`: buttons and the dialogs.
- `server/api/bouts.ts` and `fighters.ts` export the delete and merge
  preview types; their behaviour is unchanged.
- `docs/SPEC.md`: the fighter's weight in pounds (D36), the forms, and how a
  finalised card is changed. `docs/DECISIONS.md`: D36, D37.

Tests:
- `tests/rules/scoring.test.ts`, six new tier-1 tests for
  `shapeForResult`:
  - a KO in round 3 makes round 3 0–0, keeps its knockdown and drops round
    4 with its deduction;
  - a TKO adds the 0–0 round when it was not typed;
  - a TD keeps its last round as scored;
  - a points decision, an NC over the distance and an unscored card are
    left alone, while an NC before the last round is stopped;
  - a gap before the stoppage stays, so `validateCard` refuses it;
  - a knockdown and a KO in round 1, with nothing else, is round 1 at 0–0.
- `tests/front/forms.test.ts`, ten:
  - weights in three units and back, kept to the hundredth shown;
  - fighter search;
  - winners and round per code, the winner kept across a code change, and
    judges;
  - End bout on a KO with round 3 half typed: shaped, accepted by the API,
    round 3 at 0 / −1 for B, records moved;
  - a UD on a half-scored card is refused with the reason;
  - reopen keeps the card and result, takes the count off both records; a
    round corrected while reopened is finalised again;
  - a round-1 KO after a knockdown with nothing typed: the dialog offers
    round 1, the card is round 1 at 0–0, and it can be reopened;
  - End bout drops nothing typed: one column only, points after the end,
    and a deduction after the end are each refused, while the stoppage
    round may be half typed;
  - the same finalised card saved twice moves the records once;
  - a title of another class is caught, and a fighter edit sends only
    what changed.

Run by Claude on the Mac, Deno 2.9.8: `deno task test` 154/154;
`deno task check`, `deno lint`, `deno fmt --check` clean.

Run by Claude in the desktop app's browser pane, standalone (port 8898,
`BOXING_DEV=1`, a new empty `$BOXING_DB` in the scratchpad):
- "New event" with Enter made Kingdom Arena, Riyadh, and opened its card.
- "Add bout": typing "Oleksandr Usyk" offered "+ New fighter", whose form
  came prefilled with the name. Weight 226 lbs, 22-0-0 (14 KOs); saved, he
  came back chosen as A.
- Tyson Fury, with nickname and stone weight "20 1 0", was stored as 281
  lbs, unit st; his edit form later showed "20 1 0" again.
- "+ New title" with WBC made WBC World for heavyweight, set held by Usyk.
  The bout saved, and the card listed it with the belt and holder.
- On the scorecard: 10s and 9s for rounds 1–3, and one knockdown on Fury
  in round 3 through the deduction dialog (totals 30–26).
- End bout, KO, Usyk, round prefilled 3, time 2:01: the page showed "KO 3
  (2:01)". The server held rounds 1–2 as typed and round 3 at 0–0 with the
  knockdown; Usyk went to 23-0-0 (15 KOs), Fury to 34-1-1.
- "Change decision" to UD stayed open with "round 3 must be 10–9, 9–10 or
  10–10; a UD goes the distance: score all 12 rounds".
- "Reopen as draft" asked, then put both records back and the boxes
  editable. End bout finalised it again. That first reopen sent the card
  with its result, as it does now. The round-1 recheck below was run after
  the reader's fixes.
- The guarded delete and the merge, as their task files record.

Found in the pane and fixed before this commit:
- the dialogs' grid overflowed (inputs kept their intrinsic width);
- the record fieldset picked up the `.record` mono style by name;
- the chosen fighter's row crowded its "change" link;
- changing the decision type dropped a winner the new type still allows
  (KO for Usyk → UD asked "who won?");
- the delete's done table read "Now / Now" and offered Cancel.

The independent reader (a read-only subagent over the diff and these
records) found these, all fixed before this commit and set down in D37:
- A KO in round 1 after a knockdown could not be finalised. A card with
  only a deduction now counts as scored.
- End bout could save an empty card when one column was typed, or drop real
  rounds when the round it offered was wrong. It offered the last typed
  round and ignored deductions. Now it offers the last round with anything
  in it, and refuses rather than drops.
- A leaving save made during a finalise could have sent a draft over it
  and undone it. Draft saves are now held off while a finalise or reopen
  is under way, and checked again when their turn comes.
- The bout form kept another class's titles after a class change.
- A fighter or title made in a cancelled bout form was lost to the page,
  inviting a duplicate.
- Escape during a save hid the answer, and an open dialog outlived Back.
- A fighter edit from a stale list could write an old record back.
- Typed pounds were not kept to the shown hundredth.
- Change decision did not say that the records change.
- Some claims here were wrong, including the test count.

Trying one fix in the pane showed it was wrong. Reopening without the
result was refused by the server, since a KO's 0–0 round needs the KO. So
reopen keeps the result, as D32 had it, and there is a test for that case.

Rechecked in the pane after the fixes, on the same scratch database with a
fresh 10-round draft:
- A knockdown on Fury in round 1 and End bout as KO: the dialog offered
  round 1, and the card saved as round 1 at 0–0, Fury −1.
- "Change decision" showed its title and the warning about the records.
- "Reopen as draft" kept the KO and put both records back.
- The bout form with WBC World (heavyweight) on the line, switched to
  Lightweight, refused to save: "not a title of this class: WBC World".

Not rechecked in the pane: Escape while busy, Back with a dialog open, and
the hold on draft saves during a finalise. They are small and read in the
code, but not exercised.

Not covered by a test: the dialogs' templates and their open/close, the
bout form's search and titles, the page buttons, and the page's save queue
around a finalise (the tests drive `finalCard` and the API, not
`BoutPage`). The first three were checked by hand above.

Not built, and not asked by this task: reordering bouts on a card (a new
bout goes last), deleting an event from the page (the API has it, D23),
and editing a fighter from anywhere but `/fighters` (the fighter card is
task 09).

Left open: the last box. Erez has not entered and scored a full event on
it.

2026-11-07, after Erez's first run. He added an event, typed two names
and a title, and Save said "choose both fighters": the search box only
searched, and nothing said a click was needed. Fixed in
`front/bout-form.ts` (D38):
- A name typed in full is listed first. The top match is highlighted, the
  arrow keys move it, and Enter takes it.
- On Save, or on Enter with an empty list, `resolveTyped` in
  `front/entry.ts` judges the text against every fighter. A name typed in
  full is taken without a click. Otherwise the form says per side what to
  do: pick from the list, pick one of two who share the name, the name is
  already the other fighter, or add the fighter. Only that last case makes
  Enter open the new fighter form.
- Adding a fighter clears the old error. Enter that confirms an IME
  composition is ignored.
- The match list has a border, so it reads as a list to choose from.

Tests in `tests/front/forms.test.ts`:
- a full name with or without the nickname, accents and quotes optional,
  names its fighter; part of one fighter's name and a shared name do not;
- a full name is the top match, so Enter and Save agree (Joe "Bomber" Lee
  before Joe Leeds);
- `resolveTyped` finds a full name past the first eight matches, says when
  the name is the other fighter's, leaves a shared name to the user, and
  tells "pick" from "add".

`deno task test` 157/157; check, lint and fmt clean.

An independent reader found the first version of this fix:
- judged only the eight listed matches;
- let the other side's choice settle a shared name;
- told the user to add a fighter who was already on the other side;
- could take one fighter on Enter and another on Save;
- left the old error up after an add;
- and acted on IME Enter.

All fixed above.

Checked by Claude in the browser pane on the scratch database (the first
version; the messages are unchanged in the second):
- "usy" then Enter chose Usyk. "Tyson Fury" was typed in full and not
  clicked; Save made the bout Usyk v Fury.
- "Joe Nobody" and "Tyson" then Save said: Fighter A: "Joe Nobody" is not
  in the list; add them with + New fighter. Fighter B: pick "Tyson" from
  the list (click, or Enter).
- Enter on "Joe Nobody" opened New fighter with Joe / Nobody filled in.

Rechecked in the pane after those fixes: "fury" then Enter chose Fury for
A. "Tyson Fury" typed for B, then Enter, said Fighter B: "Tyson Fury" is
already the other fighter, and no new fighter form opened.

2026-11-07, after Erez scored a full fight on it ("finished the fight,
scored, added a winner"), with no deductions in that bout.

From his notes:
- The decision dialog now works out a points decision from the judges'
  cards (D41). `decisionFromCards` in `server/rules/decisions.ts` gives
  3–0 UD, 2–1 SD, 2 + even MD, two even MT, three even or 1–1–1 D.
  `DecisionForm.judged` fills the type and winner once all six totals are
  in, while the decision goes the distance, and says so under the select;
  choosing another type clears that line.
- The judges' grid has a header row with each fighter's name over their
  column. Before, the names were only in the legend, as "A – B".

Test: `tests/rules/decisions.test.ts` "§5, D41: a decision that went the
distance follows from the three cards" covers UD, SD for either side, MD,
MT, the two draw shapes, and nothing until all six totals are in.
`deno task test` 159/159; check, lint and fmt clean.

Checked by Claude in the browser pane: on a 12-round draft, End bout with
cards 115–113, 113–115, 116–112 typed (Tab between them) gave "SD for
Oleksandr Usyk, from the cards (2–1)", the select on SD, Usyk checked and
round 12, with both names over the judges' columns.

Not covered by a test: `judged` itself (the rule is tested, the dialog
was checked by hand).

The independent reader (a read-only subagent over the staged diff)
confirmed the classification for all ten combinations of three cards, and
found:
- A decision the user picked by hand was overwritten by the cards on the
  next edit to any judge box. The same happened to a generic DEC, and to a
  finalised bout's stored result on "Change decision", where fixing one
  judge's total could have changed the result and both records.
- Picking a winner left a stale "from the cards" line.

Fixed: `fillFromCards` (`front/entry.ts`) fills only UD/SD/MD/MT/D, and
only while the decision is not the user's. Picking a decision or a winner,
or opening the dialog on a bout with a result, makes it the user's. The
reader also found gaps in the tests: UD and MD for B, MT for A, a missing
A total, four cards. All are added, along with a test of `fillFromCards`.
`deno task test` 160/160; check, lint and fmt clean.

Rechecked in the pane: the cards filled "SD for Oleksandr Usyk, from the
cards (2–1)". Picking Fury cleared the line and kept Fury, and changing
judge 3's total afterwards left SD for Fury as picked.
