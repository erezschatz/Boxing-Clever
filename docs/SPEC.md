# Boxing Clever — Specification

Version 2.0.0-draft. An Atrium chamber: Deno + Hono on the server, lit-html in
the browser, one SQLite database. One user, scoring fights on a laptop while
watching them, and keeping every fight and fighter watched.

This is the *what* and the *how*. The *why* is in [DECISIONS.md](DECISIONS.md);
the order of work is in [PLAN.md](PLAN.md); the predecessor is described in
[BOXING-CLEVER-V1.md](BOXING-CLEVER-V1.md). When this file and the code
disagree, fix one of them in the same scene.

## Why this project exists

Version 1 (NestJS + React, MySQL + MongoDB) does the job and is in daily use.
It was started as a way to try a stack, and the stack is the problem: two
frameworks, two databases and ~470 packages to serve 28 endpoints and four
pages for one user. It also stopped short of what the data is for:

- the fighter card is crowded and unfriendly;
- a title fight does not say who the champion is, nor which belt each
  fighter brought to a title-for-title fight;
- TBRB rankings — the one ranking the user trusts — are absent;
- red and blue corners are not recorded;
- ~1,100 fights scored by hand in a Numbers sheet (Nov 2021 → Apr 2025) are
  not in the database.

Version 2 keeps v1's behaviour where it was right (the scorecard, the
pre-fight snapshot, the record update on finalise), fixes what was wrong (the
stoppage-round defects, record atomicity, 200-for-missing), moves to the
house platform, and adds the four features above plus the import. The
long-term reason for a relational database is the second purpose of the
app: one day, chart a fighter's trajectory *as witnessed* — record, weight,
ranking, results — across every fight watched.

## Scope

### Phase 1 (this repo, now)

Parity with v1 **plus**:

- Corners. Each bout records which fighter is red and which is blue.
- Champion and titles. A title bout records, per title, which side held it
  coming in (A, B, or vacant). The scorecard and fighter card show it.
- TBRB rankings. A daily scrape of tbrb.org stores dated snapshots; a bout
  shows each fighter's rank (or champion) *as of the fight*, and the fighter
  card shows the current one. Historical back-fill is a manual tool fed one
  archive page at a time (TBRB.md).
- Imports. v1's MySQL + MongoDB data, and the Numbers sheet, both through
  one staged importer with a rejects report (IMPORT.md).
- Fighter card redesign, and a design pass over the whole front end.
- Real URLs (deep links, back button) instead of v1's atom router.
- Server-side tests at three tiers (see Testing); the suite is green before
  every deploy.

### Explicitly out of phase 1

- Mobile / touch layout. The laptop is always at hand when watching (D9).
- Public access, more than one user, any permission model. Atrium's login is
  the only gate (D2).
- Charts, trajectories, statistics pages. Phase 2; the schema must not make
  them harder, nothing in phase 1 is done *for* them.
- Offline / service worker. v1's service worker is not carried; the
  manifest is, for an installed window with the grid mark as its icon
  (D97, superseding D10).
- Automated TBRB history back-fill from archive.org. Manual tool only.
- Browser end-to-end tests (Playwright). Parked (D11).
- Other ranking bodies (Ring, BoxRec).

## Atrium

The server is a chamber: `mod.ts` exports `{ domain: '', displayName:
'Boxing Clever', fetch }` satisfying Atrium's `Chamber` interface. `fetch` is a
Hono app's handler. Routes under `/api/*` are the API (an unregistered API path is a
404, never the page); everything else is served from `front/` by the
chamber's own small static handler (`server/static.ts`, index.html
fallback), so the repo runs without Atrium checked out. Atrium owns auth
(session cookie on the Atrium domain), TLS, the process and the import map;
the chamber owns nothing of that. `deno serve mod.ts` boots the same handler
on a local port for development; there is no `import.meta.main` block.

Deployment: the repo is symlinked into Atrium's `chambers/` and registered in
`chambers.json`; its dependencies are added to Atrium's import map. One
process, one dependency list, one login.

## Architecture

