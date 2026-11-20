// What sits around the scorecard's table (task 07; restyled in task
// restyle-scorecard to docs/reference/design/): each side's marquee above
// it, and once final, the result band.
import type { BoutView, Fighter, Title } from './api.ts';
import { html, nothing } from './component.ts';
import {
  missedWeightNote,
  rankText,
  resultLabel,
  resultText,
  standingOnTheNight,
  titleText,
} from './format.ts';
import { beltsOf, rankOf } from './scorecard.ts';
import type { Side } from '../server/rules/decisions.ts';

// A side's marquee (SPEC Front end): corner, a "Champion" chip and the belts
// brought in, the name and nickname, a missed weight noted quietly (D26,
// D47), and the record, weight and colours on the night (standingOnTheNight:
// the fighter as they stand until the first save takes the snapshot, §7),
// with the TBRB rank once the snapshot has it.
export function sideHead(
  bout: BoutView,
  titles: Map<number, Title>,
  side: Side,
  fighter: Fighter | undefined,
  name: string,
  corner: string | null,
) {
  const belts = beltsOf(bout, side).map((id) => {
    const title = titles.get(id);
    return title ? titleText(title) : `title ${id}`;
  });
  const s = side === 'A' ? 'a' : 'b';
  const { record, weight, colours } = standingOnTheNight(bout, s, fighter);
  const rank = rankOf(bout, side);
  const note = missedWeightNote(bout, side);
  const stat = (label: string, value: string) =>
    html`
      <div>
        <dt>${label}</dt>
        <dd>${value}</dd>
      </div>
    `;
  return html`
    <article class="bp-marquee side-${s}" aria-label=${name}>
      <div class="bp-corner">
        ${corner
          ? html`
            <span class="bp-square ${corner}"></span><span
              class="bp-corner-name ${corner}">${corner} corner</span>
          `
          : nothing}
        ${belts.length > 0 ? html`<span class="bp-chip" title="champion">Champion</span>` : nothing}
      </div>
      <h2 class="bp-name">${fighter
        ? html`<span>${fighter.first_name}</span> <span>${fighter.last_name}</span>`
        : name}</h2>
      ${fighter?.nickname ? html`<p class="bp-nick">“${fighter.nickname}”</p>` : nothing}
      ${belts.length > 0 ? html`<p class="bp-belts">${belts.join(' · ')}</p>` : nothing}
      ${note ? html`<p class="missed">${note}</p>` : nothing}
      <dl class="bp-stats">
        ${record ? stat('Record', record) : nothing}
        ${rank !== null ? stat('TBRB', rankText(rank)) : nothing}
        ${weight ? stat('Weight', weight) : nothing}
        ${colours ? stat('Colours', colours) : nothing}
      </dl>
    </article>
  `;
}

// Once final: the result, the judges' cards that were typed, and mine from
// the running totals when a round was scored (D41; task restyle-scorecard).
export function resultBand(
  bout: BoutView,
  nameA: string,
  nameB: string,
  totals: { a: number; b: number },
  scored: boolean,
) {
  const judges = bout.card.judges
    .map((j, i) => ({ ...j, n: i + 1 }))
    .filter((j) => j.a !== null && j.b !== null);
  return html`
    <section class="bp-result" aria-label="Result">
      <div>
        <p class="bp-result-label">Result</p>
        <p class="bp-result-text" title=${resultLabel(bout)}>${resultText(bout, nameA, nameB)}</p>
      </div>
      <dl class="bp-cards">
        ${judges.map((j) =>
          html`
            <div>
              <dt>Judge ${j.n}</dt>
              <dd>${j.a}–${j.b}</dd>
            </div>
          `
        )}
        ${scored
          ? html`
            <div class="mine">
              <dt>My card</dt>
              <dd>${totals.a}–${totals.b}</dd>
            </div>
          `
          : nothing}
      </dl>
    </section>
  `;
}
