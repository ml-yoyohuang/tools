import { layoutMask, rgba, stageCanvas } from '../../engine/canvas';
import { clamp, ease, num, PALETTE, TAU } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// The text bounding box is cut by a jittered triangle grid; only triangles that
// cover glyph pixels are kept. Each shard draws the pre-rendered text image clipped
// to its own triangle, transformed by translate/rotate/flip around its centroid.
// Every transform term is multiplied by (1 − eased progress), so at progress 1 the
// transform is the identity and the reassembled text is pixel-exact. Edge glints
// and tint exist only in flight. Exit: shards scatter outward again, then repeat.

interface Shard {
  pts: [number, number][];
  cx: number;
  cy: number;
  bx: number;
  by: number;
  bw: number;
  bh: number;
  sx: number;
  sy: number;
  rot: number;
  flip: number;
  delay: number;
  ex: number;
  ey: number;
  erot: number;
}

const impl: EffectImpl = {
  id: 'shard-assemble',
  defaults: { ...PALETTE.pink },
  loopable: true,
  posterTime: 1.25,
  maxChars: 30,
  params: [
    { key: 'size', label: '碎片大小', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1, unit: '×' },
    { key: 'spin', label: '旋轉圈數', type: 'range', min: 0, max: 3, step: 0.1, default: 1.2 },
    { key: 'hold', label: '完整停留', type: 'range', min: 0.5, max: 4, step: 0.1, default: 1.8, unit: 's' },
  ],
  create(ctx): EffectRuntime {
    const sc = stageCanvas(ctx);
    const { g, dpr } = sc;
    const W = ctx.width;
    const H = ctx.height;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.56, maxWidth: W * 0.84 });
    const fs = L.fontSize;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const img = layoutMask(ctx, L, dpr, fg);
    const probe = layoutMask(ctx, L, 1, '#fff');
    const pd = probe.g.getImageData(0, 0, probe.canvas.width, probe.canvas.height).data;
    const PW = probe.canvas.width;
    const PH = probe.canvas.height;
    const k = clamp(ctx.s.intensity, 0.1, 2);
    const spin = num(ctx, 'spin', 1.2) * k;
    const hold = num(ctx, 'hold', 1.8);

    // --- triangulate the text box -------------------------------------------
    const pad = fs * 0.12;
    const x0 = L.x - pad;
    const y0 = L.y + (L.lineHeight - fs) / 2 - pad;
    const bw = L.width + pad * 2;
    const bh = L.height - (L.lineHeight - fs) + pad * 2;
    let cell = clamp(fs * 0.26 * num(ctx, 'size', 1), 7, 120) / Math.sqrt(Math.max(0.35, ctx.q));
    const est = (bw / cell) * (bh / cell) * 2;
    if (est > 1400) cell *= Math.sqrt(est / 1400);
    const cols = Math.max(2, Math.round(bw / cell));
    const rows = Math.max(1, Math.round(bh / cell));
    const cw = bw / cols;
    const ch = bh / rows;
    const vtx = (i: number, j: number): [number, number] => {
      const edge = i === 0 || j === 0 || i === cols || j === rows;
      const jx = edge ? 0 : (hash2(i, j, ctx.seed) - 0.5) * cw * 0.7;
      const jy = edge ? 0 : (hash2(i + 91, j + 17, ctx.seed) - 0.5) * ch * 0.7;
      return [x0 + i * cw + jx, y0 + j * ch + jy];
    };
    const covers = (pts: [number, number][]) => {
      const minX = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[0]))));
      const maxX = Math.min(PW - 1, Math.ceil(Math.max(...pts.map((p) => p[0]))));
      const minY = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1]))));
      const maxY = Math.min(PH - 1, Math.ceil(Math.max(...pts.map((p) => p[1]))));
      const [a, b, c] = pts;
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
      const st = Math.max(1, Math.floor(Math.min(cw, ch) / 6));
      for (let y = minY; y <= maxY; y += st)
        for (let x = minX; x <= maxX; x += st) {
          if (pd[(y * PW + x) * 4 + 3] < 60) continue;
          // barycentric inside test (inflated a bit so anti-aliased edges are kept)
          const w0 = ((b[0] - x) * (c[1] - y) - (b[1] - y) * (c[0] - x)) / area;
          const w1 = ((c[0] - x) * (a[1] - y) - (c[1] - y) * (a[0] - x)) / area;
          const w2 = 1 - w0 - w1;
          if (w0 > -0.05 && w1 > -0.05 && w2 > -0.05) return true;
        }
      return false;
    };
    const tcx = L.x + L.width / 2;
    const tcy = L.y + L.height / 2;
    const far = Math.hypot(W, H) * 0.62;
    const shards: Shard[] = [];
    let idx = 0;
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = vtx(i, j);
        const b = vtx(i + 1, j);
        const c = vtx(i + 1, j + 1);
        const d = vtx(i, j + 1);
        const tris: [number, number][][] = (i + j) % 2 ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]];
        for (const pts of tris) {
          idx++;
          if (!covers(pts)) continue;
          const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
          const cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
          const r1 = hash2(idx, 1, ctx.seed);
          const r2 = hash2(idx, 2, ctx.seed);
          const r3 = hash2(idx, 3, ctx.seed);
          let ang = Math.atan2(cy - tcy, cx - tcx);
          if (Math.hypot(cx - tcx, cy - tcy) < fs * 0.2) ang = r1 * TAU;
          ang += (r2 - 0.5) * 1.1;
          const dist = far * (0.85 + r3 * 0.5);
          const minX = Math.min(...pts.map((p) => p[0])) - 1;
          const minY = Math.min(...pts.map((p) => p[1])) - 1;
          const maxX = Math.max(...pts.map((p) => p[0])) + 1;
          const maxY = Math.max(...pts.map((p) => p[1])) + 1;
          const nd = Math.hypot(cx - tcx, cy - tcy) / Math.max(1, Math.hypot(L.width, L.height) / 2);
          shards.push({
            pts,
            cx,
            cy,
            bx: minX,
            by: minY,
            bw: maxX - minX,
            bh: maxY - minY,
            sx: Math.cos(ang) * dist,
            sy: Math.sin(ang) * dist,
            rot: (r1 - 0.5) * TAU * spin + (r1 > 0.5 ? 1 : -1) * Math.PI * 0.5 * spin,
            flip: Math.round((r2 - 0.5) * 4 * spin) * Math.PI + (r3 - 0.5) * 1.2,
            // outer shards land last: the word "closes" toward its edges
            delay: nd * 0.55 + hash2(idx, 4, ctx.seed) * 0.4,
            ex: Math.cos(ang + 0.4) * dist * 0.7,
            ey: Math.sin(ang + 0.4) * dist * 0.7 + H * 0.15,
            erot: (r3 - 0.5) * TAU,
          });
        }
      }

    const lead = 0.2;
    const fly = 1.05;
    const maxDelay = 0.95;
    const landed = lead + maxDelay + fly;
    const exitStart = landed + hold;
    const exitD = 0.75;
    const cycle = exitStart + 0.35 + exitD + 0.3;
    const posE = ease('expo.out');
    const rotE = ease('power3.out');
    const exE = ease('power2.in');
    const S = img.canvas;

    const drawShard = (s: Shard, ox: number, oy: number, rot: number, fx: number, alpha: number, glint: number) => {
      g.save();
      g.globalAlpha = alpha;
      g.translate(s.cx + ox, s.cy + oy);
      g.rotate(rot);
      g.scale(fx, 1);
      g.translate(-s.cx, -s.cy);
      g.beginPath();
      g.moveTo(s.pts[0][0], s.pts[0][1]);
      g.lineTo(s.pts[1][0], s.pts[1][1]);
      g.lineTo(s.pts[2][0], s.pts[2][1]);
      g.closePath();
      if (glint > 0.001) {
        // glassy body: tint + shade from the flip angle
        g.fillStyle = rgba(acc, 0.22 * glint);
        g.fill();
      }
      g.save();
      g.clip();
      g.drawImage(S, s.bx * dpr, s.by * dpr, s.bw * dpr, s.bh * dpr, s.bx, s.by, s.bw, s.bh);
      g.restore();
      if (glint > 0.001) {
        const shade = (1 - Math.abs(fx)) * 0.5;
        if (shade > 0.01) {
          g.fillStyle = `rgba(0,0,0,${shade * glint})`;
          g.fill();
        }
        g.strokeStyle = rgba(acc, 0.9 * glint);
        g.lineWidth = 1;
        g.stroke();
      }
      g.restore();
    };

    return {
      canvas: sc.canvas,
      settle: landed + 0.5,
      render(time) {
        const t = time % cycle;
        sc.clear(bg);
        if (t >= landed && t < exitStart) {
          // assembled: exact text, no seams
          g.drawImage(S, 0, 0, W, H);
          return;
        }
        for (const s of shards) {
          if (t < exitStart) {
            const p = clamp((t - lead - s.delay) / fly, 0, 1);
            if (p <= 0) continue;
            const q = 1 - posE(p);
            const qr = 1 - rotE(p);
            const fx = Math.cos(s.flip * qr);
            const glint = Math.min(1, qr * 3);
            drawShard(s, s.sx * q, s.sy * q, s.rot * qr, fx, Math.min(1, p * 6), glint);
          } else {
            const p = clamp((t - exitStart - s.delay * 0.35) / exitD, 0, 1);
            const e = exE(p);
            const fx = Math.cos(s.erot * e * 1.5);
            drawShard(s, s.ex * e, s.ey * e + H * 0.4 * e * e, s.erot * e, fx, 1 - clamp((p - 0.6) / 0.4, 0, 1), Math.min(1, p * 4));
          }
        }
      },
    };
  },
};
export default impl;