```
browser (lit-html, fetch)  ──►  /api/*  Hono routes (server/api/)
                                   │        validate (zod) → call
                                   ▼
                            server/db/*  hand-written SQL over node:sqlite
                                   │
                            server/rules/*  pure functions: scoring, decisions,
                                            records, stoppage rule — no I/O
```

- `server/rules/` is imported by both `server/api/` and `front/` (the browser
  computes running totals with the same functions the server validates with).
  It imports nothing outside itself (its files may import each other), and
  a test enforces it.
- `server/db/` is one module per table (`fighter.ts`, `round-score.ts`, …),
  each exporting plain functions that take a `Database` and parameters;
  `connection.ts` opens the file with foreign keys on. Updates take the
  whole row (the API merges a PATCH first), so no SQL is assembled. Transactions are explicit:
  `transaction(db, work)` in `connection.ts` wraps BEGIN/COMMIT/ROLLBACK, and the API
  handler that needs several tables to move together (merge, the guarded delete, a bout
  with its titles) calls it around the db functions.
- `server/api/` is one file per resource (`fighters.ts`, `events.ts`, `bouts.ts`,
  `titles.ts`, `weight-classes.ts`), each with its zod schema and its routes;
  `http.ts` holds what they share and `app.ts` mounts them. `mod.ts` opens the
  database on first use and migrates it (D29); the tests hand `createApp` an
  in-memory one.
- `server/migrations/NNN-name.sql` are applied by `server/db/migrate.ts`
  (~50 lines: a `schema_version` table, apply in order, each file and its
  version row in one transaction).
