// Small canvas helpers shared by T14–T24 (underscore → not registered as an effect).
import { clamp } from '../../engine/helpers';
import { fontString, glyphWidth100, graphemes } from '../../engine/text';
import { ensureFonts } from '../../engine/fonts';
import type { FontKey } from '../../engine/types';

/** 0→1 progress of a segment that starts at `start` and lasts `dur`. */
export const seg = (t: number, start: number, dur: number) => clamp((t - start) / Math.max(1e-6, dur), 0, 1);

export const font = (size: number, family: string, weight: number | string, style = '') => fontString(Math.max(1, size), family, weight, style);

/** Width of a string at `size` incl. tracking (em). */
export function strWidth(s: string, size: number, family: string, weight: number | string, tracking = 0): number {
  const gs = graphemes(s);
  let w = 0;
  for (const ch of gs) w += (glyphWidth100(ch, family, weight) / 100) * size;
  return w + Math.max(0, gs.length - 1) * tracking * size;
}

/** Largest size so that `s` fits in maxW (and ≤ maxSize). */
export function fitLine(s: string, maxW: number, maxSize: number, family: string, weight: number | string, tracking = 0): number {
  const w100 = Math.max(1, strWidth(s, 100, family, weight, tracking));
  return Math.max(4, Math.min(maxSize, (maxW / w100) * 100));
}

/**
 * Draw a string grapheme by grapheme (so tracking is honoured) with
 * textBaseline 'middle'. align: where x refers to.
 */
export function drawTracked(
  g: CanvasRenderingContext2D,
  s: string,
  x: number,
  y: number,
  size: number,
  family: string,
  weight: number | string,
  tracking = 0,
  align: 'left' | 'center' | 'right' = 'left',
) {
  const gs = graphemes(s);
  const total = strWidth(s, size, family, weight, tracking);
  let cx = align === 'left' ? x : align === 'center' ? x - total / 2 : x - total;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  if (!tracking) {
    g.fillText(s, cx, y);
    return total;
  }
  for (const ch of gs) {
    g.fillText(ch, cx, y);
    cx += (glyphWidth100(ch, family, weight) / 100) * size + tracking * size;
  }
  return total;
}

/** Rounded rectangle path (does not fill). */
export function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.arcTo(x + w, y, x + w, y + rr, rr);
  g.lineTo(x + w, y + h - rr);
  g.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  g.lineTo(x + rr, y + h);
  g.arcTo(x, y + h, x, y + h - rr, rr);
  g.lineTo(x, y + rr);
  g.arcTo(x, y, x + rr, y, rr);
  g.closePath();
}

/**
 * Mask reveal: clip to the rect and run `draw(dy)` with content shifted by
 * (1 − p) · rect height (p = 0 hidden below the mask, 1 in place). Negative p hides
 * the content above the mask (used for exits).
 */
export function maskSlide(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  p: number,
  draw: (dy: number) => void,
) {
  if (p <= -1 || p === 0) return;
  p = Math.min(1, p);
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const dy = p >= 0 ? (1 - p) * h : p * h;
  draw(dy);
  g.restore();
}

/** Split a phrase into words (latin by spaces) for word-based effects. */
export function words(s: string): string[] {
  return s.split(/\s+/).filter(Boolean);
}

export { graphemes };

/**
 * Text params (quote, author, name…) are not covered by the player's font preload
 * (it only loads ctx.text). Await this in an async create() before measuring.
 */
export async function preloadFonts(ctx: { s: { font: FontKey } }, texts: string[], extra: FontKey[] = []) {
  const sample = texts.join('');
  await Promise.all([ensureFonts(sample, ctx.s.font), ...extra.map((f) => ensureFonts(sample, f))]);
}

/** Text param with fallback when empty / whitespace. */
export function textParam(ctx: { s: { params: Record<string, unknown> } }, key: string, fallback: string): string {
  const v = ctx.s.params[key];
  return typeof v === 'string' && v.trim() ? v.trim() : fallback;
}
