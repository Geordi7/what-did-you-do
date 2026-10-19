import { createSignal, onCleanup } from 'solid-js';

/**
 * Hash routes: the calendar list at no hash, a GSD calendar's todo page at
 * `#/gsd/<id>`. Hash URLs need no server rewrite, so they work on any host and from
 * `file://` — `specs/02-architecture.md` "Routes".
 */
export type Route = { page: 'list' } | { page: 'gsd'; id: string };

export function parseRoute(hash: string): Route {
  const match = /^#\/gsd\/(.+)$/.exec(hash);
  return match ? { page: 'gsd', id: decodeURIComponent(match[1]) } : { page: 'list' };
}

export function todoPageHash(id: string): string {
  return `#/gsd/${encodeURIComponent(id)}`;
}

/** The current route, following `hashchange` until the owner is disposed. */
export function createRoute(): () => Route {
  const [route, setRoute] = createSignal(parseRoute(location.hash));
  const follow = () => setRoute(parseRoute(location.hash));
  window.addEventListener('hashchange', follow);
  onCleanup(() => window.removeEventListener('hashchange', follow));
  return route;
}

/** Open a GSD calendar's todo page; Back returns to wherever the user was. */
export function openTodoPage(id: string): void {
  location.hash = todoPageHash(id);
}
