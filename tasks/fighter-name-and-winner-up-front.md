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
- [x] Erez: in the browser, in a new bout and in a bout with rounds scored, he picks a fighter, goes back into the name and types another without backspacing through the first
- [x] Erez: in the browser, the decision dialog's winner is where and how he wants it, and Finalise without one shows him what is missing

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

### 2026-11-26 · The bout dialog's matches drop over the form; Escape or leaving the box closes them

**Decision** — In the bout dialog the matches for a side are drawn over what is below the box (`ul.found.drop`, as the fighter form's are, D44), and only while that side's list is open: typing, Down, or going back into a box that holds text opens it; Escape, leaving the box, or choosing closes it and keeps the text. Escape with no list open is the dialog's Cancel, as before. With the list closed, Enter judges the text as Save does (D38) and never takes a match that is not showing. "+ Fighter" is the list's last row and also a line of its own under the box, so it is there either way.
**Rejected** — A close button on the list: Escape and a click elsewhere are how every other list closes, and the list's corner is where the last match's record is. Leaving the list in the flow with fewer matches: five still push the form.
**Why** — Erez, 2026-11-26: "the dialog breaks when the dropdown is large", and "how do I close the dropdown? there's no X or whatever, I have to backspace".

### 2026-11-26 · A chosen fighter stays in the search box, typed over to change; "Edit" beside the record opens their own form

**Decision** — D152 as it stood, restated: each side of the bout dialog is one box at all times; with a fighter chosen it holds their name in bold with their record under it; going into the box, or choosing with the cursor in it, selects the name; typing that leaves anything but that name un-chooses and searches (`sideTyped`); a name typed back in full is the fighter again on Save (D38); a finalised bout's box is read-only (D30). Added: "Edit" beside the record opens the fighter form on that fighter (`new FighterForm(chosen, …)`, the form the fighters page opens), over the bout dialog; what it saves is shown at once, the fighter still chosen. It is there on a finalised bout too, since it changes the fighter and not who fought.
**Rejected** — What D152 rejected and still does: a "change" button, and choosing as you type. Leaving the fighter's details to the fighters page, which D152 chose: Erez asked for the opposite once he had used it. Editing the details inline in the bout dialog: a second copy of the fighter form.
**Why** — Erez, 2026-11-26: the record "is incorrect, I want to change, or maybe her colors or weight is different as it 99% always is. no where do open the dialog". The weight and colours are tonight's, so the moment they are known is while the bout is being made.
Supersedes: D152

### 2026-11-26 · "Edit bout" on the scorecard; the card as typed stands unless the rounds change

**Decision** — The scorecard's bar has "Edit bout", final or not, opening the same bout dialog the event page opens. Before it opens, a card with unsaved points is saved as Save progress would. When the dialog closes, whatever its answer, the bout and the reference lists are read again; the points in the boxes are kept as typed when the scheduled rounds are what they were (`typedCardStands` in `front/scorecard.ts`), and read again from what is stored when they changed, since the card then has other rows. The API is unchanged: a draft's fighters may change and its rounds stand, the changed side's snapshot being retaken at the next save (D32); a finalised bout's may not (D30).
**Rejected** — Reading the whole card again every time: a round with one box typed, which the rules will not save yet, would be lost for having fixed a name. Refusing to open until every box can be saved: the wrong fighter is noticed in the middle of a round. A link to the event page's dialog: that is the trip he asked not to make.
**Why** — Erez, 2026-11-26: "that's not Takoma Inoue I want but his Brother, but I can't edit the name other than closing the fight and going back to the event page".

### 2026-11-26 · The chosen name's selection is not checked in Safari

**Decision** — The review line "A chosen box clicked into in Safari → the whole name is selected" is dropped unchecked and stays unticked. The mouseup guard written for Safari stays in the code; nobody will run it there.
**Rejected** — Trying it in Safari before calling the task done.
**Why** — Erez, 2026-11-26: "Drop the Safari, not gonna bother with it for something that is a personal project."
Not in scope: checking the app in Safari

### 2026-11-26 · The click that comes back from another window is told by the box's own blur and focus

**Decision** — A box that is still the document's focused element at its own blur was left with the window, not for another control (`#away`). The focus event that follows on that box is the return, and its time is kept (`#back`). A mouse press on the box is taken as the one bringing the focus, so its mouseup does not put the caret down over the selected name, when the box did not have the focus, or the return was less than 250 ms before the press (`pressEnters` in `front/entry.ts`), or the return's focus event has not arrived yet. All of it is inside `fighterField`. A return by the keyboard followed by a later click places the caret, as any click in a focused box does.
**Rejected** — Listening to the window's own blur and focus: a listener outside the dialog to add and remove, for what the box's events already say. Selecting the name on every click in a chosen box: there would be no way to put the caret in the name to mend a letter. `document.hasFocus()` at the press: the window already has the focus again by then.
**Why** — Erez, 2026-11-26, having tried the review's open line: "I left the mouse in the middle of the name, went out and back, clicked and it just placed the caret at the start so anything I typed went in front of the name, so replacing joe with james became 'jajoe'". The 250 ms is the span of one click: the return and the press are the same act of the hand.

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

## Review · 2026-11-26 · Erez, in the browser

Erez, the same day, with three screenshots (the list open under "jes", Jessica Camara chosen, and the scorecard of Takuma Inoue v Kazuto Ioka): "Winner redesign is indeed a winner, as to the second thing, let me explain. I open the dialog and type, you can see that the dialog breaks when the dropdown is large (unlike how a dropdown shouldnt be part of the actual rendered parts) But wait, none of these options is right, how do I close the dropdown? there's no X or whatever, I have to backspace. Next, I pick Jessica Camara, but her record is incorrect, I want to change, or maybe her colors or weight is different as it 99% always is. no where do open the dialog. What I want here is basically the same ability as I have in clicking on the URL and picking a new fighter or editing, just with the name I already choosen. So I settle on the fighters and start the bout, but wait, that's not Takoma Inoue I want but his Brother, but I can't edit the name other than closing the fight and going back to the event page." The winner's acceptance box is ticked on his word. Written into the form by Claude.

### The list of matches pushes the bout dialog apart, and cannot be closed

**Found** — `front/bout-form.ts`, `fighterField`: the matches are drawn in the form's flow, so eight of them push the corner, the weight and the rest down; and the list is there for as long as the box holds text, so the only way to be rid of it is to delete the text.

**Done when**

- [x] A name typed with eight matches → the list lies over the fields below it, and nothing in the form moves
- [x] The list open, Escape → the list closes, the text stays, the dialog stays open
- [x] The list open, a click anywhere outside it and its box, or Tab → the list closes, the text stays
- [x] The list closed with text in the box, a letter typed or Down pressed, or the box clicked back into → the list opens again
- [x] The list closed, Escape → the dialog's own Cancel, asking first when something was typed, as before
- [x] A match clicked, or Enter on the highlighted one → that fighter is chosen, as before
- [x] The list closed with a part of a name in the box, Enter → no fighter is chosen unseen; it says to pick from the list, or opens the new fighter form when nobody has the name, as Save does (D38)
- [x] "+ Fighter" → there with the list open and with it closed, opening the fighter form with what was typed, as before

**Not asked** — A change to which fighters a name finds, or their order. A close button drawn on the list.

### A chosen fighter's details cannot be opened from the bout dialog

**Found** — `front/bout-form.ts`: once a fighter is chosen there is their name and record and nothing that opens their form, so a wrong record, tonight's weight or colours wait for the fighters page.

**Done when**

- [x] A fighter chosen, "Edit" beside their record → the fighter dialog opens over the bout dialog with their details, as from the fighters page
- [x] Saved there → the bout dialog shows the name and record as saved, the fighter still chosen, the rest of the bout dialog as it was
- [x] Cancelled there → nothing changes
- [x] Renamed there to the other side's fighter's name → refused, as from the fighters page
- [x] A finalised bout → "Edit" is there too: it changes the fighter, not who fought

**Not asked** — A change to the fighter form itself. A change to what a finalised bout keeps of the record on the night.

### The bout cannot be edited from its scorecard

**Found** — `front/bout-page.ts`: the scorecard has no way to the bout dialog, so the wrong fighter found while scoring means leaving for the event page.

**Done when**

- [x] The scorecard of a bout not finalised, "Edit bout" → the bout dialog opens over the card, with the bout as stored
- [x] A fighter changed there and saved → the marquee and the column heads show the new fighter, and the rounds scored so far stand
- [x] Points typed and not yet saved, then "Edit bout" → they are saved first as Save progress would, and are in the boxes afterwards
- [x] Points the rules will not save yet (one box of a round), "Edit bout", the rounds left as scheduled → they are still in the boxes afterwards
- [x] The scheduled rounds changed there → the card is read again from what is stored, with that many rows
- [x] Cancelled → the card is as it was
- [x] A finalised bout, "Edit bout" → the dialog opens with the fighters read-only (D30), and the corner, weight, rounds and titles can change
- [x] The event page's Edit → as before

**Not asked** — Changing a finalised bout's fighters. An endpoint or a schema change.

## What was done

2026-11-26, answering Erez's round above. Every line of it is ticked as read in the code; the ones Claude also saw in the browser pane are named below, and seeing them is still Erez's.

`front/bout-form.ts`: a new `listOpen` state names the side whose matches show (`listShown` in `front/entry.ts`). `fighterField` wraps the label and the list in `.combo` and draws the list as `ul.found.drop` over the form, only while open; typing, Down, a press or a focus in a box that holds text open it; Escape (stopped there, so the dialog does not take it), leaving the box and choosing close it; a press inside the list is kept from taking the focus, so a click on a match is not lost to the list closing. `searchKey` is given only the matches showing, so Enter with the list closed judges the text as Save does. "+ Fighter" is the list's last row and a line of its own under the box. Under a chosen name are the record and "Edit", which calls the new `editFighter`: the fighter form on that fighter, its answer put into the dialog's list and the side. `front/bout-page.ts`: `editBout` and an "Edit bout" button in the bar, draft and final: it saves a dirty card in turn, waits for the saves, opens `BoutForm` on the stored bout, then reads the bout and the lists again and keeps the entries and deductions as typed when `typedCardStands` (`front/scorecard.ts`), else takes them from the stored card. `front/style.css`: `.combo`, `.of-chosen`, `.add-line`, a white ground for the dropped list in a dialog, and the Fighter label's small capitals reached inside `.combo`. `docs/SPEC.md` says each. No server change.

Tests: `listShown` and `typedCardStands` stated in `tests/front/`; `tests/api/card.test.ts` holds that a draft's fighter replaced by PATCH leaves the rounds scored. `deno task test`: 283 passed; `deno task check` and format clean. In the browser pane, standalone on a scratch database, one Chromium, Claude saw: eight matches lying over the form; Escape and a click elsewhere closing them with the text kept; Down opening them; from a scorecard with round 1 scored and one box of round 2 typed, "Edit bout" saving round 1, the fighter changed by typing over the selected name, "Edit" opening the fighter form and its saved record shown in the bout dialog, and the scorecard afterwards with the new fighter, round 1 and the lone box of round 2. Not seen: a finalised bout, a change of rounds, Cancel, Safari.

Reviewed by: a read-only Claude subagent (Explore), cold, on the staged diff, carrying out docs/reviewer.md. It found every line of the three items to hold against the code and the record to describe the diff, with one finding, below. It also noted that when the card cannot be saved yet the bar keeps its "Not saved" message after the dialog closes, and that "Edit" is now a Tab stop between the two boxes.

## Review · 2026-11-26 · the cold reader, on the answer to Erez's round

### Tab out of a box with its matches open loses the focus

**Found** — `front/bout-form.ts`, `fighterField`: the dropped list's rows came after the box in the Tab order, so Tab went to the first match, and the box's blur removed the list and that row with it; the focus was left on the page.

**Done when**

- [x] Fighter A's box with its matches open, Tab → the list closes, the text stays, and the focus is on the next control after the box ("+ Fighter" under it, then Fighter B's box), never on the page
- [x] The same in Fighter B's box, Tab → the list closes, the text stays, and the focus moves on to the corner choice
- [x] A box with its matches open, Shift+Tab → the list closes, the text stays, and the focus is on the control before the box
- [x] A box with its matches closed, or holding a chosen fighter, Tab → the focus moves to the next control, as now ("+ Fighter", or "Edit" beside the record)
- [x] Matches open, a match clicked, Enter on the highlighted one, Up and Down, Escape → as now
- [x] The fighter form's name matches (D44), Tab and Escape → as now

