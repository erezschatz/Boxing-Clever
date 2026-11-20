// The bout form's belts on the line (task 08, D42): each a title of the
// bout's class with who brought it in, and a new title added on the spot.
// Its own file so the bout form stays under the size budget (CLAUDE.md);
// these are the form's own parts, over its state.
import { api, json, type Title } from './api.ts';
import type { BoutForm, Holder, Line, NewTitle } from './bout-form.ts';
import { html, nothing } from './component.ts';
import { choiceRow } from './dialog.ts';
import { plainName, titleText } from './format.ts';

// The belts on the line: each a title of this class and who brought it.
export function titlesField(form: BoutForm) {
  const s = form.state;
  // A title is fought for at its class's limit, so a contracted weight
  // offers none (D45).
  const ofClass = s.weightBy === 'contracted'
    ? []
    : form.lists.titles.filter((t) => t.weight_class_id === s.weight_class_id);
  const unused = ofClass.filter((t) => !s.titles.some((l) => l.title_id === t.id));
  // Short enough for a button: the name without the nickname.
  const name = (side: 'A' | 'B') => {
    const f = side === 'A' ? s.a : s.b;
    return f ? plainName(f) : `Fighter ${side}`;
  };
  const setLine = (i: number, line: Line) =>
    form.set({ titles: s.titles.map((l, j) => (j === i ? line : l)) });
  return html`
    <fieldset class="titles">
      <legend>Titles on the line</legend>
      ${s.titles.map((line, i) => {
        const title = form.lists.titles.find((t) => t.id === line.title_id);
        return html`
          <div class="line">
            <span>${title ? titleText(title) : `title ${line.title_id}`}</span>
            ${choiceRow<Holder>(
              `${title ? titleText(title) : 'Title'}, brought in by`,
              [
                { value: 'A', label: name('A') },
                { value: 'B', label: name('B') },
                { value: 'vacant', label: 'Vacant' },
              ],
              line.holder_side,
              (holder_side) => setLine(i, { ...line, holder_side }),
            )}
            <button type="button" class="quiet" @click=${() =>
              form.set({ titles: s.titles.filter((_, j) => j !== i) })}>remove</button>
          </div>
        `;
      })}
      <div class="line">
        ${unused.length > 0
          ? html`
            <select @change=${(e: InputEvent) => {
              const select = e.target as HTMLSelectElement;
              const id = Number(select.value);
              select.value = '';
              if (id) {
                form.set({ titles: [...s.titles, { title_id: id, holder_side: 'vacant' }] });
              }
            }}>
              <option value="">Add a title of this class…</option>
              ${unused.map((t) => html`<option value=${t.id}>${titleText(t)}</option>`)}
            </select>
          `
          : nothing}
        ${s.newTitle || s.weightBy === 'contracted' ? nothing : html`
          <button type="button" class="quiet" @click=${() =>
            form.set({ newTitle: { sanctioning_body: '', area: 'World', interim: false } })}>
            + New title
          </button>
        `}
      </div>
      ${s.newTitle && s.weightBy === 'class' ? newTitleForm(form, s.newTitle) : nothing}
    </fieldset>
  `;
}

function newTitleForm(form: BoutForm, t: NewTitle) {
  const field = (key: 'sanctioning_body' | 'area', label: string, placeholder: string) =>
    html`
      <label>${label}
        <input .value=${t[key]} placeholder=${placeholder} @input=${(e: InputEvent) =>
          form.set({ newTitle: { ...t, [key]: (e.target as HTMLInputElement).value } })}>
      </label>
    `;
  return html`
    <div class="new-title">
      ${field('sanctioning_body', 'Body', 'WBC, IBF, IBO…')}
      ${field('area', 'Area', 'World, World Silver, European…')}
      <label class="inline">
        <input
          type="checkbox"
          .checked=${t.interim}
          @change=${(e: Event) =>
            form.set({ newTitle: { ...t, interim: (e.target as HTMLInputElement).checked } })}
        > Interim
      </label>
      <p class="muted hint">
        Whether it is vacant is said per fight, by who holds it coming in, not here.
      </p>
      <button type="button" @click=${() => addTitle(form, t)}>Add title</button>
      <button type="button" class="quiet" @click=${() => form.set({ newTitle: null })}>
        Never mind
      </button>
    </div>
  `;
}

// A new belt is saved at once, for this class, and put on the line vacant.
async function addTitle(form: BoutForm, t: NewTitle) {
  const title = await form.attempt(() =>
    api<Title>('/titles', json('POST', { ...t, weight_class_id: form.state.weight_class_id }))
  );
  if (!title) return;
  form.lists.titles.push(title);
  form.set({
    newTitle: null,
    titles: [...form.state.titles, { title_id: title.id, holder_side: 'vacant' }],
  });
}
