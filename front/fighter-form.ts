// The fighter dialog (task 08): edit a fighter, or find-or-add one (D43,
// D44), with the weight in any unit (D36) and the record they arrive with,
// correctable by hand (D28). Answers the saved fighter.
//
// The form is a place, not a chute (D44). At ringside the details come
// before the name, and whether the fighter is already in the list is not
// known until the name is typed. As it is typed the form lists the fighters
// it could be; picking one makes the form theirs and keeps it open: their
// name and stored record go in, tonight's details stay as typed, and the
// record typed is kept beside theirs to take or leave. Only Save ends the
// form, and Cancel asks first when anything was typed. A new fighter is
// made only when nobody has the name.
import { api, type Fighter, json } from './api.ts';
import { html, nothing } from './component.ts';
import { DialogForm, type DialogState, FRESH } from './dialog.ts';
import {
  changedFields,
  fieldsOnFound,
  fieldsUnfound,
  type FighterEntry,
  fighterFor,
  findFighters,
  patchForFound,
  readDetails,
  readRecord,
  readWeight,
  RECORD_KEYS,
  type RecordCounts,
  recordStrings,
  renameProblem,
  weightText,
} from './entry.ts';
import { fighterName, recordText } from './format.ts';
import { getUnitDisplayName, type WeightUnit } from '../server/rules/weight.ts';

const UNITS: WeightUnit[] = ['lbs', 'kg', 'st'];
const RECORD_LABELS = { won: 'Won', lost: 'Lost', draws: 'Drawn', nc: 'NC', kos: 'KOs' };

type State = DialogState & {
  fields: FighterEntry;
  unitTouched: boolean;
  found: Fighter | null; // the fighter in the list this form is about
  before: FighterEntry | null; // what was typed before they were found, for "not him"
  typedRecord: RecordCounts | null; // the record typed before, when it differs from theirs
  pick: number; // the highlighted match, which Enter takes
  listOpen: boolean; // Escape closes the list; typing a name opens it again
};

