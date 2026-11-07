// The bout dialog (task 08): who fights whom, found by name or added on the
// spot, the corners, the class, the scheduled rounds and the belts on the
// line with who brought each (SPEC API, POST/PATCH /bouts). Answers the
// saved bout.
import { api, type BoutView, type Fighter, json, type Title, type WeightClass } from './api.ts';
import { html, nothing } from './component.ts';
import { DialogForm, type DialogState, FRESH } from './dialog.ts';
import { findFighters, titlesOffClass } from './entry.ts';
import { FighterForm } from './fighter-form.ts';
import { fighterName, recordText, titleText } from './format.ts';
import { MAX_ROUNDS } from '../server/rules/scoring.ts';

type Holder = 'A' | 'B' | 'vacant';
type Line = { title_id: number; holder_side: Holder };
type NewTitle = { sanctioning_body: string; area: string; status: string };
type State = DialogState & {
  a: Fighter | null;
  b: Fighter | null;
  queryA: string;
  queryB: string;
  corner_a: 'red' | 'blue' | '';
  weight_class_id: number;
  scheduled_rounds: string;
  titles: Line[];
  newTitle: NewTitle | null; // the small form for a belt not in the list yet
};
type Lists = { fighters: Fighter[]; classes: WeightClass[]; titles: Title[] };

