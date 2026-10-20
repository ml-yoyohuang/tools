// localStorage wrapper that never throws (private mode, quota, disabled storage).
// Falls back to an in-memory copy for the current session.
const mem = new Map<string, string>();

export function readJSON<T>(key: string, fallback: T): T {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  if (raw === null) raw = mem.get(key) ?? null;
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  const raw = JSON.stringify(value);
  mem.set(key, raw);
  try {
    window.localStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string) {
  mem.delete(key);
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