**Not asked** — Tab stepping through the matches one by one. Any change to which fighters a name finds, to Escape, to the arrows or to Enter. A change to `front/fighter-form.ts`.

## What was done

2026-11-26, answering the item above in the same commit. `front/bout-form.ts`: the rows of the dropped list, the matches and its "+ Fighter", carry `tabindex="-1"`, so Tab from the box goes to the "+ Fighter" line under it, which is drawn whether the list is open or not, and the list's rows are reached by the mouse and the arrows as before. `deno task test`: 283 passed; `deno task check` and format clean. This one attribute was added after the reader's read and has not been read cold or seen in a browser; the boxes above are ticked from the code.

Reviewed by: the same reader named above read everything in this commit but this last fix, which answers its own finding.

## What was done

2026-11-26, answering the open line of the review item "A chosen box that keeps the focus while the window is away is not selected by the click that brings the window back", which Erez tried and found to fail ("jajoe"). `front/bout-form.ts`, `fighterField`: the box's blur notes a box left with the window (`#away`), its focus notes the return (`#back`) and selects the name as before, and the mousedown takes the press as entering by `pressEnters` (`front/entry.ts`, with `SAME_CLICK_MS`) or while `#away` is still set, so that click's mouseup is prevented and the selection stands. Nothing outside `fighterField` listens to the window. `docs/SPEC.md` says the name is selected by that click too; `tests/front/forms.test.ts` states `pressEnters`. `deno task test`: 284 passed; `deno task check` and format clean. Leaving the window cannot be done from the browser pane, so this was not seen running by Claude: the review line stays unticked until Erez has tried it.

