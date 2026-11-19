# The fighter card

## Context

Erez, 2026-11-19: "start task 09: build the fighter card". This is the second
acceptance box of [09 · Design pass](09-design-pass.md), built to the design
in `docs/reference/design/` (`Fighter.dc.html`, and its README's open
choices). It is a task file of its own so that 09 stays open for the restyle
of the other pages and for Erez's check in the browser (see Decisions).

**Promise.** A fighter card that reads at a glance: who they are, their
record, where they stand, and what I have seen them do.

**Acceptance.**
- [x] `/fighters/:id` shows the fighter's name, nickname and colours, and their current record
- [x] It shows their TBRB rank in each class whose latest list names them, with that list's date, and says so when no list names them
- [x] It shows the titles they hold as witnessed: those whose last finalised bout left the belt with them
- [x] It lists their fights as witnessed, newest first, each with the record they took into it, and each opens its scorecard
- [x] A name on `/fighters` opens that fighter's card
- [x] `deno task test` and `deno task check` run green by Claude

## Decisions

### 2026-11-19 · The fighter card is its own task file, under 09

**Decision** — The card is built and recorded in `tasks/fighter-card.md`. Task 09 keeps its four acceptance boxes, and its second one is ticked when 09 closes.
**Rejected** — Appending a `## What was done` to `tasks/09-design-pass.md` for the card alone.
**Why** — A task file with a *What was done* section is done (tasks/README.md), so the plan would call 09 done while the restyle of the other pages and Erez's check in the browser are still open.

### 2026-11-19 · Titles held are worked out from the bouts watched

**Decision** — A fighter holds a title when the last finalised bout that had it on the line left it with them. The winner of a finalised bout takes every title on the line. A draw or a no contest leaves each title with the side that brought it in, and a vacant title stays vacant. Bouts are taken in fight order: event date, then card order. Every finalised bout with that title counts, whoever fought in it. It is a pure rule, `titlesHeld` in `server/rules/titles.ts` (SPEC Scoring §8).
**Rejected** — A stored current holder per title, which nothing writes and the import could not fill. Reading only the fighter's own bouts, which would still show a belt they had lost in a fight between two others, or vacated before one.
**Why** — The app knows titles only through the fights watched. The card says "as witnessed", as the fight list does. A title lost or vacated off-screen still shows until a bout with that title is watched.

### 2026-11-19 · One read endpoint for where a fighter stands

