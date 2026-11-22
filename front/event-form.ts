// The event dialog (task 08): a date and a venue (D117, task venues). The
// venue is found by typing any part of it, as the bout form finds a fighter:
// arrows move through the matches and Enter or a click chooses; Enter with
// no match, or "New venue", opens the venue dialog with what was typed. A
// chosen venue can be changed, or fixed for every event held there. Answers
// the saved event.
import { api, type Event, json, type Venue } from './api.ts';
import { html, nothing } from './component.ts';
import { DialogForm, type DialogState, FRESH } from './dialog.ts';
import { findVenues } from './entry.ts';
import { venueText } from './format.ts';
import { VenueForm } from './venue-form.ts';

type State = DialogState & { date: string; venue: Venue | null; query: string; pick: number };

export class EventForm extends DialogForm<State, Event> {
  venues: Venue[] = [];

  constructor(readonly existing: Event | null = null) {
    super({
      ...FRESH,
      date: existing?.date ?? new Date().toLocaleDateString('en-CA'), // today, YYYY-MM-DD
      venue: existing?.venue ?? null,
      query: '',
      pick: 0,
    });
  }

  override async load() {
    this.venues = await api<Venue[]>('/venues');
    this.render();
  }

  title() {
    return this.existing ? 'Edit event' : 'New event';
  }

  body() {
    return html`
      <form class="grid" @submit=${(e: SubmitEvent) => {
        e.preventDefault();
        this.save();
      }}>
        <label>Date
          <input
            type="date"
            required
            .value=${this.state.date}
            @input=${(e: InputEvent) => this.set({ date: (e.target as HTMLInputElement).value })}
          >
        </label>
        <div class="wide">${this.venueField()}</div>
        <button type="submit" hidden></button>
      </form>
    `;
  }

  venueField() {
    const { venue, query } = this.state;
    if (venue) {
      return html`
        <div class="field">
          <span class="label">Venue</span>
          <div class="chosen">
            <strong>${venue.name}</strong>
            <span class="record">${venueText({ ...venue, name: '' })}</span>
            <button type="button" class="quiet" @click=${() => this.set({ venue: null })}>
              change
            </button>
            <button type="button" class="quiet" @click=${() => this.editVenue(venue)}>
              edit venue
            </button>
          </div>
        </div>
      `;
    }
    const found = findVenues(this.venues, query);
    const pick = Math.min(this.state.pick, Math.max(0, found.length - 1));
    return html`
      <div class="field">
        <label>Venue
          <input
            placeholder="Type the venue, city or country"
            autocomplete="off"
            .value=${query}
            @input=${(e: InputEvent) =>
              this.set({ query: (e.target as HTMLInputElement).value, pick: 0 })}
            @keydown=${(e: KeyboardEvent) => this.searchKey(e, found, pick)}
          >
        </label>
        <ul class="found ${found.length > 0 || query.trim() ? 'listed' : ''}" role="listbox">
          ${found.map((v, i) =>
            html`
              <li>
                <button
                  type="button"
                  class="pick ${i === pick ? 'highlighted' : ''}"
                  @click=${() => this.choose(v)}
                >
                  ${v.name} <span class="record">${venueText({ ...v, name: '' })}</span>
                </button>
              </li>
            `
          )}
          <li>
            <button type="button" class="quiet" @click=${() => this.addVenue()}>
              ${query.trim() ? `New venue "${query.trim()}"` : 'New venue'}${found.length === 0 &&
                  query.trim()
                ? html`
                  <span class="muted">(Enter)</span>
                `
                : nothing}
            </button>
          </li>
        </ul>
      </div>
    `;
  }

  searchKey(e: KeyboardEvent, found: Venue[], pick: number) {
    if (e.key === 'ArrowDown' && found.length > 0) {
      e.preventDefault();
      this.set({ pick: Math.min(pick + 1, found.length - 1) });
    } else if (e.key === 'ArrowUp' && found.length > 0) {
      e.preventDefault();
      this.set({ pick: Math.max(pick - 1, 0) });
    } else if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault(); // Enter here chooses; it never saves the event
      if (found.length > 0) this.choose(found[pick]);
      else if (this.state.query.trim()) this.addVenue();
    }
  }

  choose(venue: Venue) {
    this.set({ venue, query: '', pick: 0, error: null });
  }

  async addVenue() {
    const venue = await new VenueForm(null, this.state.query).open();
    if (!venue) return;
    this.venues.push(venue);
    this.choose(venue);
  }

  async editVenue(venue: Venue) {
    const saved = await new VenueForm(venue).open();
    if (!saved) return;
    this.venues = this.venues.map((v) => (v.id === saved.id ? saved : v));
    this.choose(saved);
  }

  override dirty(): boolean {
    const was = this.existing;
    const { date, venue, query } = this.state;
    return was ? date !== was.date || venue?.id !== was.venue_id : venue !== null || !!query.trim();
  }

  override actions() {
    return html`
      <button type="button" ?disabled=${this.state.busy} @click=${() => this.save()}>Save</button>
    `;
  }

  async save() {
    const { date, venue } = this.state;
    if (!venue) return this.set({ error: 'choose the venue, or add it' });
    const body = { date, venue_id: venue.id };
    const saved = await this.attempt(() =>
      this.existing
        ? api<Event>(`/events/${this.existing.id}`, json('PATCH', body))
        : api<Event>('/events', json('POST', body))
    );
    if (saved) this.done(saved);
  }
}
