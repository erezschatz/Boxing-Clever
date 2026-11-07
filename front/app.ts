// The browser entry: the route table (SPEC Front end) over the pages. Bundled
// into /app.js by server/static.ts in dev and by `deno task build` for
// deployment (D7, D33).
import { Component, html } from './component.ts';
import { EventPage } from './event-page.ts';
import { EventsPage } from './events-page.ts';
import { FightersPage } from './fighters-page.ts';
import { type Route, startRouter } from './router.ts';

class NotFoundPage extends Component<{ path: string }> {
  view() {
    return html`
      <h1>Not found</h1>
      <p class="muted">There is no page at <code>${this.state.path}</code>.</p>
      <p><a href="/">Events</a></p>
    `;
  }
}

// `/bouts/:id` (task 07) and `/fighters/:id` (task 09) join this table when
// they are built.
const routes: Route[] = [
  { path: '/', page: () => new EventsPage() },
  { path: '/events/:id', page: ({ id }) => new EventPage(Number(id)) },
  { path: '/fighters', page: () => new FightersPage() },
];

// The header's link for the section we are in is marked, so the page says
// where it is without each page repeating the navigation. `/` and
// `/events/...` are the Events section; `/fighters/...` is Fighters.
function markNavigation(path: string) {
  const first = path.split('/').filter(Boolean)[0] ?? '';
  const section = first === '' || first === 'events' ? '/' : '/' + first;
  for (const link of document.querySelectorAll<HTMLAnchorElement>('header nav a')) {
    link.toggleAttribute('aria-current', link.pathname === section);
  }
}

startRouter(routes, document.getElementById('app')!, {
  notFound: (path) => new NotFoundPage({ path }),
  onNavigate: markNavigation,
});