Reviewed by: a read-only Claude subagent (Explore), cold, on the staged diff, carrying out docs/reviewer.md. It found the record to describe the diff and the item's other lines to hold, and two findings, below, on the fix as it then stood.

## Review · 2026-11-26 · the cold reader, on the click that returns to the window

### The return click's own press can undo the selection when the focus event comes first

**Found** — `front/bout-form.ts`, `fighterField`: with the focus event before the mousedown, the name was selected and then the press's own default put the caret down and collapsed it; preventing the mouseup could not bring it back.

**Done when**

- [x] Chosen box focused, window left, back by clicking in the middle of the name, focus event before the mousedown → the whole name is selected and the first key replaces it
- [x] The same, mousedown before the focus event → the whole name is selected and the first key replaces it
- [x] The same click held and dragged across the name → no partial selection replaces the whole-name selection; the whole name stays selected
- [x] Back by keyboard, then a click 250 ms or more later → the caret goes where clicked
- [x] A click in a box focused within the page, by click or Tab → the caret goes where clicked, as now
- [x] A box with search text, or a finalised bout's box → nothing selected, as now

**Not asked** — Listening to the window's focus or blur. Selecting on every click. A change to `sideTyped`, `choose` or D38.

### "Or tab" in Done-when line 1 cannot hold as written