export class FighterForm extends DialogForm<State, Fighter> {
  readonly #opened: string; // the boxes as the form opened, for dirty()

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
        ...recordStrings({
          won: f?.won ?? 0,
          lost: f?.lost ?? 0,
          draws: f?.draws ?? 0,
          nc: f?.nc ?? 0,
          kos: f?.kos ?? 0,
        }),
      },
      unitTouched: false,
      found: null,
      before: null,
      typedRecord: null,
      pick: 0,
      listOpen: true,
    });
    this.#opened = JSON.stringify(this.state.fields);
  }

  title() {
    if (this.existing) return 'Edit fighter';
    return this.state.found ? fighterName(this.state.found) : 'Fighter';
  }

  // Cancel asks once anything is typed, or a fighter was found (D44).
  override dirty(): boolean {
    return this.state.found !== null || JSON.stringify(this.state.fields) !== this.#opened;
  }

  // Fighters in the list the name typed so far could be; none once the form
  // is someone's, or on an edit.
  matches(): Fighter[] {
    if (this.existing || this.state.found) return [];
    const { first_name, last_name } = this.state.fields;
    return findFighters(this.list, `${first_name} ${last_name}`, 6)
      .filter((f) => f.id !== this.otherId)
      .slice(0, 5);
  }

  field(name: keyof FighterEntry, value: string) {
    const isName = name === 'first_name' || name === 'last_name';
    this.set({
      fields: { ...this.state.fields, [name]: value },
      ...(isName ? { listOpen: true, pick: 0 } : {}),
    });
  }

  body() {
    const f = this.state.fields;
    const found = this.state.found;
    const text = (name: keyof FighterEntry, label: string, placeholder = '') =>
      html`
        <label>${label}
          <input
            .value=${f[name]}
            placeholder=${placeholder}
            @input=${(e: Event) => this.field(name, (e.target as HTMLInputElement).value)}
          >
        </label>
      `;
    return html`
      <form class="grid" @submit=${(e: Event) => {
        e.preventDefault();
        this.save();
      }}>
        ${this.statusLine()}
        <div class="wide names" @keydown=${(e: KeyboardEvent) => this.nameKey(e)}>
          ${text('first_name', 'First name')} ${text('last_name', 'Last name')}
          ${this.matchList()}
        </div>
        ${text('nickname', 'Nickname', found?.nickname ?? '')}
        ${text('colors', 'Colours', found?.colors ?? '')}
        <label>Weight ${f.unit === 'st' ? html`<small class="muted">(st lb oz)</small>` : nothing}
          <input
            .value=${f.weight}
            inputmode="decimal"
            placeholder=${found ? weightText(found.weight, f.unit) : ''}
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
          <legend>Record <small class="muted">${this.recordNote()}</small></legend>
          ${RECORD_KEYS.map((k) =>
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
          ${this.typedRecordLine()}
        </fieldset>
        <button type="submit" hidden></button>
      </form>
    `;
  }

  // One line under the title, always there so the form never jumps: what
  // the form is about to do.
  statusLine() {
    if (this.existing) return nothing;
    const found = this.state.found;
    if (found) {
      return html`
        <p class="wide status muted">
          In your list, <strong>${recordText(found)}</strong>. Save updates them.
          <button type="button" class="link" @click=${() => this.notHim()}>Not them</button>
        </p>
      `;
    }
    return html`
      <p class="wide status muted">
        ${this.matches().length > 0 && this.state.listOpen
          ? "Already in your list? Pick them: their record stays, tonight's details are taken."
          : 'A new fighter, unless the name turns out to be one in your list.'}
      </p>
    `;
  }

  recordNote() {
    if (this.existing) return '(correct by hand)';
    return this.state.found ? '(theirs; a change here corrects it)' : '(as announced)';
  }

  // The record typed before the fighter was found, when it is not theirs:
  // take it with a click, or leave the stored one (D44).
  typedRecordLine() {
    const typed = this.state.typedRecord;
    if (!this.state.found || !typed) return nothing;
    return html`
      <p class="typed-record muted">
        You typed ${recordText(typed)}.
        <button type="button" class="link" @click=${() =>
          this.set({
            fields: { ...this.state.fields, ...recordStrings(typed) },
            typedRecord: null,
          })}>
          Use it
        </button>
      </p>
    `;
  }

  matchList() {
    const found = this.matches();
    if (found.length === 0 || !this.state.listOpen) return nothing;
    const pick = Math.min(this.state.pick, found.length - 1);
    return html`
      <ul class="found listed drop" role="listbox">
        ${found.map((f, i) =>
          html`
            <li>
              <button
                type="button"
                class="pick ${i === pick ? 'highlighted' : ''}"
                ?disabled=${this.state.busy}
                @mousedown=${(e: Event) => e.preventDefault()}
                @click=${() => this.bind(f)}
              >
                ${fighterName(f)} <span class="record">${recordText(f)}</span>
              </button>
            </li>
          `
        )}
      </ul>
    `;
  }

  // In the name boxes: arrows move the highlighted match, Enter takes it,
  // Escape closes the list and nothing else. Enter with no list saves.
  nameKey(e: KeyboardEvent) {
    const found = this.matches();
    const listed = this.state.listOpen && found.length > 0;
    if (!listed) return;
    const pick = Math.min(this.state.pick, found.length - 1);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.set({ pick: Math.min(pick + 1, found.length - 1) });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.set({ pick: Math.max(pick - 1, 0) });
    } else if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      this.bind(found[pick]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.set({ listOpen: false });
    }
  }

  // The form becomes this fighter's (fieldsOnFound, D44). Nothing is saved
  // until Save.
  bind(fighter: Fighter) {
    const { fields, typedRecord } = fieldsOnFound(
      this.state.fields,
      this.state.unitTouched,
      fighter,
    );
    this.set({
      found: fighter,
      before: this.state.fields,
      fields,
      typedRecord,
      listOpen: false,
      error: null,
    });
  }

  // "Not them": a new fighter again, with the name and record as they were
  // typed and the details as they stand now.
  notHim() {
    const { fields, before } = this.state;
    this.set({
      found: null,
      before: null,
      typedRecord: null,
      fields: before ? fieldsUnfound(fields, before) : fields,
      listOpen: false,
    });
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
    if (this.existing) return this.saveEdit(this.existing);
    if (this.state.found) return this.saveFound(this.state.found);
    // A name that is someone's: the form becomes theirs, to look at before
    // anything is written; Save again saves (D44). Nobody's: a new fighter.
    const who = fighterFor(this.list, f.first_name, f.last_name, null, this.otherId);
    if ('error' in who) return this.set({ error: who.error });
    if ('use' in who) return this.bind(who.use);
    const details = readDetails(f, true, null);
    if ('error' in details) return this.set({ error: details.error });
    const record = readRecord(f);
    if ('error' in record) return this.set({ error: record.error });
    const body = { first_name: f.first_name, last_name: f.last_name, ...details, ...record };
    const saved = await this.attempt(() => api<Fighter>('/fighters', json('POST', body)));
    if (saved) this.done(saved);
  }

  // A fighter found in the list: a name changed must still be nobody
  // else's (a name left as theirs is theirs, whoever shares it); the name
  // and record go only where changed, tonight's details by D43
  // (patchForFound).
  async saveFound(found: Fighter) {
    const f = this.state.fields;
    const problem = renameProblem(this.list, f, found, this.otherId);
    if (problem) return this.set({ error: problem });
    const result = patchForFound(found, f, this.state.unitTouched);
    if ('error' in result) return this.set({ error: result.error });
    if (Object.keys(result.patch).length === 0) return this.done(found);
    const saved = await this.attempt(() =>
      api<Fighter>(`/fighters/${found.id}`, json('PATCH', result.patch))
    );
    if (saved) this.done(saved);
  }

  // An edit from /fighters: everything as typed, only what changed sent.
  async saveEdit(existing: Fighter) {
    const f = this.state.fields;
    const problem = renameProblem(this.list, f, existing, this.otherId);
    if (problem) return this.set({ error: problem });
    const details = readDetails(f, true, null);
    if ('error' in details) return this.set({ error: details.error });
    const record = readRecord(f);
    if ('error' in record) return this.set({ error: record.error });
    const body = { first_name: f.first_name, last_name: f.last_name, ...details, ...record };
    const saved = await this.attempt(() =>
      api<Fighter>(`/fighters/${existing.id}`, json('PATCH', changedFields(existing, body)))
    );
    if (saved) this.done(saved);
  }
}
