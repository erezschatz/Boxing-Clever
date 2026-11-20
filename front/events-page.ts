// `/`: every event, newest first, folded by year with the newest year open
// (SPEC Front end; v1's EventList). A new event opens its card. Restyled to
// docs/reference/design/Events.dc.html (task restyle-events).
import { api, type Event } from './api.ts';
import { Component, html } from './component.ts';
import { EventForm } from './event-form.ts';
import { navigate } from './router.ts';
import { dateText, dayAndMonth, watchedSince, yearOf } from './format.ts';

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

  async add() {
    const event = await new EventForm().open();
    if (event) navigate(`/events/${event.id}`);
  }

  toggle(year: string) {
    const open = new Set(this.state.open);
    if (!open.delete(year)) open.add(year);
    this.set({ open });
  }

  view() {
    const { events, open } = this.state;
    if (!events) return html`<p class="muted">Loading…</p>`;
    const since = watchedSince(events.map((e) => e.date));
    const head = html`
      <div class="ep-head">
        <div>
          <h1>Events</h1>
          ${since ? html`<p class="muted">${since}</p>` : ''}
        </div>
        <button type="button" class="ep-new" @click=${() => this.add()}>New event</button>
      </div>
    `;
    if (events.length === 0) {
      return html`
        <div class="events-page">${head}<p class="muted">No events yet.</p></div>
      `;
    }
    const years = new Map<string, Event[]>();
    for (const event of events) {
      const year = yearOf(event.date);
      years.set(year, [...(years.get(year) ?? []), event]);
    }
    return html`
      <div class="events-page">
        ${head}
        <div class="ep-years">
          ${[...years].map(([year, ofYear]) => this.year(year, ofYear, open.has(year)))}
        </div>
      </div>
    `;
  }

  // A year's row: the year, a mark per event, the count, and the chevron.
  // The marks are a picture of the count, so the screen reader is given the
  // count alone.
  year(year: string, events: Event[], isOpen: boolean) {
    const count = events.length === 1 ? '1 event' : `${events.length} events`;
    return html`
      <section>
        <h2>
          <button type="button" class="ep-year" aria-expanded=${isOpen} @click=${() =>
            this.toggle(year)}>
            <span class="ep-yr">${year}</span>
            <span class="ep-ticks" aria-hidden="true">${events.map(() =>
              html`<span></span>`
            )}</span>
            <span class="ep-count">${count}</span>
            <span class="ep-chev" aria-hidden="true"></span>
          </button>
        </h2>
        ${isOpen ? this.list(events) : ''}
      </section>
    `;
  }

  // Each event is one link to its card; the full date is its title and the
  // `time` element's, the year being in the row above.
  list(events: Event[]) {
    return html`
      <ol class="ep-events">
        ${events.map((event) => {
          const { day, month } = dayAndMonth(event.date);
          return html`
            <li>
              <a href="/events/${event.id}">
                <time datetime=${event.date} title=${dateText(event.date)}>
                  <span class="ep-day">${day}</span>
                  <span class="ep-month">${month}</span>
                </time>
                <span class="ep-where">${event.location}</span>
                <span class="ep-go" aria-hidden="true"></span>
              </a>
            </li>
          `;
        })}
      </ol>
    `;
  }
}
