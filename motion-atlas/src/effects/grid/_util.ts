// Grid-category local helpers (underscore → not registered as an effect).
import { clamp } from '../../engine/helpers';

/** Square-cell grid that fits the stage: target cell size → cols / rows / cell / origin. */
export function fitGrid(w: number, h: number, cell: number, minCols = 3, minRows = 3) {
  const cols = Math.max(minCols, Math.round(w / cell));
  const rows = Math.max(minRows, Math.round(h / cell));
  const c = Math.min(w / cols, h / rows);
  return { cols, rows, cell: c, ox: (w - cols * c) / 2, oy: (h - rows * c) / 2 };
}

/** 0→1 progress of a segment starting at `start` lasting `dur`. */
export const prog = (t: number, start: number, dur: number) => clamp((t - start) / Math.max(1e-6, dur), 0, 1);

/** Smooth bump: 0 outside |x|>w, 1 at x=0 (cosine window). */
export const bump = (x: number, w: number) => (Math.abs(x) >= w ? 0 : 0.5 + 0.5 * Math.cos((Math.PI * x) / w));

/** Fill a convex polygon given flat coordinates. */
export function poly(g: CanvasRenderingContext2D, pts: number[]) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
}

/** Simple perspective camera: rotate around X (pitch) then Y (yaw), project onto screen. */
export function makeCamera(cx: number, cy: number, focal: number, dist: number) {
  const out = { x: 0, y: 0, z: 0, s: 1 };
  let cp = 1;
  let sp = 0;
  let cyw = 1;
  let syw = 0;
  return {
    set(pitch: number, yaw: number) {
      cp = Math.cos(pitch);
      sp = Math.sin(pitch);
      cyw = Math.cos(yaw);
      syw = Math.sin(yaw);
    },
    /** world (x right, y up, z forward/away) → screen; returns shared object */
    p(x: number, y: number, z: number) {
      // yaw around Y
      const x1 = x * cyw + z * syw;
      const z1 = -x * syw + z * cyw;
      // pitch around X
      // pitch > 0 looks down onto the y = 0 plane (far points rise on screen)
      const y2 = y * cp + z1 * sp;
      const z2 = -y * sp + z1 * cp;
      const d = Math.max(1e-3, dist + z2);
      const s = focal / d;
      out.x = cx + x1 * s;
      out.y = cy - y2 * s;
      out.z = z2;
      out.s = s;
      return out;
    },
  };
}