- `front/` is static ESM, flat: `index.html` (the import map that pins
  lit-html, the header, sticky at the window's top (D109), with the grid
  mark (`mark.png`) beside the name, the
  sections and the slot a page's bar goes in, the `<main>`, the icon and
  manifest links),
  `style.css`, `manifest.json` and the grid mark's icons (`favicon-32.png`,
  `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, from
  `docs/reference/brand/mark.png`), `app.ts` (the route
  table), `component.ts` (the base class and its store), `router.ts`,
  `api.ts` (fetch, and the wire shapes imported as types from the server),
  `format.ts` (names, records, dates, results as the pages say them),
  `scorecard.ts` (the scorecard's entry, totals, draft and finished card,
  pure), and
  one `*-page.ts` per page. The browser loads one script, `/app.js`:
  `app.ts` bundled with the pages and `server/rules/` by Deno's own bundler,
  on every request in dev (`BOXING_DEV`, set by `deno task dev`) and once by
  `deno task build` into `front/dist/app.js` for deployment; lit-html stays
  a bare import for the page's import map (D7, D33).

## Data model

SQLite, one file, `data/boxing.db` (gitignored). Dates are ISO text. Money,
none. All ids are `INTEGER PRIMARY KEY`.

| Table | Holds | Notes |
|---|---|---|
| `weight_class` | the 18 classes: name, alternate name, lbs, kg | seeded by migration 002 in v1's order; Heavyweight's limit is null (D17) |
| `fighter` | first/last name, nickname, colors, weight (pounds) + the unit it is typed and shown in (D36), **current** record (won, lost, draws, nc, kos) | the record is derived data that is stored: typed in on creation and correctable by hand (D28), updated transactionally on finalise, recomputable by `scripts/recompute-records.ts`, which rebuilds it from bouts and adds the fighter's `record_adjustment` rows (D13, D57) |
| `fighter_alias` | fighter_id, alias text | names as TBRB and the sheet spell them; merge keeps aliases; an alias names one fighter (D19) |
| `event` | date, location | |
| `bout` | event_id, card_order, weight_class_id **or** contracted_weight (pounds; exactly one of the two, D26, D45), scheduled_rounds, fighter_a_id, fighter_b_id, **corner_a** (`red`/`blue`, null when not recorded), **missed_weight_a/b** (0/1, marked by the user, never computed; D26), a/b **as-of snapshot** (record ×5, weight, unit, colors, tbrb_rank), result (decision_type, winner `A`/`B`/`draw`/`none`, round, time), judges ×3 ×2, is_draft | there is no catchweight class: a bout fought at a weight that is no class's limit records that weight (migration 004); the snapshot is what v1's Mongo document was for and is kept on purpose (D4); its columns are `a_won` … `a_tbrb_rank`, `b_won` …, null until first save; result columns `decision_type`, `winner`, `result_round`, `result_time`; judges `judge1_a` … `judge3_b` |
| `round_score` | bout_id, round_no, side, points | one row per fighter per round actually scored; the stoppage round has points `0`, except a retirement's (a TKO at 3:00, D55), which is scored (see Scoring) |
| `deduction` | bout_id, round_no, side, points, reason | reasons: knockdown, low blow, holding, headbutt, other — a free text alongside |
| `title` | sanctioning_body, area (`World`, `World Silver`, `European`…), weight_class_id, interim (0/1) | unique on the four; a belt is regular or interim, nothing else; vacancy is the fight's, by `bout_title.holder_side` (D42) |
| `bout_title` | bout_id, title_id, holder_side (`A`/`B`/`vacant`) | champion and title-for-title fall out of this |
| `tbrb_snapshot` | snapshot_date, weight_class_id, rank (0 = champion), fighter_name, fighter_id (nullable) | one row per ranked name per snapshot; resolution to `fighter_id` by alias, never fuzzy (TBRB.md) |
| `record_adjustment` | fighter_id, opponent_id, won, lost, draws, nc, kos, bout_description, bout_date | a result kept in the record after its bout was deleted with *keep the records*: what it added to that fighter's record, and which fight it was (the opponent, `A vs B, UD`, the event's date). Written for both fighters in the delete's transaction; a merge moves the duplicate's to the target and repoints the duplicate as opponent (D57, D62) |
| `import_batch`, `import_reject` | source, started_at, counts; row text + reason | the staged importer's audit trail (IMPORT.md) |

Constraints: the schema refuses shapes no card could have; the rules judge
the card as a whole (D18). A deduction references its side's `round_score`
row, so none can exist in an unrecorded round.

What is *not* a table: a `violation_type` lookup — reasons are a checked
string; a `judge` table — three ring-side cards per bout is the whole model.

## Scoring (the rules — `server/rules/`)

These are the statements the tier-1 tests make. v1's CLAUDE.md is their
origin; the three stoppage defects there are fixed by construction here.

1. A scored round is 10 points to the winner and 9 to the loser; 10–10 is
   allowed; 10–8 and lower are entered as deductions, not as points. Points
   are integers 0–10.
2. A round total is `points − Σ deductions` for that side and round.
3. A bout total is the sum of round totals over recorded rounds.
4. **Stoppage rule.** Rounds completed before the stoppage are scored
   normally. The stoppage round is recorded with points `0` for both sides,
   carrying only the deductions that happened in it (a knockdown then a stop
   reads points 0, total −1 — *not* a 10–8 round). Rounds after the stoppage
   are not recorded. There are no gaps: every round up to and including the
   stoppage round has a row for both sides. The one exception is a corner
   retirement, a `TKO` at 3:00 (D55): its round was fought in full, so it is
   scored like any other, and the card ends there. A KO, a DQ, or a TKO at
   any other time keeps the 0–0 round.
5. Decision types: `UD` `MD` `SD` `DEC` (unspecified points win), `KO` `TKO`
   `TD` `DQ` `NC` `MT` `T` (majority/technical draw) `D` (draw). There is
   no `RTD`: a corner retirement after round X is a `TKO` at 3:00 of round
   X (D55; migration 005 converted the stored ones).
   Winner is a side for the first group and for KO/TKO/TD/DQ; `draw` for
   MT/T/D; `none` for NC. The wire carries the code, never a display label.
   Which card shape each code implies (D20, D22, D55): `KO` `TKO` `DQ` end
   in a stoppage round (§4) and need the result round, except a `TKO` at
   3:00, a retirement, whose round was fought in full and is scored like any
   other, with nothing after it; `TD` and `T` were
   stopped and went to the cards, so they need the result round too but
   score it like any other round, and nothing comes after it; `UD` `MD` `SD`
   `DEC` `MT` `D` go the distance, every scheduled round scored; `NC` is a
   stoppage when it ended before the last scheduled round (or in it, at
   0–0), and went the distance otherwise. A card with no rounds at all
   (watched, not scored) is valid with any result, the round included.
   Rounds may arrive in any order. The scorecard never has to agree with
   the decision. The decision dialog offers a points decision worked out
   from the three judges' cards, each won or even: 3–0 UD, 2–1 SD, 2 and
   one even MD; two even and one won MT, three even or 1–1–1 D
   (`decisionFromCards`). It is a suggestion, filled in until the user
   picks otherwise, never a check (D41).
6. **Record update on finalise**, once and atomically: KO/TKO → winner
   won+1 kos+1, loser lost+1; other wins → won+1 / lost+1; draws → both
   draws+1; NC → both nc+1. Re-saving a finalised bout does not double count;
   editing the result of a finalised bout reverses the old increment and
   applies the new in one transaction.
7. **As-of snapshot.** The first save of the card, draft or final, stores
   both fighters' record, weight, colors and TBRB rank as they stand,
   before this bout's result is counted. The snapshot never changes
   afterwards; the fighter row does. The exceptions: the TBRB rank, which
   is re-derived when TBRB history is back-filled (D25), and a draft whose
   fighter is replaced, whose side is cleared and taken again at the next
   save (D32). A bout already finalised and counted without a snapshot (an
   import) is snapshotted with its own result taken off. The rank is read
   from the bout's own class only, the last list on or before the fight
   day (D32, D58, D59); a bout at a contracted weight has no class, so its
   rank is null (D45, D59).
8. **Titles held, as witnessed.** The app knows a belt only through the
   bouts watched with it on the line, so the last finalised one decides,
   taken in fight order (event date, then card order), whoever fought in
   it. Its winner takes every title on the line; a draw or a no contest
   leaves each with the side that brought it in, and a vacant one stays
   vacant. A side marked as having missed weight (D26) can neither take a
   title nor keep it: where the belt would go to them, it goes vacant. A
   holder who missed weight and lost loses it to a challenger who made
   weight. A bout not yet final counts for nothing. A belt lost or vacated
   off-screen still shows until a bout with it is watched
   (`titlesHeld`, task fighter-card).

## API

JSON over `/api`. Missing resource → `404` with `{ error }` (v1 returned 200
and an empty body; D5); a path id that is not a positive integer is missing
too. Validation failure → `400` with zod's issues; bodies are strict, so an
unknown field fails. A write the schema refuses → `400 {error, detail}`
(missing reference, failed check), with the database's message instead of
zod's issues, or `409` (duplicate); a choice the user has not made or cannot
make → `409` (D30). Every list endpoint returns an array; every single
endpoint the object. Creating answers `201` with the object, deleting `204`,
except where a delete or merge moves a record: it answers `200` with what it
did, and its `409` carries a `preview` of what each choice would do (D31).

| Method | Path | Notes |
|---|---|---|
| GET | `/api/weight-classes` | |
| GET/POST | `/api/fighters` | the body carries the record the fighter arrives with, 0 when left out (D28); weight and unit go together |
| GET/PATCH | `/api/fighters/:id` | PATCH may correct the record (D28) |
| GET | `/api/fighters/:id/merge/:targetId` | the merge's preview: the target's record before and after, the duplicate's record that is dropped, and how many bouts (finalised among them), aliases, TBRB rows and kept results (`kept_results`) move (D31, D57) |
| POST | `/api/fighters/:id/merge/:targetId` | `:id` is the duplicate. Its bouts, aliases, TBRB rows and record adjustments move to the target and it is deleted, in one transaction. The results of its finalised fights and its kept results are added to the target's record (D61). Every merge needs `?records=add`, else `409` with the preview (D31). The duplicate's typed-in record is dropped (D28). `409` if the two fought each other, in a bout or in a deleted one whose result was kept (D62); GET answers the same `409`. Answers the preview, carried out |
| GET | `/api/fighters/:id/bouts` | history as witnessed, oldest first, each bout as `GET /api/bouts/:id` answers it (snapshot, `titles`, `card`; D34) |
| GET | `/api/fighters/:id/standing` | where the fighter stands now, for the fighter card: `{titles: [title_id], tbrb: [{weight_class_id, rank, snapshot_date}]}`, the titles held as witnessed (Scoring §8) and their rank on each class's latest TBRB list that names them; a class whose latest list leaves them off is not there, which is unranked (D25) |
| GET/POST | `/api/events` | |
| GET/PATCH/DELETE | `/api/events/:id` | delete refuses (`409`) if any bout is finalised; otherwise its bouts go with it |
| GET | `/api/events/:id/bouts` | ordered by card_order, each bout as `GET /api/bouts/:id` answers it (D34) |
| POST | `/api/bouts` | `card_order` left out puts the bout last on its card; `titles` is `[{title_id, holder_side}]`. `weight_class_id` or `contracted_weight` (pounds, positive), one of the two and the other null or left out, else `400`; `missed_weight_a` and `missed_weight_b` are `true`/`false`, false when left out, and answered as the stored 0/1 (D26, D45). A bout is answered as its row with `titles` beside it |
| GET/PATCH/DELETE | `/api/bouts/:id` | GET (and every write that answers a bout) gives the row with its snapshot and result, `titles`, and `card` in PUT's shape plus read-only `totals` (`{rounds: [{round_no, a, b}], a, b}`, from the rules). PATCH covers corners, the class or contracted weight (moving between them sends both, one null; the bout as it would stand must have exactly one, else `400`), the missed-weight marks, titles with holder side (the list sent replaces the old one), scheduled rounds (re-checked against the saved card, `400` if it no longer fits); a finalised bout's fighters cannot change (`409`, D30). DELETE of a finalised bout needs `?records=reverse` (both records lose the result, in the same transaction) or `?records=keep` (both records stay as they are, and each fighter gets a `record_adjustment` row for the kept result in the same transaction, D57), else `409` with a preview of both records before and after a reverse; a reverse that would go below zero is `409` too. Answers `200` with the choice made and both records before and after (D31); a draft's delete is `204`. It never deletes the event, not even its last bout (D23) |
| PUT | `/api/bouts/:id/card` | the whole scorecard, `{rounds: [{round_no, a, b}], deductions: [{round_no, side, points, reason, note}], result: {decision_type, winner, round, time} \| null, judges: [{a, b}] ×3, is_draft}`; `deductions` (none), `judges` (all null) and a deduction's `note` (null) may be left out. Validated by the rules (`400 {error, problems}`), then written in one transaction with the snapshot (§7) and the record change (§6); finalise = `is_draft:false` with a result. A change that would take a record below zero is `409` (D32). Answers the bout, as GET does |
| GET/POST | `/api/titles` | |
| GET | `/api/tbrb/current` | latest snapshot, grouped by weight class |
| GET | `/api/tbrb/fighters/:id` | that fighter's rank history |
| POST | `/api/tbrb/snapshots` | manual back-fill: a dated page's parsed rows |
| POST | `/api/imports/:source` | staged import; returns batch id and rejects |

## Front end

lit-html templates, a hand-written `Component` base of ~40 lines (observe a
store, re-render on change, `ref()` for focus), and a URL router (history
API; a plain click on a link into the app navigates without a reload, the
back button and deep links work). A page joins ids to names itself from the
reference lists, every fighter, class and title (D34). Pages:

- `/` events list (newest first, folded by year with the newest open, as in
  v1), built to `docs/reference/design/Events.dc.html` (task
  restyle-events): the title with how many nights were watched since the
  first; a row per year with the year large, a mark per event and the count;
  under an open year, a row per event linking to its card, the day large,
  the month, and the location as typed
- `/events/:id` the card, built to `docs/reference/design/Event.dc.html`
  (task restyle-event-card): the date and "Edit event", the location large,
  how many bouts, how many still to score and how many not final, and "Add
  bout"; bouts in order, the two sides facing each other across "VS" with
  corner squares, names set large without the nickname and the loser's
  greyed once there is a winner, and their
  record on the night (the snapshot, once taken), a missed weight noted
  quietly beside the fighter who missed it (D47), corners, class or "Contracted at
  N lbs" (D26), rounds,
  titles with who brought each, and the result; the whole row opens the
  scorecard; add/edit bout.
  Deleting a bout is always confirmed. A finalised bout takes two dialogs
  (D23): "this is a finalised fight, are you sure?", then one showing what
  both fighters' records will become, with *delete and reset the records*,
  *delete and keep the records*, and *cancel* (back to the fight).
- `/bouts/:id` **the scorecard** — the heart of the app, built to
  `docs/reference/design/Main.dc.html` (task restyle-scorecard). Two
  halves (A left, B right) mirrored around the round number: A reads
  total · deductions · points, B points · deductions · total, so a round's
  two points boxes sit side by side; grand totals at the outer edges; a
  deduction box shows `−N` with KD (a knockdown) or FOUL (any other
  reason, D63); each side's marquee above its half gives the corner, a
  "Champion" chip with the belts brought in, name and nickname, and the
  record, TBRB rank, weight and colours on the night; the crumb, the save
  line (its first words, the rest in its tooltip) and the page's buttons
  sit in the header's row, in place of its sections; once final, a band
  under the marquees gives the result, the judges' cards and mine;
  focus moves across to the other fighter, or on to the next round when
  that box is scored (D39); deductions open a small
  dialog; "End bout" opens the decision dialog (type, winner, round, time,
  three judges; a stoppage is offered the round after the last one scored,
  or the round already under way, and a TD or T the last round on the card;
  with a TKO it says that a corner
  retirement after round X is round X at 3:00, scored, D55) and, once it has saved, goes back to the
  card; "Change
  decision" stays. The class or the contracted weight under the title;
  champion marker and belt list under each name; a missed weight noted
  under the name of the side that missed it (D26, D47); corner
  colour on the column header; TBRB rank as of the event date (from the
  snapshot). Focus moves on once an entry cannot grow; a save (the API's
  draft) keeps the whole typed card when the rules accept it, never
  dropping a stored round by mistake, on demand and on leaving the page; a
  finalised card is read-only: its decision can be changed, or it is
  reopened for scoring to fix a round (D35, D37). The pages say "score",
  "save progress" and "not final", never "draft" (D39). The card a result implies comes from the rules
  (`shapeForResult`, §4), never from the form.
- `/fighters` grouped by last-name initial, record as W-L-D (N KOs); merge;
  built to `docs/reference/design/Fighters.dc.html` (task restyle-fighters):
  the title with how many fighters, a section per letter with the letter
  large and its count (a folded letter lists its last names), and the
  fighters in two columns, last name large, then first name and nickname,
  the record, Edit and Merge…
- `/fighters/:id` the **fighter card** (redesigned): name, nickname,
  colors, current record, current TBRB rank per class, titles held, the
  list of their fights as witnessed with the as-of record beside each,
  the contracted weight where there was one and a missed weight noted as
  the scorecard notes it (D26, D47; `boutWeightText` and `missedWeightNote` in
  `format.ts`). Built to `docs/reference/design/Fighter.dc.html`
  (`fighter-page.ts`): the record large beside the name, with a "Champion"
  chip over the name when any title is held as witnessed (Scoring §8; a
  TBRB rank 0 alone does not show it); TBRB now, titles
  held and "As witnessed": a row of squares, one per finalised fight
  (filled a win, open a loss, grey a draw, dashed a no contest), the number
  of fights watched with how many were won and lost (drawn and no contest
  only when there is one), and "First seen" with the first fight's date; then the
  fights newest first, each row opening its scorecard, with the result
  from this fighter's side, the rank that night and my card with their
  total first. The colours are the words typed. A name on `/fighters`
  opens the card.

No CSS framework. One stylesheet, custom properties, light theme only.
Native `<dialog>` for modals (v1 already did this): each form is a
`DialogForm` (`dialog.ts`) that opens over the page and answers what it
made (D37). It is built to `docs/reference/design/Dialogs*.dc.html` (task
restyle-dialogs): the title, the body and the actions in three bands
inside a 2px ink border over paper grey, the main action dark and a delete
red; a choice of two or three options is a row of buttons (`choiceRow`:
the corner of fighter A, who brought a title in, the weight unit), and one
of more stays a dropdown. The fighter and bout forms ask before Cancel or Escape
discards what was typed (D44; the others do not say yet what dirty is).
The forms are `event-form.ts`, `fighter-form.ts`
(edit, or find-or-add: as the name is typed the fighters it could be drop
down under it; picking one, or saving a name that is exactly one
fighter's, makes the form theirs and keeps it open, with their name and
stored record in the boxes, tonight's weight, colours and nickname as
typed, and a record typed off the broadcast kept beside theirs to take or
leave; only Save writes, never the other side's fighter, D43, D44),
`bout-form.ts` (fighters by search: Enter takes the highlighted match, a
name typed in full is taken on Save, and a fighter is found or added on
the spot, before the name is known if need be (D38, D43);
the class, each shown with its limit as v1 did, "Flyweight (112 lbs /
50.802 kg)", or "Contracted weight (no class)" and the pounds typed;
"Missed weight" ticked per side on one plain line (D26, D45, D46, D47); titles with holder side,
with a new title added on the spot, in `bout-titles.ts`),
`deduction-form.ts`, `decision-form.ts`, `bout-delete.ts` (D23, D31) and
`merge-form.ts` (D31); what they make of typed text is in `entry.ts`.

## Stack — rote libraries only

A library is acceptable when it solves a rote, already-solved part and does
not impose an application architecture. Every row is also a row in Atrium's
import map.

| Concern | Choice | Replaces | Why it is rote |
|---|---|---|---|
| Runtime | Deno 2.x | Node + pnpm + tsc + vite | Atrium's runtime; TS, test runner, fmt, lint, SQLite built in |
| HTTP routing | Hono | NestJS | Atrium's chamber convention; a `fetch` handler, nothing else |
| Validation | zod | class-validator + class-transformer | one schema per resource is also its TS type |
| Database | `node:sqlite` (Deno built-in) | TypeORM + MySQL + Mongoose + MongoDB | one file, in-memory for tests, zero infrastructure (D3, D4) |
| Templates | lit-html 3.3.3, pinned twice: esm.sh in the browser import map, `npm:` in `deno.json` for the type-check (a test keeps the two equal) | React + Jotai + Bootstrap | templates only; no component framework (D6) |
| Bundling | `Deno.bundle` (built in, behind the `bundle` unstable flag in `deno.json`) | Vite | the dev server and `deno task build` make the one browser script (D7, D33); not a package, so nothing for Atrium's import map |
| Tests | `Deno.test` + `node:assert/strict` | — | both built into Deno; no package |
| Numbers sheet | none — Numbers exports CSV, the importer reads CSV | numbers-parser | no dependency for a one-time step (D8) |

Not in the list and not wanted: an ORM or query builder, a state library, a
CSS framework, a bundler (D7), Playwright (D11).

## Testing

Three tiers, all run by `deno test`, all green before a step is done:

1. **Rules** — `server/rules/*` as pure functions. The scoring statements
   above, one test per statement, including the stoppage rule worked example
   (KO in round 2 with a knockdown → rounds 1 and 2 recorded, round 2 at
   0 / −1).
2. **HTTP contract** — one test per endpoint via `app.request()` against an
   in-memory database: status, shape, 404 and 400 behaviour.
3. **State across requests** — what a sequence leaves behind: snapshot taken
   on first save and unchanged after (the TBRB rank excepted, D25); record moves once on finalise and not
   again; result edit reverses and re-applies; merge repoints bouts, aliases
   and TBRB rows or nothing at all; importer rejects a bad row without
   losing the batch.

Not written: tests of Hono wiring, of SQL text, of lit-html output. Browser
journeys are checked by the programmer until D11 is revisited.

## Versioning

`version` in `deno.json`. Bumped when a scene is meant to be deployed to
Atrium; `CHANGELOG.md` is compiled at that moment from the task files.
