// `/fighters/:id`: the fighter card (SPEC Front end, task fighter-card),
// built to docs/reference/design/Fighter.dc.html. Who they are, their record,
// where they stand (TBRB now, titles held as witnessed), and every fight
// watched, newest first, each with the record they took into it. A row opens
// its scorecard. Read-only: the fighter is edited from /fighters.
import { api, type BoutView, type Event, type Fighter, references, type Standing } from './api.ts';
import { Component, html, nothing } from './component.ts';
import { navigate } from './router.ts';
import { rankOf } from './scorecard.ts';
import {
  boutWeightText,
  dateText,
  fighterName,
  howItEnded,
  missedWeightNote,
  myCardFor,
  outcomeFor,
  rankText,
  recordOnTheNight,
  sideOf,
  titleText,
} from './format.ts';

type References = Awaited<ReturnType<typeof references>>;
type Loaded = {
  fighter: Fighter;
  bouts: BoutView[]; // oldest first, as the API answers
  standing: Standing;
  events: Map<number, Event>;
  refs: References;
};
type State = { loaded: Loaded | null };

export class FighterPage extends Component<State> {
  constructor(readonly id: number) {
    super({ loaded: null });
  }

  override async load() {
    const [fighter, bouts, standing, events, refs] = await Promise.all([
      api<Fighter>(`/fighters/${this.id}`),
      api<BoutView[]>(`/fighters/${this.id}/bouts`),
      api<Standing>(`/fighters/${this.id}/standing`),
      api<Event[]>('/events'),
      references(),
    ]);
    this.set({
      loaded: { fighter, bouts, standing, events: new Map(events.map((e) => [e.id, e])), refs },
    });
  }

  view() {
    const loaded = this.state.loaded;
    if (!loaded) return html`<p class="muted">Loading…</p>`;
    return html`
      <article class="fighter-card">
        ${this.identity(loaded)}
        <div class="fc-standing">
          ${this.tbrb(loaded)} ${this.titles(loaded)} ${this.witnessed(loaded)}
        </div>
        ${this.fights(loaded)}
      </article>
    `;
  }

  identity({ fighter: f, standing }: Loaded) {
    const kos = f.kos === 1 ? '1 KO' : `${f.kos} KOs`;
    return html`
      <header class="fc-identity">
        <div class="fc-who">
          ${standing.titles.length > 0 ? html`<span class="fc-chip">Champion</span>` : nothing}
          <h1 class="fc-name"><span>${f.first_name}</span> <span>${f.last_name}</span></h1>
          <p class="fc-nick">
            ${f.nickname ? html`<span class="fc-nickname">“${f.nickname}”</span>` : nothing}
            ${f.colors ? html`<span>Colours: ${f.colors}</span>` : nothing}
          </p>
        </div>
        <div class="fc-record">
          <span class="fc-label">Record</span>
          <span class="fc-wld">${f.won}-${f.lost}-${f.draws}</span>
          <span class="fc-kos">${kos}${f.nc > 0 ? `, ${f.nc} NC` : ''}</span>
        </div>
      </header>
    `;
  }

