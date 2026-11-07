// `/`: every event, newest first, folded by year with the newest year open
// (SPEC Front end; v1's EventList). Adding an event is task 08.
import { api, type Event } from './api.ts';
import { Component, html } from './component.ts';
import { dateText, yearOf } from './format.ts';

type State = { events: Event[] | null; open: Set<string> };

export class EventsPage extends Component<State> {
  constructor() {
    super({ events: null, open: new Set() });
  }

  override async load() {
    const events = await api<Event[]>('/events');
    const newest = events[0] ? yearOf(events[0].date) : null;
    this.set({ events, open: new Set(newest ? [newest] : []) });
  }

  toggle(year: string) {
    const open = new Set(this.state.open);
    if (!open.delete(year)) open.add(year);
    this.set({ open });
  }

  view() {
    const { events, open } = this.state;
    if (!events) return html`<p class="muted">Loading…</p>`;
    if (events.length === 0) return html`<p class="muted">No events yet.</p>`;
    const years = new Map<string, Event[]>();
    for (const event of events) {
      const year = yearOf(event.date);
      years.set(year, [...(years.get(year) ?? []), event]);
    }
    return html`
      <h1>Events</h1>
      ${[...years].map(([year, ofYear]) =>
        html`
          <section class="group">
            <h2>
              <button type="button" aria-expanded=${open.has(year)} @click=${() =>
                this.toggle(year)}>
                ${year} <span class="count">${ofYear.length}</span>
              </button>
            </h2>
            ${open.has(year) ? this.table(ofYear) : ''}
          </section>
        `
      )}
    `;
  }

  table(events: Event[]) {
    return html`
      <table class="list">
        <tbody>
          ${events.map((event) =>
            html`
              <tr>
                <td class="date">${dateText(event.date)}</td>
                <td><a href="/events/${event.id}">${event.location}</a></td>
              </tr>
            `
          )}
        </tbody>
      </table>
    `;
  }
}
