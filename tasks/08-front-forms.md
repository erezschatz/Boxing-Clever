# 08 · Front: forms

## Context

**Promise.** I can add a fighter, an event and a bout — with corners, weight class,
scheduled rounds and titles with who holds them — enter a deduction with a
reason, and end a bout with the decision dialog, all without leaving the
page I am on.

**Acceptance.**
- [ ] Dialogs over native `<dialog>`: fighter (create/edit, weight in any unit), event, bout (fighters by search, corners, class, rounds, titles + holder side), deduction (points, reason), decision (type, winner, round, time, three judges)
- [ ] Decision dialog sends codes; the stoppage round is handled by the rules, not the form
- [ ] Fighter merge from the fighters page
- [ ] Verified by Erez: a full event entered and scored from an empty database, standalone
