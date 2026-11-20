// The decision dialog (task 08, v1's DecisionModal): how the bout ended
// and the three judges' cards. It sends the code, never a label (SPEC §5),
// and leaves the card's shape to the rules: the scorecard page passes the
// result through shapeForResult and validateCard before it saves (§4).
import { html, nothing } from './component.ts';
import { DialogForm, type DialogState, FRESH } from './dialog.ts';
import { fillFromCards, readJudge, roundAsked, winnerAfter, winnersFor } from './entry.ts';
import {
  DECISION_TYPES,
  decisionLabel,
  type DecisionType,
  ending,
  type Winner,
} from '../server/rules/decisions.ts';
import type { Result } from '../server/rules/scoring.ts';
import type { BoutView } from './api.ts';

type Judges = BoutView['card']['judges'];
type State = DialogState & {
  code: DecisionType;
  winner: Winner | null;
  round: string;
  time: string;
  judges: string[]; // a1, b1, a2, b2, a3, b3
  fromCards: string | null; // what the cards decided, said under the decision (D41)
  chosen: boolean; // the decision is the user's (picked, or the bout's own): cards leave it
};

export type Finalise = (result: Result, judges: Judges) => Promise<BoutView>;

export class DecisionForm extends DialogForm<State, BoutView> {
  constructor(
    readonly names: { A: string; B: string },
    readonly scheduled: number,
    // The round each kind of ending is offered: a stoppage the round it was
    // stopped in (stoppedRound), a technical decision or draw, which goes to
    // the cards, the last round typed (lastTyped).
    readonly offered: { stopped: number; typed: number },
    readonly current: { result: Result | null; judges: Judges },
    readonly changingFinal: boolean, // "Change decision" on a finalised bout
    readonly finalise: Finalise,
  ) {
    const r = current.result;
    super({
      ...FRESH,
      code: r?.decision_type ?? 'UD',
      winner: r?.winner ?? null,
      round: r?.round ? String(r.round) : '',
      time: r?.time ?? '',
      judges: current.judges.flatMap((j) => [j.a, j.b]).map((n) => (n === null ? '' : String(n))),
      fromCards: null,
      chosen: r !== null, // a stored result was somebody's choice; the cards do not redo it
    });
  }

  title() {
    return this.changingFinal ? 'Change decision' : 'End bout';
  }

  // A stopped bout is offered the round it most likely ended in, unless
  // told otherwise: a stoppage the round after the last scored (task
  // stoppage-round), a TD or T the last round on the card, which is scored
  // (D22).
  roundShown(): string {
    const { code, round } = this.state;
    const asked = roundAsked(code);
    if (asked === 'last') return String(this.scheduled);
    if (round || asked !== 'needed') return round;
    const { stopped, typed } = this.offered;
    return String(ending(code) === 'cards' ? Math.max(1, typed) : stopped);
  }

