/*
 * The ledger: every turtle burned on this device, and every 十方迴向 performed.
 *
 *   {
 *     v: 2,
 *     total,      lifetime turtles burned (never decreases)
 *     pending,    wishes of turtles not yet dedicated, oldest first; null = a wordless turtle
 *     rounds,     lifetime rounds dedicated
 *     records: [  one per completed rite, oldest first
 *       { id, at, rounds, count, from, to, wishes }   from/to: turtle ids; wishes: snapshot
 *     ]
 *   }
 *
 * Turtle ids are burn order, 1-based. Burns append and rites take the oldest, so the pending
 * turtles are always ids (total - pending.length + 1) … total, and each record is one run.
 *
 * Version 1 kept two keys: 'paper-turtle:burned' (count) and 'paper-turtle:wishes' (newest
 * 2000 wishes). They are read once to build version 2, and left in place untouched.
 */

export const LEDGER_KEY = 'paper-turtle:ledger';
const V1_TOTAL = 'paper-turtle:burned';
const V1_WISHES = 'paper-turtle:wishes';
const LOCK = 'paper-turtle-ledger';
export const ROUND = 100;

/** Build a v2 ledger from v1 values. Pure, for testing. */
export function migrate(v1Total, v1Wishes) {
  const wishes = Array.isArray(v1Wishes) ? v1Wishes.filter((w) => typeof w === 'string') : [];
  const total = Math.max(Number.isFinite(v1Total) ? v1Total : 0, wishes.length);
  return { v: 2, total, pending: Array(total - wishes.length).fill(null).concat(wishes), rounds: 0, records: [] };
}

/** Keep only what a ledger should hold, so a damaged entry can't break the page. Pure. */
export function sanitize(raw) {
  const pending = Array.isArray(raw?.pending) ? raw.pending.map((w) => (typeof w === 'string' ? w : null)) : [];
  const records = Array.isArray(raw?.records)
    ? raw.records.filter((r) => r && typeof r.id === 'string' && Array.isArray(r.wishes) && r.rounds > 0)
    : [];
  const total = Math.max(Number.isFinite(raw?.total) ? raw.total : 0, pending.length + records.reduce((s, r) => s + r.wishes.length, 0));
  const rounds = Math.max(Number.isFinite(raw?.rounds) ? raw.rounds : 0, records.reduce((s, r) => s + r.rounds, 0));
  return { v: 2, total, pending, rounds, records };
}

/** The current ledger, migrating v1 on first read; null when storage is unavailable. */
export function readLedger() {
  let raw;
  try {
    raw = localStorage.getItem(LEDGER_KEY);
  } catch {
    return null;
  }
  if (raw) {
    try {
      return sanitize(JSON.parse(raw));
    } catch {
      /* unreadable v2: rebuild from v1 below rather than lose the count */
    }
  }
  let total = 0;
  let wishes = [];
  try {
    total = parseInt(localStorage.getItem(V1_TOTAL), 10) || 0;
    wishes = JSON.parse(localStorage.getItem(V1_WISHES) || '[]');
  } catch {
    /* keep what we have */
  }
  return migrate(total, wishes);
}

function write(ledger) {
  localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger)); // throws on quota or blocked storage
}

/** Run fn exclusively across tabs (Web Locks), falling back to running it directly. */
function locked(fn) {
  if (navigator.locks?.request) return navigator.locks.request(LOCK, async () => fn());
  return Promise.resolve().then(fn);
}

export const summary = (l) => ({ total: l.total, rounds: l.rounds, pending: l.pending.length });

/** Add n turtles carrying this wish. Resolves to the new summary, or null if it couldn't be saved. */
export function recordBurn(wish, n) {
  return locked(() => {
    const l = readLedger();
    if (!l) return null;
    l.total += n;
    for (let i = 0; i < n; i++) l.pending.push(wish || null);
    try {
      write(l);
    } catch {
      return null;
    }
    return summary(l);
  });
}

/** Whole rounds available now. */
export const roundsAvailable = (l) => Math.floor(l.pending.length / ROUND);

/**
 * Complete a rite. Idempotent: settling the same riteId twice returns the first record.
 * Takes the oldest turtles, up to the planned rounds (fewer if another tab got there first).
 * Resolves { record, ledger } on success, { error: 'gone' | 'storage' } otherwise.
 */
export function settle(riteId, plannedRounds, now = Date.now()) {
  return locked(() => {
    const l = readLedger();
    if (!l) return { error: 'storage' };
    const done = l.records.find((r) => r.id === riteId);
    if (done) return { record: done, ledger: l, already: true };
    const rounds = Math.min(plannedRounds, roundsAvailable(l));
    if (rounds < 1) return { error: 'gone' };
    const count = rounds * ROUND;
    const from = l.total - l.pending.length + 1;
    const record = { id: riteId, at: now, rounds, count, from, to: from + count - 1, wishes: l.pending.slice(0, count) };
    l.pending = l.pending.slice(count);
    l.rounds += rounds;
    l.records.push(record);
    try {
      write(l);
    } catch {
      return { error: 'storage' };
    }
    return { record, ledger: l };
  });
}

export const newRiteId = () => (crypto.randomUUID ? crypto.randomUUID() : `rite-${Date.now()}-${Math.random().toString(36).slice(2)}`);

/* ---------- Numbers ---------- */

const DIGITS = '零一二三四五六七八九';
const UNITS = ['千', '百', '十', ''];

function under10k(n) {
  let s = '';
  let gap = false;
  let started = false;
  String(n).padStart(4, '0').split('').forEach((c, i) => {
    const d = +c;
    if (!d) {
      if (started) gap = true;
      return;
    }
    if (gap) s += '零';
    gap = false;
    s += DIGITS[d] + UNITS[i];
    started = true;
  });
  return s;
}

/** 5 → 五, 10 → 十, 12 → 十二, 20 → 二十, 100 → 一百, 101 → 一百零一, 110 → 一百一十 */
export function cnNum(n) {
  n = Math.floor(n);
  if (n <= 0) return '零';
  if (n < 10000) {
    const s = under10k(n);
    return s.startsWith('一十') ? s.slice(1) : s;
  }
  const lo = n % 10000;
  return `${cnNum(Math.floor(n / 10000))}萬${lo ? (lo < 1000 ? '零' : '') + under10k(lo) : ''}`;
}

const fmt = (n) => n.toLocaleString('en-US');

/** 累計燒化 555 隻 / 累計燒化 555 隻，迴向五輪，餘 55 隻 */
export function tallyLine({ total, rounds, pending }) {
  return rounds ? `累計燒化 ${fmt(total)} 隻，迴向${cnNum(rounds)}輪，餘 ${fmt(pending)} 隻` : `累計燒化 ${fmt(total)} 隻`;
}
