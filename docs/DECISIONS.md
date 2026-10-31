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
