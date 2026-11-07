// The event dialog (task 08): a date and a place. Answers the saved event.
import { api, type Event, json } from './api.ts';
import { html } from './component.ts';
import { DialogForm, type DialogState, FRESH } from './dialog.ts';

type State = DialogState & { date: string; location: string };

export class EventForm extends DialogForm<State, Event> {
  constructor(readonly existing: Event | null = null) {
    super({
      ...FRESH,
      date: existing?.date ?? new Date().toLocaleDateString('en-CA'), // today, YYYY-MM-DD
      location: existing?.location ?? '',
    });
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
        <label>Location
          <input
            required
            .value=${this.state.location}
            @input=${(e: InputEvent) =>
              this.set({ location: (e.target as HTMLInputElement).value })}
          >
        </label>
        <button type="submit" hidden></button>
      </form>
    `;
  }

  override actions() {
    return html`
      <button type="button" ?disabled=${this.state.busy} @click=${() => this.save()}>Save</button>
    `;
  }

  async save() {
    const body = { date: this.state.date, location: this.state.location };
    const saved = await this.attempt(() =>
      this.existing
        ? api<Event>(`/events/${this.existing.id}`, json('PATCH', body))
        : api<Event>('/events', json('POST', body))
    );
    if (saved) this.done(saved);
  }
}
