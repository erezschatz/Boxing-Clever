// `/events/:id`: the card. Every bout in card order with who fights whom,
// the corners, the class, the rounds, the belts on the line and who brought
// each, and the result (SPEC Front end; v1's Event page columns). The event
// and its bouts are added, edited and deleted here in dialogs (task 08); the
// whole row opens the bout's scorecard (task 07).
import { api, type BoutView, type Event, references } from './api.ts';
import { BoutDelete } from './bout-delete.ts';
import { BoutForm } from './bout-form.ts';
import { Component, html, nothing } from './component.ts';
import { EventForm } from './event-form.ts';
import { navigate } from './router.ts';
import {
  boutWeightText,
  dateText,
  fighterName,
  missedWeightNote,
  recordOnTheNight,
  resultLabel,
  resultText,
  titleText,
} from './format.ts';

type References = Awaited<ReturnType<typeof references>>;
type State = { event: Event | null; bouts: BoutView[]; refs: References | null };

export class EventPage extends Component<State> {
  constructor(readonly id: number) {
    super({ event: null, bouts: [], refs: null });
  }

  override async load() {
    const [event, bouts, refs] = await Promise.all([
      api<Event>(`/events/${this.id}`),
      api<BoutView[]>(`/events/${this.id}/bouts`),
      references(),
    ]);
    this.set({ event, bouts, refs });
  }

  async editEvent(event: Event) {
    const saved = await new EventForm(event).open();
    if (saved) this.set({ event: saved });
  }

  // The bout form gets the reference lists as arrays it may add to (a new
  // fighter, a new title); the page reads everything again afterwards,
  // whatever the answer.
  async editBout(bout: BoutView | null) {
    const refs = this.state.refs!;
    const lists = {
      fighters: [...refs.fighters.values()],
      classes: [...refs.classes.values()],
      titles: [...refs.titles.values()],
    };
    await new BoutForm(this.id, lists, bout).open();
    await this.load(); // a fighter or title made in the form stays, even on Cancel
  }

  // Read again whatever the answer: a delete closed with Escape after it
  // was done still happened.
  async deleteBout(bout: BoutView, names: string) {
    await new BoutDelete(bout, names).open();
    await this.load();
  }

  view() {
    const { event, bouts, refs } = this.state;
    if (!event || !refs) return html`<p class="muted">Loading…</p>`;
    return html`
      <div class="page-head">
        <h1>${event.location}</h1>
        <button type="button" class="quiet" @click=${() => this.editEvent(event)}>edit</button>
        <button type="button" @click=${() => this.editBout(null)}>Add bout</button>
      </div>
      <p class="subtitle">${dateText(event.date)}</p>
      ${bouts.length === 0 ? html`<p class="muted">No bouts on this card yet.</p>` : html`
        <table class="list card">
          <thead>
            <tr>
              <th>#</th>
              <th>Fighters</th>
              <th>Class</th>
              <th>Rounds</th>
              <th>Titles</th>
              <th>Result</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${bouts.map((bout) => this.row(bout, refs))}</tbody>
        </table>
      `}
    `;
  }

  row(bout: BoutView, refs: References) {
    const a = refs.fighters.get(bout.fighter_a_id);
    const b = refs.fighters.get(bout.fighter_b_id);
    const nameA = a ? fighterName(a) : `fighter ${bout.fighter_a_id}`;
    const nameB = b ? fighterName(b) : `fighter ${bout.fighter_b_id}`;
    const cornerB = bout.corner_a === 'red' ? 'blue' : bout.corner_a === 'blue' ? 'red' : null;
    const side = (name: string, corner: string | null, record: string | null, missed: string) =>
      html`
        <div class="side">
          ${corner
            ? html`<span class="corner ${corner}" title="${corner} corner"></span>`
            : nothing}
          <span class="name">${name}</span>
          ${record ? html`<span class="record">${record}</span>` : nothing}
          ${missed ? html`<span class="missed">${missed}</span>` : nothing}
        </div>
      `;
    // The whole row opens the scorecard (Erez, 2026-11-07); the result
    // link stays for the keyboard, and edit and delete are their own.
    const open = (e: MouseEvent) => {
      if ((e.target as Element).closest('a, button')) return;
      navigate(`/bouts/${bout.id}`);
    };
    return html`
      <tr class="bout" @click=${open}>
        <td class="order">${bout.card_order}</td>
        <td>
          ${side(nameA, bout.corner_a, recordOnTheNight(bout, 'a'), missedWeightNote(bout, 'A'))}
          ${side(nameB, cornerB, recordOnTheNight(bout, 'b'), missedWeightNote(bout, 'B'))}
        </td>
        <td>${boutWeightText(bout, refs.classes)}</td>
        <td>${bout.scheduled_rounds}</td>
        <td>
          ${bout.titles.map(({ title_id, holder_side }) => {
            const title = refs.titles.get(title_id);
            const holder = holder_side === 'A' ? nameA : holder_side === 'B' ? nameB : 'vacant';
            return html`<div>${
              title ? titleText(title) : `title ${title_id}`
            } <span class="muted">(${holder})</span></div>`;
          })}
        </td>
        <td title=${resultLabel(bout)}>
          <a href="/bouts/${bout.id}">${resultText(bout, nameA, nameB) || 'Score'}</a>
        </td>
        <td class="row-actions">
          <button type="button" class="quiet" @click=${() => this.editBout(bout)}>edit</button>
          <button type="button" class="quiet" @click=${() =>
            this.deleteBout(bout, `${nameA} v ${nameB}`)}>delete</button>
        </td>
      </tr>
    `;
  }
}
