# 09 · Design pass

## Context

**Promise.** The app looks designed rather than built — one visual language across
pages, and a fighter card that reads at a glance: who they are, their
record, where they stand, and what I have seen them do.

**Acceptance.**
- [x] Erez runs a Claude Design pass over the pages from 06–08; the output lands in `docs/reference/design/` as the reference
- [x] Fighter card `/fighters/:id` built to that design: identity, current record, TBRB standing per class, titles held, fights as witnessed with the as-of record beside each
- [x] Scorecard, events and fighters pages restyled to the design without behaviour change (tier tests untouched)
- [x] Verified by Erez in the browser

## What was done

2026-11-22. Task 09 closes on Erez's check in the browser. Its work was
done in the task files each box names, and is recorded there.

- **Design pass**: Erez's Claude Design pass landed in
  `docs/reference/design/`: ten artboards, the canvas index and the README
  of the look and its open choices (commit `bcb98e0`).
- **Fighter card**: [fighter-card](fighter-card.md) (D68–D75).
- **Restyles**, each without behaviour change and with the tier tests
  untouched:
  - [restyle-scorecard](restyle-scorecard.md) (D76–D82);
  - [restyle-events](restyle-events.md) (D83–D87);
  - [restyle-event-card](restyle-event-card.md) (D88–D92);
  - [restyle-fighters](restyle-fighters.md) (D93–D96);
  - [restyle-dialogs](restyle-dialogs.md) (D103–D105).
- **Around them**, asked for while checking the pages:
  - the brand: [brand-icons](brand-icons.md), [header-logo](header-logo.md),
    [header-to-design](header-to-design.md), [sticky-header](sticky-header.md);
  - the scorecard in use: [short-save-line](short-save-line.md),
    [stoppage-round](stoppage-round.md), [arrow-keys](arrow-keys.md),
    [marquee-before-save](marquee-before-save.md),
    [kd-in-round-under-way](kd-in-round-under-way.md).
- **Left open**, each an open choice in `docs/reference/design/README.md`
  or a decision of the task that left it: the events list's main event and
  bout counts (D83), the fighters Find box and letter rail (D93), and blind
  scoring (D82). The place's split into venue and city is
  [venues](venues.md) (D117), next.

Verified 2026-11-22 by Erez in the browser, over a day of use: "The design
looks very good, close and move to the venues". No code changes with this
record.

Reviewed by: Explore subagent (cold read of the staged diff against this file, 2026-11-22); no findings
