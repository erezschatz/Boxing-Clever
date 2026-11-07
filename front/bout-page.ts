// `/bouts/:id`: the scorecard, the heart of the app (SPEC Front end). Two
// columns, A left and B right, each round points · deductions · total; the
// totals run in the browser through the rules (SPEC §2, §3). Focus moves down
// a side as rounds are typed, as in v1 (D35). A draft is saved on demand and
// when the page is left, and a reload restores it. The deduction form and
// "End bout" are task 08; a finalised card is read-only here (D35).
import { api, type BoutView, type Event, references } from './api.ts';
import { Component, createRef, html, nothing, ref } from './component.ts';
import {
  dateText,
  fighterName,
  rankText,
  recordOnTheNight,
  resultLabel,
  resultText,
  titleText,
} from './format.ts';
import {
  beltsOf,
  type Deduction,
  draftToSave,
  entriesOf,
  type Entry,
  isAssumed,
  rankOf,
  readPoints,
  runningTotals,
} from './scorecard.ts';
import { messageOf } from './router.ts';
import type { Side } from '../server/rules/decisions.ts';

type References = Awaited<ReturnType<typeof references>>;
type Spot = { round: number; side: Side };
type State = {
  bout: BoutView | null;
  event: Event | null;
  refs: References | null;
  entries: Entry[];
  deductions: Deduction[];
  focus: Spot | null;
  dialog: Spot | null;
  saving: boolean;
  message: string | null; // what the last save said
};

// Saves to a card go one after another, and a page loads its card only
// after the saves before it are done: leaving by a link and coming straight
// back must not read the card older than the save made on the way out, and
// a later save must not be overtaken by an earlier one (D35).
let saves: Promise<unknown> = Promise.resolve();
function inTurn<T>(work: () => Promise<T>): Promise<T> {
  const turn = saves.then(work);
  saves = turn.catch(() => {});
  return turn;
}

function putCard(id: number, body: unknown, keepalive = false) {
  return api<BoutView>(`/bouts/${id}/card`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    keepalive,
  });
}

