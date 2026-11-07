// The fighter dialog (task 08): edit a fighter, or find-or-add one (D43),
// with the weight in any unit (D36) and the record they arrive with,
// correctable by hand (D28). Answers the saved fighter.
//
// Find-or-add: at ringside the name often comes last, and whether the
// fighter is already in the list is not known until it does. As the name is
// typed the form lists the fighters it matches; using one, or saving a name
// that is exactly one fighter's, takes that fighter, with their stored
// record and tonight's weight, colours and nickname. A new fighter is made
// only when nobody has the name.
import { api, type Fighter, json } from './api.ts';
import { html, nothing } from './component.ts';
import { DialogForm, type DialogState, FRESH } from './dialog.ts';
import {
  changedFields,
  fighterFor,
  findFighters,
  readDetails,
  readWeight,
  updatesForExisting,
  weightText,
} from './entry.ts';
import { fighterName, recordText } from './format.ts';
import { getUnitDisplayName, type WeightUnit } from '../server/rules/weight.ts';

const UNITS: WeightUnit[] = ['lbs', 'kg', 'st'];
const RECORD = ['won', 'lost', 'draws', 'nc', 'kos'] as const;
const RECORD_LABELS = { won: 'Won', lost: 'Lost', draws: 'Drawn', nc: 'NC', kos: 'KOs' };

type Fields = {
  first_name: string;
  last_name: string;
  nickname: string;
  colors: string;
  weight: string;
  unit: WeightUnit;
  won: string;
  lost: string;
  draws: string;
  nc: string;
  kos: string;
};
type State = DialogState & { fields: Fields; unitTouched: boolean };

export class FighterForm extends DialogForm<State, Fighter> {
  // `existing` to edit. Otherwise a fighter to find or add: `typed` is a
  // name already typed (in the bout form's search), and `list` the fighters
  // to find them in.
  constructor(
    readonly existing: Fighter | null = null,
    typed = '',
    readonly list: Fighter[] = [],
    readonly otherId: number | null = null, // the bout's other side, never taken
  ) {
    const [first = '', ...rest] = typed.trim().split(/\s+/);
    const f = existing;
    super({
      ...FRESH,
      fields: {
        first_name: f?.first_name ?? first,
        last_name: f?.last_name ?? rest.join(' '),
        nickname: f?.nickname ?? '',
        colors: f?.colors ?? '',
        weight: f ? weightText(f.weight, f.weight_unit) : '',
        unit: f?.weight_unit ?? 'lbs',
        won: String(f?.won ?? 0),
        lost: String(f?.lost ?? 0),
        draws: String(f?.draws ?? 0),
        nc: String(f?.nc ?? 0),
        kos: String(f?.kos ?? 0),
      },
      unitTouched: false,
    });
  }

  title() {
    return this.existing ? 'Edit fighter' : 'Fighter';
  }

  // Fighters in the list the name typed so far could be.
  matches(): Fighter[] {
    if (this.existing) return [];
    const { first_name, last_name } = this.state.fields;
    return findFighters(this.list, `${first_name} ${last_name}`, 6)
      .filter((f) => f.id !== this.otherId)
      .slice(0, 5);
  }

  field(name: keyof Fields, value: string) {
    this.set({ fields: { ...this.state.fields, [name]: value } });
  }

