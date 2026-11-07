// `/events/:id`: the card. Every bout in card order with who fights whom,
// the corners, the class, the rounds, the belts on the line and who brought
// each, and the result (SPEC Front end; v1's Event page columns). Editing
// is task 08; the scorecard behind each bout is task 07.
import { api, type BoutView, type Event, references } from './api.ts';
import { Component, html, nothing } from './component.ts';
import { dateText, fighterName, recordText, resultLabel, resultText, titleText } from './format.ts';

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

  view() {
    const { event, bouts, refs } = this.state;
    if (!event || !refs) return html`<p class="muted">Loading…</p>`;
    return html`
      <h1>${event.location}</h1>
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
    const side = (name: string, corner: string | null, record: string | null) =>
      html`
        <div class="side">
          ${corner
            ? html`<span class="corner ${corner}" title="${corner} corner"></span>`
            : nothing}
          <span class="name">${name}</span>
          ${record ? html`<span class="record">${record}</span>` : nothing}
        </div>
      `;
    return html`
      <tr>
        <td class="order">${bout.card_order}</td>
        <td>
          ${side(nameA, bout.corner_a, recordOnTheNight(bout, 'a'))}
          ${side(nameB, cornerB, recordOnTheNight(bout, 'b'))}
        </td>
        <td>${refs.classes.get(bout.weight_class_id)?.name ?? ''}</td>
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
        <td title=${resultLabel(bout)}>${resultText(bout, nameA, nameB)}</td>
      </tr>
    `;
  }
}

// The side's record from the as-of snapshot (SPEC §7), or null before the
// first save has taken it. The five columns are written together, so the
// first one says whether they are there.
function recordOnTheNight(bout: BoutView, side: 'a' | 'b'): string | null {
  const s = side === 'a'
    ? { won: bout.a_won, lost: bout.a_lost, draws: bout.a_draws, nc: bout.a_nc, kos: bout.a_kos }
    : { won: bout.b_won, lost: bout.b_lost, draws: bout.b_draws, nc: bout.b_nc, kos: bout.b_kos };
  if (s.won === null) return null;
  return recordText({ won: s.won, lost: s.lost!, draws: s.draws!, nc: s.nc!, kos: s.kos! });
}
