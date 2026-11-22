// `/events/:id`: the card. Every bout in card order with who fights whom,
// the corners, the class, the rounds, the belts on the line and who brought
// each, and the result (SPEC Front end; v1's Event page columns). The event
// and its bouts are added, edited and deleted here in dialogs (task 08); the
// whole row opens the bout's scorecard (task 07). Restyled to
// docs/reference/design/Event.dc.html (task restyle-event-card).
import { api, type BoutView, type Event, references } from './api.ts';
import { BoutDelete } from './bout-delete.ts';
import { BoutForm } from './bout-form.ts';
import { Component, html, nothing } from './component.ts';
import { EventForm } from './event-form.ts';
import { navigate } from './router.ts';
import {
  boutWeightText,
  cardCounts,
  dateText,
  fighterName,
  missedWeightNote,
  outcomeText,
  placeLines,
  plainName,
  recordOnTheNight,
  resultLabel,
  titleText,
} from './format.ts';
import type { Side } from '../server/rules/decisions.ts';

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
    // Read again even on Cancel: a venue fixed from the form is saved
    // whether or not the event is (task venues).
    await new EventForm(event).open();
    await this.load();
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
    const counts = cardCounts(bouts);
    return html`
      <div class="event-page">
        <div class="ec-head">
          <div class="ec-where">
            <p class="ec-date">
              <span>${dateText(event.date)}</span>
              <button type="button" class="ec-quiet" @click=${() =>
                this.editEvent(event)}>Edit event</button>
            </p>
            <h1>${placeLines(event.venue).name}</h1>
            ${placeLines(event.venue).where
              ? html`<p class="ec-place">${placeLines(event.venue).where}</p>`
              : nothing}
          </div>
          <div class="ec-tally">
            ${bouts.length > 0
              ? html`
                <p class="muted">
                  <strong>${counts.bouts}</strong> ${counts.bouts === 1 ? 'bout' : 'bouts'}${counts
                      .toScore > 0
                    ? html`
                      · <strong>${counts.toScore}</strong> to score
                    `
                    : nothing}${counts.notFinal > 0
                    ? html`
                      · <strong>${counts.notFinal}</strong> not final
                    `
                    : nothing}
                </p>
              `
              : nothing}
            <button type="button" class="ec-add" @click=${() =>
              this.editBout(null)}>Add bout</button>
          </div>
        </div>
        ${bouts.length === 0 ? html`<p class="muted">No bouts on this card yet.</p>` : html`
          <div class="ec-scroll">
            <table class="ec-card" aria-label="The card">
              <thead>
                <tr>
                  <th>#</th>
                  <th colspan="3">Fighters</th>
                  <th>Weight · rounds · titles</th>
                  <th>Result</th>
                  <th><span class="visually-hidden">Edit or delete</span></th>
                </tr>
              </thead>
              <tbody>${bouts.map((bout) => this.row(bout, refs))}</tbody>
            </table>
          </div>
          <p class="ec-note muted">A row opens its scorecard.</p>
        `}
      </div>
    `;
  }

  // A side of a bout row: the corner square, the name large (grey once the
  // other side has won), and the record on the night with a missed weight
  // noted beside it (D47). Side B is mirrored, its square after the name.
  side(bout: BoutView, side: Side, name: string, corner: string | null) {
    const s = side === 'A' ? 'a' : 'b';
    const winner = bout.card.result?.winner;
    const lost = (winner === 'A' || winner === 'B') && winner !== side;
    const record = recordOnTheNight(bout, s);
    const missed = missedWeightNote(bout, side);
    return html`
      <div class="ec-side side-${s}">
        <div class="ec-fighter">
          <span
            class="ec-corner ${corner ?? 'none'}"
            role="img"
            aria-label=${corner ? `${corner} corner` : 'corner not recorded'}
          ></span>
          <span class="ec-name ${lost ? 'lost' : ''}">${name}</span>
        </div>
        ${record || missed
          ? html`
            <div class="ec-record">
              ${record ? html`<span class="record">${record}</span>` : nothing}
              ${missed ? html`<span class="missed">${missed}</span>` : nothing}
            </div>
          `
          : nothing}
      </div>
    `;
  }

  row(bout: BoutView, refs: References) {
    const a = refs.fighters.get(bout.fighter_a_id);
    const b = refs.fighters.get(bout.fighter_b_id);
    const nameA = a ? fighterName(a) : `fighter ${bout.fighter_a_id}`;
    const nameB = b ? fighterName(b) : `fighter ${bout.fighter_b_id}`;
    // The rows set names large, without the nickname (task restyle-event-card).
    const shortA = a ? plainName(a) : nameA;
    const shortB = b ? plainName(b) : nameB;
    const cornerB = bout.corner_a === 'red' ? 'blue' : bout.corner_a === 'blue' ? 'red' : null;
    const outcome = outcomeText(bout, shortA, shortB);
    const note = bout.card.result && bout.card.is_draft ? 'not final' : '';
    const weight = boutWeightText(bout, refs.classes);
    // The whole row opens the scorecard (Erez, 2026-11-07); the result
    // link stays for the keyboard, and edit and delete are their own.
    const open = (e: MouseEvent) => {
      if ((e.target as Element).closest('a, button')) return;
      navigate(`/bouts/${bout.id}`);
    };
    return html`
      <tr class="bout" @click=${open}>
        <td class="ec-order">${bout.card_order}</td>
        <td class="ec-a">${this.side(bout, 'A', shortA, bout.corner_a)}</td>
        <td class="ec-vs" aria-hidden="true">vs</td>
        <td class="ec-b">${this.side(bout, 'B', shortB, cornerB)}</td>
        <td class="ec-terms">
          <div>${weight ? `${weight} · ` : ''}${bout.scheduled_rounds} rounds</div>
          ${bout.titles.map(({ title_id, holder_side }) => {
            const title = refs.titles.get(title_id);
            const holder = holder_side === 'A' ? shortA : holder_side === 'B' ? shortB : 'vacant';
            return html`<div class="ec-title">${
              title ? titleText(title) : `title ${title_id}`
            } <span class="muted">(${holder})</span></div>`;
          })}
        </td>
        <td class="ec-result" title=${resultLabel(bout)}>
          ${outcome
            ? html`<a class="ec-outcome" href="/bouts/${bout.id}">${outcome}</a>`
            : html`<a class="ec-score" href="/bouts/${bout.id}">Score</a>`}
          ${note ? html`<span class="muted">${note}</span>` : nothing}
        </td>
        <td class="ec-actions">
          <button type="button" class="ec-quiet" @click=${() => this.editBout(bout)}>Edit</button>
          <button type="button" class="ec-quiet" @click=${() =>
            this.deleteBout(bout, `${nameA} v ${nameB}`)}>Delete</button>
        </td>
      </tr>
    `;
  }
}
