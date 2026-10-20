// Category-local helpers for SPLIT effects (underscore → not registered as an effect).
// A split always moves *pieces of the old scene*: each piece is a polygon of a scene
// canvas, drawn under a transform so the clip path and the image move together.
import { clamp } from '../../engine/helpers';

export type Pts = number[]; // flat [x0, y0, x1, y1, ...] in css px

/** local 0–1 progress of a staggered sub-animation */
export const local = (p: number, delay: number, span: number) => clamp((p - delay) / Math.max(1e-6, span), 0, 1);

/** sin bump 0→1→0 */
export const bump = (u: number) => Math.sin(Math.PI * clamp(u, 0, 1));

export function polyPath(g: CanvasRenderingContext2D, pts: Pts) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
}

export function centroid(pts: Pts): [number, number] {
  let x = 0;
  let y = 0;
  const n = pts.length / 2;
  for (let i = 0; i < pts.length; i += 2) {
    x += pts[i];
    y += pts[i + 1];
  }
  return [x / n, y / n];
}

export interface PieceXf {
  /** translation */
  tx?: number;
  ty?: number;
  /** rotation (rad) around pivot */
  rot?: number;
  /** uniform / per-axis scale around pivot (axes follow the rotation) */
  sx?: number;
  sy?: number;
  /** pivot (defaults to polygon centroid) */
  px?: number;
  py?: number;
}

/** Apply a piece transform to the context (call inside save/restore). */
export function applyXf(g: CanvasRenderingContext2D, pts: Pts, xf: PieceXf) {
  let px = xf.px;
  let py = xf.py;
  if (px === undefined || py === undefined) [px, py] = centroid(pts);
  g.translate(px + (xf.tx ?? 0), py + (xf.ty ?? 0));
  if (xf.rot) g.rotate(xf.rot);
  if (xf.sx !== undefined || xf.sy !== undefined) g.scale(xf.sx ?? 1, xf.sy ?? xf.sx ?? 1);
  g.translate(-px, -py);
}

/**
 * Draw polygon `pts` of `img` (a full-stage scene canvas) moved by `xf`.
 * Optional hard (unblurred) drop shadow and edge stroke for the split line.
 */
export function drawPiece(
  g: CanvasRenderingContext2D,
  img: CanvasImageSource,
  w: number,
  h: number,
  pts: Pts,
  xf: PieceXf,
  opt: { shadow?: number; shadowAlpha?: number; edge?: string; edgeWidth?: number; shade?: number } = {},
) {
  if (opt.shadow) {
    g.save();
    g.translate(opt.shadow * 0.6, opt.shadow);
    applyXf(g, pts, xf);
    polyPath(g, pts);
    g.fillStyle = `rgba(0,0,0,${opt.shadowAlpha ?? 0.28})`;
    g.fill();
    g.restore();
  }
  g.save();
  applyXf(g, pts, xf);
  polyPath(g, pts);
  g.save();
  g.clip();
  // only blit the polygon's bounding box (cheaper than the full stage)
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]);
    x1 = Math.max(x1, pts[i]);
    y0 = Math.min(y0, pts[i + 1]);
    y1 = Math.max(y1, pts[i + 1]);
  }
  x0 = clamp(Math.floor(x0) - 1, 0, w);
  y0 = clamp(Math.floor(y0) - 1, 0, h);
  x1 = clamp(Math.ceil(x1) + 1, 0, w);
  y1 = clamp(Math.ceil(y1) + 1, 0, h);
  if (x1 > x0 && y1 > y0) blit(g, img, w, h, x0, y0, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  if (opt.shade) {
    g.fillStyle = `rgba(0,0,0,${opt.shade})`;
    g.fillRect(x0, y0, x1 - x0, y1 - y0);
  }
  g.restore();
  if (opt.edge) {
    g.strokeStyle = opt.edge;
    g.lineWidth = opt.edgeWidth ?? 2;
    g.lineJoin = 'round';
    g.stroke();
  }
  g.restore();
}

/** drawImage with the source rectangle given in css px of a full-stage scene canvas. */
export function blit(
  g: CanvasRenderingContext2D,
  img: CanvasImageSource,
  w: number,
  h: number,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const cw = (img as HTMLCanvasElement).width;
  const ch = (img as HTMLCanvasElement).height;
  const kx = cw / w;
  const ky = ch / h;
  if (sw <= 0 || sh <= 0 || Math.abs(dw) < 0.01 || Math.abs(dh) < 0.01) return;
  g.drawImage(img, sx * kx, sy * ky, sw * kx, sh * ky, dx, dy, dw, dh);
}

/** Draw a whole scene scaled by `s` around (cx, cy). */
export function drawScaled(g: CanvasRenderingContext2D, img: CanvasImageSource, w: number, h: number, s: number, cx = w / 2, cy = h / 2) {
  g.drawImage(img, cx - cx * s, cy - cy * s, w * s, h * s);
}

/** Stroke an open polyline. */
export function line(g: CanvasRenderingContext2D, pts: Pts, color: string, width: number) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.stroke();
}

/** Shared copy for every split's text hint. */
export const AB_HINT = '「／」前為 A 場景文字，後為 B 場景文字。';