export class BoutPage extends Component<State> {
  #dialog = createRef<HTMLDialogElement>();
  // How many rounds the server holds as far as this page knows: the loaded
  // card's, then the last card sent's (D35). A save never cuts below it
  // unless the user cleared both boxes of the rounds at the end.
  #stored = 0;
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
      dialog: null,
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
    if (!body) return { sent: null, unsaved };
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
        this.set({ saving: false, message: `Not saved: ${unsaved.join('; ')}` });
        return;
      }
      try {
        const saved = await sent;
        this.set({
          bout: saved,
          saving: false,
          message: unsaved.length > 0 ? `Saved; ${unsaved.join('; ')}` : 'Draft saved',
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
    if (!this.dirty() || this.finalised) return;
    const send = async () => {
      await this.#send(true).sent;
    };
    if (queued) inTurn(send).catch(() => {});
    else send().catch(() => {});
  }

  // A key in a points box. The value is checked as typed; a complete entry
  // (any digit but 1, or 10) moves focus to the same side's next round, and
  // Enter does it for a lone 1 (D35).
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

  // The render after set() is synchronous, so the dialog holds this spot's
  // deductions by the time it opens.
  openDialog(spot: Spot) {
    this.set({ dialog: spot });
    this.#dialog.value?.showModal();
  }

  keydown(event: KeyboardEvent, round: number, side: Side) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    this.focusNext(event.target as HTMLInputElement, round, side);
  }

  focusNext(input: HTMLInputElement, round: number, side: Side) {
    const next = input.closest('table')?.querySelector<HTMLInputElement>(
      `input[data-side="${side}"][data-round="${round + 1}"]`,
    );
    if (next) {
      next.focus();
      next.select();
    }
  }

  view() {
    const { bout, event, refs } = this.state;
    if (!bout || !event || !refs) return html`<p class="muted">Loading…</p>`;
    const a = refs.fighters.get(bout.fighter_a_id);
    const b = refs.fighters.get(bout.fighter_b_id);
    const nameA = a ? fighterName(a) : `fighter ${bout.fighter_a_id}`;
    const nameB = b ? fighterName(b) : `fighter ${bout.fighter_b_id}`;
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
            ${this.header(bout, refs, 'A', nameA, bout.corner_a)}
            <th></th>
            ${this.header(bout, refs, 'B', nameB, cornerB)}
          </tr>
          <tr class="columns">
            <th>Rd</th>
            <th>Pts</th>
            <th>Ded</th>
            <th>Total</th>
            <th></th>
            <th>Pts</th>
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
        ? html`<p class="muted">
          This bout is finalised; its card is read-only until the decision dialog (task 08).
        </p>`
        : html`
          <p class="actions">
            <button type="button" ?disabled=${this.state.saving} @click=${() => this.save()}>
              ${this.state.saving ? 'Saving…' : 'Save draft'}
            </button>
            <span class=${this.unsavable() ? 'error' : 'muted'}>${this.status()}</span>
          </p>
        `}
      ${this.dialog(nameA, nameB)}
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

  // A side's column header (SPEC Front end): corner colour, name with
  // nickname, (c) and the belts brought in, the record on the night and the
  // TBRB rank once the snapshot is taken.
  header(bout: BoutView, refs: References, side: Side, name: string, corner: string | null) {
    const belts = beltsOf(bout, side).map((id) => {
      const title = refs.titles.get(id);
      return title ? titleText(title) : `title ${id}`;
    });
    const record = recordOnTheNight(bout, side === 'A' ? 'a' : 'b');
    const rank = rankOf(bout, side);
    return html`
      <th colspan="3" class="side-head ${corner ?? ''}">
        <div class="name">
          ${corner
            ? html`<span class="corner ${corner}" title="${corner} corner"></span>`
            : nothing}
          ${name}${belts.length > 0
            ? html`
              <span class="champion" title="champion">(c)</span>
            `
            : nothing}
        </div>
        ${belts.length > 0 ? html`<div class="belts">${belts.join(' · ')}</div>` : nothing}
        <div class="meta">
          ${record ? html`<span class="record">${record}</span>` : nothing}
          ${rank !== null ? html`<span class="rank">${rankText(rank)}</span>` : nothing}
        </div>
      </th>
    `;
  }

  roundRow(round: number, entry: Entry, total: { a: number | null; b: number | null }) {
    const focus = this.state.focus;
    const mark = focus?.round === round ? 'scoring' : focus?.round === round - 1 ? 'next' : '';
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
          @click=${() => this.openDialog({ round, side })}
        >${deducted > 0 ? `−${deducted}` : '·'}${assumed ? html`<sup>?</sup>` : nothing}</button>
      </td>
      <td class="total">${total ?? ''}</td>
    `;
  }

  // The deduction dialog (SPEC Front end: native <dialog>). Here it lists
  // what the round holds; adding and editing are task 08's form.
  // The <dialog> is always in the page, so it can be opened from the click
  // that asks for it (showModal needs it in the document).
  dialog(nameA: string, nameB: string) {
    const spot = this.state.dialog;
    const list = spot
      ? this.state.deductions.filter((d) => d.round_no === spot.round && d.side === spot.side)
      : [];
    return html`
      <dialog class="deductions" ${ref(this.#dialog)} @close=${() => this.set({ dialog: null })}>
        <h2>${spot ? `Round ${spot.round} · ${spot.side === 'A' ? nameA : nameB}` : ''}</h2>
        ${list.length === 0 ? html`<p class="muted">No deductions.</p>` : html`
          <ul>
            ${list.map((d) =>
              html`<li>
                −${d.points} ${d.reason}${
                d.note
                  ? html`
                    <span class="muted">(${d.note})</span>
                  `
                  : nothing
              }
                ${
                isAssumed(d)
                  ? html`<sup class="assumed" title="reason assumed on import">?</sup>`
                  : nothing
              }
              </li>`
            )}
          </ul>
        `}
        <p class="muted">Adding and changing deductions comes with task 08.</p>
        <form method="dialog"><button>Close</button></form>
      </dialog>
    `;
  }
}
