import { useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from './storage';

// Tiny external stores (no per-frame React state anywhere).

function createStore<T>(initial: T) {
  let value = initial;
  const subs = new Set<() => void>();
  return {
    get: () => value,
    set(next: T) {
      value = next;
      subs.forEach((f) => f());
    },
    subscribe(f: () => void) {
      subs.add(f);
      return () => subs.delete(f);
    },
  };
}

// ---- favourites ------------------------------------------------------------

const FAV_KEY = 'kt:favorites';
const favStore = createStore<string[]>(
  (() => {
    const v = readJSON<unknown>(FAV_KEY, []);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 200) : [];
  })(),
);

export function useFavorites(): string[] {
  return useSyncExternalStore(favStore.subscribe, favStore.get);
}
export function toggleFavorite(id: string) {
  const cur = favStore.get();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  favStore.set(next);
  writeJSON(FAV_KEY, next);
}

// ---- hash route --------------------------------------------------------------

export interface Route {
  name: 'list' | 'effect' | 'snap';
  id?: string;
  query: URLSearchParams;
  /** increments on every real navigation (not on replaceQuery) */
  nav: number;
}
let navCounter = 0;

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  const [path, qs = ''] = h.split('?');
  const query = new URLSearchParams(qs);
  const parts = path.split('/').filter(Boolean);
  const nav = ++navCounter;
  if (parts[0] === 'e' && parts[1]) return { name: 'effect', id: safeDecode(parts[1]), query, nav };
  if (parts[0] === 'snap' && parts[1]) return { name: 'snap', id: safeDecode(parts[1]), query, nav };
  return { name: 'list', query, nav };
}

const routeStore = createStore<Route>(parseHash(typeof location !== 'undefined' ? location.hash : ''));
let lastHash = typeof location !== 'undefined' ? location.hash : '';
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    if (location.hash === lastHash) return;
    lastHash = location.hash;
    routeStore.set(parseHash(location.hash));
  });
}

export function useRoute(): Route {
  return useSyncExternalStore(routeStore.subscribe, routeStore.get);
}

export function navigate(hash: string) {
  if (location.hash === hash) return;
  location.hash = hash;
}

/** Update the query of the current route without a navigation / re-render. */
export function replaceQuery(path: string, q: URLSearchParams) {
  const qs = q.toString();
  const hash = `#${path}${qs ? '?' + qs : ''}`;
  if (location.hash === hash) return;
  lastHash = hash;
  history.replaceState(history.state, '', hash);
}

// ---- preferences -------------------------------------------------------------

const mq = (q: string) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : null);
const reduceMQ = mq('(prefers-reduced-motion: reduce)');

const PREF_KEY = 'kt:prefs';
interface Prefs {
  autoPreview: boolean | null; // null = follow system reduced-motion setting
}
const prefStore = createStore<Prefs>({ autoPreview: null, ...readJSON<Partial<Prefs>>(PREF_KEY, {}) });
const reduceStore = createStore<boolean>(!!reduceMQ?.matches);
reduceMQ?.addEventListener?.('change', (e) => reduceStore.set(e.matches));

export function useReducedMotion(): boolean {
  return useSyncExternalStore(reduceStore.subscribe, reduceStore.get);
}
export function usePrefs(): Prefs {
  return useSyncExternalStore(prefStore.subscribe, prefStore.get);
}
export function setAutoPreview(on: boolean) {
  const next = { ...prefStore.get(), autoPreview: on };
  prefStore.set(next);
  writeJSON(PREF_KEY, next);
}

export const isLowPower = (): boolean => {
  const small = !!mq('(max-width: 720px)')?.matches;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8;
  return small || cores <= 4;
};

export const isCoarsePointer = (): boolean => !!mq('(hover: none), (pointer: coarse)')?.matches;
