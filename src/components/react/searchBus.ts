/**
 * A one-event bus so the nav trigger (an island) can open the palette
 * (a different island) without either importing the other or sharing state.
 */
const EVENT = 'arcadia:open-search';

export function openSearch(): void {
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function onOpenSearch(fn: () => void): () => void {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
