// `/bouts/:id`: the scorecard, the heart of the app (SPEC Front end). Two
// columns, A left and B right, each round points · deductions · total; the
// totals run in the browser through the rules (SPEC §2, §3). Focus moves
// across the card and down as rounds are typed (D39). The card is saved on
// demand and when the page is left, and a reload restores it. Deductions and
// "End bout" open dialogs (task 08). A finalised card is read-only (D35):
// its decision can be changed, or it can be reopened for scoring (D37).
import { api, type BoutView, type Event, references } from './api.ts';
import { inTurn, putCard, saves } from './card-saves.ts';
import { sideHead } from './side-head.ts';
import { Component, html, nothing } from './component.ts';
import { DeductionForm } from './deduction-form.ts';
import { DecisionForm } from './decision-form.ts';
import { Confirm } from './dialog.ts';
import { dateText, fighterName, resultLabel, resultText } from './format.ts';
import {
  type Deduction,
  draftToSave,
  entriesOf,
  type Entry,
  finalCard,
  isAssumed,
  lastTyped,
  nextBox,
  readPoints,
  reopenBody,
  runningTotals,
} from './scorecard.ts';
import { messageOf } from './router.ts';
import type { Side } from '../server/rules/decisions.ts';
import type { Result } from '../server/rules/scoring.ts';

type References = Awaited<ReturnType<typeof references>>;
type Spot = { round: number; side: Side };
type State = {
  bout: BoutView | null;
  event: Event | null;
  refs: References | null;
  entries: Entry[];
  deductions: Deduction[];
  focus: Spot | null;
  saving: boolean;
  message: string | null; // what the last save said
};

