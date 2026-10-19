import type { EffectContext } from './types';
import type { TextLayout } from './text';

export interface StageCanvas {
  canvas: HTMLCanvasElement;
  g: CanvasRenderingContext2D;
  /** css px */
  w: number;
  h: number;
  dpr: number;
  /** clear (optionally fill) in css px space */
  clear(fill?: string): void;
}

/** A canvas covering the stage, backing store scaled by ctx.dpr, drawing in css px. */
export function stageCanvas(ctx: EffectContext, parent: HTMLElement = ctx.root, dprOverride?: number): StageCanvas {
  const dpr = dprOverride ?? ctx.dpr;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(ctx.width * dpr));
  canvas.height = Math.max(1, Math.round(ctx.height * dpr));
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block' });
  parent.appendChild(canvas);
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return {
    canvas,
    g,
    w: ctx.width,
    h: ctx.height,
    dpr,
    clear(fill) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      if (fill) {
        g.fillStyle = fill;
        g.fillRect(0, 0, canvas.width, canvas.height);
      } else g.clearRect(0, 0, canvas.width, canvas.height);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
    },
  };
}

/** Offscreen canvas (not attached). */
export function offscreen(w: number, h: number): { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w));
  canvas.height = Math.max(1, Math.ceil(h));
  return { canvas, g: canvas.getContext('2d', { willReadFrequently: true })! };
}

/** Draw a layout glyph-by-glyph (respects tracking). */
export function drawLayout(
  g: CanvasRenderingContext2D,
  layout: TextLayout,
  opts: { fill?: string | CanvasGradient | CanvasPattern; stroke?: string; lineWidth?: number; dx?: number; dy?: number; scale?: number } = {},
) {
  const sc = opts.scale ?? 1;
  g.save();
  g.font = layout.font.replace(/(\d+(\.\d+)?)px/, `${layout.fontSize * sc}px`);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (opts.lineWidth) g.lineWidth = opts.lineWidth;
  g.lineJoin = 'round';
  for (const c of layout.chars) {
    const x = c.cx * sc + (opts.dx ?? 0);
    const y = c.cy * sc + (opts.dy ?? 0);
    if (opts.stroke) {
      g.strokeStyle = opts.stroke;
      g.strokeText(c.ch, x, y);
    }
    if (opts.fill) {
      g.fillStyle = opts.fill;
      g.fillText(c.ch, x, y);
    }
  }
  g.restore();
}

/** Render a layout into an offscreen mask canvas at `scale` (1 = css px). */
export function layoutMask(ctx: EffectContext, layout: TextLayout, scale = 1, color = '#fff') {
  const o = offscreen(ctx.width * scale, ctx.height * scale);
  drawLayout(o.g, layout, { fill: color, scale });
  return o;
}

export interface SamplePoint {
  x: number;
  y: number;
  /** index of the glyph the point belongs to (nearest centre) */
  gi: number;
}

/**
 * Sample filled pixels of a text layout on a grid of `step` css px.
 * Returns points in css px. `max` limits the count (evenly thinned).
 */
export function sampleLayout(ctx: EffectContext, layout: TextLayout, step: number, max = 6000): SamplePoint[] {
  const s = 1;
  const o = layoutMask(ctx, layout, s);
  const { data, width, height } = o.g.getImageData(0, 0, o.canvas.width, o.canvas.height);
  const pts: SamplePoint[] = [];
  const st = Math.max(1, step * s);
  for (let y = st / 2; y < height; y += st) {
    for (let x = st / 2; x < width; x += st) {
      const a = data[((y | 0) * width + (x | 0)) * 4 + 3];
      if (a > 128) pts.push({ x: x / s, y: y / s, gi: 0 });
    }
  }
  // assign glyph index
  for (const p of pts) {
    let best = 0;
    let bd = Infinity;
    layout.chars.forEach((c, i) => {
      const d = (c.cx - p.x) ** 2 + (c.cy - p.y) ** 2;
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    p.gi = best;
  }
  if (pts.length <= max) return pts;
  const out: SamplePoint[] = [];
  const k = pts.length / max;
  for (let i = 0; i < max; i++) out.push(pts[Math.floor(i * k)]);
  return out;
}

/** Boolean matrix of a string rendered at `rows` pixel height (used by LED-like effects). */
export function textMatrix(text: string, rows: number, family: string, weight: number | string = 900) {
  const size = rows * 0.92;
  const probe = offscreen(8, 8).g;
  probe.font = `${weight} ${size}px ${family}`;
  const w = Math.max(1, Math.ceil(probe.measureText(text).width + rows * 0.2));
  const o = offscreen(w, rows);
  o.g.font = `${weight} ${size}px ${family}`;
  o.g.textBaseline = 'middle';
  o.g.fillStyle = '#fff';
  o.g.fillText(text, rows * 0.1, rows / 2 + rows * 0.04);
  const { data } = o.g.getImageData(0, 0, w, rows);
  const cells = new Uint8Array(w * rows);
  for (let i = 0; i < w * rows; i++) cells[i] = data[i * 4 + 3] > 110 ? 1 : 0;
  return { cols: w, rows, cells };
}

/** Parse #rrggbb into [r,g,b]. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [255, 255, 255];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Mix two hex colours, returns rgb() string. */
export function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const m = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}

/** Mix two hex colours, returns #hex. */
export function mixHex(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** Relative luminance 0..1 */
export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
