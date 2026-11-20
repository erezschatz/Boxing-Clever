// Deleting a bout from the event page, never by accident (D23, D31;
// tasks/guarded-bout-delete.md). A draft asks once. A finalised fight asks
// "are you sure?", then shows what both records will become and offers
// delete and reset the records, delete and keep them, or cancel, back to
// the fight. Afterwards it says what was done. The event always stays.
import { api, ApiError, type BoutView, type DeleteDone, type DeletePreview, json } from './api.ts';
import { html, nothing } from './component.ts';
import { DialogForm, type DialogState, FRESH } from './dialog.ts';
import { recordText } from './format.ts';

type Step =
  | { kind: 'ask' }
  | { kind: 'choose'; preview: DeletePreview }
  | { kind: 'done'; what: DeleteDone };
type State = DialogState & { step: Step };

export class BoutDelete extends DialogForm<State, true> {
  constructor(readonly bout: BoutView, readonly names: string) {
    super({ ...FRESH, step: { kind: 'ask' } });
  }

  get finalised(): boolean {
    return this.bout.is_draft === 0;
  }

  title() {
    return this.state.step.kind === 'done' ? 'Deleted' : 'Delete bout';
  }

  body() {
    const step = this.state.step;
    switch (step.kind) {
      case 'ask':
        return this.finalised
          ? html`<p><strong>This is a finalised fight</strong> (${this.names}). Are you sure?</p>`
          : html`<p>Delete ${this.names}? Its card goes with it.</p>`;
      case 'choose':
        return html`
          <p>What should happen to the fighters' records?</p>
          ${this.recordsTable(
            [step.preview.a, step.preview.b].map((s) => ({
              name: s.name,
              before: recordText(s.before),
              after: recordText(s.after_reverse),
            })),
            'Now',
            'If reset',
          )}
          ${step.preview.reverse_possible ? nothing : html`
            <p class="error">
              A record was corrected by hand and no longer holds this result, so it cannot be
              reset; the fight can only be deleted with the records kept.
            </p>
          `}
        `;
      case 'done':
        return html`
          <p>The bout is deleted and the records were ${step.what.records === 'reverse'
            ? 'reset'
            : 'kept'}.</p>
          ${this.recordsTable(
            [step.what.a, step.what.b].map((s) => ({
              name: s.name,
              before: recordText(s.before),
              after: recordText(s.after),
            })),
            'Before',
            'Now',
          )}
        `;
    }
  }

  recordsTable(
    rows: { name: string; before: string; after: string }[],
    beforeLabel: string,
    afterLabel: string,
  ) {
    return html`
      <table class="list preview">
        <thead>
          <tr>
            <th></th>
            <th>${beforeLabel}</th>
            <th>${afterLabel}</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) =>
            html`
              <tr>
                <td>${r.name}</td>
                <td class="record">${r.before}</td>
                <td class="record">${r.after}</td>
              </tr>
            `
          )}
        </tbody>
      </table>
    `;
  }

  override cancellable() {
    return this.state.step.kind !== 'done';
  }

  override actions() {
    const step = this.state.step;
    const busy = this.state.busy;
    switch (step.kind) {
      case 'ask':
        return html`
          <button type="button" class="danger" ?disabled=${busy} @click=${() => this.first()}>
            ${this.finalised ? 'Yes, go on' : 'Delete'}
          </button>
        `;
      case 'choose':
        return html`
          <button
            type="button"
            class="danger strong"
            ?disabled=${busy || !step.preview.reverse_possible}
            @click=${() => this.choose('reverse')}
          >Delete and reset the records</button>
          <button type="button" class="danger" ?disabled=${busy}
            @click=${() => this.choose('keep')}>Delete and keep the records</button>
        `;
      case 'done':
        return html`<button type="button" @click=${() => this.done(true)}>Close</button>`;
    }
  }

  // A draft goes at once (204). A finalised bout answers 409 with what each
  // choice would do, which is the second dialog.
  async first() {
    const path = `/bouts/${this.bout.id}`;
    if (!this.finalised) {
      const gone = await this.attempt(() => api(path, json('DELETE')).then(() => true));
      if (gone) this.done(true);
      return;
    }
    const preview = await this.attempt(async () => {
      try {
        await api(path, json('DELETE'));
        throw new Error('the bout was deleted without asking about the records');
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          return (err.body as { preview: DeletePreview }).preview;
        }
        throw err;
      }
    });
    if (preview) this.set({ step: { kind: 'choose', preview } });
  }

  async choose(records: 'reverse' | 'keep') {
    const what = await this.attempt(() =>
      api<DeleteDone>(`/bouts/${this.bout.id}?records=${records}`, json('DELETE'))
    );
    if (what) this.set({ step: { kind: 'done', what } });
  }
}
