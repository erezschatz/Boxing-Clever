# A chosen fighter's name stays editable; the winner is up front

## Context

Erez, 2026-11-26, after scoring with the app: "first is the inability to
edit a fighter once selected, if I start a bout and type a name that is
selected, that name is frozen now, I can't edit it. Same if I picked a name
and started scoring or so. Also, the selection dropdown, if I want to go to
edit, I have to backspace all the way to clear it. So more flexibility on
the fighter name. Second, and this is a smaller issue, picking the winner is
not positioned right in term of design, and I don't like the radio buttons.
While it may be the right design, it's not a good view, unlike the bold type
in the scorecard and I have already tried saving a couple of dialogs and
then got "who won" because I missed it. See if you can alter it so it will
be more up-front and maybe redesign the radio buttons, make them more square
and significant".

Now, in the bout dialog, a chosen fighter is a line of text with a small
"change" beside it, and "change" brings back the search box holding whatever
was typed before. In the decision dialog the winner is two radio buttons
under the decision dropdown.

**Promise.** A fighter's name in the bout dialog can always be typed over,
without clearing it letter by letter first; and the winner is the first and
plainest thing in the decision dialog, so it is not missed.

**Acceptance.**
- [x] In the bout dialog a chosen fighter's name is in a box that takes typing; typing in it goes back to the search with what the box then holds, and the name typed back in full is the fighter again, read in the diff and held by a test of what the box makes of typing
- [x] Going into the box of a chosen fighter selects the whole name, so the first key replaces it, read in the diff
- [x] A finalised bout's fighters still cannot be changed in the dialog (D30), read in the diff
- [x] The winner is the first thing in the decision dialog, as two square buttons with the names in the scorecard's bold type, the chosen one in ink with `aria-pressed`; a drawn or no-contest result shows its one answer the same way, already chosen; held by a test of the choices each decision gives
- [x] Finalise with no winner picked marks the winner buttons as well as saying so, read in the diff
- [x] `deno task test` and `deno task check` run green by Claude
- [ ] Erez: in the browser, in a new bout and in a bout with rounds scored, he picks a fighter, goes back into the name and types another without backspacing through the first
- [ ] Erez: in the browser, the decision dialog's winner is where and how he wants it, and Finalise without one shows him what is missing

## Decisions

### 2026-11-26 · A chosen fighter stays in the search box, and typing in it searches again

**Decision** — Each side of the bout dialog is one box at all times. With a fighter chosen it holds their name, in the bold type the chosen line had, with their record under it. Going into the box selects the whole name. Any typing that leaves the box holding something other than that name un-chooses the fighter and searches for what the box now holds (`sideTyped` in `front/entry.ts`); nothing is written until Save, and a name typed back in full is the fighter again on Save, as before (D38). The "change" button goes. A finalised bout's box is read-only (D30).
**Rejected** — Keeping the chosen line and making "change" plainer, or having it empty the search box: still a click before typing, and Erez read the line as frozen. An "edit" beside the name that opens the fighter's own form from the bout dialog: that edits the fighter everywhere, which is the fighter page's job, and what Erez described is typing a different name. Choosing as you type, so the box always holds a fighter: rejected in D38 and still is.
**Why** — "More flexibility on the fighter name": the name is where he looks and where he types, so the name is the control. Selecting it on the way in is what makes one key enough.

### 2026-11-26 · The winner is the first thing in the decision dialog, as large buttons; a choice of two or three is buttons, more a dropdown

