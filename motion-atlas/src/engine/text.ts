import type { EffectContext } from './types';

// ---------------------------------------------------------------------------
// Grapheme segmentation (keeps emoji / combining marks intact)
// ---------------------------------------------------------------------------

type SegmenterLike = { segment(input: string): Iterable<{ segment: string }> };
let segmenter: SegmenterLike | null = null;
try {
  const Seg = (Intl as unknown as { Segmenter?: new (l: string, o: { granularity: string }) => SegmenterLike }).Segmenter;
  if (Seg) segmenter = new Seg('zh-Hant', { granularity: 'grapheme' });
} catch {
  segmenter = null;
}

const COMBINING = /[̀-ͯ᪰-᫿⃐-⃿︀-️︠-︯‍]|\ud83c[\udffb-\udfff]/;

export function graphemes(str: string): string[] {
  if (!str) return [];
  if (segmenter) return Array.from(segmenter.segment(str), (s) => s.segment);
  // Fallback: code points, gluing combining marks / ZWJ sequences / skin tones.
  const out: string[] = [];
  const cps = Array.from(str);
  for (let i = 0; i < cps.length; i++) {
    const c = cps[i];
    if (out.length && (COMBINING.test(c) || out[out.length - 1].endsWith('‍'))) out[out.length - 1] += c;
    else out.push(c);
  }
  return out;
}

export const graphemeCount = (s: string) => graphemes(s).length;

/** Truncate to n graphemes. */
export function clampGraphemes(s: string, n: number): string {
  const g = graphemes(s);
  return g.length > n ? g.slice(0, n).join('') : s;
}

/** Remove control chars (keeps \n), normalise line breaks, limit length. */
export function sanitizeText(raw: string, maxChars: number): string {
  const cleaned = (raw ?? '')
    .replace(/\r\n?/g, '\n')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
    .replace(/\n{3,}/g, '\n\n');
  return clampGraphemes(cleaned, maxChars);
}

/** Split on ／ / or line breaks into non-empty phrases. */
export function phrases(text: string): string[] {
  const p = text.split(/[／/\n]+/).map((x) => x.trim()).filter(Boolean);
  return p.length ? p : [text.trim() || ' '];
}

/** Text with ／ turned into line breaks (for single-shot multi-line layouts). */
export function asLines(text: string): string {
  return phrases(text).join('\n');
}

