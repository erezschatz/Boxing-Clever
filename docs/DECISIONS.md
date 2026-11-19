# Decisions

Dated, append-only. A decision is reversed only by a new entry naming the one
it supersedes (`Supersedes: D<n>`).

D1–D47 below were written in this file by hand, up to 2026-11-14. From D48 on,
a decision is written in the task file of the work that made it, under
`## Decisions` (format in `tasks/README.md`), and compiled here by
`deno task record` before each commit, below the marker line. Nothing in this
file is edited by hand any more, the entries above the marker included.

---

### D1 · 2026-10-31 · An Atrium chamber, not a standalone server
**Decision:** The server is a chamber (`mod.ts` exporting `{domain,
displayName, fetch}`), mounted in Atrium's single Deno process, using
Atrium's auth, TLS and import map. Hono for `/api/*` because that is the
chamber convention Mandy and Dentro already follow.
**Rejected:** Keeping v1's own process behind pm2; a standalone Deno server
with its own login.
**Why:** One process, one dependency list, one login is the point of Atrium.
Carrying a second server and a second auth for one user is the mistake v1
made in a different form.

### D2 · 2026-10-31 · Private, single user
**Decision:** Everything sits behind Atrium's login. No roles, no public
read-only view.
**Rejected:** A public fight database with scoring behind login.
**Why:** The data and the app are the user's own. If that ever changes it is
a new decision, and the schema does not care either way.

### D3 · 2026-10-31 · Hand-written SQL, no ORM, no query builder
**Decision:** `server/db/` is one module per table of plain functions over
`node:sqlite`, with parameterised SQL written by hand and numbered `.sql`
migrations applied by a ~40-line runner.
**Rejected:** TypeORM (v1), Prisma, Drizzle, Kysely.
**Why:** Ten tables. The ORM would be more code than the SQL, and the two
places v1 needed real ORM behaviour (the five-relation load, the merge
transaction) are a join and a `BEGIN`. The user's standing position is that
an ORM has to earn its keep and none does at this size.

### D4 · 2026-10-31 · One relational database (SQLite); the Mongo document becomes columns
**Decision:** SQLite via Deno's built-in `node:sqlite`, one file, backed up
with the Atrium server. Round scores and deductions are rows, not a JSON
blob. The pre-fight snapshot that v1's Mongo document carried is kept as
explicit as-of columns on `bout`.
**Rejected:** v1's MySQL + MongoDB split; MySQL alone; Postgres; JSON
columns for the scorecard.
**Why:** The dual-DB design was chosen to try dual DBs, and because
"rounds × scores × deductions" felt byzantine as tables. It is three small
tables. Rows are what make phase 2 (trajectories, knockdowns per fighter,
scores per judge) a query instead of a document scan. MySQL's only argument
was "the data is there", and that is a one-time import. SQLite also makes
every server test run against a real in-memory database.

### D5 · 2026-10-31 · Missing resource is 404
**Decision:** Every single-resource endpoint returns `404 {error}` when the
id does not exist.
**Rejected:** v1's behaviour — `200` with an empty body, a NestJS default
nobody chose.
**Why:** v1's own client already carried an `if (status === 404)` branch
that never ran. The client expected it; the server never held up its end.

### D6 · 2026-10-31 · lit-html standalone, not Lit
**Decision:** `lit-html` for templates, with a hand-written base class
(~40 lines) for render-on-change and a small URL router. No LitElement, no
Shadow DOM, no signals library.
**Rejected:** React (v1); Lit (LitElement); no library at all.
**Why:** The compromise already reached on Attune: as little framework as
possible, with sane templating. There is no global CSS framework here to make
Shadow DOM a liability, so Lit would be *acceptable* — but four pages do not
need a component model, and the base class is smaller than learning one.
Reversible without ceremony if a page proves it needs reactive properties.

### D7 · 2026-10-31 · No bundler
**Decision:** The front end is static ESM. `lit-html` is pinned in the
browser import map (esm.sh); `front/*.ts` is served by Deno in dev
(transpile on request) and emitted once by `deno task build` at deploy.
**Rejected:** Vite (v1), esbuild, `deno bundle`.
**Why:** A build step is a dependency and a moving part for what is four
pages. If `deno task build` turns out to be inadequate (import-map
rewriting, say), esbuild is the fallback and gets its own entry here.

### D8 · 2026-10-31 · The Numbers sheet is imported from a CSV export
**Decision:** The sheet is exported from Numbers to CSV by hand once; the
importer reads CSV. The original `.numbers` stays in `docs/reference/`.
**Rejected:** Parsing `.numbers` directly (Python `numbers-parser`).
**Why:** A dependency and a second language for a step that runs once. The
sheet has not changed since April 2025.

### D9 · 2026-10-31 · Laptop first; no mobile layout in phase 1
**Decision:** The scorecard is designed for a laptop screen while watching.
**Rejected:** Mobile-first (considered in Sept 2026; went to Nine Bars).
**Why:** The user watches at home with the laptop always available. A touch
layout is phase 2 at the earliest.

### D10 · 2026-10-31 · No service worker / PWA shell
**Decision:** v1's `sw.js` and manifest are not carried.
**Rejected:** Keeping the PWA shell.
**Why:** The app is online by nature (it writes to a server) and sits behind
Atrium's login, which the service worker would have to cooperate with. A
manifest can return later if an installable window is wanted.

### D11 · 2026-10-31 · Browser end-to-end tests parked
**Decision:** Tiers 1–3 (rules, HTTP contract, state across requests) are
the automated suite. Browser journeys are verified by the programmer.
**Rejected:** Playwright journeys from the start (v1's cutting-weight Part
III, tier 4).
**Why:** Playwright is the single heaviest dependency the project could
take, and the three server tiers cover everything the data cares about. If
the scorecard page regresses twice in a way the programmer only catches by
hand, this is reopened.

### D12 · 2026-10-31 · Strict staging: the commit is the scene
**Decision:** One developer; `git commit` is the unit of complete work.
**Rejected:** The adapted (pull-request) staging used on team repos.
**Why:** No team, no PR gate to lean on. The runbook installs the commit
gate.

### D13 · 2026-10-31 · Fighter record is stored and derived
**Decision:** `fighter.won/lost/draws/nc/kos` are stored, updated
transactionally on finalise, and recomputable from bouts by a script. The
bout's as-of snapshot is the historical truth; the fighter row is the
current convenience.
**Rejected:** Computing the record on every read; snapshot-only.
**Why:** Imported fights carry the record *as the sheet recorded it*
(including fights not watched), so the record cannot be rebuilt from bouts
alone — the latest snapshot plus results since is the recompute rule, and it
needs a stored column to land in.

### D14 · 2026-10-31 · TBRB names resolve by alias, never by fuzzy match
**Decision:** A `tbrb_snapshot` row links to a fighter only through an exact
match on `fighter_alias`. Unmatched names stay unlinked and are listed for
the user to link by hand (which creates the alias).
**Rejected:** Levenshtein / token matching; auto-creating fighters from
ranking rows.
**Why:** Rankings must never attach to the wrong fighter; one wrong link
poisons a trajectory silently. The ranking lists are ~15 names × 18 classes,
and the user links a name once.

### D15 · 2026-10-31 · Repo lives on GitHub from day one
**Decision:** `github.com/erezschatz/Boxing-Clever` is the remote; local
folder `~/dev/Boxing-Clever-gh`; the project name is unchanged.
**Rejected:** Phorge-first with a GitHub mirror later (the usual pattern).
**Why:** Cross-session reach for Claude Code and visibility were asked for
explicitly. The v1 repo stays on Phorge as the reference.

### D16 · 2026-10-31 · Atrium mount deferred to deployment
**Decision:** Development and verification run on the standalone track
(`deno serve mod.ts`). Mounting in Atrium is first exercised in task 14, or
earlier only if its absence becomes a showstopper.
**Rejected:** Mounting the chamber in a local Atrium as part of task 01.
**Why:** Atrium does not run on the development machine; it runs on the
server. The chamber contract is three fields and a fetch handler, and
`server/static.ts` already removes the one place a local Atrium would have
been needed. Verifying the mount early would cost a local Atrium setup for
no information the deploy step will not give.

### D17 · 2026-11-02 · Heavyweight has no weight limit in the table
**Decision:** `weight_class.lbs` and `kg` are nullable, and Heavyweight's are
null: the class has a floor, not a limit. kg for the other classes is
lbs × 0.45359237 to three decimals.
**Rejected:** Copying v1's seed, which gives Heavyweight Cruiserweight's
200 lbs / 90.718 kg; a sentinel such as 999.
**Why:** v1's row is a typo that would make a 250 lb heavyweight look over
the limit the moment anything compares weights (phase 2 trajectories, or a
weigh-in check). Null is what "no limit" means; a sentinel is a number that
lies. v1's hand-typed kg were off in the third decimal for six classes, so
they are computed rather than copied. Atomweight stays: v1 has it and the
spec says 18, though TBRB ranks men only and will never list it.

### D18 · 2026-11-02 · The schema refuses shapes; the rules judge cards
**Decision:** SQL constraints enforce what no valid card could contain:
the checked sets (side, corner, holder side, decision code, winner,
deduction reason, weight unit, import source), points 0–10, ranges on
rounds, ranks and record counts, ISO dates on `event` and `tbrb_snapshot`,
a result on every finalised bout,
and a deduction only in a round that has a `round_score` row for that side
(composite foreign key). Everything that depends on the card as a whole —
which winner each decision type allows, no gaps, the stoppage round —
is `server/rules/` (task 03), checked before anything is written.
**Rejected:** Encoding the decision-type/winner table and the no-gaps
invariant as triggers or CHECKs; leaving the schema unconstrained and
trusting the rules alone.
**Why:** Imports and hand-written scripts write to the database without
going through the API, so the shapes must hold there too; but the rules
are the subject matter of the app and belong in one readable place (CLAUDE.md
*Code rules*), not duplicated as SQL that has to be kept in step.

### D19 · 2026-11-02 · An alias names one fighter
**Decision:** `fighter_alias.alias` is unique across all fighters. Two real
fighters with the same name are told apart by giving one of them a
distinguishing alias, by hand.
**Rejected:** Letting the same alias belong to several fighters and having
TBRB linking and the importers report the ambiguity.
**Why:** D14 makes the alias the only way a name becomes a fighter; if one
alias could resolve to two fighters, every lookup would need an ambiguity
path, and the safe answer in every case would be "do not link". A unique
alias makes that refusal happen once, when the second alias is added,
instead of on every lookup. Same-name fighters among those watched are rare
enough to handle by hand.


