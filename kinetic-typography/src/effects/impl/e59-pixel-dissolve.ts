import { layoutMask, mix, rgba, stageCanvas } from '../../engine/canvas';
import { clamp, num, PALETTE } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { fontString, layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// The glyph mask is cut into big square cells; only cells with enough coverage
// become blocks. Each block belongs to a seeded batch (clustered hash, so batches
// read as chunky groups). Batches pop in on a stepped clock, hold, then flash and
// shrink away in place — blocks never translate (unlike fine particle drift).
const impl: EffectImpl = {
  id: 'pixel-dissolve',
  defaults: { ...PALETTE.limeOnDark },
  posterTime: 3,
  maxChars: 30,
  hide: ['intensity'],
  params: [
    { key: 'block', label: '方塊大小', type: 'range', min: 0.04, max: 0.2, step: 0.005, default: 0.065, hint: '相對於字級' },
    { key: 'batches', label: '批次數', type: 'range', min: 3, max: 14, step: 1, default: 7 },
  ],
  create(ctx): EffectRuntime {
    const L = layoutText(ctx, ctx.text, { maxHeight: ctx.height * 0.6, maxWidth: ctx.width * 0.86, weight: 500 });
    const fs = L.fontSize;
    const B = Math.max(3, (fs * num(ctx, 'block', 0.065)) / Math.sqrt(Math.max(0.3, ctx.q)));
    const NB = Math.round(num(ctx, 'batches', 7));
    const mask = layoutMask(ctx, L, 1);
    const W = mask.canvas.width;
    const H = mask.canvas.height;
    const data = mask.g.getImageData(0, 0, W, H).data;
    const alpha = (x: number, y: number) => {
      const xi = x | 0;
      const yi = y | 0;
      return xi < 0 || yi < 0 || xi >= W || yi >= H ? 0 : data[(yi * W + xi) * 4 + 3];
    };
    const ox = L.x - B * 0.5;
    const oy = L.y - B * 0.5;
    const cols = Math.ceil((L.width + B) / B);
    const rows = Math.ceil((L.height + B) / B);
    interface Blk { x: number; y: number; b: number; d: number }
    const blocks: Blk[] = [];
    const S = 4;
    for (let iy = 0; iy < rows; iy++) {
      for (let ix = 0; ix < cols; ix++) {
        const x = ox + ix * B;
        const y = oy + iy * B;
        let c = 0;
        for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) if (alpha(x + ((sx + 0.5) * B) / S, y + ((sy + 0.5) * B) / S) > 120) c++;
        if (c / (S * S) < 0.4) continue;
        const cx = Math.floor(ix / 3);
        const cy = Math.floor(iy / 3);
        const ob = 0.62 * hash2(cx, cy, ctx.seed) + 0.38 * hash2(ix, iy, ctx.seed + 7);
        const od = 0.62 * hash2(cx + 101, cy, ctx.seed + 3) + 0.38 * hash2(ix, iy + 57, ctx.seed + 11);
        blocks.push({ x, y, b: Math.min(NB - 1, Math.floor(ob * NB)), d: Math.min(NB - 1, Math.floor(od * NB)) });
      }
    }
    const step = Math.min(0.2, 1.5 / NB);
    const buildAt = 0.25;
    const buildEnd = buildAt + NB * step + 0.3;
    const dissolveAt = buildEnd + 1.9;
    const dissolveEnd = dissolveAt + NB * step + 0.25;
    const cycle = dissolveEnd + 0.55;
    const gap = Math.max(1, B * 0.12);
    const sc = stageCanvas(ctx);
    const g = sc.g;
    const fg = ctx.s.primary;
    const acc = ctx.s.secondary;
    const ghost = rgba(fg, 0.08);
    const labelSize = Math.max(8, Math.min(ctx.width, ctx.height) * 0.032);

    return {
      canvas: sc.canvas,
      render(time) {
        const t = time % cycle;
        sc.clear(ctx.s.background);
        const size = B - gap;
        // ghost slots
        g.fillStyle = ghost;
        for (const k of blocks) g.fillRect(k.x + gap / 2, k.y + gap / 2, size, size);
        let alive = 0;
        for (const k of blocks) {
          const tb = buildAt + k.b * step;
          const td = dissolveAt + k.d * step;
          let s = 0;
          let col = fg;
          if (t >= tb && t < td) {
            const a = t - tb;
            // pop: 0.6 → 1.12 → 1, colour flashes accent then settles
            s = a < 0.06 ? 0.6 + (a / 0.06) * 0.52 : a < 0.16 ? 1.12 - ((a - 0.06) / 0.1) * 0.12 : 1;
            col = a < 0.28 ? mix(acc, fg, clamp(a / 0.28, 0, 1)) : fg;
          } else if (t >= td) {
            const a = t - td;
            if (a < 0.07) {
              s = 1;
              col = acc;
            } else if (a < 0.2) {
              s = 1 - (a - 0.07) / 0.13;
              col = acc;
            }
          }
          if (s <= 0) continue;
          alive++;
          const z = size * s;
          g.fillStyle = col;
          g.fillRect(k.x + B / 2 - z / 2, k.y + B / 2 - z / 2, z, z);
        }
        // tiny readout
        g.font = fontString(labelSize, ctx.font.mono, 500);
        g.textBaseline = 'alphabetic';
        g.fillStyle = rgba(fg, 0.45);
        const pct = Math.round((alive / Math.max(1, blocks.length)) * 100);
        g.fillText(`■ ${String(alive).padStart(4, '0')} / ${blocks.length}   ${String(pct).padStart(3, ' ')}%`, labelSize * 1.4, ctx.height - labelSize * 1.4);
      },
    };
  },
};
export default impl;
