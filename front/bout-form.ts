// The bout dialog (task 08): who fights whom, found by name or added on the
// spot, the corners, the class or the contracted weight and who missed it
// (D26, D45), the scheduled rounds and the belts on the line with who
// brought each (SPEC API, POST/PATCH /bouts). Answers the saved bout.
import { api, type BoutView, type Fighter, json, type Title, type WeightClass } from './api.ts';
import { html, nothing } from './component.ts';
import { arrowStep, choiceRow, DialogForm, type DialogState, FRESH } from './dialog.ts';
import {
  findFighters,
  newFighterLabel,
  readBoutWeight,
  resolveTyped,
  sideText,
  sideTyped,
  titlesOffClass,
} from './entry.ts';
import { titlesField } from './bout-titles.ts';
import { FighterForm } from './fighter-form.ts';
import { classText, fighterName, recordText, titleText } from './format.ts';
import { MAX_ROUNDS } from '../server/rules/scoring.ts';

// null: not recorded, as a title bout arrives from v1 (D127).
export type Holder = 'A' | 'B' | 'vacant' | null;
export type Line = { title_id: number; holder_side: Holder };
export type NewTitle = { sanctioning_body: string; area: string; interim: boolean };
type State = DialogState & {
  a: Fighter | null;
  b: Fighter | null;
  queryA: string;
  queryB: string;
  pickA: number; // the highlighted match, which Enter takes
  pickB: number;
  corner_a: 'red' | 'blue' | '';
  weightBy: 'class' | 'contracted';
  weight_class_id: number; // kept while a contracted weight is chosen, for going back
  contracted: string; // lbs, as typed
  missedA: boolean;
  missedB: boolean;
  scheduled_rounds: string;
  titles: Line[];
  newTitle: NewTitle | null; // the small form for a belt not in the list yet
};
type Lists = { fighters: Fighter[]; classes: WeightClass[]; titles: Title[] };

export class BoutForm extends DialogForm<State, BoutView> {
  readonly #opened: string; // what the form held when it opened, for dirty()
  #entered: HTMLInputElement | null = null; // a chosen box the mouse is pressing its way into

  constructor(
    readonly eventId: number,
    readonly lists: Lists,
    readonly existing: BoutView | null = null,
  ) {
    const b = existing;
    const find = (id: number | undefined) => lists.fighters.find((f) => f.id === id) ?? null;
    super({
      ...FRESH,
      a: find(b?.fighter_a_id),
      b: find(b?.fighter_b_id),
      queryA: '',
      queryB: '',
      pickA: 0,
      pickB: 0,
      corner_a: b?.corner_a ?? 'red',
      weightBy: b?.contracted_weight != null ? 'contracted' : 'class',
      weight_class_id: b?.weight_class_id ?? lists.classes.at(-1)?.id ?? 0,
      contracted: b?.contracted_weight != null ? String(b.contracted_weight) : '',
      missedA: b?.missed_weight_a === 1,
      missedB: b?.missed_weight_b === 1,
      scheduled_rounds: String(b?.scheduled_rounds ?? 12),
      titles: b?.titles.map((t) => ({ ...t })) ?? [],
      newTitle: null,
    });
    this.#opened = this.held();
  }

  // The choices and text the form holds, as one string to compare.
  held(): string {
    const s = this.state;
    return JSON.stringify([
      s.a?.id ?? null,
      s.b?.id ?? null,
      s.queryA,
      s.queryB,
      s.corner_a,
      s.weightBy,
      s.weight_class_id,
      s.contracted,
      s.missedA,
      s.missedB,
      s.scheduled_rounds,
      s.titles,
      s.newTitle,
    ]);
  }

  // Cancel asks when a fighter was chosen or anything typed (D44).
  override dirty(): boolean {
    return this.held() !== this.#opened;
  }

  // A finalised bout's fighters cannot change (D30).
  get fightersLocked(): boolean {
    return this.existing?.is_draft === 0;
  }

  title() {
    return this.existing ? 'Edit bout' : 'New bout';
  }

