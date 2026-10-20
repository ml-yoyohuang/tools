// Comic-category local helpers (file starts with "_" → not registered as an effect).
import { TAU, clamp } from '../../engine/helpers';
import type { TextLayout } from '../../engine/text';
import type { Pt } from '../../engine/shapes';

export const INK = '#141414';

/** Draw a layout with a thick outline: every stroke first, then every fill (no seams between glyphs). */
export function inkText(
  g: CanvasRenderingContext2D,
  layout: TextLayout,
  fill: string,
  stroke: string | null,
  lw: number,
  dx = 0,
  dy = 0,
  chars: TextLayout['chars'] = layout.chars,
) {
  g.save();
  g.font = layout.font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.miterLimit = 2;
  if (stroke && lw > 0) {
    g.strokeStyle = stroke;
    g.lineWidth = lw;
    for (const c of chars) g.strokeText(c.ch, c.cx + dx, c.cy + dy);
  }
  g.fillStyle = fill;
  for (const c of chars) g.fillText(c.ch, c.cx + dx, c.cy + dy);
  g.restore();
}

export function polyPath(g: CanvasRenderingContext2D, pts: Pt[]) {
  if (!pts.length) return;
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
}

/** Keep the part of a convex/simple polygon where nx*x + ny*y + c >= 0 (Sutherland–Hodgman, one plane). */
export function clipHalf(pts: Pt[], nx: number, ny: number, c: number): Pt[] {
  const out: Pt[] = [];
  const f = (p: Pt) => nx * p[0] + ny * p[1] + c;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const fa = f(a);
    const fb = f(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) {
      const u = fa / (fa - fb);
      out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
    }
  }
  return out;
}

/** Reflect p across the line through q with unit normal (nx, ny). */
export function reflect(p: Pt, q: Pt, nx: number, ny: number): Pt {
  const d = (p[0] - q[0]) * nx + (p[1] - q[1]) * ny;
  return [p[0] - 2 * d * nx, p[1] - 2 * d * ny];
}

/** Concave "sparkle" star: tips joined by quadratic curves pulled toward the centre. */
export function sparkPath(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, inner: number, n: number, rot: number) {
  for (let i = 0; i <= n; i++) {
    const a = rot + (i / n) * TAU;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) g.moveTo(x, y);
    else {
      const am = rot + ((i - 0.5) / n) * TAU;
      g.quadraticCurveTo(cx + Math.cos(am) * r * inner, cy + Math.sin(am) * r * inner, x, y);
    }
  }
  g.closePath();
}

/** Parallel hatch lines (angle in radians) covering a box, centred on (cx, cy). */
export function hatchLines(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  reach: number,
  angle: number,
  spacing: number,
) {
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);
  const n = Math.ceil(reach / spacing);
  g.beginPath();
  for (let i = -n; i <= n; i++) {
    const ox = -uy * i * spacing;
    const oy = ux * i * spacing;
    g.moveTo(cx + ox - ux * reach, cy + oy - uy * reach);
    g.lineTo(cx + ox + ux * reach, cy + oy + uy * reach);
  }
}

/** Points of a superellipse (|x/a|^p + |y/b|^p = 1). */
export function superEllipse(cx: number, cy: number, a: number, b: number, p: number, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU - Math.PI / 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    out.push([cx + a * Math.sign(c) * Math.abs(c) ** (2 / p), cy + b * Math.sign(s) * Math.abs(s) ** (2 / p)]);
  }
  return out;
}

/** Cumulative arc lengths of a closed polyline. */
export function arcLengths(pts: Pt[]): number[] {
  const out = [0];
  for (let i = 1; i <= pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i % pts.length];
    out.push(out[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return out;
}

/** Stroke the first `frac` (0–1) of a closed polyline. */
export function partialStroke(g: CanvasRenderingContext2D, pts: Pt[], lens: number[], frac: number) {
  const total = lens[lens.length - 1];
  const target = clamp(frac, 0, 1) * total;
  if (target <= 0) return;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= pts.length; i++) {
    const b = pts[i % pts.length];
    if (lens[i] <= target) g.lineTo(b[0], b[1]);
    else {
      const a = pts[i - 1];
      const u = (target - lens[i - 1]) / (lens[i] - lens[i - 1] || 1);
      g.lineTo(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u);
      break;
    }
  }
  if (frac >= 1) g.closePath();
  g.stroke();
}

/** Spring pop: 0 → ~1.2 overshoot → small dip → 1 over p = 0..1. */
export function popScale(p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  return 1 - Math.exp(-6 * p) * Math.cos(p * 9);
}

/** Back-out ease with a tunable overshoot. */
export function backOut(p: number, s = 2.2): number {
  const x = clamp(p, 0, 1) - 1;
  return 1 + (s + 1) * x * x * x + s * x * x;
}
