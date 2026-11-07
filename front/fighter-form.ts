// The fighter dialog (task 08): create or edit a fighter, with the weight
// in any unit (D36) and the record they arrive with, correctable by hand
// (D28). Answers the saved fighter.
import { api, type Fighter, json } from './api.ts';
import { html, nothing } from './component.ts';
import { DialogForm, type DialogState, FRESH } from './dialog.ts';
import { changedFields, readWeight, weightText } from './entry.ts';
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
type State = DialogState & { fields: Fields };

export class FighterForm extends DialogForm<State, Fighter> {
  // `existing` to edit; a name already typed (in the bout form's search) to
  // start a new one with.
  constructor(readonly existing: Fighter | null = null, typed = '') {
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
    });
  }

  title() {
    return this.existing ? 'Edit fighter' : 'New fighter';
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
            : nothing}</legend>
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

  // Switching the unit keeps the weight: what was typed is read in the old
  // unit and written in the new one.
  changeUnit(unit: WeightUnit) {
    const f = this.state.fields;
    const read = readWeight(f.weight, f.unit);
    const weight = 'pounds' in read ? weightText(read.pounds, unit) : f.weight;
    this.set({ fields: { ...f, unit, weight } });
  }

  override actions() {
    return html`
      <button type="button" ?disabled=${this.state.busy} @click=${() => this.save()}>Save</button>
    `;
  }

  async save() {
    const f = this.state.fields;
    const weight = readWeight(f.weight, f.unit);
    if ('error' in weight) return this.set({ error: weight.error });
    const record: Record<string, number> = {};
    for (const k of RECORD) {
      if (!/^\d+$/.test(f[k].trim())) {
        return this.set({ error: `${RECORD_LABELS[k]} is a whole number` });
      }
      record[k] = Number(f[k]);
    }
    const body = {
      first_name: f.first_name,
      last_name: f.last_name,
      nickname: f.nickname.trim() || null,
      colors: f.colors.trim() || null,
      weight: weight.pounds,
      weight_unit: weight.pounds === null ? null : f.unit,
      ...record,
    };
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
