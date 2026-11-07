// The forms of task 08 open as native modal <dialog>s (SPEC Front end, as v1
// did), over whatever page is showing, and answer with what they made:
// `await new EventForm().open()` is the saved event, or null when the
// dialog was cancelled. A form may open another (a new fighter from inside
// the bout form); the second sits over the first.
import { messageOf } from './router.ts';
import { Component, html, nothing, type TemplateResult } from './component.ts';

export abstract class DialogForm<S extends DialogState, R> extends Component<S> {
  #finish?: (result: R | null) => void;
  #dialog?: HTMLDialogElement;

  abstract title(): string;
  abstract body(): TemplateResult;

  // Whether Cancel is offered; a dialog that has done its work only closes.
  cancellable(): boolean {
    return true;
  }

  // The form's own action buttons, beside Cancel.
  actions(): TemplateResult | typeof nothing {
    return nothing;
  }

  view() {
    return html`
      <h2>${this.title()}</h2>
      ${this.body()}
      ${this.state.error ? html`<p class="error">${this.state.error}</p>` : nothing}
      <div class="dialog-actions">
        ${this.actions()}
        ${this.cancellable()
          ? html`<button type="button" class="quiet" @click=${() =>
            this.done(null)}>Cancel</button>`
          : nothing}
      </div>
    `;
  }

  // Runs a request with the form disabled; a refusal is shown in the form,
  // which stays open so it can be fixed.
  async attempt<X>(work: () => Promise<X>): Promise<X | undefined> {
    this.set({ busy: true, error: null } as Partial<S>);
    try {
      return await work();
    } catch (err) {
      this.set({ error: messageOf(err) } as Partial<S>);
      return undefined;
    } finally {
      this.set({ busy: false } as Partial<S>);
    }
  }

  done(result: R | null) {
    this.#finish?.(result);
    this.#finish = undefined;
    this.#dialog?.close();
  }

  open(): Promise<R | null> {
    const dialog = document.createElement('dialog');
    dialog.className = 'form';
    document.body.append(dialog);
    this.#dialog = dialog;
    const answer = new Promise<R | null>((resolve) => (this.#finish = resolve));
    // Escape does nothing while a request is out: the answer must reach the
    // page that asked, or it would not read again what was saved.
    dialog.addEventListener('cancel', (event) => {
      if (this.state.busy) event.preventDefault();
    });
    // The back button leaves the page the dialog belongs to; the dialog goes
    // with it rather than act on a page that is gone.
    const leave = () => dialog.close();
    addEventListener('popstate', leave);
    // Escape, done() and leaving all end here: the form goes, and anything
    // but done() answers null.
    dialog.addEventListener('close', () => {
      removeEventListener('popstate', leave);
      this.#finish?.(null);
      this.unmount();
      dialog.remove();
    });
    this.mount(dialog).catch((err) => this.set({ error: messageOf(err) } as Partial<S>));
    dialog.showModal();
    return answer;
  }
}

export type DialogState = { error: string | null; busy: boolean };
export const FRESH: DialogState = { error: null, busy: false };

// A question with one action, which runs inside the dialog so a refusal is
// shown there: `await new Confirm('Reopen?', 'It will…', 'Reopen', work).open()`.
export class Confirm<R> extends DialogForm<DialogState, R> {
  constructor(
    readonly heading: string,
    readonly text: string,
    readonly label: string,
    readonly work: () => Promise<R>,
  ) {
    super({ ...FRESH });
  }

  title() {
    return this.heading;
  }

  body() {
    return html`<p>${this.text}</p>`;
  }

  override actions() {
    return html`
      <button type="button" ?disabled=${this.state.busy} @click=${() => this.go()}>
        ${this.label}
      </button>
    `;
  }

  async go() {
    const result = await this.attempt(this.work);
    if (result !== undefined) this.done(result);
  }
}
