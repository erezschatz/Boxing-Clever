// `/fighters`: everyone watched, filed by the initial of the last name, with
// the record as W-L-D (N KOs) (SPEC Front end; v1's FighterList). Add, edit
// and merge open dialogs; the fighter card behind each name is task 09.
import { api, type Fighter } from './api.ts';
import { Component, html } from './component.ts';
import { FighterForm } from './fighter-form.ts';
import { MergeForm } from './merge-form.ts';
import { fighterName, initialOf, recordText } from './format.ts';

type State = { fighters: Fighter[] | null; closed: Set<string> };

export class FightersPage extends Component<State> {
  constructor() {
    super({ fighters: null, closed: new Set() });
  }

  override async load() {
    this.set({ fighters: await api<Fighter[]>('/fighters') });
  }

  // After a dialog, the list is read again: a merge removes one fighter and
  // changes another's record.
  async edit(fighter: Fighter | null) {
    await new FighterForm(fighter, '', this.state.fighters ?? []).open();
    await this.load();
  }

  // Read again whatever the answer: a merge closed with Escape after it was
  // done still happened.
  async merge(duplicate: Fighter) {
    await new MergeForm(duplicate, this.state.fighters ?? []).open();
    await this.load();
  }

  toggle(letter: string) {
    const closed = new Set(this.state.closed);
    if (!closed.delete(letter)) closed.add(letter);
    this.set({ closed });
  }

  view() {
    const { fighters, closed } = this.state;
    if (!fighters) return html`<p class="muted">Loading…</p>`;
    const head = html`
      <div class="page-head">
        <h1>Fighters</h1>
        <button type="button" @click=${() => this.edit(null)}>New fighter</button>
      </div>
    `;
    if (fighters.length === 0) return html`${head}<p class="muted">No fighters yet.</p>`;
    const letters = new Map<string, Fighter[]>();
    for (const fighter of sortedByName(fighters)) {
      const letter = initialOf(fighter.last_name);
      letters.set(letter, [...(letters.get(letter) ?? []), fighter]);
    }
    return html`
      ${head}
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
                <td class="row-actions">
                  <button type="button" class="quiet" @click=${() =>
                    this.edit(fighter)}>edit</button>
                  <button type="button" class="quiet" @click=${() =>
                    this.merge(fighter)}>merge…</button>
                </td>
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