### D20 · 2026-11-03 · Which decisions are stoppages, and what a card may look like
**Decision:** The rules (`server/rules/decisions.ts`) give each decision code an
ending. `KO` `TKO` `RTD` `TD` `DQ` `T` are stoppages: the result round is
required and is the §4 stoppage round (0–0, deductions only), and nothing
comes after it. This holds whichever round convention is used for an RTD.
`UD` `MD` `SD` `DEC` `MT` `D` go the distance: every scheduled round is
scored 10–9, 9–10 or 10–10, and the result round, if given, is the last one.
`NC` is either, and the card says which: a stoppage when its result round
is before the last scheduled round, or is the last with a 0–0 row;
otherwise a fight overturned after going the distance, held to the
distance shape. A card with no rounds at all is valid with any result,
including a stoppage whose round is not known, for a bout watched but not
scored and for v1's unscored bouts re-saved after import. Rounds are a set:
the order they arrive in does not matter. Nothing checks that the scorecard
agrees with the decision.
**Rejected:** Scoring the partial round of a technical decision or draw as
the judges do (it would make §4 depend on the decision type); requiring
every finalised bout to carry a full card; one fixed shape for NC.
**Why:** SPEC §4 states the stoppage rule without naming which results are
stoppages, and the validator cannot work without knowing. The scorecard is
the viewer's bookkeeping; the result is carried by the decision (v1
CLAUDE.md), so an incomplete technical round is recorded the same way as a
knockout round. The NC cases are both real: an accidental clash early, or a
win overturned weeks later.

### D21 · 2026-11-03 · The weight port: exact pound, unreadable stone is null
**Decision:** `server/rules/weight.ts` keeps v1's six functions and their
contracts: pounds as the pivot, two decimals, "S L O" stone entry and
display, the same unit names. Two changes: kg converts with the exact
international pound (0.45359237 kg) instead of v1's 2.20462, and
`parseStoneLbsOz` returns null for input that is not one to three
non-negative numbers, where v1 read junk or an empty string as 0. Each
part is still read with `Number()` as in v1 (so ".5" and "1e1" parse), and
an unknown unit still passes the weight through, as v1's `default`
branches did.
**Rejected:** Porting v1's factor and its silent zero unchanged.
**Why:** The factor is the same one D17 uses for the weight classes; one
constant for the app. Compared against v1's own file (2026-11-03: 0–200 in
0.01 steps through all three units, 90–300 lbs in 0.05 steps back and to
"S L O", 12 stone strings, 4 unit names; 81,019 calls), the only
differences are kg conversions, by one cent, in 568 of them. The silent
zero would let a typo store a fighter at 0 lbs; IMPORT.md requires a weight
that cannot be parsed to be rejected, which needs "unreadable" to be
distinguishable from 0.

### D22 · 2026-11-03 · A technical decision or draw scores its last round (supersedes D20 in part)
**Decision:** `TD` and `T` are no longer stoppages in D20's sense. They
"go to the cards": the result round is required (on a scored card), is
the last round recorded, and is scored like any other round (10–9, 9–10,
or 10–10 when it ended almost at once), never 0–0. `KO` `TKO` `RTD` `DQ`
keep D20's 0–0 stoppage round, and `NC` keeps D20's two shapes. For now an
RTD is treated like a TKO: its result round is 0–0. Erez gave the usual
convention, "ended at 3:00 of round X". Whether round X, which was fought
in full, should then be scored rather than recorded 0–0, and whether RTD
stays a code apart from TKO, are open (`tasks/questions-2026-11-03.md`).
**Rejected:** D20's 0–0 for the technical round.
**Why:** Erez, 2026-11-03: the judges score the round the fight was
stopped in, and on a technical decision that score counts. D20 had reasoned
that the card is bookkeeping and that a stopped round is never scored; that
holds for a stoppage, not for a fight that goes to the cards.

### D23 · 2026-11-03 · Deleting a finalised bout is guarded twice; deleting bouts never deletes the event
**Decision:** Any bout can be deleted, finalised ones included, and every
delete is confirmed. For a finalised bout the front end asks twice. First:
"this is a finalised fight, are you sure?". Then a dialog showing what both
fighters' records will become, with three choices: delete and reset the
records, delete and keep the records, or cancel back to the fight. The API
takes that choice as `DELETE /api/bouts/:id?records=reverse|keep` and
answers `409` for a finalised bout without one. Deleting a bout never
deletes its event, not even when it was the last bout. An event is deleted
only by deleting the event. SPEC's existing rule that this refuses while
any of its bouts is finalised is unchanged for now; whether it should
instead go through the guarded flow is open (`tasks/questions-2026-11-03.md`).
"Keep the records" leaves the result in the fighters' stored records with
no bout behind it, which `scripts/recompute-records.ts` (D13) would undo;
how a kept result survives a recompute is open in the same file.
**Rejected:** Refusing to delete a finalised bout; always reversing the
records; deleting an event along with its last bout.
**Why:** Erez, 2026-11-03: a fight can be deleted even after finalising,
but heavily guarded, and the user chooses whether the records are reset.
The typical mistake is a fight entered under the wrong event (Dec 12 in
Las Vegas instead of Dec 14 at MSG). The user deletes the fight and
re-enters it under the right one, and the wrong event must still be there
afterwards. Supersedes the promise of `tasks/delete-finalised-bout.md`
("never leaves a record counting a fight that is no longer there");
built under `tasks/guarded-bout-delete.md`.

