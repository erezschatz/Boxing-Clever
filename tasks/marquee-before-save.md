# The scorecard's marquees before the first save, the titles at stake, and VS at the top

## Context

Erez, 2026-11-20, with two screenshots of one scorecard: "the design I see
has the title and the record, my screen doesn't, and the VS should be to
the top, see what happens with one guy in a single line and the other not.
Now, to test this, I moved back to the event window and forward, and now
it shows the second image, still no title, the record weight and colors
are now there."

The marquees showed the record, weight and colours from the as-of snapshot
only, which the first save takes (§7): a new card showed none, and going
back to the event saved the card on the way out, which took it. The design
(`docs/reference/design/Main.dc.html`) also has the titles fought for under
the class ("12 rounds · WBC super bantamweight title"), which the scorecard
did not show. And VS was centred on the marquees, so with one name on two
lines it sat lower than the other name's line.

**Promise.** Opening a card shows both fighters' record, weight and
colours and what is at stake, and VS sits level with the names.

**Acceptance.**
- [x] Before the first save, each marquee shows the fighter's record, weight and colours as they stand (what that save will take); after it, the snapshot's, as before; the TBRB rank still only from the snapshot
- [x] Under the class and rounds, a quiet line names the titles fought for ("WBC World title", "WBC World · IBF World titles"); no line when none is at stake
- [x] VS sits level with the names' first line, whichever name runs to two lines
- [x] What is saved is unchanged; the snapshot is taken as before
- [x] Tests show the marquee's figures before and after the snapshot and the titles line; `deno task test` and `deno task check` run green by Claude; seeing it is Erez's

## Decisions

### 2026-11-20 · Before the snapshot, a marquee shows the fighter as they stand

**Decision** — `standingOnTheNight` in `front/format.ts` gives a side's record, weight and colours: the snapshot's once the first save has taken it (`a_won` or `b_won` not null), and before that the fighter's row as loaded with the page, which is what the first save will take (§7). A finalised bout with no snapshot (an import) already counts in the fighter's record, and that save takes its result off first (`recordChange` from `server/rules/records.ts`), so the marquee does too. The TBRB rank stays the snapshot's only (`rankOf`), as the rank is read on the server. Only the scorecard's marquees use it; the event card and fighter card keep the snapshot's record.
**Rejected** — Taking the snapshot when the page opens (a save the user did not make). Leaving the marquee empty until a save, as it was. Changing the event card's rows too, which were not asked about.
**Why** — Erez expected the record on a fresh card, as the design shows it. The fighter's row is what the snapshot will hold, unless the fighter is edited before the first save, in which case the marquee shows the edit, as the snapshot will.

### 2026-11-20 · The titles fought for are named under the class

