// Category-local helpers for WIPE effects (underscore prefix → not registered as an effect).
import { smoothstep } from '../../engine/helpers';
import type { Direction } from '../../engine/types';

export type Pt = [number, number];

/** Unit travel vector for a direction (right / left / down / up). */
export function dirVec(dir: Direction): Pt {
  switch (dir) {
    case 'left':
      return [-1, 0];
    case 'down':
      return [0, 1];
    case 'up':
      return [0, -1];
    default:
      return [1, 0];
  }
}

/** [min, max] of p·n over the four stage corners. */
export function extent(w: number, h: number, nx: number, ny: number): [number, number] {
  const v = [0, w * nx, h * ny, w * nx + h * ny];
  return [Math.min(...v), Math.max(...v)];
}

/** Adds the half-plane { p : p·n < front } as a (large) quad subpath. */
export function halfPlane(g: CanvasRenderingContext2D, nx: number, ny: number, front: number, L: number) {
  const qx = nx * front;
  const qy = ny * front;
  const tx = -ny;
  const ty = nx;
  g.moveTo(qx + tx * L, qy + ty * L);
  g.lineTo(qx - tx * L, qy - ty * L);
  g.lineTo(qx - tx * L - nx * L, qy - ty * L - ny * L);
  g.lineTo(qx + tx * L - nx * L, qy + ty * L - ny * L);
  g.closePath();
}

/** Adds the line { p : p·n = front } as an open subpath. */
export function frontLine(g: CanvasRenderingContext2D, nx: number, ny: number, front: number, L: number) {
  const qx = nx * front;
  const qy = ny * front;
  g.moveTo(qx - ny * L, qy + nx * L);
  g.lineTo(qx + ny * L, qy - nx * L);
}

/** Adds a closed polygon subpath. */
export function poly(g: CanvasRenderingContext2D, pts: Pt[]) {
  if (!pts.length) return;
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath();
}

/**
 * Travel coordinates: v = distance travelled from the start edge, u = position across.
 * map(u, v) → stage xy.
 */
export function travel(dir: Direction, w: number, h: number) {
  const horizontal = dir === 'left' || dir === 'right';
  const len = horizontal ? w : h;
  const span = horizontal ? h : w;
  const map = (u: number, v: number): Pt => {
    if (dir === 'right') return [v, u];
    if (dir === 'left') return [w - v, u];
    if (dir === 'down') return [u, v];
    return [u, h - v];
  };
  return { horizontal, len, span, map };
}

/** 0 at the very start / end of a transition, 1 in between (for decorations such as seams). */
export const decoFade = (p: number) => smoothstep(0, 0.06, p) * (1 - smoothstep(0.94, 1, p));

/** Largest distance from (x, y) to a stage corner. */
export const farCorner = (x: number, y: number, w: number, h: number) =>
  Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y));
