// Category-local helpers for SHAPES effects (underscore → not registered as an effect).
import { TAU } from '../../engine/helpers';
import type { Pt } from '../../engine/shapes';

export type Kind = 'circle' | 'square' | 'triangle' | 'diamond' | 'hexagon' | 'star' | 'pill';

/** Square half-size relative to the nominal radius r (keeps visual mass close to a circle of radius r). */
export const SQ = 0.86;

/**
 * Add the outline of a basic shape, centred on (0,0), to the current path.
 * r = nominal radius. Triangles are equilateral with a flat bottom (centroid at the origin).
 */
export function shapePath(g: CanvasRenderingContext2D, kind: Kind, r: number) {
  switch (kind) {
    case 'circle':
      g.moveTo(r, 0);
      g.arc(0, 0, r, 0, TAU);
      break;
    case 'square':
      g.rect(-r * SQ, -r * SQ, r * SQ * 2, r * SQ * 2);
      break;
    case 'triangle': {
      const R = r * 1.22;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 3;
        if (i === 0) g.moveTo(Math.cos(a) * R, Math.sin(a) * R);
        else g.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      }
      g.closePath();
      break;
    }
    case 'diamond':
      g.moveTo(0, -r * 1.1);
      g.lineTo(r * 0.8, 0);
      g.lineTo(0, r * 1.1);
      g.lineTo(-r * 0.8, 0);
      g.closePath();
      break;
    case 'hexagon':
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6;
        if (i === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      g.closePath();
      break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 10;
        const rr = i % 2 ? r * 0.5 : r * 1.12;
        if (i === 0) g.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.closePath();
      break;
    case 'pill': {
      const w = r * 1.3;
      const h = r * 0.62;
      g.moveTo(-w + h, -h);
      g.lineTo(w - h, -h);
      g.arc(w - h, 0, h, -Math.PI / 2, Math.PI / 2);
      g.lineTo(-w + h, h);
      g.arc(-w + h, 0, h, Math.PI / 2, (Math.PI * 3) / 2);
      g.closePath();
      break;
    }
  }
}

/** Distance from the centre to the lowest point of an upright shape (for floor contact). */
export function bottomExtent(kind: Kind, r: number): number {
  switch (kind) {
    case 'square':
      return r * SQ;
    case 'triangle':
      return r * 1.22 * 0.5;
    case 'diamond':
      return r * 1.1;
    case 'star':
      return r * 1.12 * Math.cos(Math.PI / 5);
    case 'pill':
      return r * 0.62;
    case 'hexagon':
      return r * Math.sin(Math.PI / 3);
    default:
      return r;
  }
}

/** Fill a shape at (x, y) with rotation a and non-uniform scale. */
export function drawShape(
  g: CanvasRenderingContext2D,
  kind: Kind,
  x: number,
  y: number,
  r: number,
  a: number,
  fill: string | null,
  stroke?: { color: string; width: number },
  sx = 1,
  sy = 1,
) {
  g.save();
  g.translate(x, y);
  if (a) g.rotate(a);
  if (sx !== 1 || sy !== 1) g.scale(sx, sy);
  g.beginPath();
  shapePath(g, kind, r);
  if (fill) {
    g.fillStyle = fill;
    g.fill();
  }
  if (stroke) {
    g.lineWidth = stroke.width / Math.max(0.2, Math.min(sx, sy));
    g.strokeStyle = stroke.color;
    g.lineJoin = 'round';
    g.stroke();
  }
  g.restore();
}

export function polyCentroid(pts: Pt[]): Pt {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const c = x0 * y1 - x1 * y0;
    a += c;
    cx += (x0 + x1) * c;
    cy += (y0 + y1) * c;
  }
  if (Math.abs(a) < 1e-9) return pts[0] ?? [0, 0];
  return [cx / (3 * a), cy / (3 * a)];
}

/** Seeded Fisher–Yates shuffle (uses the provided rand, call only in create). */
export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shortest signed angle difference b - a. */
export const angDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
