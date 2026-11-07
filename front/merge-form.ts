// Merging a duplicate fighter into the one it duplicates, from the fighters
// page (D28, D31; tasks/merge-asks-before-records-move.md). Pick who it
// duplicates, see what happens to the records first, approve, and be told
// what was done. Nothing moves without the approval.
import { api, type Fighter, json, type MergePreview } from './api.ts';
import { html, nothing } from './component.ts';
import { DialogForm, type DialogState, FRESH } from './dialog.ts';
import { findFighters } from './entry.ts';
import { fighterName, recordText } from './format.ts';

type Step =
  | { kind: 'pick'; query: string }
  | { kind: 'approve'; target: Fighter; preview: MergePreview }
  | { kind: 'done'; what: MergePreview };
type State = DialogState & { step: Step };

export class MergeForm extends DialogForm<State, MergePreview> {
  constructor(readonly duplicate: Fighter, readonly fighters: Fighter[]) {
    super({ ...FRESH, step: { kind: 'pick', query: '' } });
  }

  title() {
    return this.state.step.kind === 'done'
      ? 'Merged'
      : `Merge ${fighterName(this.duplicate)} into…`;
  }

  body() {
    const step = this.state.step;
    switch (step.kind) {
      case 'pick': {
        const found = findFighters(this.fighters, step.query)
          .filter((f) => f.id !== this.duplicate.id);
        return html`
          <p class="muted">
            ${fighterName(this.duplicate)} is the duplicate: their fights, aliases and rankings move
            to the fighter you pick, and they are deleted.
          </p>
          <label>The real fighter
            <input
              placeholder="Type a name"
              autocomplete="off"
              .value=${step.query}
              @input=${(e: InputEvent) =>
                this.set({ step: { kind: 'pick', query: (e.target as HTMLInputElement).value } })}
            >
          </label>
          <ul class="found">
            ${found.map((f) =>
              html`
                <li>
                  <button type="button" class="pick" ?disabled=${this.state.busy} @click=${() =>
                    this.preview(f)}>
                                  ${fighterName(f)} <span class="record">${recordText(f)}</span>
                                </button>
                </li>
              `
            )}
          </ul>
        `;
      }
      case 'approve':
        return html`
          <p>Merging <strong>${step.preview.duplicate.name}</strong> into
            <strong>${step.preview.target.name}</strong>:</p>
          ${this.summary(step.preview)}
          <p>Nothing changes until you approve.</p>
        `;
      case 'done':
        return html`
          <p><strong>${step.what.duplicate.name}</strong> is merged into
            <strong>${step.what.target.name}</strong>.</p>
          ${this.summary(step.what)}
        `;
    }
  }

  summary(p: MergePreview) {
    const moving = [
      `${p.bouts} ${p.bouts === 1 ? 'fight' : 'fights'} (${p.finalised_bouts} finalised)`,
      `${p.aliases} ${p.aliases === 1 ? 'alias' : 'aliases'}`,
      `${p.tbrb_rows} TBRB ${p.tbrb_rows === 1 ? 'ranking' : 'rankings'}`,
    ];
    return html`
      <table class="list preview">
        <tbody>
          <tr>
            <td>${p.target.name}'s record</td>
            <td class="record">${recordText(p.target.before)} → ${recordText(p.target.after)}</td>
          </tr>
          <tr>
            <td>${p.duplicate.name}'s typed-in record</td>
            <td class="record">${recordText(p.duplicate.record_dropped)} (dropped)</td>
          </tr>
          <tr>
            <td>Moving</td>
            <td>${moving.join(', ')}</td>
          </tr>
        </tbody>
      </table>
      ${p.finalised_bouts > 0
        ? html`<p class="muted">The results of the finalised fights are added to ${p.target.name}'s record.</p>`
        : nothing}
    `;
  }

  async preview(target: Fighter) {
    const preview = await this.attempt(() =>
      api<MergePreview>(`/fighters/${this.duplicate.id}/merge/${target.id}`)
    );
    if (preview) this.set({ step: { kind: 'approve', target, preview } });
  }

  async approve(target: Fighter) {
    const what = await this.attempt(() =>
      api<MergePreview>(
        `/fighters/${this.duplicate.id}/merge/${target.id}?records=add`,
        json('POST'),
      )
    );
    if (what) this.set({ step: { kind: 'done', what } });
  }

  override cancellable() {
    return this.state.step.kind !== 'done';
  }

  override actions() {
    const step = this.state.step;
    switch (step.kind) {
      case 'pick':
        return nothing;
      case 'approve':
        return html`
          <button type="button" ?disabled=${this.state.busy} @click=${() =>
            this.approve(step.target)}>Merge and add the results</button>
          <button type="button" class="quiet" @click=${() =>
            this.set({ step: { kind: 'pick', query: '' } })}>Pick another</button>
        `;
      case 'done':
        return html`<button type="button" @click=${() => this.done(step.what)}>Close</button>`;
    }
  }
}
