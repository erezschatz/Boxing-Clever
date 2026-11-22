// The venue dialog (task venues, D117): a place's name, city, region and
// country. Opened from the event form to add a venue, with what was typed in
// the search as its name, or to fix one, which fixes it on every event held
// there. Answers the saved venue.
import { api, json, type Venue } from './api.ts';
import { html } from './component.ts';
import { DialogForm, type DialogState, FRESH } from './dialog.ts';

type Fields = { name: string; city: string; region: string; country: string };
type State = DialogState & Fields;

export class VenueForm extends DialogForm<State, Venue> {
  constructor(readonly existing: Venue | null = null, typed = '') {
    super({
      ...FRESH,
      name: existing?.name ?? typed.trim(),
      city: existing?.city ?? '',
      region: existing?.region ?? '',
      country: existing?.country ?? '',
    });
  }

  title() {
    return this.existing ? 'Edit venue' : 'New venue';
  }

  body() {
    const field = (key: keyof Fields, label: string, hint = '') =>
      html`
        <label><span class="label">${label}${hint
          ? html`
            <small class="muted">${hint}</small>
          `
          : ''}</span>
          <input
            .value=${this.state[key]}
            @input=${(e: InputEvent) =>
              this.set({ [key]: (e.target as HTMLInputElement).value } as Partial<State>)}
          >
        </label>
      `;
    return html`
      <form class="grid" @submit=${(e: SubmitEvent) => {
        e.preventDefault();
        this.save();
      }}>
        <div class="wide">${field('name', 'Venue')}</div>
        ${field('city', 'City')} ${field('region', 'Region', '(state, if any)')}
        <div class="wide">${field('country', 'Country')}</div>
        <button type="submit" hidden></button>
      </form>
    `;
  }

  override dirty(): boolean {
    const was = this.existing;
    const s = this.state;
    return was
      ? s.name !== was.name || s.city !== was.city || s.region !== (was.region ?? '') ||
        s.country !== was.country
      : [s.name, s.city, s.region, s.country].some((v) => v.trim() !== '');
  }

  override actions() {
    return html`
      <button type="button" ?disabled=${this.state.busy} @click=${() => this.save()}>Save</button>
    `;
  }

  async save() {
    const { name, city, region, country } = this.state;
    const missing = [['venue', name], ['city', city], ['country', country]]
      .filter(([, v]) => !v.trim())
      .map(([k]) => k);
    if (missing.length > 0) return this.set({ error: `say the ${missing.join(', ')}` });
    const body = { name, city, region: region.trim() || null, country };
    const saved = await this.attempt(() =>
      this.existing
        ? api<Venue>(`/venues/${this.existing.id}`, json('PATCH', body))
        : api<Venue>('/venues', json('POST', body))
    );
    if (saved) this.done(saved);
  }
}