**Decision** — The decision dialog opens with the winner: one square button per answer the decision allows (`button.win`, the dialog's own markup, not `choiceRow`), the fighter's name in the display type of the scorecard, the chosen one filled in ink with `aria-pressed`. A decision with one answer shows it as one pressed button reading "Draw" or "No winner". The decision dropdown, the round and time and the judges' cards follow in their old order. Finalise with no winner picked outlines the buttons in red and says "pick the winner"; the mark and the message go together, once there is a winner. Pressing a winner, the pressed one too, makes the result the user's, so the cards no longer fill it (D41). By keyboard: the dialog opens with the cursor on the first winner button; Tab moves between the buttons, a lone "Draw" or "No winner" among them; Enter or Space presses one and does not finalise; the arrow keys do nothing on them; Enter in the round, the time or a judge's box finalises as before. The rest of D103 is restated here unchanged: `choiceRow` in `front/dialog.ts` draws the corner of fighter A, who brought each title in and the weight unit as rows of buttons, the chosen one `aria-pressed`, a press on it doing nothing; the class, the title to add, the deduction reason and the decision code stay dropdowns.
**Rejected** — Leaving the winner under the decision and only restyling the radios: he missed it there twice. Drawing it with `choiceRow`: that row is small by design, and a press on its chosen button does nothing, where here it confirms what the cards filled in. Arrow keys moving between the two as they did between the radios: two buttons are one Tab apart, and it is more code than the dialog needs. Colouring the buttons by corner: the dialog is not told the corners, and a corner may be unrecorded. Refusing the dialog's other fields until a winner is picked: the judges' cards can pick the winner (D41), so they must stay open.
**Why** — Erez, 2026-11-26: it should be "more up-front", "more square and significant", like "the bold type in the scorecard". The winner is the one thing in the dialog that cannot be defaulted, so it goes first and largest. D103 said the winner "stays" radio buttons; that sentence is what this reverses, and the decision is superseded whole because a decision is not reversed in part.
Supersedes: D103

## What was done

2026-11-26. `front/bout-form.ts`: `fighterField` draws one box per side at all times; with a fighter chosen it holds their name (class `chosen`) and their record is under it, the matches list is drawn only while nobody is chosen, and the "change" button is gone. Going into a chosen box selects its text; `search` passes what is typed through `sideTyped` and lets go of the fighter unless the box still holds their name; `choose` empties the search text; Enter in a chosen box does nothing. On a finalised bout the box is read-only and `search` returns at once (D30). `front/entry.ts` gains `sideText`, `sideTyped` and `winnerChoices`. `front/decision-form.ts`: the winner fieldset is first, a `button.win` per choice with `aria-pressed`, a single-answer decision shown pressed as "Draw" or "No winner" (they showed as "draw" and "none"); a new `noWinner` state marks the fieldset when Finalise finds no winner, with the message "pick the winner" in place of "who won?", and is cleared by picking a winner, changing the decision or the cards filling it in. `front/style.css`: `input.chosen`, `.record.of-chosen`, `.winner-row`, `button.win` and the `missing` mark; the old chosen-line rules now name `div.chosen`, which the event form's venue still uses; the radio row's rule is removed. The chosen name is 1.2rem, not the old line's 1.5rem, so a name with a nickname fits the box. `docs/SPEC.md` says both. `tests/front/forms.test.ts`: what the box makes of typing, and the winner choices per decision.

`deno task test`: 280 passed; `deno task check` and format clean; `deno lint` reports two unused names in `.claude/hooks/check-unit.test.mjs`, there before this change and not touched. Claude looked at both dialogs once in the app's browser pane, standalone on a scratch database: the winner buttons, the red mark after Finalise with none picked, and a click or Shift+Tab into a chosen name selecting it so that typing replaced it. That is one Chromium; the two boxes left open are Erez's, on his own browser.

Reviewed by: a read-only Claude subagent (Explore), cold, on the staged diff, carrying out docs/reviewer.md. Four findings, written below as the review of 2026-11-26; it found acceptance boxes 1, 3, 4 and 5 to hold and box 2 not in every case.

## Review · 2026-11-26

By the cold reader named above. It also found that nothing else in `front/` depended on the rules and markup the diff removed or renamed.

### A name chosen with Enter is not selected, so the first key is added to the end of it

**Found** — `front/bout-form.ts`, `fighterField`: only the box's focus handler selects the name. Chosen with Enter, the box never loses focus, so nothing is selected and the next key is added after the name. A selection made in a focus handler can also be undone by the mouseup of the click that brought the focus (Safari).

**Done when**

- [x] A fighter chosen with Enter, the cursor still in the box, a letter typed → the name is replaced by that letter and the list searches for it
- [x] A fighter chosen by clicking a match, then a click into the box → the whole name is selected, and the first key replaces it
- [x] A chosen box entered by Tab or Shift+Tab → the whole name is selected
- [ ] A chosen box clicked into in Safari → the whole name is selected
- [x] A chosen box that already has focus, clicked again → the caret goes where clicked
- [x] A box with search text and nobody chosen, focused → the text is not selected and the caret goes where clicked, as before
- [x] A finalised bout's box, focused → nothing is selected and the box stays read-only

**Not asked** — An "edit" or "clear" button next to the name. A change to how `sideTyped` treats typing. A change to D38's rule that a name typed in full counts on Save.

### The selection is kept on the first click after the box was focused without a click

By the second cold reader, on the answer to the item above as first written: `#entered` was set by every focus of a chosen box and cleared only by a mouseup or a blur.

**Found** — `front/bout-form.ts`, `fighterField`: a chosen box focused by Tab, Shift+Tab or the dialog opening on it kept `#entered` set, so the next click in it had its mouseup prevented and left the whole name selected; only a second click placed the caret. The same after the name was typed over.

**Done when**

- [x] An Edit bout dialog on a draft opens with focus in fighter A's chosen box, then one click on a letter of the name → the caret goes where clicked and nothing is selected
- [x] A chosen box entered by Tab or Shift+Tab, then one click on a letter → the caret goes where clicked
- [x] A chosen box entered by Tab, a letter typed over the name, the search text selected with Shift+arrows, then one click inside that selection → the caret goes where clicked
- [x] A chosen box not focused, clicked into → the whole name is selected and the first key replaces it, as now
- [x] A chosen box that already has focus from a click, clicked again → the caret goes where clicked, as now
- [x] A fighter chosen with Enter, a letter typed → the name is replaced and the list searches for it, as now
- [x] A box with search text and nobody chosen, focused or clicked → nothing selected and the caret goes where clicked, as now
- [x] A finalised bout's box, focused or clicked → nothing selected and the box stays read-only, as now

**Not asked** — A change to `sideTyped`, to `choose`, or to D38's rule that a name typed in full counts on Save. An "edit" or "clear" button.

### A chosen box that keeps the focus while the window is away is not selected by the click that brings the window back

By the third cold reader, on the answer to the item above. Left open in this commit: it costs one more click or a select-all when coming back from another window, and the fix would track the window's focus for that alone; Erez's to ask for.

**Found** — `front/bout-form.ts`, `fighterField`, the mousedown handler: with the window away the box is still `document.activeElement`, so the click that brings the window back is not taken as one that brings the focus; the name is selected by the focus event and the same click's mouseup may put the caret down over it.

**Done when**

- [ ] A chosen box focused, the user switches to another window or tab, then clicks back into that box → the whole name is selected and the first key replaces it
- [x] The same, but coming back by clicking elsewhere in the page and then into the box → the whole name is selected
- [x] A chosen box focused by a click and clicked again, the window never left → the caret goes where clicked, as now
- [x] A chosen box entered by Tab or Shift+Tab, or focused when the dialog opens, then one click → the caret goes where clicked, as now
- [x] A box with search text and nobody chosen, or a finalised bout's box → nothing selected, as now

**Not asked** — A change to `sideTyped`, to `choose`, or to D38's rule. An "edit" or "clear" button. Tracking window focus anywhere outside `fighterField`.

### The red mark and the "pick the winner" message are cleared by different things

**Found** — `front/decision-form.ts`: changing the decision and the cards filling in cleared the mark but left the message; picking a winner after that left the message too.

**Done when**

- [x] Finalise with no winner → the buttons are outlined red, the legend is red and "pick the winner" shows
- [x] Then a winner picked → neither the mark nor the message shows
- [x] Then the decision changed to another with two winners, none picked → the mark and the message both still show
- [x] Then the decision changed to D, MT or NC → neither the mark nor the message shows
- [x] Then the cards fill in a winner → neither the mark nor the message shows
- [x] Any other error ("the round is a whole number", a judge's card) → shown as before, and not cleared by picking a winner

**Not asked** — Blocking the other fields until a winner is picked. Any new validation.

### Keyboard behaviour of the winner changed and is not in the record

**Found** — `front/decision-form.ts`: the radios took the arrow keys and Enter on one finalised; the buttons take Tab, Enter or Space press one without finalising, a lone answer is a Tab stop, and the dialog opens on a winner button, not the dropdown. Neither the record nor the decision said so.

**Done when**

- [x] Enter or Space on a winner button → that winner is pressed and the dialog stays open
- [x] Enter in the round, time or a judge box → Finalise, as before
- [x] Arrow keys on a winner button → nothing, as the decision now states
- [x] A single-answer decision → its one button is in the Tab order, as the decision now states
- [x] The dialog opened → focus is on the first winner button, as the decision now states

**Not asked** — Rebuilding the winner on `choiceRow`, or a roving-tabindex widget, unless chosen in a decision.

### D103 is partly reversed without a `Supersedes:` line

**Found** — this file's second decision reopened one sentence of D103 in words only, so the compiled decisions kept D103 saying the winner stays radio buttons; and it said the winner "follows its rule" though the buttons are not `choiceRow`.

**Done when**

- [x] The compiled `docs/DECISIONS.md` read top to bottom → no live decision says the winner is radio buttons
- [x] D103's choices for the corner, the title holder and the weight unit → still stated as live
- [x] The new decision → describes the winner buttons as they are (own markup, not `choiceRow`)

**Not asked** — Changing the code to `choiceRow`. Editing D103's committed text.

## What was done

2026-11-26, answering the review above, in the same commit. `front/bout-form.ts`: `choose` selects the name when the cursor is in that side's box (the box carries `data-side`), so a fighter chosen with Enter is replaced by the next key; a mouse press on a chosen box that does not have the focus is noted (`#entered`, set on mousedown and cleared on mouseup and blur) and the mouseup of that same click is prevented, so the click that brings the focus does not put the caret down over the selection; a click in a box that already has the focus, from an earlier click, from Tab or from the dialog opening on it, places the caret. A box with search text, and a finalised bout's box, select nothing, as before. `front/decision-form.ts`: `answered()` clears the mark and its message together and leaves any other error; it is used by a winner button, by the cards filling a winner in, and by a change of decision only when the new decision has its winner. The second decision above was rewritten before it was ever committed: it states the keyboard behaviour, describes the buttons as the dialog's own, restates D103's row-of-buttons rule and supersedes D103.

`deno task test`: 280 passed; `deno task check` and format clean. Not seen in a browser after these fixes, and never in Safari: the Safari line above is left open, and is covered by Erez's first open acceptance box if Safari is where he scores.

Reviewed by: three read-only Claude subagents (Explore), each cold, on the staged diff, carrying out docs/reviewer.md. The first is named on the record above. The second read the answer to its round and found the click swallowed after Tab, which was fixed and is the review's second item. The third read that fix, found every ticked line to hold and the record to describe the diff, and found the window-away case, which is the review's third item and is left open with the Safari line.