export const isSpace = (g: string) => /^\s+$/.test(g);
export const isLatin = (g: string) => /^[A-Za-z0-9'’\-.,!?:;%&@#$()]+$/.test(g);

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

let measureCtx: CanvasRenderingContext2D | null = null;
function mctx(): CanvasRenderingContext2D {
  if (!measureCtx) {
    const c = document.createElement('canvas');
    c.width = c.height = 8;
    measureCtx = c.getContext('2d')!;
  }
  return measureCtx;
}

export function fontString(size: number, family: string, weight: number | string = 900, style = ''): string {
  return `${style ? style + ' ' : ''}${weight} ${size}px ${family}`;
}

const widthCache = new Map<string, number>();
/** Width of a single grapheme at 100px. */
export function glyphWidth100(g: string, family: string, weight: number | string): number {
  const key = `${weight}|${family}|${g}`;
  let w = widthCache.get(key);
  if (w === undefined) {
    const c = mctx();
    c.font = fontString(100, family, weight);
    w = c.measureText(g).width;
    if (widthCache.size > 6000) widthCache.clear();
    widthCache.set(key, w);
  }
  return w;
}

export function textWidth(str: string, size: number, family: string, weight: number | string = 900, trackingEm = 0): number {
  const g = graphemes(str);
  let w = 0;
  for (const ch of g) w += glyphWidth100(ch, family, weight);
  return (w / 100) * size + Math.max(0, g.length - 1) * trackingEm * size;
}

/** Call after fonts finish loading, so cached widths of fallback fonts are discarded. */
export function clearMeasureCache() {
  widthCache.clear();
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export interface Glyph {
  ch: string;
  /** index in the whole text (spaces included) */
  i: number;
  /** index among visible (non-space) glyphs */
  vi: number;
  line: number;
  col: number;
  /** left edge */
  x: number;
  /** line top */
  y: number;
  w: number;
  /** centre */
  cx: number;
  cy: number;
  space: boolean;
}

export interface TextLayout {
  glyphs: Glyph[];
  /** visible glyphs only (no whitespace) */
  chars: Glyph[];
  lines: { text: string; glyphs: Glyph[]; width: number; y: number; cy: number }[];
  fontSize: number;
  lineHeight: number;
  /** bounding box of the block */
  x: number;
  y: number;
  width: number;
  height: number;
  family: string;
  weight: number | string;
  tracking: number;
  /** css font shorthand */
  font: string;
}

export interface LayoutOptions {
  family?: string;
  weight?: number | string;
  /** default 0.86 * stage width */
  maxWidth?: number;
  /** default 0.62 * stage height */
  maxHeight?: number;
  /** line height multiplier, default 1.2 */
  lineHeight?: number;
  /** hard upper bound for the font size before scale (px) */
  maxSize?: number;
  /** fraction of the fitted size used at scale = 1 (default 0.85) */
  fill?: number;
  /** allow wrapping long lines (default true) */
  wrap?: boolean;
  align?: 'center' | 'left' | 'right';
  /** centre of the block, default stage centre */
  cx?: number;
  cy?: number;
  /** override tracking (em); default ctx.s.tracking */
  tracking?: number;
  /** treat ／ as a line break (default true) */
  slashBreak?: boolean;
  /** ignore scale */
  noScale?: boolean;
  /** allow scale to exceed the fitted size (content may overflow on purpose) */
  allowOverflow?: boolean;
}

interface Token {
  g: string[];
  w: number; // width at 100px, without tracking
  space: boolean;
}

function tokenize(line: string, family: string, weight: number | string): Token[] {
  const gs = graphemes(line);
  const tokens: Token[] = [];
  let cur: Token | null = null;
  for (const g of gs) {
    const w = glyphWidth100(g, family, weight);
    if (isSpace(g)) {
      cur = null;
      tokens.push({ g: [g], w, space: true });
    } else if (isLatin(g)) {
      if (cur && !cur.space) {
        cur.g.push(g);
        cur.w += w;
      } else {
        cur = { g: [g], w, space: false };
        tokens.push(cur);
      }
    } else {
      cur = null;
      tokens.push({ g: [g], w, space: false });
    }
  }
  // Kinsoku: closing punctuation never starts a line, opening punctuation never ends one.
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const prev = out[out.length - 1];
    if (prev && !prev.space && !t.space && CLOSING.test(t.g[0])) {
      prev.g.push(...t.g);
      prev.w += t.w;
    } else out.push({ ...t, g: [...t.g] });
  }
  for (let i = out.length - 2; i >= 0; i--) {
    const t = out[i];
    const next = out[i + 1];
    if (!t.space && !next.space && OPENING.test(t.g[t.g.length - 1])) {
      t.g.push(...next.g);
      t.w += next.w;
      out.splice(i + 1, 1);
    }
  }
  return out;
}

const CLOSING = /^[，。、！？；：」』）》〉】〕…‥・,.!?;:)\]}%]/;
const OPENING = /[「『（《〈【〔(\[{]$/;

function wrapTokens(tokens: Token[], maxW100: number, track100: number): string[][] {
  const lines: string[][] = [];
  let line: string[] = [];
  let w = 0;
  for (const t of tokens) {
    const tw = t.w + t.g.length * track100;
    if (line.length && w + tw > maxW100 && !t.space) {
      while (line.length && isSpace(line[line.length - 1])) line.pop();
      lines.push(line);
      line = [];
      w = 0;
    }
    if (!line.length && t.space) continue;
    // very long single token (e.g. a long latin word): split by graphemes
    if (!line.length && tw > maxW100 && t.g.length > 1) {
      for (const g of t.g) {
        const gw = (tw / t.g.length);
        if (line.length && w + gw > maxW100) {
          lines.push(line);
          line = [];
          w = 0;
        }
        line.push(g);
        w += gw;
      }
      continue;
    }
    line.push(...t.g);
    w += tw;
  }
  if (line.length) lines.push(line);
  return lines.length ? lines : [[' ']];
}

function lineWidth100(g: string[], family: string, weight: number | string, track100: number) {
  let w = 0;
  for (const ch of g) w += glyphWidth100(ch, family, weight);
  return w + Math.max(0, g.length - 1) * track100;
}

/**
 * Fit and lay out text in the stage. Handles CJK, latin words, emoji, explicit
 * line breaks, ／ breaks, wrapping, tracking and scale, and never returns a
 * block larger than maxWidth × maxHeight unless allowOverflow is set.
 */
export function layoutText(ctx: EffectContext, text: string, opts: LayoutOptions = {}): TextLayout {
  const family = opts.family ?? ctx.family;
  const weight = opts.weight ?? ctx.weight;
  const maxW = opts.maxWidth ?? ctx.width * 0.86;
  const maxH = opts.maxHeight ?? ctx.height * 0.62;
  const lh = opts.lineHeight ?? 1.2;
  const tracking = opts.tracking ?? ctx.s.tracking;
  const fill = opts.fill ?? 0.85;
  const scale = opts.noScale ? 1 : ctx.s.scale;
  const track100 = tracking * 100;
  const src = opts.slashBreak === false ? text : text.replace(/[／]/g, '\n');
  const hardLines = src.split('\n').map((l) => l.trim());
  const tokenLines = hardLines.map((l) => tokenize(l || ' ', family, weight));

  const sizeFor = (lines: string[][]) => {
    let widest = 1;
    for (const l of lines) widest = Math.max(widest, lineWidth100(l, family, weight, track100));
    const byW = (maxW / widest) * 100;
    const byH = maxH / (lines.length * lh);
    return Math.min(byW, byH, opts.maxSize ?? Infinity);
  };

  // Candidate 1: no wrapping
  let best = hardLines.map((l) => graphemes(l || ' '));
  let bestSize = sizeFor(best);
  if (opts.wrap !== false) {
    const total = tokenLines.reduce((a, t) => a + t.reduce((b, k) => b + k.w + k.g.length * track100, 0), 0);
    for (let k = 2; k <= 8; k++) {
      const target = Math.max(total / k, ...tokenLines.flat().map((t) => t.w + t.g.length * track100)) * 1.02;
      const lines = tokenLines.flatMap((t) => wrapTokens(t, target, track100));
      const s = sizeFor(lines);
      if (s > bestSize * 1.04) {
        bestSize = s;
        best = lines;
      }
    }
  }

  let fontSize = bestSize * fill * scale;
  if (!opts.allowOverflow) fontSize = Math.min(fontSize, bestSize);
  fontSize = Math.max(4, fontSize);
  const lineHeight = fontSize * lh;
  const blockH = best.length * lineHeight;
  const cx = opts.cx ?? ctx.width / 2;
  const cy = opts.cy ?? ctx.height / 2;
  const top = cy - blockH / 2;
  const glyphs: Glyph[] = [];
  const lines: TextLayout['lines'] = [];
  let blockW = 0;
  const widths = best.map((l) => (lineWidth100(l, family, weight, track100) / 100) * fontSize);
  for (const w of widths) blockW = Math.max(blockW, w);
  let idx = 0;
  let vi = 0;
  best.forEach((lg, li) => {
    const lw = widths[li];
    let x =
      opts.align === 'left' ? cx - blockW / 2 : opts.align === 'right' ? cx + blockW / 2 - lw : cx - lw / 2;
    const y = top + li * lineHeight;
    const lineGlyphs: Glyph[] = [];
    lg.forEach((ch, col) => {
      const w = (glyphWidth100(ch, family, weight) / 100) * fontSize;
      const space = isSpace(ch);
      const g: Glyph = { ch, i: idx++, vi: space ? -1 : vi, line: li, col, x, y, w, cx: x + w / 2, cy: y + lineHeight / 2, space };
      if (!space) vi++;
      glyphs.push(g);
      lineGlyphs.push(g);
      x += w + tracking * fontSize;
    });
    lines.push({ text: lg.join(''), glyphs: lineGlyphs, width: lw, y, cy: y + lineHeight / 2 });
  });
  return {
    glyphs,
    chars: glyphs.filter((g) => !g.space),
    lines,
    fontSize,
    lineHeight,
    x: cx - blockW / 2,
    y: top,
    width: blockW,
    height: blockH,
    family,
    weight,
    tracking,
    font: fontString(fontSize, family, weight),
  };
}

/** Simple single-line fit: font size so that `text` spans at most maxW / maxH. */
export function fitSize(
  text: string,
  maxW: number,
  maxH: number,
  family: string,
  weight: number | string = 900,
  trackingEm = 0,
): number {
  const w100 = Math.max(1, textWidth(text, 100, family, weight, trackingEm));
  return Math.max(4, Math.min((maxW / w100) * 100, maxH));
}