**Decision** — `GET /api/fighters/:id/standing` answers `{titles: [title_id], tbrb: [{weight_class_id, rank, snapshot_date}]}`: the titles held (above), and the fighter's rank on each class's latest TBRB list that names them. A class whose latest list does not name them is left out, which is unranked (D25).
**Rejected** — Building `GET /api/tbrb/fighters/:id` (the rank history, task 12–13's) early for the card. Adding the standing to `GET /api/fighters/:id`, whose shape the fighters page, the forms and the merge read.
**Why** — The card needs the current standing, not the history. The other endpoints stay as they are. Before task 12 there are no lists, so `tbrb` is empty and the card says so.

### 2026-11-19 · The card reads the event dates from the events list

**Decision** — The card loads `GET /api/events` and joins each bout to its event's date, as a page joins ids to names from the reference lists (D34).
**Rejected** — Adding the event date to `GET /api/fighters/:id/bouts`.
**Why** — The data is already served, and the bout's wire shape is shared by every page.

### 2026-11-19 · No webfont yet; the card's styles are its own

**Decision** — The card's display type is a system condensed stack (`Avenir Next Condensed`, `Helvetica Neue` condensed, `Arial Narrow`), and its colours are custom properties scoped to `.fighter-card` in `front/style.css`. The other pages do not change.
**Rejected** — Loading Barlow Condensed and Inter from Google Fonts, as the design reference does. Changing the `:root` properties now.
**Why** — A webfont is a new dependency, and needs a row in SPEC's Stack table. Whether to add one is the restyle's call, for every page at once. Until then, scoping keeps the restyle's "no behaviour change" box about the other pages true.

### 2026-11-19 · From the design, what the card leaves out

**Decision** — Colours are shown as the words typed, not as swatches. A title held has no "won on" date or count of defences. Wins and losses are squares in the "As witnessed" row: filled for a win, open for a loss, grey for a draw, dashed for a no contest.
**Rejected** — Parsing the colour words into swatches. Counting defences from the bouts watched.
**Why** — `colors` is free text ("Blue/Yellow"). A count of defences from the fights watched would be wrong whenever one was missed, and the design's README already lists both as open.

### 2026-11-19 · "Champion" above the name means a title held as witnessed

**Decision** — The card puts a "Champion" chip above the name when the fighter holds at least one title as witnessed (§8), whatever the belt, interim included. A TBRB champion (rank 0) shows as "Champion" in the TBRB panel, and does not get the chip on its own.
**Rejected** — Showing the chip for a TBRB rank 0 as well. Showing it only for a regular belt.
**Why** — The chip follows the titles panel under it, so the two always agree. TBRB's champion is a ranking, and the panel already says it. Which belts count as "real" is not something the app records.

### 2026-11-19 · A side that missed weight can neither take nor keep a title

**Decision** — In §8, where a bout would leave a title with a side marked as having missed weight, the title goes vacant instead. That covers a heavy winner, and a heavy holder who wins, draws or ends in a no contest. A heavy holder who loses loses the belt to a challenger who made weight. `holderAfter` reads `missed_weight_a/b` from the bout.
**Rejected** — Ignoring missed weight, so the winner always takes the belt and the holder keeps it on a draw.
**Why** — Erez, 2026-11-19, asked when the cold review of tasks/fighter-card.md found the gap: "No, it goes vacant". A fighter who misses weight is not eligible for the belt. The mark is the user's, never computed (D26), so the rule reads only what was ticked.

## Review · 2026-11-19

Read cold by an Explore subagent against the staged diff and this file
(`docs/reviewer.md`). It found that the drafts are left out, the ordering
and the latest-list join do what the record says, the rule is pure and cites
§8, the tests go through HTTP and the rule, `resultText`'s output is
unchanged, and there is no schema change, migration or dependency.

### The decisions log and plan entries are not in the staged change

**Found** — `docs/DECISIONS.md` (D68–D73) and `docs/PLAN.md` were compiled but not staged, so the commit would have carried the decisions only in this file.

**Done when**

- [x] The change as committed → `docs/DECISIONS.md` has one entry per `## Decisions` entry here, each with `Source: tasks/fighter-card.md`
- [x] The change as committed → `docs/PLAN.md` lists fighter-card as done
- [x] tasks/09-design-pass.md → unchanged and still open

**Not asked** — rewording the Decisions, or any code change.

### The card shows things the record does not mention

**Found** — `front/fighter-page.ts` `identity()` shows a "Champion" chip when any title is held, and `witnessed()` shows a count of fights watched with tallies and a "First seen" line. Neither the record nor SPEC named them.

**Done when**

- [x] A fighter holding at least one title as witnessed → the record (What was done, SPEC Front end, the decision above) says the card labels them "Champion", for any belt
- [x] A fighter holding none → no chip
- [x] A fighter ranked 0 on a TBRB list but holding no witnessed title → the record says the chip does not show (the decision above)
- [x] The "As witnessed" panel → the record names its fight count, tallies and "First seen" line

**Not asked** — adding defences or "won on" dates, or a new endpoint.

### A winner who missed weight takes the belt

**Found** — `holderAfter` in `server/rules/titles.ts`, and §8 as written, give every title on the line to the winner, and leave it with the holder on a draw or no contest. Neither reads `missed_weight_a/b` (D26, D47). So a challenger who came in heavy and wins is shown holding the belt, and so is a holder who missed weight and drew. Erez stated the rule: it goes vacant (the decision above).

**Done when**

- [x] A finalised bout won by a side marked missed weight → the card shows the holder §8 states for that case, and §8 states one
- [x] A finalised draw or no contest where the side that brought the title in missed weight → the holder §8 states for that case
- [x] A finalised bout where nobody missed weight → the holder is the same as now

**Not asked** — a stored title holder, a schema change, or computing missed weight (D26: it is marked, never computed).

## Review · 2026-11-19, second reading

Read cold by a second Explore subagent against the staged change, after the
missed-weight fix. Every *Done when* line of the three items above holds on
the code path. The missed-weight columns are `0 | 1`, as the rule expects.
It found one gap.

### SPEC does not describe the "As witnessed" counts

**Found** — `docs/SPEC.md` Front end described the "As witnessed" row only as squares. The fight count, the tallies and the "First seen" line were named only in What was done.

**Done when**

- [x] The card's "As witnessed" panel → SPEC Front end names the fight count, the tallies (drawn and NC shown only when there is one) and the "First seen" date
- [x] The squares and the Champion chip → described as now

**Not asked** — a Decisions entry for display copy, a change to the code, or defence counts.

## What was done

2026-11-19. The fighter card at `/fighters/:id`, built to
`docs/reference/design/Fighter.dc.html`.

- **Titles held**: `server/rules/titles.ts` (`holderAfter`, `titlesHeld`),
  pure, as SPEC Scoring §8 now states. A side marked as having missed weight
  can neither take nor keep a belt, which goes vacant (the decision above).
  `listTitleLinesForFighter` in `server/db/bout-title.ts` reads every
  finalised bout carrying a title this fighter has fought for, whoever
  fought in it, in fight order, with both sides' missed-weight marks.
- **TBRB now**: `currentRanks` in `server/db/tbrb-snapshot.ts`, the
  fighter's row on each class's latest list.
- **Endpoint**: `GET /api/fighters/:id/standing` in `server/api/fighters.ts`
  answers both (`Standing`, exported to the browser through `front/api.ts`);
  404 for no such fighter. Nothing else in the API changed.
- **Page**: `front/fighter-page.ts`, routed in `front/app.ts`. It loads the
  fighter, their bouts, their standing, the events (for dates) and the
  reference lists. It shows the identity and record, with a "Champion" chip
  over the name when any title is held as witnessed (the decision above).
  Then TBRB now, titles held, and "As witnessed": one square per finalised
  fight, the number of fights watched with won, lost, drawn and no-contest
  counts (each of the last two only when there is one), and "First seen" with
  the date of the first. Then the fights newest first. Each
  row opens its scorecard (whole-row click, and the opponent's name as the
  link). Each row shows the date, this fighter's corner, the opponent with
  a missed weight noted and the titles with who brought each, the class or
  contracted weight with this fighter's own missed weight, the scheduled
  rounds, W/L/D/NC and how it ended ("not final" when reopened), the record
  that night, the rank then, and my card with their total first.
- **Helpers**: `front/format.ts` gains `howItEnded` (now shared by
  `resultText`, whose output is unchanged), `sideOf`, `outcomeFor` and
  `myCardFor`.
- **Fighters page**: each name in `front/fighters-page.ts` links to the
  fighter's card.
- **Styles**: `front/style.css` gains a block scoped to `.fighter-card` and
  its `fc-` classes. It uses its own colour properties and a system
  condensed font stack, and changes nothing for the other pages.
- **Docs**: SPEC gains Scoring §8, the API row and the card's layout under
  Front end. `docs/TBRB.md` says what "now" means.

Tests:
- `tests/rules/titles.test.ts`, tier 1, covers §8: the winner takes the
  title, a draw or NC leaves it with the holder, vacant stays vacant, and
  the last bout decides whoever fought in it. On missed weight: a heavy
  winner or a heavy holder who wins, draws or ends in an NC leaves it
  vacant; a heavy holder who loses loses it to the challenger; a heavy
  challenger in a draw leaves it with the holder.
- `tests/api/fighters.test.ts`, tiers 2–3, covers the standing endpoint:
  404s, an empty answer, and a sequence where a not-final result moves
  nothing. A bout entered later but fought earlier doesn't override, and a
  draw keeps the belt with the holder. A fight without this fighter takes
  it from them. Rank comes from the latest list per class, and a class whose
  latest list leaves them off is absent. A heavy challenger who wins over
  HTTP leaves the belt with neither fighter.
- `tests/front/shell.test.ts` covers the new format helpers.

Verified 2026-11-19 by Claude: `deno task test` (208 passed) and
`deno task check` run green. `deno lint`'s two errors are in
`.claude/hooks/check-unit.test.mjs`, from before this change. Not yet seen in
the browser: that is Erez's, with 09's last box. The review's three items
are answered in this change. The third, a winner who missed weight, was
answered by Erez's rule.

Reviewed by: two Explore subagents, each a cold read of the staged diff against this file (2026-11-19): the first before the missed-weight fix, the second after it
