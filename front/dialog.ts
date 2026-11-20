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

  // Whether the form holds work that Cancel would lose. A dirty form asks
  // before it goes (D44): at ringside, what was typed cost thirty seconds of
  // the announcement, and Escape is also the key that dismisses a list.
  dirty(): boolean {
    return false;
  }

  // Cancel, from the button or Escape: nothing while a request is out; a
  // question first when the form is dirty.
  cancel() {
    if (this.state.busy) return;
    if (this.dirty() && !this.state.leaving) return this.set({ leaving: true } as Partial<S>);
    this.done(null);
  }

  view() {
    // The design's three bands (docs/reference/design/Dialogs*.dc.html; task
    // restyle-dialogs): the title, the body, the actions.
    return html`
      <div class="dialog-head">
        <h2>${this.title()}</h2>
      </div>
      <div class="dialog-body">
        ${this.body()}
        ${this.state.error ? html`<p class="error">${this.state.error}</p>` : nothing}
      </div>
      <div class="dialog-actions">
        ${this.state.leaving
          ? html`
            <span class="leaving">Discard what you typed?</span>
            <button type="button" class="danger" @click=${() => this.done(null)}>Discard</button>
            <button type="button" class="quiet" @click=${() =>
              this.set({ leaving: false } as Partial<S>)}>Keep editing</button>
          `
          : html`
            ${this.actions()}
            ${this.cancellable()
              ? html`<button type="button" class="quiet" @click=${() =>
                this.cancel()}>Cancel</button>`
              : nothing}
          `}
      </div>
    `;
  }

  // Runs a request with the form disabled; a refusal is shown in the form,
  // which stays open so it can be fixed.
  async attempt<X>(work: () => Promise<X>): Promise<X | undefined> {
    this.set({ busy: true, error: null, leaving: false } as Partial<S>); // a save answers the question
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
    // Escape goes through cancel(): nothing while a request is out, since
    // the answer must reach the page that asked, or it would not read again
    // what was saved; a question first when the form is dirty. Chrome lets
    // a dialog refuse Escape once per user activation; a second Escape with
    // no click between closes it through the close listener below, which
    // answers null, as cancel() would have.
    dialog.addEventListener('cancel', (event) => {
      event.preventDefault();
      this.cancel();
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

// A choice of two or three as a row of buttons, the chosen one pressed
// (Erez, 2026-11-20: buttons for two or three, a dropdown for more; task
// restyle-dialogs). A swatch marks a corner's colour. Pressing the chosen
// one does nothing, as picking the chosen option of a dropdown fires no
// change.
export type Choice<V> = { value: V; label: string; swatch?: 'red' | 'blue' };

export function choiceRow<V>(
  label: string,
  options: Choice<V>[],
  current: V,
  pick: (value: V) => void,
) {
  return html`
    <div class="seg" role="group" aria-label=${label}>
      ${options.map((o) =>
        html`
          <button type="button" aria-pressed=${o.value === current} @click=${() =>
            o.value !== current && pick(o.value)}>
            ${o.swatch ? html`<span class="swatch ${o.swatch}"></span>` : nothing}${o.label}
          </button>
        `
      )}
    </div>
  `;
}

export type DialogState = { error: string | null; busy: boolean; leaving: boolean };
export const FRESH: DialogState = { error: null, busy: false, leaving: false };

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