### D24 · 2026-11-03 · The sheet's rounds under 9 are 9 less knockdowns
**Decision:** In the Numbers sheet, a side's round written as `8`, `7`, …
is imported as points 9 with one one-point deduction per point below 9,
and the round then passes §1. Erez named the two reasons to choose from,
"general or KD". Claude chose `knockdown` as the default, on his "95% of
the time it's a KD", and every such deduction carries the note `reason
assumed (import)`, so the scorecard can mark it (task 07's marker). If the
sheet's cell colours turn out to tell a knockdown from a foul, and can be
read, the colour gives the reason instead
(`tasks/sheet-deduction-colours.md`). A round where neither side has 10
(`9`/`9`: the round's winner was docked a point) cannot say who won it;
how to import it is open (`tasks/questions-2026-11-03.md`), and until then
the importer rejects it. This is the one thing the importer infers, against
IMPORT.md's "nothing is guessed" and task 11's promise; the note is what
keeps it visible.
**Rejected:** IMPORT.md's earlier plan to store `8` as points 8 with no
deduction (it fails §1, so such a card could never be edited after import;
task 03's open note); `other` ("general") as the default.
**Why:** Erez, 2026-11-03: there is no 10–8 as points, it is a 10–9 with a
deduction, so 8, 7 and below are 9-point rounds with 1, 2, 3… points
deducted, and about 95% of them are knockdowns.

### D25 · 2026-11-03 · A bout's TBRB rank is the last list before the fight; off the list is unranked
**Decision:** A fighter's TBRB standing for a bout is read from the last
snapshot prior to the fight, weekly or monthly. Two edges are open
(`tasks/questions-2026-11-03.md`): whether a list dated the day of the fight
counts, and whether a list can be too old to count (the 2024 → now history
gap). Until they are answered, the rule is "on or before the fight date"
with no age limit. Listed means
that rank (0 champion); not listed means unranked. Claude added that there
is no separate "unknown" standing, which follows from Erez's "if a fighter
isn't ranked current to the fight … he's unranked". The rank is copied into
the bout with the rest of the snapshot (first save and finalise, SPEC §7),
but it is the one part of the snapshot that is re-derived later. When task 13's history tool stores an older snapshot, every bout
dated in the span that snapshot now governs gets its rank re-read.
**Rejected:** An "unknown" standing distinct from unranked; freezing
imported bouts' ranks at import, before the history exists.
**Why:** Erez, 2026-11-03: a ranking only matters if the fighter was ranked
at the time of the fight (Usyk–Fury was C v #1), and it is always the last
ranking prior to the fight. Imports (tasks 10–11) run before the history
back-fill (13), so a rank frozen at import would be "unranked" for most
historical bouts. This overrides the "never changed" in
`server/migrations/001-schema.sql`'s comment and the "forever" in task 05's
promise, for the rank only.

### D26 · 2026-11-03 · Contracted weight, not a catchweight class; missing weight is marked
**Decision:** A bout fought at a weight that is not a class limit records
that contracted weight; there is no "Catchweight" class. Each side of a
bout can be marked as having missed weight, and the mark is shown
prominently on the scorecard and in the fighter's history. Both sides can
be marked, or only one. The schema, API and display are
`tasks/contracted-weight-and-missed-weight.md`, which must land before the
imports (tasks 10–11).
**Rejected:** A 19th weight class called Catchweight; deriving "missed
weight" from the weigh-in figures.
**Why:** Erez, 2026-11-03: "there's no catchweight", just two fighters
fighting at a specific weight, either both coming in above it or one on it
and the other not, and he wants a fighter who missed weight marked and
highlighted. Claude's reason for marking rather than computing: the
weigh-in figures alone don't settle it (rehydration clauses, agreed
allowances).

### D27 · 2026-11-03 · Imported rows are not linked to their batch
**Decision:** `import_batch` and `import_reject` are the whole audit trail.
No `bout` (or other) row records which batch wrote it.
**Rejected:** An `import_batch_id` column on `bout`.
**Why:** Erez, 2026-11-03: it does not matter which import wrote a bout.
Closes the open note in task 02's record.

### D28 · 2026-11-04 · A fighter's record is typed in and correctable; merge keeps the target's
**Decision:** `POST /api/fighters` takes the record the fighter arrives
with (won, lost, draws, nc, kos; 0 when left out) and `PATCH` can correct
it, as in v1, where both DTOs carried it. After that, finalise moves it
(§6) and the guarded delete can reverse it (D23). Merging a duplicate
into a target leaves the target's record as it was and discards the
duplicate's, as v1's `FighterService.merge` did. Two fighters who fought
each other cannot be merged (`409`). Claude's call, from v1; Erez has not
ruled on it.
**Rejected:** A record that only finalise may move (a fighter first seen
at 25–1 would show 0–0); summing the two records on merge (a duplicate made
by an import carries the sheet's record, which overlaps the target's, so a
sum double-counts); recomputing on merge (the recompute script does not
exist yet, and D23's open "keep" question bears on what it would rebuild).
**Why:** The record is the record as known, including fights not watched
(D13), so it has to be enterable; and a typo in it has to be fixable
without SQL. A reverse after a hand correction can find a record that no
longer holds the result; it is then refused (`409`) and the user deletes
with `?records=keep`. Known consequence, open for Erez: a finalised bout
that moves to the target in a merge brings a result the target's record
never counted, and deleting it later with `?records=reverse` takes that
result off the target anyway. The below-zero refusal catches it only when
the target has nothing to lose. Until Erez rules, delete such a bout with
`?records=keep`.

### D29 · 2026-11-04 · The chamber migrates its database on first use
**Decision:** `mod.ts` opens `data/boxing.db` (or `$BOXING_DB`) on the
first request that needs it and runs the migrator then, so a fresh clone
or a deploy serves an up-to-date schema. Importing `mod.ts` opens nothing.
`deno task migrate` stays, for applying migrations without serving.
**Rejected:** Requiring `deno task migrate` before the server starts
(SQLite would silently create an empty file and every API call would fail
with "no such table"); opening at import time (the tests and Atrium import
the chamber, and the test permissions do not allow writing).
**Why:** The migrator is idempotent and applies each file in its own
transaction (task 02), so running it on every start is safe, and one
forgotten step on deploy no longer takes the app down.

### D30 · 2026-11-04 · How the API says no
**Decision:** Beyond D5's 404 and SPEC's 400-with-issues:
- a path id that is not a positive integer is a `404`, like an id that
  does not exist;
- a write the schema refuses becomes a client error in one place
  (`server/api/http.ts`): a missing reference (unknown fighter, class or
  title) or a failed CHECK is `400 {error, detail}`, a duplicate (a title's
  four fields) is `409`; a NOT NULL or primary-key refusal maps the same
  way (`400`, `409`); any other failure is `500`;
- the user's choice is missing or impossible: `409 {error}` (a finalised
  bout deleted without `?records=`, an event with a finalised bout, a
  merge of two fighters who met, a reverse that would go below zero); a
  fighter merged into itself is `400`;
- a finalised bout's fighters cannot be changed by `PATCH` (`409`), because
  its result has already moved those two fighters' records.
Bodies are strict: an unknown field is a `400`, not ignored.
**Rejected:** Checking every referenced id in each handler before writing
(the schema already refuses them, D18, and the checks would have to be
kept in step); `400` for a malformed id; moving a finalised result's
record increments to newly patched fighters.
**Why:** The schema is the authority on shapes (D18), so the API reports
its refusals rather than duplicating them. A strict body catches a client
sending `record` or `id` and believing it was saved.

### D31 · 2026-11-05 · A merge carries the duplicate's finalised results, shown first and approved (supersedes D28 in part)
**Decision:** Merging a duplicate into a target adds the results of the
duplicate's finalised fights to the target's record, so each fight is
counted once, in the record of the fighter who now owns it. The
duplicate's own typed-in record is still dropped (D28). Nothing changes
the record without the user's approval:
- `GET /api/fighters/:id/merge/:targetId` previews the merge: the target's
  record before and after, the duplicate's record that is dropped, and how
  many bouts (finalised among them), aliases and TBRB rows move;
- `POST` with `?records=add` carries it out. Without that, `409` with the
  same preview, and nothing changes. Every merge asks, even one that moves
  no finalised fight, because it still drops the duplicate's record;
- the answer is the preview, now carried out: what was done.
The guarded bout delete (D23) works the same way. Its `409` carries a
preview of both records before and after a reverse, and whether a reverse
is possible. A finalised delete answers `200` with both records before and
after (and which choice was made); a draft delete is still `204`, because it
touches no record. The approval is not tied to the preview the user saw: if
the duplicate gains a finalised fight between the preview and the POST, the
POST counts it. For one user at one laptop that window is not real.
**Rejected:** D28's merge that leaves the target's record alone. A merged
fight deleted later with `?records=reverse` would take off a result the
target never counted. Also rejected: summing the two records (D28's
reason: a double count), and refusing reverse for merged fights.
**Why:** Erez, 2026-11-05, choosing option 2 from the question D28 left
open: "make it explicit, tell me what happened, and ask me to approve it",
the opposite of the delete's "this will reset X's record to 20-0". The
server computes both previews, so the dialogs in task 08 show what the API
will do instead of working it out themselves.

### D32 · 2026-11-05 · The scorecard save: when the snapshot is taken, and three edges
**Decision:** `PUT /api/bouts/:id/card` writes the whole card in one
transaction. The first save of any kind, draft or final, takes the as-of
snapshot (SPEC §7), before this bout's result is counted, and later saves
never change it. Then:
- **TBRB rank, interim.** The snapshot's rank is the fighter's rank on the
  last list of the *bout's own class* on or before the event date (D25),
  and null when not on it. Which class's list should count is still Erez's
  question (`tasks/tbrb-rank-across-classes.md`), and a bout at a
  contracted weight (D26) will need an answer from it.
- **A draft's fighter replaced.** If `PATCH` puts another fighter in a
  draft bout, that side's snapshot is cleared and taken again at the next
  save. The other side keeps the snapshot it has, because each side is
  written on its own. A finalised bout's fighters cannot change (D30).
- **A finalised bout with no snapshot.** The imports (tasks 10–11) will
  leave bouts like this, already counted in both records. They are
  snapshotted with their own result taken off first, so the snapshot is
  still the record before the fight.
- **Back to draft.** Saving a finalised bout as a draft takes its result
  off both records (`recordChange(before, null)`, task 03). A change that
  would take a hand-corrected record (D28) below zero is `409`, as in the
  guarded delete.
- **The schedule.** `PATCH` of `scheduled_rounds` re-checks the saved card
  against the new schedule with the rules, and is `400` with the problems
  if the card no longer fits.
The card goes over the wire in one shape: `{rounds, deductions, result,
judges, is_draft}`. `GET` answers it as `card` with a read-only `totals`
computed by the rules, so a client can GET, edit and PUT back.
**Rejected:** v1's re-snapshot on every save (after finalise it captured
the record with this fight already counted). Keeping a snapshot of a
fighter who is no longer in the bout. Refusing a finalised bout's return
to draft. A rank from the fighter's best class (that is the open question,
not an interim).
**Why:** SPEC §7 wants the fighters as they stood on the night, and §6
wants the result counted once. The snapshot has to come before the count,
and only once. A snapshot of a replaced fighter is not "as of" anyone in
the fight. The bout's class is the one list a bout always has today, so
it is the least surprising interim until Erez answers.

### D33 · 2026-11-07 · One browser script, bundled by Deno itself; lit-html through the import map
**Decision:** The browser loads one module, `/app.js`: `front/app.ts` with
the pages and `server/rules/` bundled by `Deno.bundle` (Deno's built-in,
esbuild-based bundler, behind the `bundle` unstable flag in `deno.json`).
lit-html is left as a bare import for the pinned import map in
`index.html`, so the one browser dependency stays where D7 put it. In
development the dev server bundles on every request of `/app.js`
(`BOXING_DEV`, set by `deno task dev`), so a reload shows an edit without a
watcher; for deployment `deno task build` writes the same bundle, minified,
to `front/dist/app.js`, and the server serves that file whenever
`BOXING_DEV` is unset, with a 500 that says to run the build when it is
missing. Dev and deploy share one function (`bundleFront` in
`server/static.ts`). The server never serves `front/*.ts` raw.
**Rejected:** Transpiling each `.ts` file on request (`@deno/emit` from
jsr, a dependency that Atrium's import map would carry for a dev-only
job, and jsr is unreachable from the cloud workspace); spawning `deno
bundle` per request (an `--allow-run`, for the same esbuild); bundling
lit-html in (no esm.sh at runtime, but it contradicts D7 and the task's
"import map, lit-html pinned"); serving `front/dist/` whenever it exists
(a local `deno task build` would then shadow every later edit in dev
without a word).
**Why:** D7 wanted no bundler as a dependency, and this adds none: the
bundler is the runtime's. One bundle also means `server/rules/` reaches
the browser without the server exposing it as files, which keeps the
static handler to `front/`. The unstable flag is the cost, and SETUP.md
names esbuild as the fallback if Deno changes it.

### D34 · 2026-11-07 · Bout lists answer whole bouts; the pages join names themselves
**Decision:** `GET /api/events/:id/bouts` and `GET /api/fighters/:id/bouts`
answer each bout as `GET /api/bouts/:id` does: the row with its snapshot,
`titles` and `card`. The pages read the reference lists, every fighter,
weight class and title, once per page load and join ids to names in the
browser (`references()` in `front/api.ts`).
**Rejected:** Embedding fighter and class names in the bout view (two
shapes for a fighter, one of them partial, and the view no longer the
row); one request per bout for its titles (a card of ten bouts is eleven
round trips); a list endpoint that answers bare rows while the single
answers the view (the event page could not show the belts or the result
without the second choice).
**Why:** One user's database is a few thousand rows; three list requests
on a page load cost less than a second API shape to keep in step. The
view is the one way a bout is answered, so the browser's `BoutView` type,
imported from the server, holds for the list too.


### D35 · 2026-11-07 · The scorecard: when focus moves, what a draft keeps, a finalised card is read-only
**Decision:** Three choices on the scorecard page (task 07).
*Focus.* A points box takes whole numbers 0–10 as typed and refuses
anything else on the keystroke. Focus moves to the same side's next round
as soon as the entry cannot grow: any single digit but 1, or 10. A lone
1 waits for a 0, or for Enter (Tab works as ever). The row being scored
and the one after it are marked, as v1 did.
*Draft.* A draft save (the button, and leaving the page by link, reload
or closing the tab) replaces the stored card, so it is all or nothing: it
sends every typed round, from round 1 with no gaps, with the deductions,
judges and any result as loaded, and only when the rules accept that card.
The one round held back is the last typed one while one side is still
empty, and only if the server does not hold it yet; the page counts what
the server holds from the last card it sent, not the one it loaded. Anything else (a 9–9,
a box cleared mid-card, a gap, a result the typed rounds no longer fit)
sends nothing, and the line beside the button says why as it is typed, in
the error colour. A save never removes a stored round, except trailing
rounds whose boxes were both cleared. Saves go one at a time, and a page
loads its card only after the saves before it are done, so leaving by a
link and coming straight back reads the saved card. Leaving by link waits
its turn; on reload or closing the tab a `keepalive` fetch goes at once,
and the browser's "leave site?" prompt asks first whenever typed points
would be lost. The page is dirty only when its boxes differ from the
stored card. Merely opening a bout saves nothing, so a look does not take the
snapshot (§7).
*Finalised.* A finalised bout's card is shown read-only, with its result;
nothing is saved from the page. Changing it comes with the decision
dialog (task 08).
**Rejected:** v1's move-on-every-keyup (a 10 cannot be typed without
landing a 1 in the next round, or the field must guess); a fixed delay
before moving (slow, and wrong for a fast typist); saving the longest
prefix the rules accept (tried first: a save replaces the card, so a typo
in round 2 deleted every stored round after it); keeping the unsaved
remainder in `localStorage` (a second copy of the card that can disagree
with the database); relaxing the rules for
drafts on the server (§1–4 hold for every saved card, D18); saving from a
finalised card as a draft (it would reverse both records, §6, on a
keystroke).
**Why:** 10 and 9 are almost every entry, and both move on with one key
press but for the first digit of 10, which no rule can tell from a 1
without waiting. What a reload restores is what the server holds, so the
page sends only whole cards the rules accept, never one that quietly
drops what is stored, and says live what it cannot save.

### D36 · 2026-11-07 · A fighter's weight is stored in pounds; the unit is how it is typed and shown
**Decision:** `fighter.weight` (and the snapshot's) holds pounds whatever
the unit; `weight_unit` says which unit the user types and reads it in.
The fighter form reads lbs and kg as decimals and stone as v1's "S L O"
(`server/rules/weight.ts`), converts to pounds to save, and converts back
to show (`front/entry.ts`). Pounds are kept to the hundredth they are
shown in, so saving an edit unchanged changes nothing. Changing the unit in
the form converts what is typed, to the nearest ounce in stone and the
hundredth otherwise, so switching back and forth can move it by that much.
**Rejected:** Storing the number as typed, in its unit (decimal stone for
stone), which reads more literally but makes every comparison and every
class limit convert first, and differs from what v1 stored.
**Why:** v1 kept pounds (its BoxerForm converts before saving), so the v1
import (task 10) carries weights over unchanged, and the classes' limits
(D17) are in pounds already. SPEC's "weight + unit" did not say which; this
says it.

### D37 · 2026-11-07 · The forms: dialogs that answer a promise; the rules shape a finished card; a finalised card is reopened to be edited
**Decision:** Three choices in task 08.
*Dialogs.* Every form is a `DialogForm` (`front/dialog.ts`): a native
`<dialog>` made when it opens and removed when it closes, over whatever
page is showing, which answers a promise with what it made, or null when
cancelled. A form can open another over itself (a new fighter, or the
fighter form from the bout form's search). A request runs inside the
dialog, and a refusal is shown there with the server's reasons, so the
user fixes it without starting again. The scorecard's task-07 deduction
placeholder is replaced by one.
*End bout.* The decision dialog sends the code, winner, round, time and
judges. It never shapes the card. `finalCard` (`front/scorecard.ts`)
passes the rounds scored on both sides through `shapeForResult`, a new
rule in `server/rules/scoring.ts` (§4), and then through `validateCard`.
`shapeForResult` puts a stoppage round at 0–0 with only its own
deductions, keeps a technical decision's last round as scored, and drops
everything after the end. A card with only a deduction on it counts as
scored, so a knockdown and a KO in round 1 is round 1 at 0–0. `finalCard`
drops nothing typed without a word. A round with one side empty, points
typed after the round the bout ended in, or a deduction after it are
reported for the user to correct. Only the stoppage round may be half
typed or empty, since it becomes 0–0. The dialog offers the last round with
points or a deduction in it. A card the rules still refuse is not sent, and
the dialog says why. On a finalised bout the same dialog is titled "Change
decision" and says that both records change at once. While a finalise or
a reopen is under way, no draft save is sent, however the page is left, so
nothing can undo it (D32).
*Finalised cards.* A finalised bout's card stays read-only. Its decision
can be changed in the same dialog. Fixing a round means "Reopen as draft",
which asks first and then saves the card as a draft with its result (D32:
the result comes off both records). The result stays because the card's
shape depends on it: a KO's 0–0 round is only valid with a stoppage. Rounds
before the end can then be corrected and saved, and "End bout" finalises
again, or moves where the bout ended.
*Dialog lifecycle.* Escape does nothing while a request is out. The back
button closes an open dialog along with its page. A page reads its lists
again however a form closes, so a fighter or title made inside a cancelled
bout form is not lost and made twice. A fighter edit sends only the fields
it changed, so an edit made from a stale list cannot write an old record
back. The bout form refuses a title of another class, which the server
does not check.
**Rejected:** Dialogs written into each page's template (task 07's first
deduction dialog hit `showModal` before lit-html had put it in the
document, and nesting one form over another needs a second copy in every
page); the decision form typing or zeroing the stoppage round itself (the
rule would then live in a template, untested, and the server's §4 check
would be a second opinion rather than the same one); editing a finalised
card in place (every save would re-run §6 on a half-edited card);
reopening without the result (tried: the server refuses the 0–0 round of a
KO without its KO); a server guard against a finalised bout's return to
draft (D32 chose to allow it); letting the rules drop what was typed after
the end (the dialog's round could be wrong, and a real round would be lost
in silence).
**Why:** The rules are the subject of the app and are tested with nothing
running (CLAUDE.md), so the card a result implies is computed by them in
the browser, as the totals already are. Reopening says out loud that the
records move, which an edit in place would hide.

### D38 · 2026-11-07 · Choosing a fighter in the bout form: Enter, or a name typed in full
**Decision:** After Erez's first run of the bout form, where typing two
names and pressing Save only said "choose both fighters". In the fighter
search, a name typed in full is listed first, then the shortest names. The
top match is highlighted and the arrow keys move it. Enter takes the
highlighted match. Enter in the search never saves the bout. On Save, and
on Enter when the list is empty, `resolveTyped` (`front/entry.ts`) judges
the text against every fighter, not just the eight listed. It takes the one
fighter whose full name it is: first and last name, or with the nickname,
quotes optional; accents, case and spacing ignored. Otherwise it says what
to do:
- pick from the list, for a partial name;
- pick one, for a name two fighters share, even when one of them is
  already on the other side;
- the name is already the other fighter;
- or the name is not in the list, and only then does Enter open the new
  fighter form with it.
**Rejected:** Choosing as you type (the first match changes with every
letter, and "Tyson" would pick someone before "Fury" is typed); taking the
top match of a partial name on Save (a guess the user did not see made);
a `<datalist>` (no way to tell two fighters with the same name apart, and
no record beside the name).
**Why:** The name typed in full is what the user meant. A partial name or
a shared one is a search, and only the user can turn it into a choice.

### D39 · 2026-11-07 · Focus goes across, then down; the pages never say "draft" (reopens D35's focus rule)
**Decision:** Asked by Erez after his first run. Two changes.
*Focus.* This replaces D35's "focus moves to the same side's next round".
After a box is scored, focus goes across to the other fighter's box in the
same round. If that box already has a score, it goes to the other
fighter's box in the next round (`nextBox`, `front/scorecard.ts`).
Scoring forward into empty rounds, the card is scored by alternating,
whichever side a round was started on. Focus only moves into an empty box.
When a score is corrected among rounds already scored, focus stays where it
is; otherwise it would land on a selected score, and the next key would
overwrite it. The rest of D35's focus rule stands: when an entry is
complete, and a lone 1 waiting for Enter. The marked rows now follow this
order: the round being scored, and the round focus goes to next when that
is another round.
*Words.* The pages do not say "draft".
- On the event page, a bout with no result shows "Score", linked to the
  card.
- A result that is not final, on a bout reopened for scoring, reads
  "… · not final".
- The scorecard says "Save progress", "Progress saved" and "Reopen
  scoring" (Erez's words: "save progress or save fight").
- `is_draft` stays in the API and the code, where it is precise.
**Rejected:** On "move to next row", the same fighter's box in the next
round. After A then B, that would land on B, and the next score typed
would be B's, out of turn. Also rejected: keeping "draft" on the pages (it
is the API's word for an unfinished card, not how a scorer thinks of a
fight).
**Why:** Rounds are scored as pairs, 10–9, one round after another, so
the box after a score is the other half of the pair. "Score" says what
the link is for.

### D40 · 2026-11-07 · v1's fate is not part of this rewrite
**Decision:** Erez's word: whether v1 keeps running, sits unused, or is
deleted with its data kept "is not something we should be basing this
rewrite's completion upon". No task, box, milestone or test here depends
on what happens to v1. The changes:
- Task 14 is "Deploy". It no longer retires v1, and its box that stopped
  v1's pm2 processes is gone.
- PLAN's milestone after 14 is that the chamber is the one in use, with
  all the data in it.
- SPEC's suite is green "before every deploy", not "before v1 is retired".

v1 stays what it is to this repo: a read-only reference for behaviour, and
the source of data that the importer reads (task 10). D1's rejected "keep
v1's own process behind pm2" is about the shape of v2's server, not about
v1.
**Rejected:** Retiring v1 at task 14 (the plan had it from the skeleton,
2026-10-31, with no decision behind it). Recording retirement as Erez's
choice and keeping it in the plan.
**Why:** The rewrite is done when the new app does its job with all the
data in it. What becomes of the old app is a separate decision, with its
own timing, and it should not be made by a checklist written before either
app was compared in use.

### D41 · 2026-11-07 · A points decision follows from the judges' cards
**Decision:** Erez, after scoring his first fight on v2: he used to tally
the cards by hand, but "if it's 2 judges to 1 for fighter A then it's a
split decision and a win, … why not have the UI figure that on its own".
`decisionFromCards` (`server/rules/decisions.ts`, §5) reads each card as
won by one side or even:
- 3–0 is UD; 2–1 is SD; two for a side and one even is MD;
- two even and one won is MT (majority draw);
- three even, or one each and one even, is D.

In the decision dialog, once all six totals are typed, the type and the
winner are filled in from the cards, with a line saying so ("SD for …,
from the cards (2–1)"). The decision must still be the cards' to give
(`fillFromCards`, `front/entry.ts`): one of UD, SD, MD, MT or D, so never
the generic DEC, a stoppage, a technical decision or draw, or a
no-contest; and not one the user has chosen. Picking a decision or a
winner, or opening the dialog on a bout that already has a result
("Change decision", or a bout reopened for scoring), makes the decision
the user's. After that, a later fix to a card never changes it.
**Rejected:** Checking the user's choice against the cards and refusing a
mismatch (cards are sometimes misread or misreported; the result is the
user's to record, and SPEC §5 says the scorecard never has to agree with
the decision). Filling the type for TD/T from the cards as well (they are
already chosen as technical, which the cards cannot say).
**Why:** The type of a points decision is arithmetic on the three cards,
and arithmetic is what the rules are for. It is filled, not forced, so the
rule can be corrected in use: Erez said he may revise it.

### D42 · 2026-11-07 · A belt is regular or interim; vacancy is the fight's; Silver is an area
**Decision:** Erez, after entering a title as kind "Vacant" because v1's
form offered it:
- "Vacancy is only per fight, once the title is won, it's not vacant
  anymore."
- "Active" is not a status either: the only real status is interim.
- Silver, Diamond and the like are regions, "world silver" or "world
  diamond".

So a title is body, area, class and an `interim` flag, unique on the four.
The free-text `status` column is gone. When neither side is the champion
coming in, the holder is vacant, per bout (`bout_title.holder_side`), and
the form says so ("vacant (neither is champion)"). The new-title form asks
for body, area (with "World, World Silver, European…" as its hint) and an
Interim checkbox, and says that vacancy is set per fight. Interim and any
area combine freely, since whether an interim silver belt exists does not
matter to the model.

Migration 003 converts what is stored, reading kinds in any case and
spacing:
- Active, Vacant or no kind becomes regular.
- Interim sets the flag. "Interim Silver" sets it and puts Silver in the
  area.
- Any other kind is appended to the area, or becomes the area when that is
  blank.

Rows that come out the same belt (body and area compared ignoring case and
spacing) are merged into the lowest id, and their bouts are repointed. A
bout that listed two of them keeps the one naming a holder over "vacant",
else its first. The v1 import maps v1's kinds the same way (IMPORT.md). The API takes
`interim: true/false`, regular when left out, and answers the stored 0/1,
as a bout's `is_draft` does. `status` is refused as an unknown field. To
rebuild `title`, the migration runner gained one switch: a file whose
first line is `-- migrate: rebuilds a referenced table` runs with foreign
keys off around its transaction, as SQLite documents, and every reference
is checked before commit.
**Rejected:** Keeping v1's free-text kind (Vacant then marks a belt rather
than a fight, so the belt splits into two titles once it is won). A fixed
list of kinds (the list is one item long). Keeping `status` beside the flag
and leaving the old column in place (two answers to one question).
**Why:** A belt has one history; whether anyone held it going into a fight
is a fact about that fight. The form said "Kind (Active, Interim…)" and
explained nothing, so the user did what v1 taught.

### D43 · 2026-11-07 · The fighter form finds or adds; a fighter found keeps the record, takes tonight's details
**Decision:** Erez, scoring at ringside, often knows a fighter's name only
once the fight is under way, so he cannot know yet whether they are in his
list. The fighter form opened from the bout form, and "New fighter" on
`/fighters`, is therefore find-or-add. The bout form offers "+ Fighter
(new, or from your list)" under each side before anything is typed, and
it opens the form blank. Details go in in any order, the name last if
need be.
- As the name is typed, the form lists the fighters it could be ("Use …").
- Using one, or saving a name that is exactly one fighter's (`namedFighters`),
  takes that fighter. The same name shared by two fighters asks which.
- A fighter taken from the list keeps their **stored record**. The weight,
  unit, colours and nickname typed tonight replace the stored ones, and
  anything left empty keeps what is stored (`updatesForExisting`). A unit
  counts only with a weight. A weight typed with the unit never touched
  is read in that fighter's own unit (`readDetails`), so "100" for a
  fighter kept in kg is 100 kg. In Erez's words: "just because he was
  129lbs wearing white a year ago, doesn't mean they are now the same
  weight". The card's snapshot is taken at the first save of the card
  (SPEC §7), so tonight's details reach a card not yet scored; one already
  scored keeps the snapshot it has.
- The bout's other side is never offered or taken. A name that is the
  other fighter's is refused, so their details cannot be written over
  (`fighterFor`).
- Editing a fighter into a name that is someone else's is refused, with a
  pointer to merge, since it would make two fighters of one name.
- A new fighter is made only when nobody has the name. The name is
  required, and the form says so in plain words. A fighter without a name
  is not a thing, by Erez's word.
**Rejected:** v1's way, which loaded the stored fighter over what had been
typed (the issue Erez named: a year-old weight and colours came back).
Taking the record typed off the broadcast (the app keeps the record fight
by fight; a correction is a deliberate edit, D28). Asking each time
whether to keep or take (Erez chose: keep the record, take the rest).
Saving a fighter with no name, to name later.
**Why:** At ringside the details come before the name. The list must not
grow a second copy of a fighter because the form was opened before the
scorer knew who it was.

### D44 · 2026-11-07 · The fighter form is a place, not a chute: finding a fighter keeps it open (reopens the exit in D43)
**Decision:** After Erez's run of the D43 form at ringside. He typed the
weight, colours and record off the announcement, then the first name, and
the form changed under him; Escape, the key that dismisses a list, closed
the dialog with everything typed; Cancel did the same; and "Use" wrote to
the fighter and closed before he had seen that the record announced
(19-1, 7 KOs) was not the one stored (18-1, 6 KOs). v1's form had one way
to finish and one to abort, and picking a match turned it into that
fighter's edit form; its one flaw was loading the stored fighter over what
was typed, which D43 fixed by making the match an exit. This entry keeps
D43's rule for the details and takes v1's shape back:
- Only Save ends the form. Picking a match (`bind`), or saving a name that
  is exactly one fighter's, makes the form that fighter's and keeps it
  open: the title is their name, a status line says they are in the list
  with their record, and "Not them" makes it a new fighter's again with
  the name and record as typed and the details as they stand.
- On a find (`fieldsOnFound`, `front/entry.ts`): their name goes in the
  name boxes; nickname, colours and weight stay as typed, an empty box
  shows the stored value as its placeholder and keeps it (D43); the unit
  shown is theirs unless one was chosen; the record boxes take their
  stored record, and the record typed is kept beside them, "You typed
  19-1-0 (7 KOs). Use it", when it differs and is not all zeros. A change
  to the record boxes is a correction (D28). Save sends the name and
  record only where changed and the details by D43 (`patchForFound`);
  nothing changed sends nothing.
- The matches drop down over the row below the name instead of pushing
  the fields; arrows move, Enter takes, Escape closes the list and nothing
  else; typing a name opens it again. The status line is always there, so
  the form does not jump when it changes.
- Cancel and Escape ask "Discard what you typed?" when the form is dirty,
  in the dialog base (`DialogForm.dirty`), so the bout form asks too; the
  event, deduction and decision forms do not define dirtiness yet.
**Rejected:** The match as an exit (D43's "Use", which saved and closed
unseen). Binding as the name is typed when it is exactly one fighter's
(the boxes would change mid-word, and "Joe Smith" would bind on the way to
"Joe Smithson"; D38 rejected choosing as you type for the same reason).
Taking the record typed over the stored one (D43; the app keeps it fight
by fight) or dropping it unseen (what the D43 form did). A separate "which
fighter?" step before the form (the name comes last, so the step would
come last too). A nested confirm dialog for Cancel (the question fits in
the action row, and a second modal over a modal is one too many).
**Why:** The form is where the fight's people are entered while the
announcement runs; it must stand still and lose nothing until the user
says so. Erez: "fix two things and break five others" is what the D43
form did to v1's flow.

### D45 · 2026-11-07 · How a contracted weight and a missed weight are stored (follows D26)
**Decision:** The shape of D26, built in
`tasks/contracted-weight-and-missed-weight.md`:
- A bout has `weight_class_id` or `contracted_weight`, exactly one, and the
  schema refuses neither and both (migration 004 rebuilds `bout`, since
  SQLite cannot drop the class's NOT NULL in place). "Instead of a class"
  is the task's own word.
- The contracted weight is pounds, a positive decimal, typed in pounds in
  the bout form and shown as "Contracted at 150 lbs". It has no unit
  column: contracts are quoted in pounds, and pounds is what everything
  converts through (D36).
- The missed-weight marks are `missed_weight_a` and `missed_weight_b`, 0 or
  1, true/false on the wire as `interim` is. They are not part of the
  as-of snapshot (the `a_*`/`b_*` columns), so taking or clearing a
  snapshot never touches them; they are what the user ticked, and change
  only when the user changes them.
- A PATCH that moves a bout between a class and a contracted weight sends
  both, one null. The bout as it would stand must have exactly one, else
  `400`, as a POST is.
- A title is fought for at its class's limit, so the bout form offers no
  title at a contracted weight and refuses one left on the line. The server
  does not check a title's class, as before.
- The TBRB rank in the snapshot is read from the bout's class (D32). A bout
  at a contracted weight has none, so the rank is null until
  `tasks/tbrb-rank-across-classes.md` decides which list counts.
**Rejected:** Allowing both a class and a contracted weight (the class
would say what the weight does not, and the two could disagree). A unit
for the contracted weight like the fighter's (no contract is quoted in
stone or kg on the cards Erez watches; one column is enough until one is).
A PATCH that clears the class on its own when only a weight is sent (a
field changing that was not sent). Clearing a side's missed-weight mark
when a draft's fighter is replaced, as its snapshot is (the form sends the
fighter and the tick together, so the clear would undo the tick).
**Why:** D26 settled what; this settles where, so the imports (tasks
10–11) can map onto it.

### D46 · 2026-11-07 · The class dropdown shows each limit, as v1 did
**Decision:** Erez, 2026-11-07, while D45 was being built: "it would be
nice to have weights themselves in the dropdowns like I had before". The
bout form's class list reads "Flyweight (112 lbs / 50.802 kg)", v1's
format, with the limits as migration 002 seeded them (`classText`,
`front/format.ts`). Heavyweight reads "Heavyweight (no limit)".
**Rejected:** v1's Heavyweight line, "200 lbs / 90.718 kg", which is
Cruiserweight's limit and which D17 removed. Rounding the kilograms to one
decimal (v1 showed them as stored).
**Why:** The limit is what the user checks the class against at
ringside; the name alone left the limit to memory.

### D47 · 2026-11-08 · A missed weight is noted quietly (supersedes D26 in part)
**Decision:** A side that missed weight gets "(missed weight)" after its
name on the card and under it on the scorecard, small, italic and in the
muted colour (`missedWeightNote`, `front/format.ts`); the fighter card
(task 09) notes it the same way. This replaces D26's "shown prominently". The bout form asks
on one plain line, "Missed weight:" and a tickbox per fighter, instead of
a bordered box with a heading. What is stored and how it is marked (D26,
D45) do not change.
**Rejected:** The yellow badge in bold capitals that D45's build gave it,
and the bordered box in the form. Both were made to stand out, as D26
asked.
**Why:** Erez, 2026-11-08, after trying it in the browser: a missed
weight comes up once every month or two, so it need not be that
prominent. A note keeps it seen on the rare bout that has one, without
the form asking about it louder than about the class or the rounds.

<!-- Compiled from tasks/ by scripts/compile-record.mjs. Do not edit below this line by hand. -->

## D48 · 2026-11-14 · Decisions and the plan are compiled from the task files

**Decision** — Upgrade to the 2026-11-11 runbook (0.4.0). `docs/DECISIONS.md` and `docs/PLAN.md` are compiled by `scripts/compile-record.mjs` (`deno task record`) before every commit; a decision is written under `## Decisions` in the task file of the work that made it. D1–D47 stay above the marker as the file's hand-written head, with their numbers. The plan's hand-written step table gives way to the compiled steps; its out-of-order list stays, frozen, in the plan's introduction, and later placements are stated in the decision that makes them. This upgrade is recorded here in task 00, the task that carried out the first adoption.
**Rejected** — Keeping both files hand-written (the old runbook); moving D1–D47 into task files and renumbering them; turning the out-of-order list into decision lines, which the compiler has no section for; a separate `tasks/unities-0.4.md`.
**Why** — One record: status and decisions are derived from the task files and cannot drift from them. Old numbers are cited all over the code and docs (`D26`, `D47`), so they must not move. The strict staging is unchanged; a commit is also the merge, so it carries the compiled files. Recorded 2026-11-14.

Source: [tasks/00-skeleton.md](../tasks/00-skeleton.md)

## D49 · 2026-11-14 · The plan as it stood

**Decision** — The milestones and the not-in-scope list of `docs/PLAN.md` as they stood on 2026-11-14, copied as written so the compiled plan carries them. The D40 paragraph on v1 is carried as a not-in-scope line.
**Rejected** — Rewording them in the move.
**Why** — The upgrade converts the plan's form, not its content.
Milestone: After 05: the data model is proven. A bout can be created, scored, stopped in round 2 with a knockdown, finalised, and both fighters' records move once and atomically — all over HTTP against a real database, with the snapshot intact. Nothing after this is worth building if this fails.
Milestone: After 08: the app can replace v1 for a fight night, standalone on the laptop. The design is still the programmer's own.
Milestone: After 11: the database holds every fight watched since Nov 2021.
Milestone: After 14: the chamber on Atrium is the one in use, with all the data in it.
Milestone: After 15: phase 1 complete; the project goes quiet.
Not in scope: What happens to v1 is not a step or a milestone here. Whether it keeps running, stops, or goes with its data kept is Erez's call, outside this plan, and nothing in it waits on that (D40).
Not in scope: Mobile layout (D9).
Not in scope: Public access (D2).
Not in scope: Charts and trajectories.
Not in scope: Service worker (D10).
Not in scope: Playwright (D11).
Not in scope: Automated TBRB history from archive.org.
Not in scope: Other ranking bodies.
Not in scope: Phase 2 is not planned here.

Source: [tasks/00-skeleton.md](../tasks/00-skeleton.md)

## D50 · 2026-11-14 · The record compiler gets a test under tests/, and the test task may run deno

**Decision** — `tests/record.test.ts` runs `scripts/compile-record.mjs --check` against a fixture in `tests/fixtures/record/` shaped like this repo (a hand-written head ending at `### D47`) and asserts that the first decision from a task file is `D48` and that the plan derives each step's status. `deno task test` gains `--allow-run=deno`, and nothing broader.
**Rejected** — Committing the upgrade with `--no-verify` as an adoption exemption (as `9785b17` was); widening the test task to `--allow-write` so the test could compile into a temporary directory.
**Why** — `scripts/` is source here, so the gate asks for a change under `tests/`; the gate's own tests live in `.claude/hooks/` and do not count. The one thing about the compiler that is specific to this repo is that it must read the hand-written `### D<n>` head and continue from it; that is worth a test of its own, and a fixture checked with `--check` needs only read and run.

Source: [tasks/00-skeleton.md](../tasks/00-skeleton.md)

## D51 · 2026-11-14 · A record is new when its body is, not its heading

**Decision** — `check-unit.mjs` counts a `## What was done` or `## Review` section as added by the scene when one of its body lines is added (`isNew`), not when its heading line is. A test in `.claude/hooks/check-unit.test.mjs` pins it: appending a record to a file that already holds an unreviewed one asks only the new one for a reader.
**Rejected** — Appendix A as written, which matches the heading line; adding `Reviewed by:` lines to the two 00 records of 2026-10-31 and 2026-11-02, which nobody read cold.
**Why** — Every `## What was done` heading reads the same, so appending one made each earlier record in the file count as new and be refused for want of a reader. Every task here with an earlier record would hit it on its next record. This is a local deviation from the 0.4.0 master; the fix belongs in the master too.

Source: [tasks/00-skeleton.md](../tasks/00-skeleton.md)

## D52 · 2026-11-15 · Claude Code is the only agent here; no Codex binding

**Decision** — Upgrade to the 2026-11-15 runbook (0.5.1) without its 4.10. Erez works here with Claude Code alone, so the instructions stay in `CLAUDE.md`, and there is no `AGENTS.md` and no `.codex/`. What 0.5.x adds for every repo is installed: `docs/reviewer.md` as the cold reader's brief, the new strict paragraph in `CLAUDE.md`, and the gate's `--codex` flag with its three tests. The flag stays in the script even though nothing here passes it.
**Rejected** — Installing 4.10 in advance (moving `CLAUDE.md` to `AGENTS.md`, adding `.codex/hooks.json` and the reader agent), since it would be a binding nobody runs and so could never be verified (Phase 6, step 8). Leaving the `--codex` code and its tests out of the script.
**Why** — Erez answered the runbook's agent question, which repos adopted before 0.5.0 were never asked, on 2026-11-15: Claude Code only. Keeping the script equal to Appendix A, plus this repo's block and D51, keeps the next upgrade a diff against the master and not a merge. If someone starts working here with Codex, that is a new decision superseding this one, and a re-run installs 4.10.

Source: [tasks/00-skeleton.md](../tasks/00-skeleton.md)

## D53 · 2026-11-15 · Imported TD and T bouts are rejected to the list

**Decision** — A `TD` or `T` bout from the sheet or from v1 is not imported. It goes on the rejects report, and Erez enters it by hand with its last round scored as D22 requires. This answers the question D22 and IMPORT.md left open.
**Rejected** — Importing that round as 10–10 with a note (it passes §1 but guesses a score); importing it 0–0 as v1 stored it (the card then fails §1 if it is ever saved again).
**Why** — Erez, 2026-11-15: reject to the list. Claude's reason: the sheet's cell for that round holds a time or a `KO`/`TKO` marker, not a score, so anything imported would be invented, and IMPORT.md promises that nothing is guessed.

Source: [tasks/questions-2026-11-03.md](../tasks/questions-2026-11-03.md)

## D54 · 2026-11-15 · A 9/9 round in the sheet is rejected to the list

**Decision** — A sheet round with no 10 on either side (`9`/`9`) is rejected to the list. Erez fixes the sheet or enters that round by hand. D24's knockdown default for rounds under 9 is unchanged. This answers the question D24 left open.
**Rejected** — Scoring it 10–10 less one point each (it passes §1 but changes who won the round); scoring it 10–9 to one side by some rule.
**Why** — Erez, 2026-11-15: reject to the list. Claude's reason: the sheet doesn't say which side won the round, and that can't be read from anything else.

Source: [tasks/questions-2026-11-03.md](../tasks/questions-2026-11-03.md)

## D55 · 2026-11-15 · A retirement is a TKO at 3:00 of the round it followed, and that round is scored (supersedes D20 and D22 in part)

**Decision** — There is no `RTD` code. A corner retirement after round X is entered as a `TKO` at 3:00 of round X, and a TKO at 3:00 has its result round scored (10–9, 9–10 or 10–10) like any other round and ends the card there. Any other TKO keeps D20's 0–0 stoppage round. The importers map v1's and the sheet's `RTD` and `RET` to that shape. Claude added three things to Erez's answer: `RET` (the sheet's other spelling) maps the same way; an imported retirement with no score for round X (v1 stored it 0–0) is rejected to the list, as D53 does for a TD; and the work goes under `tasks/retirement-is-a-tko.md`, before task 10, so the importers map onto it.
**Rejected** — Keeping RTD as a code of its own; keeping round X 0–0 as D22's interim had it; entering a retirement as a TKO in round X+1 at 0:00, which would have kept the rules free of a special case (offered, and not chosen).
**Why** — Erez, 2026-11-15, choosing from the options put to him: score round X, fold RTD into TKO, and enter it as a TKO at 3:00 of round X. The question gave the reason: round X was fought in full and judged. Claude's reading of the rule: a 3:00 TKO is the one stoppage whose round was completed, so it is the one that is scored. This replaces D20's "this holds whichever round convention is used for an RTD" and D22's interim "an RTD is treated like a TKO: its result round is 0–0".
Supersedes: D20, D22

Source: [tasks/questions-2026-11-03.md](../tasks/questions-2026-11-03.md)

## D56 · 2026-11-15 · An event with finalised bouts still can't be deleted

**Decision** — SPEC's rule stands: `DELETE /api/events/:id` answers `409` while any of its bouts is finalised. To delete such an event, each finalised fight is deleted through D23's guarded flow first, then the event.
**Rejected** — Running D23's guarded flow from the event, with one reset-or-keep choice for all its finalised bouts.
**Why** — Erez, 2026-11-15: keep refusing. The option put to him said it is rare, and that the fights can be deleted first, each through its own guarded flow. This answers the question D23 left open.

Source: [tasks/questions-2026-11-03.md](../tasks/questions-2026-11-03.md)

## D57 · 2026-11-15 · A kept result is stored as a per-fighter adjustment

**Decision** — "Delete and keep the records" (D23) stores the kept result as a per-fighter adjustment. `scripts/recompute-records.ts` (D13), when it is written, adds each fighter's adjustments to what it rebuilds, so a kept result survives a recompute. This answers the question D23 left open. Claude added the shape, for `tasks/kept-result-is-stored.md` to build before task 14: the adjustment's five counts (won, lost, draws, nc, kos), written in the delete's transaction, and moved to the target by a merge (D31).
**Rejected** — Storing nothing and letting a recompute undo the keep (the interim).
**Why** — Erez, 2026-11-15: store an adjustment. Claude's reason: a keep is a deliberate choice made in a guarded dialog, and a rare maintenance script shouldn't quietly reverse it.

Source: [tasks/questions-2026-11-03.md](../tasks/questions-2026-11-03.md)

## D58 · 2026-11-15 · A TBRB list dated the fight day counts, and no list is too old

**Decision** — D25's interim becomes the rule: a bout's standing is read from the last list dated on or before the fight date, however old that list is. This answers the two questions D25 left open.
**Rejected** — Only lists strictly before the fight day; an age limit (six months was the one offered) past which the fighter shows as "no ranking available".
**Why** — Erez, 2026-11-15: same day counts, no limit. Claude's note: the gap from April 2024 is then closed by back-filling the history (task 13), not by hiding old lists.

Source: [tasks/questions-2026-11-03.md](../tasks/questions-2026-11-03.md)

## D59 · 2026-11-15 · A bout's TBRB standing comes from the bout's class only; a contracted-weight bout shows none

**Decision** — A fighter's standing for a bout is read only from the list of the bout's weight class: a super-middleweight champion fighting at light heavyweight is unranked for that fight. A bout at a contracted weight (D26) has no class to read, so it shows no TBRB standing for either fighter and stores none in the snapshot. Claude added that this isn't D25's rejected "unknown" standing: the lists are known, but no class applies. This answers the questions D32 and D45 left open. The code from task 05 already reads the rank this way (tested with this decision); tasks 12 and 13 must keep it.
**Rejected** — The fighter's rank in whatever class they are listed in, with that class named; for a contracted weight, also the lightest class whose limit is at or above the weight (Claude offered both options).
**Why** — Erez, 2026-11-15: the bout's class only, and no ranking at a contracted weight. Claude's reading: a ranking says where a fighter stands in a division, and a fight outside it, or at a weight that belongs to no division, isn't fought from that standing.

Source: [tasks/tbrb-rank-across-classes.md](../tasks/tbrb-rank-across-classes.md)

## D60 · 2026-11-15 · Migration 005 rebuilds the bout table to drop RTD from its check

**Decision** — `server/migrations/005-retirement-is-a-tko.sql` rebuilds `bout`, as 004 did, so that its `decision_type` check no longer lists `'RTD'`, and converts the stored RTDs in the same copy.
**Rejected** — Converting the rows with an `UPDATE` and leaving `'RTD'` in the check, which would avoid a rebuild but let the database take a code the rules no longer know.
**Why** — SQLite can't change a check in place. The schema states what the app accepts, as it does for every other code (§5), so the rebuild is worth its cost, and 004 already showed the way.

Source: [tasks/retirement-is-a-tko.md](../tasks/retirement-is-a-tko.md)

## D61 · 2026-11-16 · A merge adds the duplicate's kept results to the target's record

**Decision** — A merge (D31) counts each of the duplicate's kept results like one of its finalised fights: added to the target's record, and its `record_adjustment` row moved to the target. The preview says how many (`kept_results`), and the merge dialog names them. Claude's choice, made while building the box that moves the adjustments.
**Rejected** — Moving the adjustment rows without adding them to the target's record, which is all the acceptance box asked for.
**Why** — The duplicate's typed-in record, which holds the kept result, is dropped by a merge (D28). Moving only the row would leave the result out of the target's stored record but in what a recompute rebuilds for it, so the two would disagree and a recompute would change the record. Adding it keeps them equal, as D31 does for finalised fights.

Source: [tasks/kept-result-is-stored.md](../tasks/kept-result-is-stored.md)

## D62 · 2026-11-16 · A kept result names the opponent, and a merge refuses two who met in a kept fight

**Decision** — Each `record_adjustment` row also stores the opponent (`opponent_id`). A merge is refused (`409`, "fought each other") when the duplicate and the target have a kept result between them, as it is refused when they have a bout between them. A merge repoints the duplicate as opponent too. Claude's choice, answering the cold reader's finding below.
**Rejected** — Leaving the opponent out, so that a merge could add the duplicate's side of a kept fight against the target to the target's record, which already counts the target's own side; skipping such rows in the merge instead of refusing, which would merge two fighters who fought each other.
**Why** — D31 already holds that two who met are two people. A deleted fight whose result was kept still happened, and the record still counts it, so the same rule applies. Without the opponent the merge cannot tell which kept results are against the target.

Source: [tasks/kept-result-is-stored.md](../tasks/kept-result-is-stored.md)

## D63 · 2026-11-16 · The sheet's text colour gives a deduction's reason: red a foul, blue or none a knockdown

**Decision** — In a round that has a 10, a cell under 9 has base 9 (D24), and the cell's text colour gives the reason for each point below it. Red text is a foul. Blue text is a knockdown. No colour keeps D24's knockdown default, with its `reason assumed (import)` note. Claude added the rest:
- A foul's deduction has reason `other` and the note `foul (red in the sheet)`, since the sheet doesn't say which foul.
- A blue knockdown has no "assumed" note, since Erez marked it.
- Every point in a red 7 counts as a foul, since one cell's points can't be split between reasons.
- Colour on a 10, a 9 in a round that has a 10, or an `x` means nothing and is ignored. So is a row's green background, which covers all 23 columns of a row and highlights it.

A round with no 10 is D65's.
**Rejected** — Importing every deduction as a knockdown and dropping the colour (D24's fallback, which applied only if there was no scheme); reading blue as a foul or as no information.
**Why** — Erez, 2026-11-16: red text was a foul, no colour a knockdown. Asked about the blue cells the read turned up, he said blue was a knockdown. This fills the case D24 left open ("if the colours turn out to tell a knockdown from a foul").

Source: [tasks/sheet-deduction-colours.md](../tasks/sheet-deduction-colours.md)

## D64 · 2026-11-16 · The colours are read once from the .numbers file by a JavaScript for Automation script, beside the CSV

**Decision** — The colours come from a one-off JavaScript for Automation script, run with `osascript` on macOS with Numbers installed, against a copy of `docs/reference/boxing.numbers`. It writes `data/import/sheet-colours.csv` (gitignored, like `sheet.csv`) with one line per coloured round cell: `row,round,colour,boxer`.
- `row` is the Numbers table row, counting the header as row 1, which is the line number in `sheet.csv` when it is exported with its header.
- `colour` is `red` or `blue`.
- `boxer` is the cell's `Boxer Name`, so the importer can check that the row landed on the same fighter.

The CSV stays the source of every value, so D8 stands. Task 11 builds the script beside the importer. The importer refuses to run without the colours file, because without it every foul would quietly become an assumed knockdown.

Erez approved reading the colours this way on 2026-11-16 ("Yes, read them", to: may I read them with a one-off script, opening Numbers). The file, its format, the row matching and the refusal are Claude's.
**Rejected** — Erez adding a column to the sheet by hand before the export (offered, not chosen); parsing `.numbers` directly (D8); exporting to `.xlsx` and reading it with a parser library, a dependency; falling back to D24 for every cell when the colours file is missing.
**Why** — It adds no dependency and needs no hand marking, and it runs once, like the CSV export. It was already run once, on 2026-11-16, for the counts in `tasks/sheet-deduction-colours.md` and `docs/IMPORT.md`.

Source: [tasks/sheet-deduction-colours.md](../tasks/sheet-deduction-colours.md)

## D65 · 2026-11-16 · A round with no 10 and one side in red is that side's round, less a foul

**Decision** — A sheet round with no 10 on either side, and exactly one side's cell in red text, is imported as the red side's round: points 10, less one foul deduction per point below 10. The other side is 9 less its deductions, with their reason from D63. A round with no 10 and neither side red, or both red, is still rejected to the list. Claude added three parts to Erez's answer, which was about 9–9: the reject when both or neither side is red, the 10-based arithmetic, and the `9`/`8` case (Ryan Garcia's red 9 against Devin Haney's uncoloured 8 in round 7), which follows the same reading.
**Rejected** — Keeping D54's rejection for every round with no 10 (offered, not chosen).
**Why** — Erez, 2026-11-16: import them. Claude's reason: the red marks who was docked, and so who won the round, which D54 said the sheet couldn't tell. In the sheet as read, 15 rounds come in this way, as counted in `tasks/sheet-deduction-colours.md` and `docs/IMPORT.md`.
Supersedes: D54

Source: [tasks/sheet-deduction-colours.md](../tasks/sheet-deduction-colours.md)

## D66 · 2026-11-19 · The compilers in scripts/ do not take the runbook's licence line yet

**Decision** — The 0.5.5 licence comment goes into the two hook files only. `scripts/compile-record.mjs` and `scripts/compile-changelog.mjs` stay as they were. That comment is the only change 0.5.5 makes to them, and they will take it the next time a scene changes them for a reason a test can show.

**Rejected** — Adding the line now together with a `tests/` change made only to satisfy the gate, which would be a test of nothing. Widening the `test` role so the change passes, which would loosen the gate for every later scene to fit one comment.

**Why** — The gate counts `scripts/` as source and wants a test with any source change (D50 put the compiler's test under `tests/`). A comment changes no behaviour, so nothing honest can test it. The comment is the author's own licence notice on code he wrote, so leaving it out loses nothing.

Source: [tasks/00-skeleton.md](../tasks/00-skeleton.md)

## D67 · 2026-11-19 · The compilers take the licence line, and this one commit goes past the gate

**Decision** — `scripts/compile-record.mjs` and `scripts/compile-changelog.mjs` take the runbook's licence line as their second line, as the hook files did. The change has no test and no doc line. Erez commits it himself with `--no-verify`, once. The gate itself is unchanged.

**Rejected** — Keeping D66, which held the line back for want of a test that a comment cannot have. Teaching the gate that a comment-only diff is not a source change, which would add a local deviation to the gate for one comment.

**Why** — A licence comment changes no behaviour, so a test of it would test nothing, and no doc describes it. The gate wants both with any `scripts/` change, and the compiled `docs/DECISIONS.md` does not count as a doc. Bypassing the gate once, by Erez's own hand, costs less than changing the gate for every later scene.

Supersedes: D66

Source: [tasks/00-skeleton.md](../tasks/00-skeleton.md)

## D68 · 2026-11-19 · The fighter card is its own task file, under 09

**Decision** — The card is built and recorded in `tasks/fighter-card.md`. Task 09 keeps its four acceptance boxes, and its second one is ticked when 09 closes.
**Rejected** — Appending a `## What was done` to `tasks/09-design-pass.md` for the card alone.
**Why** — A task file with a *What was done* section is done (tasks/README.md), so the plan would call 09 done while the restyle of the other pages and Erez's check in the browser are still open.

Source: [tasks/fighter-card.md](../tasks/fighter-card.md)

## D69 · 2026-11-19 · Titles held are worked out from the bouts watched

**Decision** — A fighter holds a title when the last finalised bout that had it on the line left it with them. The winner of a finalised bout takes every title on the line. A draw or a no contest leaves each title with the side that brought it in, and a vacant title stays vacant. Bouts are taken in fight order: event date, then card order. Every finalised bout with that title counts, whoever fought in it. It is a pure rule, `titlesHeld` in `server/rules/titles.ts` (SPEC Scoring §8).
**Rejected** — A stored current holder per title, which nothing writes and the import could not fill. Reading only the fighter's own bouts, which would still show a belt they had lost in a fight between two others, or vacated before one.
**Why** — The app knows titles only through the fights watched. The card says "as witnessed", as the fight list does. A title lost or vacated off-screen still shows until a bout with that title is watched.

Source: [tasks/fighter-card.md](../tasks/fighter-card.md)

## D70 · 2026-11-19 · One read endpoint for where a fighter stands

**Decision** — `GET /api/fighters/:id/standing` answers `{titles: [title_id], tbrb: [{weight_class_id, rank, snapshot_date}]}`: the titles held (above), and the fighter's rank on each class's latest TBRB list that names them. A class whose latest list does not name them is left out, which is unranked (D25).
**Rejected** — Building `GET /api/tbrb/fighters/:id` (the rank history, task 12–13's) early for the card. Adding the standing to `GET /api/fighters/:id`, whose shape the fighters page, the forms and the merge read.
**Why** — The card needs the current standing, not the history. The other endpoints stay as they are. Before task 12 there are no lists, so `tbrb` is empty and the card says so.

Source: [tasks/fighter-card.md](../tasks/fighter-card.md)

## D71 · 2026-11-19 · The card reads the event dates from the events list

**Decision** — The card loads `GET /api/events` and joins each bout to its event's date, as a page joins ids to names from the reference lists (D34).
**Rejected** — Adding the event date to `GET /api/fighters/:id/bouts`.
**Why** — The data is already served, and the bout's wire shape is shared by every page.

Source: [tasks/fighter-card.md](../tasks/fighter-card.md)

## D72 · 2026-11-19 · No webfont yet; the card's styles are its own

**Decision** — The card's display type is a system condensed stack (`Avenir Next Condensed`, `Helvetica Neue` condensed, `Arial Narrow`), and its colours are custom properties scoped to `.fighter-card` in `front/style.css`. The other pages do not change.
**Rejected** — Loading Barlow Condensed and Inter from Google Fonts, as the design reference does. Changing the `:root` properties now.
**Why** — A webfont is a new dependency, and needs a row in SPEC's Stack table. Whether to add one is the restyle's call, for every page at once. Until then, scoping keeps the restyle's "no behaviour change" box about the other pages true.

Source: [tasks/fighter-card.md](../tasks/fighter-card.md)

## D73 · 2026-11-19 · From the design, what the card leaves out

**Decision** — Colours are shown as the words typed, not as swatches. A title held has no "won on" date or count of defences. Wins and losses are squares in the "As witnessed" row: filled for a win, open for a loss, grey for a draw, dashed for a no contest.
**Rejected** — Parsing the colour words into swatches. Counting defences from the bouts watched.
**Why** — `colors` is free text ("Blue/Yellow"). A count of defences from the fights watched would be wrong whenever one was missed, and the design's README already lists both as open.

Source: [tasks/fighter-card.md](../tasks/fighter-card.md)

## D74 · 2026-11-19 · "Champion" above the name means a title held as witnessed

**Decision** — The card puts a "Champion" chip above the name when the fighter holds at least one title as witnessed (§8), whatever the belt, interim included. A TBRB champion (rank 0) shows as "Champion" in the TBRB panel, and does not get the chip on its own.
**Rejected** — Showing the chip for a TBRB rank 0 as well. Showing it only for a regular belt.
**Why** — The chip follows the titles panel under it, so the two always agree. TBRB's champion is a ranking, and the panel already says it. Which belts count as "real" is not something the app records.

Source: [tasks/fighter-card.md](../tasks/fighter-card.md)

## D75 · 2026-11-19 · A side that missed weight can neither take nor keep a title

**Decision** — In §8, where a bout would leave a title with a side marked as having missed weight, the title goes vacant instead. That covers a heavy winner, and a heavy holder who wins, draws or ends in a no contest. A heavy holder who loses loses the belt to a challenger who made weight. `holderAfter` reads `missed_weight_a/b` from the bout.
**Rejected** — Ignoring missed weight, so the winner always takes the belt and the holder keeps it on a draw.
**Why** — Erez, 2026-11-19, asked when the cold review of tasks/fighter-card.md found the gap: "No, it goes vacant". A fighter who misses weight is not eligible for the belt. The mark is the user's, never computed (D26), so the rule reads only what was ticked.

Source: [tasks/fighter-card.md](../tasks/fighter-card.md)

## D76 · 2026-11-19 · The scorecard's columns are mirrored around the round

**Decision** — Side A reads total · ded · points, the round number sits in the middle, and side B reads points · ded · total. The two points boxes of a round sit side by side. Focus still moves across, then down, by `nextBox` (D39), which looks boxes up by round and side, not by position.
**Rejected** — v1's order, points · ded · total on both sides, with the round number first.
**Why** — Erez, 2026-11-19, on the design canvas: "Keep it mirrored". A round's 10 and 9 read next to each other. One thing does move: Tab from side A's points box now reaches side B's points box first, because A's deduction button comes before its points box.

Source: [tasks/restyle-scorecard.md](../tasks/restyle-scorecard.md)

## D77 · 2026-11-19 · The fighters' headers become marquees above the card

**Decision** — Each side's header leaves the table and becomes a marquee above it. The corner, with a "Champion" chip when the side brought a belt in, comes first. Then the name and nickname, the belts by name, and a missed weight noted quietly (D47). Then the record (`recordText`'s "22-1-0 (16 KOs)") and TBRB rank (`rankText`) on the night, and the weight and colours from the snapshot. The corner colour stays on each side's column header, as a bar over its three columns.
**Rejected** — The design's "16 KO" and "No. 2". Keeping the header inside the table.
**Why** — The app says a record and a rank one way everywhere (`format.ts`), and the fighter card already does. The weight and colours are in the snapshot, and Erez describes the marquees as where the fighters' stats at the start of the fight sit. The record, rank, weight and colours appear only once the first save has taken the snapshot, as before.

Source: [tasks/restyle-scorecard.md](../tasks/restyle-scorecard.md)

## D78 · 2026-11-19 · The page's actions move to a bar at the top

**Decision** — The crumb back to the event, then "Save progress", "End bout" and the save line (or "Change decision" and "Reopen scoring" once final) sit in one bar above the marquees. The buttons, their words and their order, and so the Tab order, are unchanged. A finalised card adds a "Final" label before its buttons. The page's `h1`, both names, becomes visually hidden, because the marquees show the names large; screen readers still get it.
**Rejected** — Leaving them under the card.
**Why** — With twelve 64px rows the card is taller than the window. A button under it would be off-screen while scoring.

Source: [tasks/restyle-scorecard.md](../tasks/restyle-scorecard.md)

## D79 · 2026-11-19 · A deduction says why, in words as well as colour

**Decision** — A deduction box shows `−N`, then "KD" in blue when any of that spot's deductions is a knockdown, and "FOUL" in red when any is another reason. The "?" of a reason assumed on import stays. `deductionKinds` in `front/scorecard.ts` says which.
**Rejected** — Colour alone. The reason's full name.
**Why** — It matches the Numbers sheet (D63) and the design, and the words carry it without the colour. The full reason is in the dialog the box opens.

Source: [tasks/restyle-scorecard.md](../tasks/restyle-scorecard.md)

## D80 · 2026-11-19 · A finalised card shows the judges

**Decision** — Once final, a black band under the marquees gives the result (`resultText`, with `resultLabel` as its tooltip), each judge's card that was typed, and my card from the running totals when a round was scored.
**Rejected** — The result in the subtitle only, as before.
**Why** — The judges' cards are kept with the result (D41), and the page never showed them. Seeing mine beside theirs is the point of the finished card.

Source: [tasks/restyle-scorecard.md](../tasks/restyle-scorecard.md)

## D81 · 2026-11-19 · The design's look is shared, scoped by page

**Decision** — The design's colours move from `.fighter-card` into one set of custom properties (`--ds-*`), given to `.fighter-card` and `.bout-page`. Each restyled page adds its class to that rule. The scorecard's old rules in `front/style.css` give way to rules scoped to `.bout-page`. `main` widens to 80rem only when it holds a `.bout-page`. There is still no webfont (D72).
**Rejected** — Changing `:root` and `main` for every page now. A second copy of the colours.
**Why** — The events and fighters pages are not restyled yet and must not change. One set of properties keeps the restyled pages in step.

Source: [tasks/restyle-scorecard.md](../tasks/restyle-scorecard.md)

## D82 · 2026-11-19 · Not in this restyle: blind scoring

**Decision** — The design's option to hide every total until the end is not built.
**Rejected** — Building it with the restyle.
**Why** — It is new behaviour, and the restyle is to change none. It stays an open choice in `docs/reference/design/README.md`.

Source: [tasks/restyle-scorecard.md](../tasks/restyle-scorecard.md)