**Decision** — `titlesAtStake` names a bout's titles (`titleText`, joined by " · ", then "title" or "titles"), shown in muted plain text under the class and rounds line, which is now a `.bp-class` block of two lines. A bout with no title has no second line.
**Rejected** — The design's "WBC super bantamweight title", which names the class, not the title's area as the app stores it. Putting the titles in the class line in capitals.
**Why** — The design shows what is at stake under the class; the belts each side brings in stay in the marquees (D78's marquee, unchanged).

### 2026-11-20 · VS is level with the names' first line

**Decision** — The corner line is one height, 1.75rem, whether or not it holds the Champion chip, so both names start level. `.bp-vs` is aligned to the top of the marquees and dropped past the corner line (1.75rem and its 0.6rem gap), then centred on one line of a name, whose size is now the custom property `--bp-name-size` on `.bp-marquees` so both rules read it.
**Rejected** — The design's VS centred on the marquees, which a name on two lines pulls down. Measuring the names with a script.
**Why** — Erez: "the VS should be to the top, see what happens with one guy in a single line and the other not".

## Review · 2026-11-20

Read cold by an Explore subagent against the staged diff and this file
(`docs/reviewer.md`). It found these as the record says:
- a draft's marquee showing what `snapshotOf` will take, a replaced
  fighter's side (D32) cleared and shown from the new row;
- `refs.fighters` loaded fresh with the page;
- `titlesAtStake` reading `bout.titles` in the server's shape;
- the class line's look unchanged;
- `--bp-name-size` on the names' ancestor;
- the test diff adding lines only, import lines aside;
- D113–D115 matching this file.

It found two things.

### An imported finalised bout's marquee shows a record the first save will not take

**Found** — `front/format.ts`, `standingOnTheNight`: a finalised bout with no snapshot (an import, §7) showed the fighter's record, which already counts this bout; the first save takes it off (`snapshotOf` with `recordChange(counted(bout), null)`).

**Done when**

- [x] Imported finalised bout, no snapshot → the record with this bout's result taken off
- [x] Fresh draft, no snapshot → the fighter row's figures
- [x] A bout with a snapshot → the snapshot's
- [x] A replaced fighter's cleared side (D32) → the new fighter's row
- [x] A side whose fighter is not loaded → only the snapshot's
- [x] TBRB rank → the snapshot's only

**Not asked** — Taking the snapshot on opening, server changes, the event and fighter cards.

Answered in this change: `standingOnTheNight` takes a finalised bout's own
result off with `recordChange(result, null)` and `applyDelta`, the rules
the server's snapshot uses. Tested for both sides and for a draft.

### VS sits above the names' first line when a side carries the Champion chip

**Found** — `front/style.css`: the corner line was at least 1.5rem, and the chip makes it about 1.72rem, so a champion's name sat about 3.5px lower than VS and the other name.

**Done when**

- [x] Neither side has the chip → VS centred on the names' first line
- [x] Both have it → VS centred on the names' first line
- [x] One has it → VS level, both names' first lines at one height
- [x] A name on two lines → VS unchanged

**Not asked** — Measuring with a script, the chip's or corner's look.

Answered in this change: `.bp-corner` is a fixed 1.75rem high, which holds
the chip, and `.bp-vs`'s padding reads 1.75rem. Shown by the arithmetic,
not seen in a browser.

## What was done

2026-11-20. The scorecard's marquees show the fighters before the first
save, the titles at stake are named, and VS is level with the names.

- **Helpers** (`front/format.ts`): `standingOnTheNight(bout, side,
  fighter)`, which takes an imported bout's own result off the fighter's
  record (`recordChange`, `applyDelta`), and `titlesAtStake(bout, titles)`;
  `Fighter` is imported from `api.ts`.
- **Marquee** (`front/side-head.ts`): the record, weight and colours come
  from `standingOnTheNight`; the rank from `rankOf`, unchanged. The unused
  `recordOnTheNight` and `weightOnTheNight` imports go.
- **Scorecard** (`front/bout-page.ts`): the class line becomes a
  `.bp-class` block holding it and, when titles are at stake, a
  `.bp-stakes` line.
- **Styles** (`front/style.css`): `.bp-class` is a centred column, its
  lines styled by `.bp-class p` and the quiet `.bp-class p.bp-stakes`.
  `--bp-name-size` on `.bp-marquees` sets the name's size; `.bp-corner` is
  a fixed 1.75rem high; `.bp-vs` is top-aligned with the padding that puts
  it on the first name line.
- **Docs**: SPEC's scorecard paragraph says what the marquee shows before
  the snapshot and that the titles fought for are under the class. `deno
  task record` compiled this file's decisions into `docs/DECISIONS.md` as D113–D115
  and added the task to `docs/PLAN.md`.

Tests: `tests/front/shell.test.ts` adds a test of `standingOnTheNight`
(before the snapshot, after it where the fighter has changed, an imported
finalised bout for each side, a draft, and with no fighter loaded) and of `titlesAtStake` (none, one, two). `git diff tests`
adds lines only, besides the import lines.

Verified 2026-11-20 by Claude:
- `deno task test` (226 passed), `deno task check` and `deno lint front`
  run.
- Not seen in a browser. A fresh card's marquees, the titles line and VS's
  place are Erez's to check.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-20); its two findings are answered above
