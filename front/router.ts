// Real URLs (SPEC Front end, v1 had none): a route table over the history
// API. Links inside the app navigate without a reload, the back button
// works, and a deep link opens the page it names. No URLPattern: Safari got
// it late, and matching a path against `/events/:id` is ten lines.
import { html, render } from 'lit-html';

export type Params = Record<string, string>;

export type Page = {
  mount(root: HTMLElement): Promise<void> | void;
  unmount(): void;
};

export type Route = { path: string; page: (params: Params) => Page };

type Options = {
  notFound: (path: string) => Page;
  onNavigate?: (path: string) => void;
};

// `/events/:id` against `/events/12` gives `{ id: '12' }`; a path with a
// different shape gives null. A trailing slash does not matter.
export function matchRoute(pattern: string, path: string): Params | null {
  const want = pattern.split('/').filter(Boolean);
  const have = path.split('/').filter(Boolean);
  if (want.length !== have.length) return null;
  const params: Params = {};
  for (let i = 0; i < want.length; i++) {
    if (want[i].startsWith(':')) params[want[i].slice(1)] = decodeURIComponent(have[i]);
    else if (want[i] !== have[i]) return null;
  }
  return params;
}

let show: (path: string) => Promise<void> = () => Promise.resolve();

// Go to a path as a link would: a history entry, then the page.
export function navigate(path: string) {
  history.pushState(null, '', path);
  scrollTo(0, 0);
  return show(path);
}

export function startRouter(routes: Route[], root: HTMLElement, options: Options) {
  let current: Page | undefined;

  const pick = (path: string): Page => {
    for (const route of routes) {
      const params = matchRoute(route.path, path);
      if (params) return route.page(params);
    }
    return options.notFound(path);
  };

  show = async (path) => {
    current?.unmount();
    const page = pick(path);
    current = page;
    options.onNavigate?.(path);
    try {
      await page.mount(root);
    } catch (err) {
      // The page is still the current one; say why it is empty. Rendered
      // through lit-html, so the next page can render into the same root.
      if (current === page) {
        render(html`<p class="error">Could not load this page: ${messageOf(err)}</p>`, root);
      }
    }
  };

  // A plain left click on a link into this app is a navigation, not a
  // reload. Modified clicks, other origins, downloads and links to the API
  // keep the browser's behaviour.
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = (event.target as Element).closest('a[href]');
    if (!(link instanceof HTMLAnchorElement)) return;
    if (link.origin !== location.origin || link.target || link.hasAttribute('download')) return;
    if (link.pathname.startsWith('/api/')) return;
    event.preventDefault();
    navigate(link.pathname + link.search + link.hash);
  });

  addEventListener('popstate', () => show(location.pathname));
  return show(location.pathname);
}

export function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
