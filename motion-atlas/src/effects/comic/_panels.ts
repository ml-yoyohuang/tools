// Comic page layout + original placeholder panel contents (shared by C06 / C11).
import { clamp, TAU } from '../../engine/helpers';
import type { Pt } from '../../engine/shapes';
import type { TextLayout } from '../../engine/text';
import { inkText, polyPath } from './_util';

export type PanelKind = 'caption' | 'tone' | 'focus' | 'sun' | 'figure' | 'burst';

export interface Panel {
  pts: Pt[];
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  cx: number;
  cy: number;
  w: number;
  h: number;
  row: number;
  kind: PanelKind;
  /** reading order index */
  order: number;
  /** per-panel seeded numbers */
  r: number[];
  layout?: TextLayout;
}

export interface PageColors {
  ink: string;
  paper: string;
  tone: string;
  accent: string;
}

/**
 * Seeded panel grid inside a page rect. Rows are split into 1–3 panels; internal
 * dividers may be slanted, but every gutter keeps the same width (offset ±g/2 from the divider line).
 */
export function makePanels(
  rand: () => number,
  x: number,
  y: number,
  w: number,
  h: number,
  gutter: number,
  opts: { rows: number; slant: number; rtl?: boolean; maxCols?: number },
): Panel[] {
  const rows = Math.max(1, opts.rows);
  const weights = Array.from({ length: rows }, () => 0.75 + rand() * 0.6);
  const wsum = weights.reduce((a, b) => a + b, 0);
  const usableH = h - gutter * (rows - 1);
  const panels: Panel[] = [];
  let top = y;
  const wideRow = Math.floor(rand() * rows);
  const maxCols = opts.maxCols ?? 3;
  for (let ri = 0; ri < rows; ri++) {
    const rh = (weights[ri] / wsum) * usableH;
    const bot = top + rh;
    let cols = ri === wideRow ? 1 : 2 + (rand() < 0.35 ? 1 : 0);
    cols = Math.min(cols, maxCols);
    if (rows === 1) cols = Math.max(2, cols);
    // divider centre lines (top x, bottom x)
    const cuts: [number, number][] = [[x - gutter / 2, x - gutter / 2]];
    let acc = 0;
    const cw = Array.from({ length: cols }, () => 0.7 + rand() * 0.6);
    const csum = cw.reduce((a, b) => a + b, 0);
    for (let ci = 1; ci < cols; ci++) {
      acc += cw[ci - 1] / csum;
      const base = x + w * acc;
      const sl = (rand() * 2 - 1) * opts.slant * rh * 0.35;
      cuts.push([base + sl, base - sl]);
    }
    cuts.push([x + w + gutter / 2, x + w + gutter / 2]);
    for (let ci = 0; ci < cols; ci++) {
      const L = cuts[ci];
      const R = cuts[ci + 1];
      // horizontal offset that keeps a perpendicular gutter of exactly g/2 per side
      const offL = (gutter / 2) * Math.hypot(1, (L[0] - L[1]) / rh);
      const offR = (gutter / 2) * Math.hypot(1, (R[0] - R[1]) / rh);
      const pts: Pt[] = [
        [L[0] + offL, top],
        [R[0] - offR, top],
        [R[1] - offR, bot],
        [L[1] + offL, bot],
      ];
      const xs = pts.map((p) => p[0]);
      const x0 = Math.min(...xs);
      const x1 = Math.max(...xs);
      panels.push({
        pts,
        x0,
        y0: top,
        x1,
        y1: bot,
        cx: (x0 + x1) / 2,
        cy: (top + bot) / 2,
        w: x1 - x0,
        h: rh,
        row: ri,
        kind: 'tone',
        order: 0,
        r: Array.from({ length: 6 }, () => rand()),
      });
    }
    top = bot + gutter;
  }
  // reading order
  const sorted = panels.slice().sort((a, b) => a.row - b.row || (opts.rtl ? b.cx - a.cx : a.cx - b.cx));
  sorted.forEach((p, i) => (p.order = i));
  // kinds: widest panel gets the caption, others cycle without neighbours repeating
  let widest = panels[0];
  for (const p of panels) if (p.w * p.h > widest.w * widest.h) widest = p;
  const pool: PanelKind[] = ['tone', 'focus', 'sun', 'figure', 'burst'];
  let prev: PanelKind = 'caption';
  let k = Math.floor(rand() * pool.length);
  for (const p of sorted) {
    if (p === widest) {
      p.kind = 'caption';
      prev = 'caption';
      continue;
    }
    let kind = pool[k++ % pool.length];
    if (kind === prev) kind = pool[k++ % pool.length];
    p.kind = kind;
    prev = kind;
  }
  return panels;
}