  body() {
    const s = this.state;
    return html`
      <div class="grid">
        ${this.fighterField('A', s.a, s.queryA)} ${this.fighterField('B', s.b, s.queryB)}
        <div class="field">
          <span class="label">Corner of fighter A</span>
          ${choiceRow<State['corner_a']>(
            'Corner of fighter A',
            [
              { value: 'red', label: 'Red', swatch: 'red' },
              { value: 'blue', label: 'Blue', swatch: 'blue' },
              { value: '', label: 'Not recorded' },
            ],
            s.corner_a,
            (corner_a) => this.set({ corner_a }),
          )}
        </div>
        ${this.weightField()}
        <label>Scheduled rounds
          <input
            inputmode="numeric"
            .value=${s.scheduled_rounds}
            @keydown=${arrowStep({ min: 1, max: MAX_ROUNDS, start: 12 })}
            @input=${(e: InputEvent) =>
              this.set({ scheduled_rounds: (e.target as HTMLInputElement).value })}
          >
        </label>
      </div>
      ${this.missedField()} ${titlesField(this)}
    `;
  }

  // A class, its limit beside it as v1 showed it (Erez, 2026-11-07), or a
  // contracted weight in lbs that is no class's limit; there is no
  // catchweight class (D26, D45).
  weightField() {
    const s = this.state;
    const contracted = s.weightBy === 'contracted';
    return html`
      <label>Weight
        <select @change=${(e: InputEvent) => {
          const value = (e.target as HTMLSelectElement).value;
          // A contracted weight has no titles, so a new title begun for
          // the class is dropped rather than added under a class no longer
          // chosen (D45).
          if (value === 'contracted') this.set({ weightBy: 'contracted', newTitle: null });
          else this.set({ weightBy: 'class', weight_class_id: Number(value) });
        }}>
          ${this.lists.classes.map((c) =>
            html`
              <option value=${c.id} ?selected=${!contracted && c.id === s.weight_class_id}>
                ${classText(c)}
              </option>
            `
          )}
          <option value="contracted" ?selected=${contracted}>Contracted weight (no class)</option>
        </select>
      </label>
      ${contracted
        ? html`
          <label>Contracted weight (lbs)
            <input
              inputmode="decimal"
              placeholder="e.g. 150"
              .value=${s.contracted}
              @input=${(e: InputEvent) =>
                this.set({ contracted: (e.target as HTMLInputElement).value })}
            >
          </label>
        `
        : nothing}
    `;
  }

  // Who missed weight: neither, either or both, ticked by the user, never
  // worked out from the weigh-in (D26). One plain line, not a box of its
  // own: it is ticked once every month or two (D47).
  missedField() {
    const s = this.state;
    const name = (f: Fighter | null, side: 'A' | 'B') => (f ? fighterName(f) : `Fighter ${side}`);
    return html`
      <div class="missed-weight" role="group" aria-label="Missed weight">
        <span>Missed weight:</span>
        <label class="inline">
          <input
            type="checkbox"
            .checked=${s.missedA}
            @change=${(e: Event) => this.set({ missedA: (e.target as HTMLInputElement).checked })}
          > ${name(s.a, 'A')}
        </label>
        <label class="inline">
          <input
            type="checkbox"
            .checked=${s.missedB}
            @change=${(e: Event) => this.set({ missedB: (e.target as HTMLInputElement).checked })}
          > ${name(s.b, 'B')}
        </label>
      </div>
    `;
  }

