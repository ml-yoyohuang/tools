// Category-local helpers for MINIMAL effects (underscore → not registered).
import type { Pt } from '../../engine/shapes';

/** Hairline-ish stroke width that scales with the stage but never vanishes. */
export const hair = (m: number, k = 0.004, min = 1) => Math.max(min, m * k);

/** Cumulative lengths of a polyline (open). */
export function polyLengths(pts: Pt[]): { cum: number[]; total: number } {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return { cum, total: cum[cum.length - 1] };
}

/** Trace the polyline section between fractions a..b (0–1 of total length) into the current path. */
export function tracePartial(g: CanvasRenderingContext2D, pts: Pt[], a: number, b: number, lens = polyLengths(pts)) {
  if (b <= a || pts.length < 2) return;
  const { cum, total } = lens;
  const s0 = a * total;
  const s1 = b * total;
  const at = (s: number): Pt => {
    for (let i = 1; i < cum.length; i++) {
      if (s <= cum[i] || i === cum.length - 1) {
        const seg = cum[i] - cum[i - 1] || 1;
        const k = Math.min(1, Math.max(0, (s - cum[i - 1]) / seg));
        return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
      }
    }
    return pts[pts.length - 1];
  };
  const p0 = at(s0);
  g.moveTo(p0[0], p0[1]);
  for (let i = 1; i < cum.length; i++) {
    if (cum[i] > s0 && cum[i] < s1) g.lineTo(pts[i][0], pts[i][1]);
  }
  const p1 = at(s1);
  g.lineTo(p1[0], p1[1]);
}

/** Point at fraction f of a polyline. */
export function pointAt(pts: Pt[], f: number, lens = polyLengths(pts)): Pt {
  const s = Math.min(1, Math.max(0, f)) * lens.total;
  const { cum } = lens;
  for (let i = 1; i < cum.length; i++) {
    if (s <= cum[i]) {
      const seg = cum[i] - cum[i - 1] || 1;
      const k = (s - cum[i - 1]) / seg;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k];
    }
  }
  return pts[pts.length - 1];
}

export const easeSineInOut = (t: number) => -(Math.cos(Math.PI * Math.min(1, Math.max(0, t))) - 1) / 2;
export const easeExpoOut = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * Math.max(0, t)));
export const easeExpoInOut = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  if (x === 0 || x === 1) return x;
  return x < 0.5 ? 2 ** (20 * x - 10) / 2 : (2 - 2 ** (-20 * x + 10)) / 2;
};
export const easeQuadInOut = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2;
};
export const easeQuartInOut = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2;
};
export const easeQuadIn = (t: number) => Math.min(1, Math.max(0, t)) ** 2;