  // The rank on each class's latest list that names them (D25): no list
  // naming them says unranked, which before task 12 is every fighter.
  tbrb({ standing, refs }: Loaded) {
    return html`
      <section class="fc-panel">
        <h2 class="fc-label">TBRB now</h2>
        ${standing.tbrb.length === 0 ? html`<p class="muted">Not on any TBRB list.</p>` : html`
          <dl class="fc-ranks">
            ${standing.tbrb.map((r) =>
              html`
                <div>
                  <dt>${refs.classes.get(r.weight_class_id)?.name ?? `class ${r.weight_class_id}`}
                    <small class="muted">list of ${dateText(r.snapshot_date)}</small>
                  </dt>
                  <dd>${r.rank === 0 ? 'Champion' : `#${r.rank}`}</dd>
                </div>
              `
            )}
          </dl>
        `}
      </section>
    `;
  }

  // As witnessed (SPEC Scoring §8): a belt seen lost or vacated off-screen
  // still shows until a bout with it is watched.
  titles({ standing, refs }: Loaded) {
    return html`
      <section class="fc-panel">
        <h2 class="fc-label">Titles held</h2>
        ${standing.titles.length === 0 ? html`<p class="muted">None, as witnessed.</p>` : html`
          <ul class="fc-titles">
            ${standing.titles.map((id) => {
              const title = refs.titles.get(id);
              return html`<li>${title ? titleText(title) : `title ${id}`}</li>`;
            })}
          </ul>
        `}
      </section>
    `;
  }

  // One square per finalised fight, oldest first: filled a win, open a
  // loss, grey a draw, dashed a no contest. Fights not final yet are left out.
  witnessed({ bouts, fighter, events }: Loaded) {
    const final = bouts.filter((b) => b.card.result && !b.card.is_draft);
    const marks = final.map((b) => outcomeFor(b, sideOf(b, fighter.id)));
    const count = (m: string) => marks.filter((x) => x === m).length;
    const parts = [
      `${count('W')} won`,
      `${count('L')} lost`,
      count('D') ? `${count('D')} drawn` : '',
      count('NC') ? `${count('NC')} no contest` : '',
    ].filter(Boolean);
    const watched = bouts.length === 1 ? 'fight watched' : 'fights watched';
    const summary = final.length ? `${watched} · ${parts.join(', ')}` : watched;
    const first = bouts[0] ? events.get(bouts[0].event_id) : undefined;
    const words: Record<string, string> = { W: 'win', L: 'loss', D: 'draw', NC: 'no contest' };
    return html`
      <section class="fc-panel">
        <h2 class="fc-label">As witnessed</h2>
        ${bouts.length === 0 ? html`<p class="muted">No fights watched yet.</p>` : html`
          <div class="fc-squares" role="img" aria-label=${`Oldest first: ${
            marks.map((m) => words[m]).join(', ') || 'none final yet'
          }`}>
            ${marks.map((m) => html`<span class="fc-sq ${m.toLowerCase()}"></span>`)}
          </div>
          <p><strong>${bouts.length}</strong> ${summary}</p>
          ${first ? html`<p class="muted">First seen ${dateText(first.date)}.</p>` : nothing}
        `}
      </section>
    `;
  }

  fights(loaded: Loaded) {
    const newestFirst = [...loaded.bouts].reverse();
    return html`
      <section class="fc-fights">
        <div class="fc-fights-head">
          <h2>Fights</h2>
          <span class="muted">Newest first. A row opens its scorecard.</span>
        </div>
        ${newestFirst.length === 0 ? html`<p class="muted">None yet.</p>` : html`
          <div class="fc-scroll">
            <table class="fc-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th><span class="visually-hidden">Corner</span></th>
                  <th>Opponent</th>
                  <th>Weight · rounds</th>
                  <th>Result</th>
                  <th>Record that night</th>
                  <th>Rank then</th>
                  <th class="num">My card</th>
                </tr>
              </thead>
              <tbody>${newestFirst.map((b) => this.row(b, loaded))}</tbody>
            </table>
          </div>
        `}
      </section>
    `;
  }

  row(bout: BoutView, { fighter, events, refs }: Loaded) {
    const side = sideOf(bout, fighter.id);
    const other = side === 'A' ? 'B' : 'A';
    const opponentId = side === 'A' ? bout.fighter_b_id : bout.fighter_a_id;
    const opponent = refs.fighters.get(opponentId);
    const opponentName = opponent ? fighterName(opponent) : `fighter ${opponentId}`;
    const corner = side === 'A'
      ? bout.corner_a
      : bout.corner_a === 'red'
      ? 'blue'
      : bout.corner_a === 'blue'
      ? 'red'
      : null;
    const event = events.get(bout.event_id);
    const mark = outcomeFor(bout, side);
    const rank = rankOf(bout, side);
    const holder = (h: string) =>
      h === side ? fighter.last_name : h === other ? (opponent?.last_name ?? 'opponent') : 'vacant';
    const ownMiss = missedWeightNote(bout, side);
    // The whole row opens the scorecard, as on the event card; the link in
    // it stays for the keyboard.
    const open = (e: MouseEvent) => {
      if ((e.target as Element).closest('a, button')) return;
      navigate(`/bouts/${bout.id}`);
    };
    return html`
      <tr class="fc-row" @click=${open}>
        <td class="fc-date">${event ? dateText(event.date) : ''}</td>
        <td>
          <span
            class="fc-corner ${corner ?? 'none'}"
            role="img"
            aria-label=${corner ? `${corner} corner` : 'corner not recorded'}
          ></span>
        </td>
        <td>
          <a class="fc-opponent" href="/bouts/${bout.id}">${opponentName}</a>
          ${missedWeightNote(bout, other)
            ? html`<span class="missed">${missedWeightNote(bout, other)}</span>`
            : nothing}
          ${bout.titles.map(({ title_id, holder_side }) => {
            const t = refs.titles.get(title_id);
            return html`<div class="fc-sub">${t ? titleText(t) : `title ${title_id}`} (${
              holder(holder_side)
            })</div>`;
          })}
        </td>
        <td>
          ${boutWeightText(bout, refs.classes)}
          ${ownMiss ? html`<span class="missed">${ownMiss}</span>` : nothing}
          <div class="fc-sub">${bout.scheduled_rounds} rounds</div>
        </td>
        <td>
          ${mark
            ? html`<span class="fc-mark ${mark.toLowerCase()}">${mark}</span> ${howItEnded(bout)}`
            : html`<span class="muted">not scored yet</span>`}
          ${mark && bout.card.is_draft ? html`<div class="fc-sub">not final</div>` : nothing}
        </td>
        <td class="fc-num">${recordOnTheNight(bout, side === 'A' ? 'a' : 'b') ?? '—'}</td>
        <td class="fc-num">${rank === null ? '—' : rankText(rank)}</td>
        <td class="fc-num num">${myCardFor(bout, side) || '—'}</td>
      </tr>
    `;
  }
}