**Found** — the earlier item's first line promises the whole name selected on coming back from another browser tab and clicking the box; coming back to the tab is its own click, outside the page, so the click into the box is a later one and places the caret, as after a return by keyboard.

**Done when**

- [x] Chosen box focused, another browser tab shown, back by clicking this tab, then a click in the box → the name is selected on the return and the click places the caret, the same as a keyboard return
- [x] Chosen box focused, another application's window shown, back by one click straight into the box → the whole name is selected
- [x] Back by keyboard, then a later click → the caret goes where clicked

**Not asked** — Tracking tab visibility (`visibilitychange`) or window focus outside `fighterField`.

## What was done

2026-11-26, answering the two items above in the same commit. `front/bout-form.ts`, `fighterField`: a press taken as entering has its default prevented and the box is focused and its name selected there, in the mousedown, so the press neither puts a caret down nor starts a drag, whichever of the focus event and the press came first; the mouseup guard stays. The second item changes no code: coming back from another browser tab is as coming back by the keyboard, the name selected on the return and a later click placing the caret, and the earlier line's "or tab" is to be read so. `deno task test`: 284 passed; `deno task check` and format clean. In the browser pane, one Chromium, on a scratch database: a real click into a chosen name from elsewhere selected all of it, and a second click placed the caret; the window's leaving and return could only be imitated there, by sending the box its blur, focus and mousedown from a script, in both orders, which left the whole name selected and the press prevented, and a press 400 ms after the return not prevented. The real thing, leaving the window and clicking back, is Erez's to try. This fix was made after the reader's read and has not been read cold.

Reviewed by: the same reader named above read this commit but for this last fix, which answers its own findings.