  body() {
    const s = this.state;
    const winners = winnersFor(s.code);
    const asked = roundAsked(s.code);
    const winnerLabel = (w: Winner) => (w === 'A' || w === 'B' ? this.names[w] : w);
    return html`
      ${this.changingFinal
        ? html`<p class="muted">Both fighters' records change at once to match the new result.</p>`
        : nothing}
      <form class="grid" @submit=${(e: SubmitEvent) => {
        e.preventDefault();
        this.save();
      }}>
        <label class="wide">Decision
          <select @change=${(e: InputEvent) => {
            const code = (e.target as HTMLSelectElement).value as DecisionType;
            this.set({
              code,
              winner: winnerAfter(code, this.state.winner),
              fromCards: null,
              chosen: true,
            });
          }}>
            ${DECISION_TYPES.map((c) =>
              html`<option value=${c} ?selected=${c === s.code}>${c} · ${decisionLabel(c)}</option>`
            )}
          </select>
        </label>
        ${s.fromCards ? html`<p class="wide muted from-cards">${s.fromCards}</p>` : nothing}
        <fieldset class="wide winner">
          <legend>Winner</legend>
          ${winners.map((w) =>
            html`<label class="inline">
              <input
                type="radio"
                name="winner"
                .checked=${s.winner === w || winners.length === 1}
                @change=${() => this.set({ winner: w, fromCards: null, chosen: true })}
              > ${winnerLabel(w)}
            </label>`
          )}
        </fieldset>
        <label><span class="label">Round ${asked === 'optional'
          ? html`<small class="muted">(if stopped)</small>`
          : nothing}</span>
          <input
            inputmode="numeric"
            .value=${this.roundShown()}
            ?readonly=${asked === 'last'}
            @input=${(e: InputEvent) => this.set({ round: (e.target as HTMLInputElement).value })}
          >
        </label>
        <label><span class="label">Time <small class="muted">(m:ss)</small></span>
          <input
            placeholder=${asked === 'last' ? '3:00' : '2:15'}
            .value=${s.time}
            @input=${(e: InputEvent) => this.set({ time: (e.target as HTMLInputElement).value })}
          >
        </label>
        <!-- D55: a retirement is entered as a TKO at 3:00, so say so where it is entered -->
        ${s.code === 'TKO'
          ? html`<p class="wide muted">
            A corner retirement after round X is round X at 3:00, and round X is scored.
          </p>`
          : nothing}
        <fieldset class="wide judges">
          <legend>Judges' cards</legend>
          <div class="judge head">
            <span></span>
            <span>${this.names.A}</span>
            <span>${this.names.B}</span>
          </div>
          ${[0, 1, 2].map((j) =>
            html`<div class="judge">
              <span class="muted">Judge ${j + 1}</span>
              ${
              [0, 1].map((k) =>
                html`
                  <input
                    inputmode="numeric"
                    aria-label="Judge ${j + 1}, ${k === 0 ? this.names.A : this.names.B}"
                    .value=${s.judges[j * 2 + k]}
                    @input=${(e: InputEvent) => {
                      const judges = this.state.judges.slice();
                      judges[j * 2 + k] = (e.target as HTMLInputElement).value;
                      this.judged(judges);
                    }}
                  >
                `
              )
            }
            </div>`
          )}
        </fieldset>
        <button type="submit" hidden></button>
      </form>
    `;
  }

  // Typing the cards: once all six totals are in, a points decision is
  // filled in from them (fillFromCards, D41), with a line saying so. Once
  // the user picks a decision or a winner, or the bout already had one, the
  // cards fill nothing more, so a later fix to a card never undoes a choice.
  judged(judges: string[]) {
    const totals = judges.map(readJudge);
    const cards = [0, 1, 2].map((j) => ({
      a: totals[j * 2] ?? null,
      b: totals[j * 2 + 1] ?? null,
    }));
    const decided = fillFromCards(this.state.code, this.state.chosen, cards);
    if (!decided) {
      return this.set({ judges, fromCards: this.state.chosen ? null : this.state.fromCards });
    }
    const forA = cards.filter((c) => c.a! > c.b!).length;
    const forB = cards.filter((c) => c.b! > c.a!).length;
    const who = decided.winner === 'A' || decided.winner === 'B'
      ? ` for ${this.names[decided.winner]}`
      : '';
    this.set({
      judges,
      code: decided.decision_type,
      winner: decided.winner,
      fromCards: `${decided.decision_type}${who}, from the cards (${forA}–${forB}${
        3 - forA - forB > 0 ? `, ${3 - forA - forB} even` : ''
      })`,
    });
  }

  override actions() {
    return html`
      <button type="button" ?disabled=${this.state.busy} @click=${() => this.save()}>
        Finalise
      </button>
    `;
  }

  async save() {
    const s = this.state;
    const winners = winnersFor(s.code);
    const winner = winners.length === 1 ? winners[0] : s.winner;
    if (!winner) return this.set({ error: 'who won?' });
    const roundText = this.roundShown().trim();
    const round = roundText === '' ? null : Number(roundText);
    if (round !== null && !Number.isInteger(round)) {
      return this.set({ error: 'the round is a whole number' });
    }
    const totals = s.judges.map(readJudge);
    if (totals.some((t) => t === undefined)) {
      return this.set({ error: "a judge's card is a whole number of points, or empty" });
    }
    const n = totals as (number | null)[];
    const judges: Judges = [{ a: n[0], b: n[1] }, { a: n[2], b: n[3] }, { a: n[4], b: n[5] }];
    const result: Result = {
      decision_type: s.code,
      winner,
      round,
      time: s.time.trim() || null,
    };
    const saved = await this.attempt(() => this.finalise(result, judges));
    if (saved) this.done(saved);
  }
}