/** Paint one panel (paper, content, border). `t` adds a small living motion to some kinds. */
export function drawPanel(g: CanvasRenderingContext2D, p: Panel, c: PageColors, lw: number, t = 0) {
  g.save();
  g.beginPath();
  polyPath(g, p.pts);
  g.fillStyle = c.paper;
  g.fill();
  g.clip();
  const s = Math.min(p.w, p.h);
  switch (p.kind) {
    case 'tone': {
      const sp = Math.max(6, s / 11);
      const ang = p.r[0] * Math.PI;
      const dx = Math.cos(ang);
      const dy = Math.sin(ang);
      const reach = Math.hypot(p.w, p.h) / 2;
      g.fillStyle = c.tone;
      g.beginPath();
      for (let yy = p.y0 + sp / 2; yy < p.y1; yy += sp) {
        for (let xx = p.x0 + sp / 2 + ((Math.round((yy - p.y0) / sp) % 2) * sp) / 2; xx < p.x1; xx += sp) {
          const d = ((xx - p.cx) * dx + (yy - p.cy) * dy) / reach;
          const r = clamp(0.5 + d * 0.6 + Math.sin(t * 1.4 + p.r[1] * 6) * 0.08, 0, 1) * sp * 0.48;
          if (r < 0.4) continue;
          g.moveTo(xx + r, yy);
          g.arc(xx, yy, r, 0, TAU);
        }
      }
      g.fill();
      break;
    }
    case 'focus': {
      const fx = p.cx + (p.r[1] - 0.5) * p.w * 0.3;
      const fy = p.cy + (p.r[2] - 0.5) * p.h * 0.3;
      const R = Math.hypot(p.w, p.h);
      const n = 34;
      g.fillStyle = c.ink;
      g.beginPath();
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + p.r[3] + Math.sin(i * 7.3) * 0.05;
        const r0 = s * (0.22 + 0.12 * ((i * 37) % 7) / 7) + Math.sin(t * 3 + i) * s * 0.02;
        const half = R * 0.012 * (1 + ((i * 13) % 5) / 4);
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        g.moveTo(fx + ca * r0, fy + sa * r0);
        g.lineTo(fx + ca * R - sa * half, fy + sa * R + ca * half);
        g.lineTo(fx + ca * R + sa * half, fy + sa * R - ca * half);
        g.closePath();
      }
      g.fill();
      g.beginPath();
      g.arc(fx, fy, s * 0.08, 0, TAU);
      g.fillStyle = c.accent;
      g.fill();
      g.lineWidth = lw;
      g.strokeStyle = c.ink;
      g.stroke();
      break;
    }
    case 'sun': {
      const hz = p.y0 + p.h * (0.58 + p.r[1] * 0.12);
      const sx = p.x0 + p.w * (0.3 + p.r[2] * 0.4);
      g.beginPath();
      g.arc(sx, hz - s * 0.04 + Math.sin(t * 0.8) * s * 0.02, s * 0.26, 0, TAU);
      g.fillStyle = c.accent;
      g.fill();
      g.lineWidth = lw;
      g.strokeStyle = c.ink;
      g.stroke();
      g.fillStyle = c.paper;
      g.fillRect(p.x0, hz, p.w, p.h);
      g.beginPath();
      g.moveTo(p.x0, hz);
      g.lineTo(p.x1, hz);
      g.stroke();
      g.lineWidth = Math.max(1, lw * 0.6);
      g.beginPath();
      for (let i = 1; i < 6; i++) {
        const yy = hz + (p.y1 - hz) * (i / 6) ** 0.8;
        const inset = p.w * 0.1 * (6 - i) * 0.12;
        g.moveTo(p.x0 + inset, yy);
        g.lineTo(p.x1 - inset, yy);
      }
      g.stroke();
      break;
    }
    case 'figure': {
      // abstract placeholder: circle head + rounded trapezoid body, on a tone stripe
      g.fillStyle = c.tone;
      g.fillRect(p.x0, p.y0 + p.h * 0.62, p.w, p.h);
      const hr = s * 0.13;
      const fx = p.cx + (p.r[1] - 0.5) * p.w * 0.25;
      const top = p.y0 + p.h * 0.28;
      g.fillStyle = c.ink;
      g.beginPath();
      g.arc(fx, top, hr, 0, TAU);
      g.fill();
      g.beginPath();
      const bw = hr * 1.5;
      g.moveTo(fx - bw * 0.7, top + hr * 1.35);
      g.lineTo(fx + bw * 0.7, top + hr * 1.35);
      g.quadraticCurveTo(fx + bw * 1.2, top + hr * 1.5, fx + bw * 1.25, p.y1 + 2);
      g.lineTo(fx - bw * 1.25, p.y1 + 2);
      g.quadraticCurveTo(fx - bw * 1.2, top + hr * 1.5, fx - bw * 0.7, top + hr * 1.35);
      g.fill();
      break;
    }
    case 'burst': {
      const n = 12;
      const r = s * 0.36;
      const rot = p.r[1] * TAU + Math.sin(t * 2) * 0.04;
      g.beginPath();
      for (let i = 0; i < n * 2; i++) {
        const a = rot + (i / (n * 2)) * TAU;
        const rr = i % 2 ? r * (0.55 + ((i * 7) % 3) * 0.05) : r;
        const px = p.cx + Math.cos(a) * rr * (p.w > p.h ? 1.25 : 1);
        const py = p.cy + Math.sin(a) * rr;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = c.accent;
      g.fill();
      g.lineWidth = lw;
      g.lineJoin = 'round';
      g.strokeStyle = c.ink;
      g.stroke();
      g.beginPath();
      g.arc(p.cx, p.cy, r * 0.16, 0, TAU);
      g.fillStyle = c.ink;
      g.fill();
      break;
    }
    case 'caption': {
      // diagonal hatch background + text
      g.strokeStyle = c.tone;
      g.lineWidth = Math.max(1, s * 0.012);
      g.beginPath();
      const sp = Math.max(7, s / 14);
      for (let k = -p.h; k < p.w; k += sp) {
        g.moveTo(p.x0 + k, p.y1);
        g.lineTo(p.x0 + k + p.h, p.y0);
      }
      g.stroke();
      if (p.layout) inkText(g, p.layout, c.ink, c.paper, p.layout.fontSize * 0.22);
      break;
    }
  }
  g.restore();
  g.beginPath();
  polyPath(g, p.pts);
  g.lineWidth = lw;
  g.lineJoin = 'miter';
  g.strokeStyle = c.ink;
  g.stroke();
}
