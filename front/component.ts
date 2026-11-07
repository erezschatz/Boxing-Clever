// The base every page is built on (SPEC Front end, D6): a store to observe,
// a view to render into a root, and a re-render whenever the store changes.
// lit-html does the templating; this file is the whole "framework".
import { html, nothing, render, type TemplateResult } from 'lit-html';
import { createRef, ref } from 'lit-html/directives/ref.js';

export { createRef, html, nothing, ref };
export type { TemplateResult };

// A value with listeners. A page owns one; a dialog that edits the same
// thing (task 08) is handed the page's and both re-render on a change.
export class Store<T> {
  #listeners = new Set<() => void>();
  constructor(public value: T) {}

  set(patch: Partial<T>) {
    this.value = { ...this.value, ...patch };
    for (const listener of this.#listeners) listener();
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}

export abstract class Component<T> {
  readonly store: Store<T>;
  #root?: HTMLElement;
  #unsubscribe?: () => void;

  constructor(initial: T) {
    this.store = new Store(initial);
  }

  get state(): T {
    return this.store.value;
  }

  set(patch: Partial<T>) {
    this.store.set(patch);
  }

  abstract view(): TemplateResult;

  // Where a page fetches what it shows. The router awaits it after the first
  // render, so the page can say "loading" and then fill in.
  load(): Promise<void> | void {}

  async mount(root: HTMLElement) {
    this.#root = root;
    this.#unsubscribe = this.store.subscribe(() => this.render());
    this.render();
    await this.load();
  }

  unmount() {
    this.#unsubscribe?.();
    this.#unsubscribe = this.#root = undefined;
  }

  render() {
    if (this.#root) render(this.view(), this.#root);
  }
}
