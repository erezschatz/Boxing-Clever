// A side's column header on the scorecard (task 07).
import type { BoutView, Title } from './api.ts';
import { html, nothing } from './component.ts';
import { missedWeight, rankText, recordOnTheNight, titleText } from './format.ts';
import { beltsOf, rankOf } from './scorecard.ts';
import type { Side } from '../server/rules/decisions.ts';

// A side's column header (SPEC Front end): corner colour, name with
// nickname, (c) and the belts brought in, the record on the night and the
// TBRB rank once the snapshot is taken, and a missed weight, marked to
// stand out (D26).
export function sideHead(
  bout: BoutView,
  titles: Map<number, Title>,
  side: Side,
  name: string,
  corner: string | null,
) {
  const belts = beltsOf(bout, side).map((id) => {
    const title = titles.get(id);
    return title ? titleText(title) : `title ${id}`;
  });
  const record = recordOnTheNight(bout, side === 'A' ? 'a' : 'b');
  const rank = rankOf(bout, side);
  return html`
    <th colspan="3" class="side-head ${corner ?? ''}">
      <div class="name">
        ${corner ? html`<span class="corner ${corner}" title="${corner} corner"></span>` : nothing}
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
        ${missedWeight(bout, side) ? html`<span class="missed">missed weight</span>` : nothing}
      </div>
    </th>
  `;
}