  // One side: one box, always. It holds the chosen fighter's name, their
  // record under it, or the text being searched for with what it finds and a
  // way to add the fighter, there from the start: at ringside the name often
  // comes last, so the fighter form can be opened blank and the name typed
  // in it whenever it is known (Erez, 2026-11-07). Typing searches; a
  // click, or Enter on the highlighted match (arrows move it), chooses. Enter
  // with no match opens the new fighter form with the name typed. A chosen
  // name is typed over like any text: going into the box, or choosing with
  // the cursor in it, selects the name, and typing searches again
  // (sideTyped; Erez, 2026-11-26). A second click in the box puts the caret
  // where clicked, to mend a letter. A finalised bout's
  // fighters cannot change, so its boxes are read-only (D30).
  fighterField(side: 'A' | 'B', chosen: Fighter | null, query: string) {
    const locked = this.fightersLocked;
    const found = chosen ? [] : this.found(side, query);
    const pick = Math.min(this.pickOf(side), Math.max(0, found.length - 1));
    // "(Enter)" only where Enter does add: nobody has the name typed (D38).
    const typed = !chosen && found.length === 0 && query.trim() ? this.resolve(side, query) : null;
    const enterAdds = typed !== null && 'absent' in typed && typed.absent;
    return html`
      <div class="field">
        <label>Fighter ${side}
          <input
            class=${chosen ? 'chosen' : ''}
            placeholder="Type a name, then Enter"
            autocomplete="off"
            .value=${sideText(chosen, query)}
            ?readonly=${locked}
            data-side=${side}
            @mousedown=${(e: MouseEvent) => {
              // A press that is about to bring the focus to a chosen box;
              // a press in a box that has it already is an ordinary click.
              const box = e.target as HTMLInputElement;
              const entering = chosen !== null && !locked && document.activeElement !== box;
              this.#entered = entering ? box : null;
            }}
            @focus=${(e: FocusEvent) => {
              if (chosen && !locked) (e.target as HTMLInputElement).select();
            }}
            @mouseup=${(e: MouseEvent) => {
              // The click that brought the focus must not put the caret
              // down and undo the selection, as Safari's does. Only that
              // click: after Tab, or once in the box, a click places the caret.
              if (this.#entered === e.target) e.preventDefault();
              this.#entered = null;
            }}
            @blur=${() => (this.#entered = null)}
            @input=${(e: InputEvent) => this.search(side, (e.target as HTMLInputElement).value)}
            @keydown=${(e: KeyboardEvent) => this.searchKey(e, side, found, pick, query)}
          >
        </label>
        ${chosen
          ? html`
            <span class="record of-chosen">${recordText(chosen)}</span>
          `
          : html`
            <ul class="found ${found.length > 0 || query.trim() ? 'listed' : ''}" role="listbox">
              ${found.map((f, i) =>
                html`
                  <li>
                    <button
                      type="button"
                      class="pick ${i === pick ? 'highlighted' : ''}"
                      @click=${() => this.choose(side, f)}
                    >
                      ${fighterName(f)} <span class="record">${recordText(f)}</span>
                    </button>
                  </li>
                `
              )}
              <li>
                <button type="button" class="quiet" @click=${() => this.addFighter(side, query)}>
                  ${newFighterLabel(query)}${enterAdds
                    ? html`
                      <span class="muted">(Enter)</span>
                    `
                    : nothing}
                </button>
              </li>
            </ul>
          `}
      </div>
    `;
  }

  found(side: 'A' | 'B', query: string): Fighter[] {
    const other = side === 'A' ? this.state.b : this.state.a;
    return findFighters(this.lists.fighters, query).filter((f) => f.id !== other?.id);
  }

  pickOf(side: 'A' | 'B'): number {
    return side === 'A' ? this.state.pickA : this.state.pickB;
  }

  // Typing in a side's box: a search, which lets go of a fighter chosen
  // there unless the box still holds their name (sideTyped).
  search(side: 'A' | 'B', text: string) {
    if (this.fightersLocked) return;
    const now = sideTyped(side === 'A' ? this.state.a : this.state.b, text);
    this.set(
      side === 'A'
        ? { a: now.chosen, queryA: now.query, pickA: 0 }
        : { b: now.chosen, queryB: now.query, pickB: 0 },
    );
  }

  // Against every fighter, with the other side's choice as it stands.
  resolve(side: 'A' | 'B', typed: string) {
    const other = side === 'A' ? this.state.b : this.state.a;
    return resolveTyped(this.lists.fighters, typed, other?.id ?? null);
  }

