// Geometry helpers shared by shape / split / wipe / comic effects (canvas 2D).
import { TAU } from './helpers';

export type Pt = [number, number];

export function regularPoly(cx: number, cy: number, r: number, n: number, rot = -Math.PI / 2): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

export function starPts(cx: number, cy: number, r: number, inner: number, n: number, rot = -Math.PI / 2): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rot + (i / (n * 2)) * TAU;
    const rr = i % 2 ? r * inner : r;
    out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  return out;
}

export function pathPts(g: CanvasRenderingContext2D, pts: Pt[], close = true) {
  if (!pts.length) return;
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  if (close) g.closePath();
}

export function fillPts(g: CanvasRenderingContext2D, pts: Pt[], fill: string) {
  g.beginPath();
  pathPts(g, pts);
  g.fillStyle = fill;
  g.fill();
}

/** Resample a closed polygon to exactly n points evenly spaced along its perimeter. */
export function resample(pts: Pt[], n: number): Pt[] {
  const segs: number[] = [];
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push(d);
    total += d;
  }
  const out: Pt[] = [];
  let si = 0;
  let acc = 0;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (si < segs.length - 1 && acc + segs[si] < target) acc += segs[si++];
    const a = pts[si];
    const b = pts[(si + 1) % pts.length];
    const u = segs[si] > 0 ? (target - acc) / segs[si] : 0;
    out.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]);
  }
  return out;
}

/** Rotate a point list so index 0 is the point closest to angle `a` around (cx, cy) — aligns morph targets. */
export function alignStart(pts: Pt[], cx: number, cy: number, a = -Math.PI / 2): Pt[] {
  let best = 0;
  let bd = Infinity;
  pts.forEach((p, i) => {
    const pa = Math.atan2(p[1] - cy, p[0] - cx);
    const d = Math.abs(Math.atan2(Math.sin(pa - a), Math.cos(pa - a)));
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return pts.slice(best).concat(pts.slice(0, best));
}

export function lerpPts(a: Pt[], b: Pt[], t: number): Pt[] {
  return a.map((p, i) => [p[0] + (b[i][0] - p[0]) * t, p[1] + (b[i][1] - p[1]) * t]);
}

export function circlePts(cx: number, cy: number, r: number, n: number, rot = -Math.PI / 2): Pt[] {
  return regularPoly(cx, cy, r, n, rot);
}

export function roundRectPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}
