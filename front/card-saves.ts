// The scorecard's saves (D35). A save replaces the whole stored card, so
// saves go one after another, and a page loads its card only after the
// saves before it are done: leaving by a link and coming straight back must
// not read the card older than the save made on the way out, and a later
// save must not be overtaken by an earlier one.
import { api, type BoutView, json } from './api.ts';

export let saves: Promise<unknown> = Promise.resolve();

export function inTurn<T>(work: () => Promise<T>): Promise<T> {
  const turn = saves.then(work);
  saves = turn.catch(() => {});
  return turn;
}

// keepalive lets a save made as the page goes outlive it.
export function putCard(id: number, body: unknown, keepalive = false) {
  return api<BoutView>(`/bouts/${id}/card`, { ...json('PUT', body), keepalive });
}