  choose(side: 'A' | 'B', fighter: Fighter) {
    // The box now holds their name; the text that found them is done with.
    this.set(
      side === 'A'
        ? { a: fighter, queryA: '', pickA: 0, error: null }
        : { b: fighter, queryB: '', pickB: 0, error: null },
    );
    // Chosen with Enter, the cursor is still in the box, and no focus event
    // will select the name: select it here, so the next key replaces it.
    const box = document.activeElement;
    if (box instanceof HTMLInputElement && box.dataset.side === side) box.select();
  }

  searchKey(e: KeyboardEvent, side: 'A' | 'B', found: Fighter[], pick: number, query: string) {
    const move = (to: number) =>
      this.set({ [side === 'A' ? 'pickA' : 'pickB']: to } as Partial<State>);
    if (e.key === 'ArrowDown' && found.length > 0) {
      e.preventDefault();
      move(Math.min(pick + 1, found.length - 1));
    } else if (e.key === 'ArrowUp' && found.length > 0) {
      e.preventDefault();
      move(Math.max(pick - 1, 0));
    } else if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault(); // Enter here chooses; it never saves the bout
      if (side === 'A' ? this.state.a : this.state.b) return; // already chosen
      if (found.length > 0) return this.choose(side, found[pick]);
      const typed = this.resolve(side, query);
      if ('fighter' in typed) this.choose(side, typed.fighter);
      else if (typed.absent) this.addFighter(side, query);
      else this.set({ error: `Fighter ${side}: ${typed.error}` });
    }
  }

  async addFighter(side: 'A' | 'B', typed: string) {
    const other = side === 'A' ? this.state.b : this.state.a;
    const fighter = await new FighterForm(null, typed, this.lists.fighters, other?.id ?? null)
      .open();
    if (!fighter) return;
    // Found in the list (and perhaps updated), or new.
    const at = this.lists.fighters.findIndex((f) => f.id === fighter.id);
    if (at >= 0) this.lists.fighters[at] = fighter;
    else this.lists.fighters.push(fighter);
    this.choose(side, fighter);
  }

  override actions() {
    return html`
      <button type="button" ?disabled=${this.state.busy} @click=${() => this.save()}>Save</button>
    `;
  }

  async save() {
    // A name typed in full is a choice; anything else says what to do (D38).
    const problems: string[] = [];
    for (const side of ['A', 'B'] as const) {
      if (side === 'A' ? this.state.a : this.state.b) continue;
      const typed = this.resolve(side, side === 'A' ? this.state.queryA : this.state.queryB);
      if ('fighter' in typed) this.choose(side, typed.fighter);
      else problems.push(`Fighter ${side}: ${typed.error}`);
    }
    if (problems.length > 0) return this.set({ error: problems.join('. ') });
    const s = this.state;
    if (!s.a || !s.b) return; // resolved above
    const rounds = Number(s.scheduled_rounds);
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > MAX_ROUNDS) {
      return this.set({ error: `scheduled rounds are 1–${MAX_ROUNDS}` });
    }
    const weight = readBoutWeight(s.weightBy, s.weight_class_id, s.contracted);
    if ('error' in weight) return this.set({ error: weight.error });
    const off = titlesOffClass(s.titles, this.lists.titles, weight.weight_class_id);
    if (off.length > 0) {
      const names = off.map(titleText).join(', ');
      return this.set({
        error: weight.weight_class_id === null
          ? `a title is fought for at its class's limit: remove ${names} or choose the class`
          : `not a title of this class: ${names}; remove it or change the class`,
      });
    }
    const body = {
      ...weight,
      missed_weight_a: s.missedA,
      missed_weight_b: s.missedB,
      scheduled_rounds: rounds,
      fighter_a_id: s.a.id,
      fighter_b_id: s.b.id,
      corner_a: s.corner_a || null,
      titles: s.titles,
    };
    const saved = await this.attempt(() =>
      this.existing
        ? api<BoutView>(`/bouts/${this.existing.id}`, json('PATCH', body))
        : api<BoutView>('/bouts', json('POST', { ...body, event_id: this.eventId }))
    );
    if (saved) this.done(saved);
  }
}
