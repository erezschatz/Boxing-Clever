// `/fighters`: everyone watched, filed by the initial of the last name, with
// the record as W-L-D (N KOs) (SPEC Front end; v1's FighterList). Add, edit
// and merge open dialogs; each name opens the fighter card (fighter-page.ts).
// Restyled to docs/reference/design/Fighters.dc.html (task restyle-fighters).
import { api, type Fighter } from './api.ts';
import { Component, html } from './component.ts';
import { FighterForm } from './fighter-form.ts';
import { MergeForm } from './merge-form.ts';
import { fighterCount, fighterName, initialOf, recordText } from './format.ts';

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
      <div class="fl-head">
        <div>
          <h1>Fighters</h1>
          ${fighters.length > 0
            ? html`<p class="muted">${fighterCount(fighters.length)}, filed by last name</p>`
            : ''}
        </div>
        <button type="button" class="fl-new" @click=${() => this.edit(null)}>New fighter</button>
      </div>
    `;
    if (fighters.length === 0) {
      return html`
        <div class="fighters-page">${head}<p class="muted">No fighters yet.</p></div>
      `;
    }
    const letters = new Map<string, Fighter[]>();
    for (const fighter of sortedByName(fighters)) {
      const letter = initialOf(fighter.last_name);
      letters.set(letter, [...(letters.get(letter) ?? []), fighter]);
    }
    return html`
      <div class="fighters-page">
        ${head}
        <div class="fl-letters">
          ${[...letters].map(([letter, ofLetter]) =>
            this.letter(letter, ofLetter, !closed.has(letter))
          )}
        </div>
      </div>
    `;
  }

  // A letter: the letter large, its count, and "fold" or "open" (shown, not
  // read out: the button's aria-expanded says it). Folded, it lists its last
  // names so the letter still says who is under it.
  letter(letter: string, fighters: Fighter[], isOpen: boolean) {
    return html`
      <section class="fl-letter">
        <h2>
          <button type="button" class="fl-lbtn" aria-expanded=${isOpen} @click=${() =>
            this.toggle(letter)}>
            <span class="fl-big">${letter}</span>
            <span class="fl-count">${fighterCount(fighters.length)}<span aria-hidden="true">
                · ${isOpen ? 'fold' : 'open'}</span></span>
          </button>
        </h2>
        ${isOpen
          ? this.list(fighters)
          : html`<p class="fl-preview muted">${fighters.map((f) => f.last_name).join(', ')}</p>`}
      </section>
    `;
  }

  // A fighter's row: the last name large, then the first name and nickname,
  // the record, and the dialogs. The link is named as everywhere else
  // (fighterName), not in the order it is set.
  list(fighters: Fighter[]) {
    return html`
      <ul class="fl-list">
        ${fighters.map((fighter) =>
          html`
            <li>
              <a href="/fighters/${fighter.id}" aria-label=${fighterName(fighter)}>
                <span class="fl-last">${fighter.last_name}</span>
                <span class="fl-first">${fighter.first_name}</span>
                ${fighter.nickname ? html`<span class="fl-nick">“${fighter.nickname}”</span>` : ''}
              </a>
              <span class="fl-record">${recordText(fighter)}</span>
              <span class="fl-actions">
                <button type="button" class="fl-quiet" @click=${() =>
                  this.edit(fighter)}>Edit</button>
                <button type="button" class="fl-quiet" @click=${() =>
                  this.merge(fighter)}>Merge…</button>
              </span>
            </li>
          `
        )}
      </ul>
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