  body() {
    const f = this.state.fields;
    const text = (name: keyof Fields, label: string, required = false) =>
      html`
        <label>${label}
          <input
            .value=${f[name]}
            ?required=${required}
            @input=${(e: Event) => this.field(name, (e.target as HTMLInputElement).value)}
          >
        </label>
      `;
    return html`
      <form class="grid" @submit=${(e: Event) => {
        e.preventDefault();
        this.save();
      }}>
        ${text('first_name', 'First name', true)} ${text('last_name', 'Last name', true)}
        ${this.matchList()}
        ${text('nickname', 'Nickname')} ${text('colors', 'Colours')}
        <label>Weight ${f.unit === 'st' ? html`<small class="muted">(st lb oz)</small>` : nothing}
          <input
            .value=${f.weight}
            inputmode="decimal"
            @input=${(e: Event) => this.field('weight', (e.target as HTMLInputElement).value)}
          >
        </label>
        <label>Unit
          <select @change=${(e: Event) =>
            this.changeUnit((e.target as HTMLSelectElement).value as WeightUnit)}>
            ${UNITS.map((u) =>
              html`<option value=${u} ?selected=${u === f.unit}>${getUnitDisplayName(u)}</option>`
            )}
          </select>
        </label>
        <fieldset class="counts">
          <legend>Record ${this.existing
            ? html`<small class="muted">(correct by hand)</small>`
            : html`<small class="muted">(for a new fighter; one from the list keeps theirs)</small>`}</legend>
          ${RECORD.map((k) =>
            html`
              <label>${RECORD_LABELS[k]}
                <input
                  .value=${f[k]}
                  inputmode="numeric"
                  @input=${(e: Event) => this.field(k, (e.target as HTMLInputElement).value)}
                >
              </label>
            `
          )}
        </fieldset>
        <button type="submit" hidden></button>
      </form>
    `;
  }

  matchList() {
    const found = this.matches();
    if (found.length === 0) return nothing;
    return html`
      <div class="wide matches">
        <span class="muted">Already in your list? Keeps their record, takes what you typed here:</span>
        <ul class="found listed">
          ${found.map((f) =>
            html`
              <li>
                <button type="button" class="pick" ?disabled=${this.state.busy} @click=${() =>
                  this.useExisting(f)}>
                              Use ${fighterName(f)} <span class="record">${recordText(f)}</span>
                            </button>
              </li>
            `
          )}
        </ul>
      </div>
    `;
  }

  // The fighter is one already in the list: their record stays, tonight's
  // details are written over the stored ones (updatesForExisting, D43).
  async useExisting(fighter: Fighter) {
    const typed = readDetails(this.state.fields, this.state.unitTouched, fighter.weight_unit);
    if ('error' in typed) return this.set({ error: typed.error });
    const patch = updatesForExisting(fighter, typed);
    if (Object.keys(patch).length === 0) return this.done(fighter);
    const saved = await this.attempt(() =>
      api<Fighter>(`/fighters/${fighter.id}`, json('PATCH', patch))
    );
    if (saved) this.done(saved);
  }

  // Switching the unit keeps the weight: what was typed is read in the old
  // unit and written in the new one.
  changeUnit(unit: WeightUnit) {
    const f = this.state.fields;
    const read = readWeight(f.weight, f.unit);
    const weight = 'pounds' in read ? weightText(read.pounds, unit) : f.weight;
    this.set({ fields: { ...f, unit, weight }, unitTouched: true });
  }

  override actions() {
    return html`
      <button type="button" ?disabled=${this.state.busy} @click=${() => this.save()}>Save</button>
    `;
  }

  async save() {
    const f = this.state.fields;
    if (!f.first_name.trim() || !f.last_name.trim()) {
      return this.set({ error: "type the fighter's first and last name to save" });
    }
    // A name that is someone's: that fighter, never a second one (D43).
    const who = fighterFor(
      this.list,
      f.first_name,
      f.last_name,
      this.existing?.id ?? null,
      this.otherId,
    );
    if ('error' in who) return this.set({ error: who.error });
    if ('use' in who) return this.useExisting(who.use);
    const typed = readDetails(f, true, null);
    if ('error' in typed) return this.set({ error: typed.error });
    const record: Record<string, number> = {};
    for (const k of RECORD) {
      if (!/^\d+$/.test(f[k].trim())) {
        return this.set({ error: `${RECORD_LABELS[k]} is a whole number` });
      }
      record[k] = Number(f[k]);
    }
    const body = { first_name: f.first_name, last_name: f.last_name, ...typed, ...record };
    const saved = await this.attempt(() =>
      this.existing
        ? api<Fighter>(
          `/fighters/${this.existing.id}`,
          json('PATCH', changedFields(this.existing, body)),
        )
        : api<Fighter>('/fighters', json('POST', body))
    );
    if (saved) this.done(saved);
  }
}
