// Shared helpers for the HALFTONE category (underscore → not registered as an effect).
import type { EffectContext } from '../../engine/types';
import { TAU } from '../../engine/helpers';

/** Grow `spacing` until a full-stage grid has at most `maxCount` cells. */
export function capSpacing(ctx: EffectContext, spacing: number, maxCount: number): number {
  const min = Math.sqrt((ctx.width * ctx.height) / Math.max(50, maxCount));
  return Math.max(spacing, min);
}

export interface DotGrid {
  n: number;
  cols: number;
  rows: number;
  spacing: number;
  /** css px centres */
  x: Float32Array;
  y: Float32Array;
  /** integer column / row */
  ci: Int16Array;
  ri: Int16Array;
}

/** Regular grid of dot centres covering the stage, centred, with `pad` extra cells beyond each edge. */
export function dotGrid(w: number, h: number, spacing: number, pad = 0, stagger = false): DotGrid {
  const cols = Math.ceil(w / spacing) + 1 + pad * 2;
  const rows = Math.ceil(h / spacing) + 1 + pad * 2;
  const ox = (w - (cols - 1) * spacing) / 2;
  const oy = (h - (rows - 1) * spacing) / 2;
  const n = cols * rows;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const ci = new Int16Array(n);
  const ri = new Int16Array(n);
  let k = 0;
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++, k++) {
      x[k] = ox + i * spacing + (stagger && j % 2 ? spacing / 2 : 0);
      y[k] = oy + j * spacing;
      ci[k] = i;
      ri[k] = j;
    }
  return { n, cols, rows, spacing, x, y, ci, ri };
}

/**
 * Batches circles of one colour and draws them as one path (one fill call per colour),
 * which is far cheaper than beginPath/fill per dot. Each batch buffers its own dots, so
 * several batches can be filled in any order.
 */
export class DotBatch {
  private buf: number[] = [];
  constructor(private g: CanvasRenderingContext2D) {}
  begin() {
    this.buf.length = 0;
  }
  dot(x: number, y: number, r: number) {
    if (r <= 0.25) return;
    this.buf.push(x, y, r);
  }
  fill(style: string) {
    const b = this.buf;
    if (!b.length) return;
    const g = this.g;
    g.beginPath();
    for (let i = 0; i < b.length; i += 3) {
      g.moveTo(b[i] + b[i + 2], b[i + 1]);
      g.arc(b[i], b[i + 1], b[i + 2], 0, TAU);
    }
    g.fillStyle = style;
    g.fill();
    b.length = 0;
  }
}

/** Alpha coverage (0–1) of an offscreen mask around (x, y), averaged over a 3×3 sub-sample of radius `r`. */
export function coverageSampler(o: { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D }) {
  const { width, height } = o.canvas;
  const data = o.g.getImageData(0, 0, width, height).data;
  const at = (x: number, y: number) => {
    const xi = x | 0;
    const yi = y | 0;
    if (xi < 0 || yi < 0 || xi >= width || yi >= height) return 0;
    return data[(yi * width + xi) * 4 + 3] / 255;
  };
  return (x: number, y: number, r: number) => {
    let s = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) s += at(x + i * r * 0.66, y + j * r * 0.66);
    return s / 9;
  };
}
