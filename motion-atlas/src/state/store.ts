import { useSyncExternalStore } from 'react';
import { readJSON, writeJSON } from './storage';

// Tiny external stores (no per-frame React state anywhere).

export function createStore<T>(initial: T) {
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
      return () => {
        subs.delete(f);
      };
    },
  };
}

// ---- favourites ------------------------------------------------------------

const FAV_KEY = 'ma:favorites';
const LEGACY_FAV_KEY = 'kt:favorites'; // previous kinetic-typography library on the same origin
const MAX_FAVS = 300;

function loadFavs(): string[] {
  const v = readJSON<unknown>(FAV_KEY, null);
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string' && x.length < 64).slice(0, MAX_FAVS);
  return [];
}
const favStore = createStore<string[]>(loadFavs());

/** Map favourites saved by the old library onto atlas ids (run once, keeps unknown ids out). */
export function migrateLegacyFavorites(map: Map<string, string>, valid: Set<string>) {
  const cur = favStore.get().filter((id) => valid.has(id) || map.has(id)).map((id) => map.get(id) ?? id);
  let changed = cur.length !== favStore.get().length;
  const migrated = readJSON<boolean>('ma:migrated', false);
  if (!migrated) {
    const old = readJSON<unknown>(LEGACY_FAV_KEY, []);
    if (Array.isArray(old))
      for (const id of old) {
        const m = typeof id === 'string' ? map.get(id) : undefined;
        if (m && !cur.includes(m)) {
          cur.push(m);
          changed = true;
        }
      }
    writeJSON('ma:migrated', true);
  }
  if (changed) {
    favStore.set([...new Set(cur)]);
    writeJSON(FAV_KEY, favStore.get());
  }
}

export function useFavorites(): string[] {
  return useSyncExternalStore(favStore.subscribe, favStore.get);
}
export function toggleFavorite(id: string) {
  const cur = favStore.get();
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(-MAX_FAVS);
  favStore.set(next);
  writeJSON(FAV_KEY, next);
}

// ---- hash route --------------------------------------------------------------

export interface Route {
  name: 'list' | 'effect';
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
  const h = hash.replace(/^#/, '').slice(0, 4000);
  const qi = h.indexOf('?');
  const path = qi >= 0 ? h.slice(0, qi) : h;
  const qs = qi >= 0 ? h.slice(qi + 1) : '';
  let query: URLSearchParams;
  try {
    query = new URLSearchParams(qs);
  } catch {
    query = new URLSearchParams();
  }
  const parts = path.split('/').filter(Boolean);
  const nav = ++navCounter;
  if (parts[0] === 'e' && parts[1]) return { name: 'effect', id: safeDecode(parts[1]).slice(0, 64), query, nav };
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
  try {
    history.replaceState(history.state, '', hash);
  } catch {
    /* some sandboxed iframes refuse replaceState */
  }
}

// ---- preferences -------------------------------------------------------------

const mq = (q: string) => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q) : null);
const reduceMQ = mq('(prefers-reduced-motion: reduce)');

const PREF_KEY = 'ma:prefs';
export type SortKey = 'number' | 'name' | 'recent';
export interface Prefs {
  /** null = follow the system reduced-motion setting */
  autoPreview: boolean | null;
  /** render live previews in cards at all */
  previews: boolean;
  theme: 'light' | 'dark' | 'system';
  sort: SortKey;
  /** safe-area overlay in the detail view */
  safeArea: boolean;
  safeOpacity: number;
}
const DEFAULT_PREFS: Prefs = { autoPreview: null, previews: true, theme: 'system', sort: 'number', safeArea: false, safeOpacity: 0.6 };

function loadPrefs(): Prefs {
  const raw = readJSON<Record<string, unknown>>(PREF_KEY, {});
  const p = { ...DEFAULT_PREFS };
  if (raw && typeof raw === 'object') {
    if (typeof raw.autoPreview === 'boolean' || raw.autoPreview === null) p.autoPreview = raw.autoPreview as boolean | null;
    if (typeof raw.previews === 'boolean') p.previews = raw.previews;
    if (raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system') p.theme = raw.theme;
    if (raw.sort === 'number' || raw.sort === 'name' || raw.sort === 'recent') p.sort = raw.sort;
    if (typeof raw.safeArea === 'boolean') p.safeArea = raw.safeArea;
    if (typeof raw.safeOpacity === 'number' && raw.safeOpacity >= 0.1 && raw.safeOpacity <= 1) p.safeOpacity = raw.safeOpacity;
  }
  return p;
}
const prefStore = createStore<Prefs>(loadPrefs());
const reduceStore = createStore<boolean>(!!reduceMQ?.matches || (typeof location !== 'undefined' && /[?&]reduced=1/.test(location.hash)));
reduceMQ?.addEventListener?.('change', (e) => reduceStore.set(e.matches));

export function useReducedMotion(): boolean {
  return useSyncExternalStore(reduceStore.subscribe, reduceStore.get);
}
export function usePrefs(): Prefs {
  return useSyncExternalStore(prefStore.subscribe, prefStore.get);
}
export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  const next = { ...prefStore.get(), [key]: value };
  prefStore.set(next);
  writeJSON(PREF_KEY, next);
}

// ---- global pause (one switch that stops every animation on the page) -------

const pauseStore = createStore<boolean>(false);
export const useGlobalPause = () => useSyncExternalStore(pauseStore.subscribe, pauseStore.get);
export const setGlobalPause = (on: boolean) => pauseStore.set(on);
export const getGlobalPause = () => pauseStore.get();

export const isLowPower = (): boolean => {
  const small = !!mq('(max-width: 720px)')?.matches;
  const cores = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 8 : 8;
  return small || cores <= 4;
};

export const isCoarsePointer = (): boolean => !!mq('(hover: none), (pointer: coarse)')?.matches;