export class BoutPage extends Component<State> {
  // How many rounds the server holds as far as this page knows: the loaded
  // card's, then the last card sent's (D35). A save never cuts below it
  // unless the user cleared both boxes of the rounds at the end.
  #stored = 0;
  // A finalise or a reopen under way: the bout is about to change between
  // draft and final, so no leaving save may be sent across it (D37).
  #changing = false;
  #onPageHide = () => this.saveOnLeave(false);
  #onBeforeUnload = (event: BeforeUnloadEvent) => {
    // Typed points that leaving would lose: let the browser ask first.
    if (this.dirty() && !this.finalised && this.draft().unsaved.length > 0) {
      event.preventDefault();
    }
  };

  constructor(readonly id: number) {
    super({
      bout: null,
      event: null,
      refs: null,
      entries: [],
      deductions: [],
      focus: null,
      saving: false,
      message: null,
    });
  }

  override async mount(root: HTMLElement) {
    addEventListener('pagehide', this.#onPageHide);
    addEventListener('beforeunload', this.#onBeforeUnload);
    await super.mount(root);
  }

  override async load() {
    await saves;
    const [bout, refs] = await Promise.all([api<BoutView>(`/bouts/${this.id}`), references()]);
    const event = await api<Event>(`/events/${bout.event_id}`);
    this.#stored = bout.card.rounds.length;
    this.set({ bout, event, refs, entries: entriesOf(bout), deductions: bout.card.deductions });
  }

  // Leaving by a link inside the app: the router unmounts the page.
  override unmount() {
    removeEventListener('pagehide', this.#onPageHide);
    removeEventListener('beforeunload', this.#onBeforeUnload);
    this.saveOnLeave(true);
    super.unmount();
  }

  get finalised(): boolean {
    return this.state.bout?.is_draft === 0;
  }

  // Whether the boxes differ from the card last answered by the server.
  // Typing a value back to what it was is no change, so a look that
  // touched a box still saves nothing (§7's snapshot is not taken).
  dirty(): boolean {
    const { bout, entries, deductions } = this.state;
    if (!bout) return false;
    return JSON.stringify(entries) !== JSON.stringify(entriesOf(bout)) ||
      JSON.stringify(deductions) !== JSON.stringify(bout.card.deductions);
  }

  draft() {
    const { bout, entries, deductions } = this.state;
    return bout
      ? draftToSave(bout, entries, deductions, this.#stored)
      : { body: null, unsaved: [] };
  }

  unsavable(): boolean {
    return this.dirty() && !this.finalised && this.draft().body === null;
  }

  // The card is made when the save is sent, and the count of stored rounds
  // moves with it, so a save queued behind another sees what that one
  // stored, and a page back from the browser's cache knows what its
  // leaving save stored.
  #send(keepalive: boolean) {
    const { body, unsaved } = this.draft();
    // Checked when the save's turn comes, not when it was asked for: a
    // finalise queued ahead of it may have made the bout final meanwhile,
    // and a draft sent now would take the result off both records (D32).
    if (!body || this.finalised || this.#changing) return { sent: null, unsaved };
    const before = this.#stored;
    this.#stored = body.rounds.length;
    const sent = putCard(this.id, body, keepalive);
    // Refused or lost: the server holds what it held. Restored before the
    // next save's turn, which waits for this one to settle.
    sent.catch(() => (this.#stored = before));
    return { sent, unsaved };
  }

  // Save on demand, in turn with any other save.
  save() {
    if (!this.state.bout || this.finalised) return;
    this.set({ saving: true, message: null });
    return inTurn(async () => {
      const { sent, unsaved } = this.#send(false);
      if (!sent) {
        const message = unsaved.length > 0 ? `Not saved: ${unsaved.join('; ')}` : null;
        this.set({ saving: false, message });
        return;
      }
      try {
        const saved = await sent;
        this.set({
          bout: saved,
          saving: false,
          message: unsaved.length > 0 ? `Progress saved; ${unsaved.join('; ')}` : 'Progress saved',
        });
      } catch (err) {
        this.set({ saving: false, message: `Not saved: ${messageOf(err)}` });
      }
    });
  }

  // Leaving the page: a keepalive request, so it outlives the page. By a
  // link it waits its turn behind a save under way; when the page itself is
  // going (reload, closing the tab) there is no later turn, so it goes now.
  // Nothing is sent when the rules refuse the draft; the stored card stays.
  saveOnLeave(queued: boolean) {
    if (!this.dirty() || this.finalised || this.#changing) return;
    const send = async () => {
      await this.#send(true).sent;
    };
    if (queued) inTurn(send).catch(() => {});
    else send().catch(() => {});
  }

  // A key in a points box. The value is checked as typed; a complete entry
  // (any digit but 1, or 10) moves focus on (nextBox, D39), and Enter does
  // it for a lone 1 (D35).
  typed(event: InputEvent, round: number, side: Side) {
    const input = event.target as HTMLInputElement;
    const read = readPoints(input.value);
    const entry = this.state.entries[round - 1];
    if (!read.ok) {
      input.value = String((side === 'A' ? entry.a : entry.b) ?? '');
      return;
    }
    const entries = this.state.entries.slice();
    entries[round - 1] = side === 'A' ? { ...entry, a: read.points } : { ...entry, b: read.points };
    this.set({ entries, message: null });
    if (read.complete) this.focusNext(input, round, side);
  }

  // The deduction dialog for one side of one round; what it answers
  // replaces that spot's deductions, saved with the card like the points.
  async editDeductions(round: number, side: Side, name: string) {
    const here = (d: Deduction) => d.round_no === round && d.side === side;
    const list = await new DeductionForm(
      round,
      side,
      name,
      this.state.deductions.filter(here),
      this.finalised,
    ).open();
    if (!list) return;
    const deductions = [...this.state.deductions.filter((d) => !here(d)), ...list]
      .sort((x, y) => x.round_no - y.round_no || x.side.localeCompare(y.side));
    this.set({ deductions, message: null });
  }

  // "End bout", or "Change decision" on a finalised bout: the decision
  // dialog, which finalises through this.
  async decide(names: { A: string; B: string }) {
    const bout = this.state.bout!;
    const lastScored = lastTyped(this.state.entries, this.state.deductions);
    const saved = await new DecisionForm(
      names,
      bout.scheduled_rounds,
      lastScored,
      { result: bout.card.result, judges: bout.card.judges },
      this.finalised,
      (result, judges) => this.finalise(result, judges),
    ).open();
    if (saved) this.set({ message: 'Finalised' });
  }

  // The card the result implies (finalCard, by the rules), saved in turn
  // with any draft save. A refusal goes back to the dialog.
  finalise(result: Result, judges: BoutView['card']['judges']): Promise<BoutView> {
    return this.changing(async () => {
      const { body, problems } = finalCard(
        this.state.bout!,
        this.state.entries,
        this.state.deductions,
        result,
        judges,
      );
      if (!body) throw new Error(problems.join('; '));
      const saved = await putCard(this.id, body);
      this.loaded(saved);
      return saved;
    });
  }

  // A finalise or reopen, in turn with the draft saves, with leaving saves
  // held off until it has landed.
  // Held from the moment it is asked for, so a leaving save made while it
  // waits its turn is not sent either.
  changing<T>(work: () => Promise<T>): Promise<T> {
    this.#changing = true;
    return inTurn(work).finally(() => (this.#changing = false));
  }

  // Back to draft (D32): the result comes off both records until the bout
  // is finalised again, and the card can be edited.
  async reopen() {
    await new Confirm(
      'Reopen scoring?',
      "Reopening takes this result off both fighters' records until the bout is finalised again. The card can then be corrected, and End bout finalises it again.",
      'Reopen',
      () =>
        this.changing(async () => {
          const { card } = this.state.bout!;
          const saved = await putCard(this.id, reopenBody(card));
          this.loaded(saved);
          return saved;
        }),
    ).open();
  }

  // The server's answer becomes the page: the boxes, the deductions and
  // what it holds.
  loaded(bout: BoutView) {
    this.#stored = bout.card.rounds.length;
    this.set({ bout, entries: entriesOf(bout), deductions: bout.card.deductions, message: null });
  }

  keydown(event: KeyboardEvent, round: number, side: Side) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.focusNext(event.target as HTMLInputElement, round, side);
  }

  // Across to the other fighter, or on to the next round (nextBox, D39),
  // judged on the boxes as they stand after this entry.
  focusNext(input: HTMLInputElement, round: number, side: Side) {
    const to = nextBox(this.state.entries, round, side);
    const next = to && input.closest('table')?.querySelector<HTMLInputElement>(
      `input[data-side="${to.side}"][data-round="${to.round}"]`,
    );
    if (next) {
      next.focus();
      next.select();
    }
  }

  names(): { A: string; B: string } {
    const { bout, refs } = this.state;
    const name = (id: number) => {
      const f = refs?.fighters.get(id);
      return f ? fighterName(f) : `fighter ${id}`;
    };
    return { A: name(bout!.fighter_a_id), B: name(bout!.fighter_b_id) };
  }

  view() {
    const { bout, event, refs } = this.state;
    if (!bout || !event || !refs) return html`<p class="muted">Loading…</p>`;
    const { A: nameA, B: nameB } = this.names();
    // Each side's points column says whose it is (Erez, after his first fight).
    const surname = (id: number) => refs.fighters.get(id)?.last_name ?? '';
    const pointsA = surname(bout.fighter_a_id) || 'A';
    const pointsB = surname(bout.fighter_b_id) || 'B';
    const cornerB = bout.corner_a === 'red' ? 'blue' : bout.corner_a === 'blue' ? 'red' : null;
    const totals = runningTotals(this.state.entries, this.state.deductions);
    const weightClass = refs.classes.get(bout.weight_class_id)?.name ?? '';
    return html`
      <p class="crumb">
        <a href="/events/${event.id}">${event.location}</a>
        <span class="muted">· ${dateText(event.date)}</span>
      </p>
      <h1>${nameA} <span class="muted">v</span> ${nameB}</h1>
      <p class="subtitle">${weightClass} · ${bout.scheduled_rounds} rounds${this.finalised
        ? html`
          · <span title=${resultLabel(bout)}>${resultText(bout, nameA, nameB)}</span>
        `
        : nothing}</p>
      <table class="scorecard">
        <colgroup>
          <col class="round-no">
          <col>
          <col>
          <col>
          <col class="gap">
          <col>
          <col>
          <col>
        </colgroup>
        <thead>
          <tr class="sides">
            <th></th>
            ${sideHead(bout, refs.titles, 'A', nameA, bout.corner_a)}
            <th></th>
            ${sideHead(bout, refs.titles, 'B', nameB, cornerB)}
          </tr>
          <tr class="columns">
            <th>Rd</th>
            <th class="whose" title="${nameA}, points">${pointsA}</th>
            <th>Ded</th>
            <th>Total</th>
            <th></th>
            <th class="whose" title="${nameB}, points">${pointsB}</th>
            <th>Ded</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${this.state.entries.map((entry, i) => this.roundRow(i + 1, entry, totals.rounds[i]))}
        </tbody>
        <tfoot>
          <tr>
            <th></th>
            <td colspan="2"></td>
            <td class="total">${totals.a}</td>
            <td></td>
            <td colspan="2"></td>
            <td class="total">${totals.b}</td>
          </tr>
        </tfoot>
      </table>
      ${this.finalised
        ? html`
          <p class="actions">
            <button type="button" @click=${() => this.decide({ A: nameA, B: nameB })}>
              Change decision
            </button>
            <button type="button" class="quiet" @click=${() => this.reopen()}>
              Reopen scoring
            </button>
          </p>
        `
        : html`
          <p class="actions">
            <button type="button" ?disabled=${this.state.saving} @click=${() => this.save()}>
              ${this.state.saving ? 'Saving…' : 'Save progress'}
            </button>
            <button type="button" @click=${() => this.decide({ A: nameA, B: nameB })}>
              End bout
            </button>
            <span class=${this.unsavable() ? 'error' : 'muted'}>${this.status()}</span>
          </p>
        `}
    `;
  }

  // The line beside the button: what the last save said until the next
  // keystroke, then whether the typed card can be saved, and if not why, so
  // it is seen before the page is left (D35).
  status(): string {
    const { message } = this.state;
    if (message) return message;
    if (!this.dirty()) return '';
    const { body, unsaved } = this.draft();
    if (!body) return `Cannot be saved: ${unsaved.join('; ')}`;
    return unsaved.length > 0 ? `Unsaved changes; ${unsaved.join('; ')}` : 'Unsaved changes';
  }

  roundRow(round: number, entry: Entry, total: { a: number | null; b: number | null }) {
    // The round being scored, and the round focus goes to next when that is
    // another round (D35's marks, following D39's order).
    const focus = this.state.focus;
    const next = focus && nextBox(this.state.entries, focus.round, focus.side);
    const mark = focus?.round === round
      ? 'scoring'
      : next && next.round !== focus?.round && next.round === round
      ? 'next'
      : '';
    return html`
      <tr class=${mark}>
        <th class="round-no">${round}</th>
        ${this.sideCells(round, 'A', entry.a, total.a)}
        <td></td>
        ${this.sideCells(round, 'B', entry.b, total.b)}
      </tr>
    `;
  }

  sideCells(round: number, side: Side, points: number | null, total: number | null) {
    const deductions = this.state.deductions.filter((d) => d.round_no === round && d.side === side);
    const deducted = deductions.reduce((sum, d) => sum + d.points, 0);
    const assumed = deductions.some(isAssumed);
    return html`
      <td>
        <input
          class="points"
          inputmode="numeric"
          maxlength="2"
          autocomplete="off"
          aria-label="Round ${round}, side ${side}, points"
          data-round=${round}
          data-side=${side}
          .value=${points === null ? '' : String(points)}
          ?readonly=${this.finalised}
          @input=${(e: InputEvent) => this.typed(e, round, side)}
          @keydown=${(e: KeyboardEvent) => this.keydown(e, round, side)}
          @focus=${(e: FocusEvent) => {
            (e.target as HTMLInputElement).select();
            this.set({ focus: { round, side } });
          }}
          @click=${(e: MouseEvent) => (e.target as HTMLInputElement).select()}
          @blur=${() => this.set({ focus: null })}
        >
      </td>
      <td>
        <button
          type="button"
          class="deduction ${assumed ? 'assumed' : ''}"
          title=${assumed ? 'reason assumed on import' : 'deductions'}
          @click=${() => this.editDeductions(round, side, this.names()[side])}
        >${deducted > 0 ? `−${deducted}` : '·'}${assumed ? html`<sup>?</sup>` : nothing}</button>
      </td>
      <td class="total">${total ?? ''}</td>
    `;
  }
}
