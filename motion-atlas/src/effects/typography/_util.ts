// Typography-local helpers (underscore → not registered as an effect).
import type { EffectContext } from '../../engine/types';
import { fontString } from '../../engine/text';

/** CSS font shorthand in the user's family / weight. */
export const fontOf = (ctx: EffectContext, size: number, weight: number | string = ctx.weight, style = '') =>
  fontString(size, ctx.family, weight, style);

/**
 * Word-aware cell layout for one-glyph-per-cell effects (flip cards, slot reels).
 * `empty[i]` marks indices that are blank in every state (word gaps). Words are
 * wrapped greedily for every candidate row width (too-long words are split) and the
 * arrangement with the largest cell wins. Rows hold glyph indices, -1 = gap cell.
 */
export function cellLayout(
  empty: boolean[],
  W: number,
  H: number,
  opts: { aspect: number; gap: number; rowGap?: number; maxRows?: number; wFrac?: number; hFrac?: number },
) {
  const { aspect, gap } = opts;
  const rowGap = opts.rowGap ?? gap;
  const maxRows = opts.maxRows ?? 6;
  const wFrac = opts.wFrac ?? 0.88;
  const hFrac = opts.hFrac ?? 0.74;
  const n = empty.length;
  const words: number[][] = [];
  let cur: number[] = [];
  for (let i = 0; i < n; i++) {
    if (empty[i]) {
      if (cur.length) words.push(cur);
      cur = [];
    } else cur.push(i);
  }
  if (cur.length) words.push(cur);
  if (!words.length) words.push([0]);
  let best = { rows: [[0]] as number[][], cols: 1, cw: 0, score: 0 };
  for (let c = 1; c <= Math.max(1, n); c++) {
    const rows: number[][] = [];
    let row: number[] = [];
    let split = false;
    for (const w0 of words) {
      if (w0.length > c) split = true;
      for (let i = 0; i < w0.length; i += c) {
        const w = w0.slice(i, i + c);
        if (row.length && row.length + 1 + w.length > c) {
          rows.push(row);
          row = [];
        }
        if (row.length) row.push(-1);
        row.push(...w);
      }
    }
    if (row.length) rows.push(row);
    if (rows.length > maxRows) continue;
    const cols = Math.max(...rows.map((r) => r.length));
    const cw = Math.min((W * wFrac) / (cols + (cols - 1) * gap), (H * hFrac) / (rows.length * aspect + (rows.length - 1) * rowGap));
    const score = cw * (split ? 0.6 : 1); // prefer keeping words whole
    if (score > best.score * 1.02) best = { rows, cols, cw, score };
  }
  if (!best.score) {
    // more rows than allowed even at full width: fall back to fixed columns
    const cols = Math.ceil(n / maxRows);
    const rows: number[][] = [];
    for (let i = 0; i < n; i += cols) rows.push(Array.from({ length: Math.min(cols, n - i) }, (_, k) => (empty[i + k] ? -1 : i + k)));
    const cw = Math.min((W * wFrac) / (cols + (cols - 1) * gap), (H * hFrac) / (rows.length * aspect + (rows.length - 1) * rowGap));
    best = { rows, cols, cw, score: cw };
  }
  return best;
}

/** Load the glyphs of `chars` for a CSS font (never rejects; gives up after `ms`). */
export async function loadGlyphs(font: string, chars: string, ms = 2500) {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    await Promise.race([document.fonts.load(font, chars), new Promise((r) => setTimeout(r, ms))]);
  } catch {
    /* fall back silently */
  }
}
