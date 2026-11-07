# 07 · Front: the scorecard page

## Context

**Promise.** Fight night: I open a bout, type 10 and 9 down the card as rounds end,
focus moving on its own, see the running totals, save a draft if I step
away, and come back to it. Each column shows the fighter's corner colour,
whether they are champion, and which belts they brought.

**Acceptance.**
- [x] `/bouts/:id` renders the two-column card from `GET /api/bouts/:id`; running totals via `rules/scoring` in the browser
- [x] Points entry: integer 0–10, focus advances to the next round of the same side after entry; the row being scored and the next are visually marked (v1 behaviour)
- [x] Deduction cell opens the deduction dialog (task 08 supplies the form; a stub here)
- [x] Draft save on demand and on leaving the page; reload restores
- [x] Header per side: name, nickname, corner colour, `(c)` and belt list from `bout_title`, TBRB rank as of the event date when a snapshot exists
- [x] Imported rounds whose deduction is unknown carry a marker
- [x] Verified by Erez on a real fight, standalone

## What was done

2026-11-07. The scorecard page at `/bouts/:id` (new D35).

Where things are:
- `front/scorecard.ts`: the page's logic with no template, so the tests
  can state it. `readPoints` (0–10 as typed, and whether the entry is
  complete, so focus may move), `runningTotals` (through the rules'
  `roundTotal` and `boutTotal`, SPEC §2–3; a deduction in an emptied round
  still counts), `draftToSave` (all or nothing: every typed round from 1
  with no gaps, with the deductions, judges and result as loaded, when the
  rules accept it; only a new last round with one side empty is held back),
  `entriesOf` (a saved card back into the boxes), `beltsOf`, `rankOf` (from
  the snapshot only) and `isAssumed` (the importer's `reason assumed
  (import)` note, D24).
- `front/bout-page.ts`: the page. Header crumb to the event; title, class,
  rounds, and the result once finalised. Per side: corner colour as a bar
  over the column, name with nickname, `(c)` and the belts from
  `bout_title` where that side is holder, the record on the night and the
  TBRB rank once the snapshot exists. Per round: a points box, a deduction
  button (total deducted, `?` and an amber colour when a reason was
  assumed on import), and the round total; bout totals in the footer. The
  focused round is marked and the next one shaded, until focus leaves the
  card. A click in a box selects it, so typing replaces. Save draft button
  with a status line that says live whether the typed card can be saved
  and why not (in the error colour when it cannot). Saves go one at a time,
  and loading waits for them. Save on leaving by link (router `unmount`,
  in turn) and by reload or closing the tab (`pagehide`, a `keepalive`
  fetch at once). A `beforeunload` prompt appears only when the typed card
  cannot be saved, or a half-scored round would be lost. The page counts
  the rounds the server holds from the last card it sent, and is dirty
  only when its boxes differ from the stored card. The deduction dialog is a
  native `<dialog>` that lists the round's deductions and says the form is
  task 08's. A finalised bout is read-only (D35).
- `front/format.ts`: `rankText`, and `recordOnTheNight` moved here from the
  event page so both pages use it. `front/event-page.ts`: the result cell
  links to the scorecard (its text is the result, or "draft").
  `front/app.ts`: the route, and `/bouts/...` marks Events in the header.
  `front/style.css`: the scorecard's styles.
- `docs/SPEC.md`: `scorecard.ts` in the front-end file list, and the
  scorecard line says what D35 decided. `docs/DECISIONS.md`: D35.

Tests: `tests/front/scorecard.test.ts`, ten: points entry and when focus
may move; running totals with a deduction, empty boxes, and a deduction in
an emptied round; a draft sends every typed round and holds back only a new
half-scored one; against rounds 1–8 saved over the API, a typo in round 2,
a box cleared mid-card, the last stored round half cleared, a stored round
emptied and a gap each send nothing, while clearing the last two rounds
sends six; a round the page sent after loading counts as stored, so
half-clearing it sends nothing; a deduction left in a cleared round, or a stored UD on a partly
scored card, sends nothing and says why; a draft sent through the API and
read back gives the same boxes, deductions and totals, equal to the
server's; a draft keeps judges and a result; the importer's note is the
marker; belts, and the TBRB rank only from the first save took the
snapshot.

Run by Claude on the Mac, Deno 2.9.8: `deno task test` 138/138;
`deno task check`, `deno lint`, `deno fmt --check` clean.

Run by Claude in the desktop app's browser pane against the standalone
server (port 8897, `BOXING_DEV=1`, `$BOXING_DB` in the scratchpad), seeded
over HTTP with Usyk v Fury (12 rounds, red corner Usyk holding WBC and WBA
Super), a 4-round Fury v Usyk draft with an assumed-reason knockdown, and
a TBRB list from 2024-12-01 put in with `sqlite3` (Usyk champion, Fury #1).
The event page's "draft" link opened `/bouts/1`; the red and blue bars,
`(c)` and "WBC World · WBA Super World" showed under Usyk. Typing 10, 9, 10
down Usyk's column moved focus a round each time; 9, 10, 1 down Fury's
left the lone 1 in round 3 waiting and Enter moved on; totals read 29 and
20. Save draft with round 3 at 10–1 (the first version, before the
reader's fixes) saved rounds 1–2; that is the cut-back behaviour since
replaced, and the recheck after the fixes is below. A reload showed rounds 1–2,
the records on the night and "TBRB champion" / "TBRB #1". Round 3 typed
and left by the crumb link was on the server afterwards; round 4 typed and
left by loading `/fighters` was too. On bout 2 the round-2 deduction read
`−1?` in amber; its dialog listed "−1 knockdown (reason assumed (import))"
and closed. Finalised over HTTP (UD to Usyk), the page showed "Oleksandr
Usyk · UD 4 (3:00)", read-only boxes and no save button.

Found in the browser and fixed: the dialog was first rendered only when
asked for, and `showModal` ran from a `ref` callback before lit-html had
put it in the document (an `InvalidStateError` in the console); it is now
always in the page and opened from the click. Also seen once: the first
click from the event page to `/bouts/1` showed the URL change while the
screenshot still had the event page; the same click repeated twice later
rendered the scorecard, and the pane's screenshots lagged the DOM
elsewhere in this run, so it is recorded, not explained.

The independent reader (a read-only subagent over the diff and this
section) found that the first draft save cut the card back to the longest
prefix the rules accepted. A save replaces the stored card, so a 9–9 typed
while correcting round 2 deleted rounds 2–8 on the next save or on leaving.
The save is now all or nothing (D35 rewritten before this commit), with
the tests above. Also from the reader: saves could overtake one another,
and a quick leave-and-back could load the card before the leaving save
landed (saves are now in turn, and loading waits); listeners were added
after the load, so a page left while loading leaked them (now added at
mount); totals dropped a deduction whose round was emptied; a click in a
box left the caret after "10", so typing could not replace it; row marks
never cleared; the status line only spoke after Save was pressed. All
fixed. Rechecked in the browser pane after the fixes: clicking Fury's
round-2 box and typing 9 replaced the 10 and the line read "Cannot be
saved: round 2 must be 10–9, 9–10 or 10–10" in red. Leaving by the crumb
left the server's four rounds as they were. Round 5 typed, then the crumb
clicked and Back at once, showed round 5 on the returning page.

A second reader pass found the page still judged "stored" by the card it
had loaded. So a save in flight followed by a half-cleared round and a
leave, or a page back from the browser's cache, could still drop a round.
It also found that retyping a box's old value counted as a change. Both
are fixed (the stored count follows the cards sent and is restored if a
save fails; dirty is a comparison with the stored card), with a test for
the stale count and sharper deduction and rank tests. Rechecked in the
pane by script: rounds 1–5 stored, round 6 typed, Save pressed, then a
tick later round 6's B box cleared and the crumb clicked; the line read
"Cannot be saved: round 6 has one side empty" and the server kept round 6.

Two gaps are left, both on purpose. A reload or tab close while a button
save is in flight sends its keepalive at once, so in that narrow case the
two requests can land out of order. And the page only knows the bout as it
loaded it: if the same bout were finalised from another tab while this one
held typed changes, leaving would send a draft and the server would undo
the result and both records (SPEC §6). One user on one laptop makes that
unlikely. A server-side guard (a draft save refused on a finalised bout
unless asked) would belong with task 08's decision dialog. The prompt on
leaving covers reload and closing the tab, not in-app links, where a
half-scored new round is dropped without asking.

Not covered by a test: the template, focus movement in the DOM, the
leave-the-page saves and the dialog, all checked by hand above.

Left open: the last box. Erez has not scored a real fight on it.

2026-11-07, after Erez's first run (D39).

Focus now goes across, then down. After a score, focus moves to the
other fighter's box in the same round. If that box is already scored, it
moves to the other fighter's box in the next round (`nextBox` in
`front/scorecard.ts`, used by `focusNext` in `front/bout-page.ts`). This
replaces D35's down-the-same-side rule; the lone-1 and marked-row rules
stand.

The word "draft" is gone from the pages:
- The event page links a bout with no result as "Score".
- `resultText` says "… · not final" for a reopened bout's result and
  nothing when there is no result.
- The scorecard says "Save progress", "Progress saved" and "Reopen
  scoring".

Tests: `tests/front/scorecard.test.ts` "after a score, focus goes across
to the other fighter, or on to the next round (D39)" covers both starting
sides, the last round, and going across when the next round is already
scored. `tests/front/shell.test.ts` now states that `resultText` never
says "draft". `deno task test` 158/158; check, lint and fmt clean.

Checked by Claude in the browser pane on the task 08 scratch database:
- The event page listed one bout as "Score" and the reopened one as
  "Oleksandr Usyk · KO 1 · not final".
- On the other bout, typing 10, 9, 9, 10, 10, 10 from round 1 A filled
  1: 10–9, 2: 9–10, 3: 10–10 and left focus on 4 A.
- Starting at 5 B, 9 then 10 filled 5: 10–9 and left focus on 6 B.
- The buttons read Save and End bout. "Save" became "Save progress" on
  Erez's word right after.

The independent reader (a read-only subagent over the staged diff and this
record) found:
- Correcting a score among rounds already scored sent focus to a filled
  box with its score selected, so the next key overwrote it. `nextBox` now
  moves only into an empty box, and otherwise focus stays.
- The "next" row mark no longer showed where focus goes. It now marks the
  round `nextBox` goes to when that is another round.
- Two comments still described the old rule, and the record's wording did
  not match the button label.

All fixed. `tests/front/scorecard.test.ts` now also states that a
correction among scored rounds goes nowhere. `deno task test` 158/158;
check, lint and fmt clean.

Rechecked in the pane on bout 2 of the task 08 scratch database:
- 10, 9, 10, 9 from round 1 A filled 1: 10–9 and 2: 10–9, left focus on
  3 A, and marked only round 3.
- 9 typed over round 1 A left focus on 1 A; round 2 was untouched.
- The buttons read "Save progress" and "End bout".

Not covered by a test: `focusNext` in the page, and the template words
(the tests state `nextBox` and `resultText`).

2026-11-07, from Erez's first fight on it: the boxes did not say whose
they were. Each side's points column is now headed with the fighter's
surname ("Usyk", "Fury") instead of "Pts", in the ink colour, with the
full name as its tooltip (`front/bout-page.ts`). This is a template change
with no rule behind it, so there is no test; it was checked in the browser
pane: the column row read "Rd Usyk Ded Total Fury Ded Total".

2026-11-07, verified by Erez. He scored a real fight on it, standalone:
Jono Carroll v Colm Murphy, 3 Arena, Dublin, 12 rounds. In his words:
"finished the fight, scored, added a winner". The database
(`data/boxing.db`, read by Claude afterwards) holds all 24 round scores
and SD for Carroll from judges 112–116, 116–112 and 117–111. The records
moved once: Carroll 25-7-1 to 26-7-1, Murphy 16-0-0 to 16-1-0. The
snapshot keeps them as they were before the fight. His notes from the run
became D39 (focus across, then down; no "draft" on the pages) and the
surnames over the columns. The last box is ticked on that run. There were
no deductions in the fight; the deduction dialog was checked by Claude in
the pane (task 08).
