// The deduction dialog (task 08, v1's DeductionForm): the points taken from
// one side in one round, each with its reason (SPEC Data model: knockdown,
// low blow, holding, headbutt, other, with a free text beside). Answers the
// round's deductions for that side as they now stand; the scorecard saves
// them with the card. A 10–8 is a 10 and a deduction (§1).
import { html, nothing } from './component.ts';
import { arrowStep, DialogForm, type DialogState, FRESH } from './dialog.ts';
import { isAssumed } from './scorecard.ts';
import type { Side } from '../server/rules/decisions.ts';
import {
  type CardDeduction,
  DEDUCTION_REASONS,
  type DeductionReason,
} from '../server/rules/scoring.ts';

type State = DialogState & {
  list: CardDeduction[];
  points: string;
  reason: DeductionReason;
  note: string;
};

export class DeductionForm extends DialogForm<State, CardDeduction[]> {
  constructor(
    readonly round: number,
    readonly side: Side,
    readonly name: string,
    current: CardDeduction[],
    readonly readOnly = false,
  ) {
    super({ ...FRESH, list: current, points: '1', reason: 'knockdown', note: '' });
  }

  title() {
    return `Round ${this.round} · ${this.name}`;
  }

  body() {
    const s = this.state;
    return html`
      ${s.list.length === 0 ? html`<p class="muted">No deductions.</p>` : html`
        <ul class="deductions">
          ${s.list.map((d, i) =>
            html`<li>
              −${d.points} ${d.reason}${
              d.note
                ? html`
                  <span class="muted">(${d.note})</span>
                `
                : nothing
            }
              ${
              isAssumed(d)
                ? html`<sup class="assumed" title="reason assumed on import">?</sup>`
                : nothing
            }
              ${
              this.readOnly ? nothing : html`
                <button type="button" class="quiet" @click=${() =>
                  this.set({ list: s.list.filter((_, j) => j !== i) })}>remove</button>
              `
            }
            </li>`
          )}
        </ul>
      `}
      ${this.readOnly
        ? html`<p class="muted">The bout is finalised; reopen it to change the card.</p>`
        : html`
          <form class="grid" @submit=${(e: SubmitEvent) => {
            e.preventDefault();
            this.add();
          }}>
            <label>Points
              <input
                inputmode="numeric"
                .value=${s.points}
                @keydown=${arrowStep({ min: 1, max: 10 })}
                @input=${(e: InputEvent) =>
                  this.set({ points: (e.target as HTMLInputElement).value })}
              >
            </label>
            <label>Reason
              <select @change=${(e: InputEvent) =>
                this.set({ reason: (e.target as HTMLSelectElement).value as DeductionReason })}>
                ${DEDUCTION_REASONS.map((r) =>
                  html`<option value=${r} ?selected=${r === s.reason}>${r}</option>`
                )}
              </select>
            </label>
            <label class="wide">Note
              <input
                .value=${s.note}
                @input=${(e: InputEvent) =>
                  this.set({ note: (e.target as HTMLInputElement).value })}
              >
            </label>
            <button type="submit">Add deduction</button>
          </form>
        `}
    `;
  }

  add() {
    const points = Number(this.state.points);
    if (!Number.isInteger(points) || points < 1 || points > 10) {
      return this.set({ error: 'a deduction is 1–10 whole points' });
    }
    const d: CardDeduction = {
      round_no: this.round,
      side: this.side,
      points,
      reason: this.state.reason,
      note: this.state.note.trim() || null,
    };
    this.set({ list: [...this.state.list, d], points: '1', note: '', error: null });
  }

  override actions() {
    return this.readOnly
      ? nothing
      : html`<button type="button" @click=${() => this.done(this.state.list)}>Done</button>`;
  }
}