export class BoutForm extends DialogForm<State, BoutView> {
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
      corner_a: b?.corner_a ?? 'red',
      weight_class_id: b?.weight_class_id ?? lists.classes.at(-1)?.id ?? 0,
      scheduled_rounds: String(b?.scheduled_rounds ?? 12),
      titles: b?.titles.map((t) => ({ ...t })) ?? [],
      newTitle: null,
    });
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
        <label>Corner of fighter A
          <select @change=${(e: InputEvent) =>
            this.set({ corner_a: (e.target as HTMLSelectElement).value as State['corner_a'] })}>
            <option value="red" ?selected=${s.corner_a === 'red'}>Red (B is blue)</option>
            <option value="blue" ?selected=${s.corner_a === 'blue'}>Blue (B is red)</option>
            <option value="" ?selected=${s.corner_a === ''}>Not recorded</option>
          </select>
        </label>
        <label>Weight class
          <select @change=${(e: InputEvent) =>
            this.set({ weight_class_id: Number((e.target as HTMLSelectElement).value) })}>
            ${this.lists.classes.map((c) =>
              html`<option value=${c.id} ?selected=${c.id === s.weight_class_id}>${c.name}</option>`
            )}
          </select>
        </label>
        <label>Scheduled rounds
          <input
            inputmode="numeric"
            .value=${s.scheduled_rounds}
            @input=${(e: InputEvent) =>
              this.set({ scheduled_rounds: (e.target as HTMLInputElement).value })}
          >
        </label>
      </div>
      ${this.titlesField()}
    `;
  }

  // One side: the chosen fighter, or a search box with what it finds and a
  // way to add the fighter when they are not there yet.
  fighterField(side: 'A' | 'B', chosen: Fighter | null, query: string) {
    const key = side === 'A' ? 'a' : 'b';
    const queryKey = side === 'A' ? 'queryA' : 'queryB';
    if (chosen) {
      return html`
        <div class="field">
          <span class="label">Fighter ${side}</span>
          <div class="chosen">
            <strong>${fighterName(chosen)}</strong>
            <span class="record">${recordText(chosen)}</span>
            ${this.fightersLocked ? nothing : html`
              <button type="button" class="quiet" @click=${() =>
                this.set({ [key]: null } as Partial<State>)}>change</button>
            `}
          </div>
        </div>
      `;
    }
    const other = side === 'A' ? this.state.b : this.state.a;
    const found = findFighters(this.lists.fighters, query).filter((f) => f.id !== other?.id);
    return html`
      <div class="field">
        <label>Fighter ${side}
          <input
            placeholder="Type a name"
            autocomplete="off"
            .value=${query}
            @input=${(e: InputEvent) =>
              this.set({ [queryKey]: (e.target as HTMLInputElement).value } as Partial<State>)}
          >
        </label>
        <ul class="found">
          ${found.map((f) =>
            html`
              <li>
                <button type="button" class="pick" @click=${() =>
                  this.set({ [key]: f } as Partial<State>)}>
                              ${fighterName(f)} <span class="record">${recordText(f)}</span>
                            </button>
              </li>
            `
          )}
          ${query.trim()
            ? html`
              <li>
                <button type="button" class="quiet" @click=${() => this.addFighter(side, query)}>
                              + New fighter "${query.trim()}"
                            </button>
              </li>
            `
            : nothing}
        </ul>
      </div>
    `;
  }

  async addFighter(side: 'A' | 'B', typed: string) {
    const fighter = await new FighterForm(null, typed).open();
    if (!fighter) return;
    this.lists.fighters.push(fighter);
    this.set({ [side === 'A' ? 'a' : 'b']: fighter } as Partial<State>);
  }

  // The belts on the line: each a title of this class and who brought it.
  titlesField() {
    const s = this.state;
    const ofClass = this.lists.titles.filter((t) => t.weight_class_id === s.weight_class_id);
    const unused = ofClass.filter((t) => !s.titles.some((l) => l.title_id === t.id));
    const name = (side: 'A' | 'B') => {
      const f = side === 'A' ? s.a : s.b;
      return f ? fighterName(f) : `fighter ${side}`;
    };
    const setLine = (i: number, line: Line) =>
      this.set({ titles: s.titles.map((l, j) => (j === i ? line : l)) });
    return html`
      <fieldset class="titles">
        <legend>Titles on the line</legend>
        ${s.titles.map((line, i) => {
          const title = this.lists.titles.find((t) => t.id === line.title_id);
          return html`
            <div class="line">
              <span>${title ? titleText(title) : `title ${line.title_id}`}</span>
              <select @change=${(e: InputEvent) =>
                setLine(i, {
                  ...line,
                  holder_side: (e.target as HTMLSelectElement).value as Holder,
                })}>
                <option value="A" ?selected=${line.holder_side === 'A'}>held by ${name(
                  'A',
                )}</option>
                <option value="B" ?selected=${line.holder_side === 'B'}>held by ${name(
                  'B',
                )}</option>
                <option value="vacant" ?selected=${line.holder_side === 'vacant'}>vacant</option>
              </select>
              <button type="button" class="quiet" @click=${() =>
                this.set({ titles: s.titles.filter((_, j) => j !== i) })}>remove</button>
            </div>
          `;
        })}
        <div class="line">
          ${unused.length > 0
            ? html`
              <select @change=${(e: InputEvent) => {
                const select = e.target as HTMLSelectElement;
                const id = Number(select.value);
                select.value = '';
                if (id) {
                  this.set({ titles: [...s.titles, { title_id: id, holder_side: 'vacant' }] });
                }
              }}>
                <option value="">Add a title of this class…</option>
                ${unused.map((t) => html`<option value=${t.id}>${titleText(t)}</option>`)}
              </select>
            `
            : nothing}
          ${s.newTitle ? nothing : html`
            <button type="button" class="quiet" @click=${() =>
              this.set({ newTitle: { sanctioning_body: '', area: 'World', status: 'Active' } })}>
              + New title
            </button>
          `}
        </div>
        ${s.newTitle ? this.newTitleForm(s.newTitle) : nothing}
      </fieldset>
    `;
  }

  newTitleForm(t: NewTitle) {
    const field = (key: keyof NewTitle, label: string) =>
      html`
        <label>${label}
          <input .value=${t[key]} @input=${(e: InputEvent) =>
            this.set({ newTitle: { ...t, [key]: (e.target as HTMLInputElement).value } })}>
        </label>
      `;
    return html`
      <div class="new-title">
        ${field('sanctioning_body', 'Body (WBC, IBF…)')} ${field('area', 'Area')}
        ${field('status', 'Kind (Active, Interim…)')}
        <button type="button" @click=${() => this.addTitle(t)}>Add title</button>
        <button type="button" class="quiet" @click=${() => this.set({ newTitle: null })}>
          Never mind
        </button>
      </div>
    `;
  }

  // A new belt is saved at once, for this class, and put on the line vacant.
  async addTitle(t: NewTitle) {
    const title = await this.attempt(() =>
      api<Title>('/titles', json('POST', { ...t, weight_class_id: this.state.weight_class_id }))
    );
    if (!title) return;
    this.lists.titles.push(title);
    this.set({
      newTitle: null,
      titles: [...this.state.titles, { title_id: title.id, holder_side: 'vacant' }],
    });
  }

  override actions() {
    return html`
      <button type="button" ?disabled=${this.state.busy} @click=${() => this.save()}>Save</button>
    `;
  }

  async save() {
    const s = this.state;
    if (!s.a || !s.b) return this.set({ error: 'choose both fighters' });
    const rounds = Number(s.scheduled_rounds);
    if (!Number.isInteger(rounds) || rounds < 1 || rounds > MAX_ROUNDS) {
      return this.set({ error: `scheduled rounds are 1–${MAX_ROUNDS}` });
    }
    const off = titlesOffClass(s.titles, this.lists.titles, s.weight_class_id);
    if (off.length > 0) {
      const names = off.map(titleText).join(', ');
      return this.set({
        error: `not a title of this class: ${names}; remove it or change the class`,
      });
    }
    const body = {
      weight_class_id: s.weight_class_id,
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
