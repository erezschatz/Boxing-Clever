# Decisions

Dated, append-only. A decision is reversed only by a new entry naming the one
it supersedes. Format: `D<n> · YYYY-MM-DD · title` → **Decision** /
**Rejected** / **Why**.

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
