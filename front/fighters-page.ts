// `/fighters`: everyone watched, filed by the initial of the last name, with
// the record as W-L-D (N KOs) (SPEC Front end; v1's FighterList). Merge is
// task 08 and the fighter card behind each name is task 09.
import { api, type Fighter } from './api.ts';
import { Component, html } from './component.ts';
import { fighterName, initialOf, recordText } from './format.ts';

type State = { fighters: Fighter[] | null; closed: Set<string> };

export class FightersPage extends Component<State> {
  constructor() {
    super({ fighters: null, closed: new Set() });
  }

  override async load() {
    this.set({ fighters: await api<Fighter[]>('/fighters') });
  }

  toggle(letter: string) {
    const closed = new Set(this.state.closed);
    if (!closed.delete(letter)) closed.add(letter);
    this.set({ closed });
  }

  view() {
    const { fighters, closed } = this.state;
    if (!fighters) return html`<p class="muted">Loading…</p>`;
    if (fighters.length === 0) return html`<p class="muted">No fighters yet.</p>`;
    const letters = new Map<string, Fighter[]>();
    for (const fighter of sortedByName(fighters)) {
      const letter = initialOf(fighter.last_name);
      letters.set(letter, [...(letters.get(letter) ?? []), fighter]);
    }
    return html`
      <h1>Fighters</h1>
      ${[...letters].map(([letter, ofLetter]) =>
        html`
          <section class="group">
            <h2>
              <button type="button" aria-expanded=${!closed.has(letter)} @click=${() =>
                this.toggle(letter)}>
                ${letter} <span class="count">${ofLetter.length}</span>
              </button>
            </h2>
            ${closed.has(letter) ? '' : this.table(ofLetter)}
          </section>
        `
      )}
    `;
  }

  table(fighters: Fighter[]) {
    return html`
      <table class="list">
        <tbody>
          ${fighters.map((fighter) =>
            html`
              <tr>
                <td>${fighterName(fighter)}</td>
                <td class="record">${recordText(fighter)}</td>
              </tr>
            `
          )}
        </tbody>
      </table>
    `;
  }
}

// By last name then first, letters compared as a person would, not as bytes
// (the API's ORDER BY is byte order, which puts "de la Hoya" after "Zurdo").
function sortedByName(fighters: Fighter[]): Fighter[] {
  const collator = new Intl.Collator('en', { sensitivity: 'base' });
  return [...fighters].sort((x, y) =>
    collator.compare(x.last_name, y.last_name) || collator.compare(x.first_name, y.first_name)
  );
}
