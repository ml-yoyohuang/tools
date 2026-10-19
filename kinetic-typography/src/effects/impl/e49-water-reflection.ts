import { drawLayout, offscreen, rgba, stageCanvas } from '../../engine/canvas';
import { clamp, num, PALETTE, TAU } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// The text is rasterised once into an off-screen canvas. Below the water line every
// row d samples the mirrored source row, shifted horizontally by a sum of travelling
// sines whose amplitude grows with d, and fades with distance. Waves are integer
// multiples of a base frequency, so the whole picture loops seamlessly every LOOP s.
const LOOP = 8;

const impl: EffectImpl = {
  id: 'water-reflection',
  defaults: { ...PALETTE.darkViolet },
  posterTime: 1.3,
  maxChars: 30,
  params: [
    { key: 'ripple', label: '波紋強度', type: 'range', min: 0, max: 2, step: 0.05, default: 1 },
    { key: 'depth', label: '倒影長度', type: 'range', min: 0.4, max: 1.2, step: 0.05, default: 0.85 },
    { key: 'level', label: '水平線位置', type: 'range', min: 0.4, max: 0.7, step: 0.01, default: 0.55 },
  ],
  create(ctx): EffectRuntime {
    const sc = stageCanvas(ctx);
    const g = sc.g;
    const W = ctx.width;
    const H = ctx.height;
    const dpr = sc.dpr;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const ripple = num(ctx, 'ripple', 1) * ctx.s.intensity;
    const depthK = num(ctx, 'depth', 0.85);
    const level = num(ctx, 'level', 0.55);
    const waterY = H * level;
    const maxTextH = Math.min(waterY * 0.62, H * 0.42);
    const L = layoutText(ctx, ctx.text, { maxHeight: maxTextH, maxWidth: W * 0.84, lineHeight: 1.08, cy: 0 });
    // sit the text block on the water line (small gap)
    const gap = L.fontSize * 0.08;
    const top = waterY - gap - L.height;
    const dy = top - L.y;
    // source image (device px) of the text only
    const src = offscreen(W * dpr, H * dpr);
    src.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawLayout(src.g, L, { fill: fg, dy });
    const textTop = top;
    const textBottom = waterY - gap * 0.2;
    const reflLen = Math.min(H - waterY, (textBottom - textTop) * depthK * 1.15);

    const base = TAU / LOOP;
    const amp = L.fontSize * 0.09 * ripple;
    const rowH = Math.max(1, Math.round(Math.min(2, H / 360)));
    // glints: short horizontal dashes on the water
    const nGl = Math.round(26 * ctx.q * Math.sqrt((W * H) / (640 * 360)));
    const glints = Array.from({ length: nGl }, (_, i) => ({
      x: hash2(i, 1, ctx.seed),
      y: hash2(i, 2, ctx.seed) ** 1.6,
      w: 0.4 + hash2(i, 3, ctx.seed),
      ph: hash2(i, 4, ctx.seed) * TAU,
      f: 1 + Math.floor(hash2(i, 5, ctx.seed) * 3),
    }));

    return {
      canvas: sc.canvas,
      render(t) {
        sc.clear(bg);
        // sky / water tones
        const sky = g.createLinearGradient(0, 0, 0, waterY);
        sky.addColorStop(0, rgba(acc, 0.0));
        sky.addColorStop(1, rgba(acc, 0.12));
        g.fillStyle = sky;
        g.fillRect(0, 0, W, waterY);
        const water = g.createLinearGradient(0, waterY, 0, H);
        water.addColorStop(0, rgba(acc, 0.16));
        water.addColorStop(1, rgba('#000000', 0.25));
        g.fillStyle = water;
        g.fillRect(0, waterY, W, H - waterY);

        // main text
        g.drawImage(src.canvas, 0, 0);

        // reflection rows
        for (let d = 0; d < reflLen; d += rowH) {
          const k = d / reflLen; // 0 at the surface → 1 far
          const a = amp * (0.15 + 1.35 * k);
          const off =
            a * (Math.sin(d * 0.11 - t * base * 3) * 0.55 + Math.sin(d * 0.047 + t * base * 2 + 1.3) * 0.3 + Math.sin(d * 0.23 - t * base * 5 + 0.4) * 0.15);
          // mirrored source row, slightly compressed + bobbing
          const sy = textBottom - d * 0.96 - Math.sin(d * 0.08 - t * base * 4) * a * 0.12;
          if (sy < textTop - 2) break;
          const alpha = (1 - k) ** 1.6 * 0.62;
          g.globalAlpha = alpha;
          g.drawImage(src.canvas, 0, Math.max(0, sy * dpr), W * dpr, rowH * dpr, off, waterY + d, W, rowH);
        }
        g.globalAlpha = 1;
        // tint the reflection toward the water colour
        const tint = g.createLinearGradient(0, waterY, 0, waterY + reflLen);
        tint.addColorStop(0, rgba(acc, 0.12));
        tint.addColorStop(1, rgba(acc, 0));
        g.globalCompositeOperation = 'source-atop';
        g.fillStyle = tint;
        g.fillRect(0, waterY, W, reflLen);
        g.globalCompositeOperation = 'source-over';

        // water line + travelling highlight
        g.fillStyle = rgba(fg, 0.35);
        g.fillRect(0, waterY, W, 1);
        const hx = ((t / LOOP) % 1) * W * 1.6 - W * 0.3;
        const hl = g.createLinearGradient(hx - W * 0.25, 0, hx + W * 0.25, 0);
        hl.addColorStop(0, rgba(acc, 0));
        hl.addColorStop(0.5, rgba(acc, 0.9));
        hl.addColorStop(1, rgba(acc, 0));
        g.fillStyle = hl;
        g.fillRect(0, waterY - 0.5, W, 2);

        // glints
        for (const gl of glints) {
          const yy = waterY + 4 + gl.y * (H - waterY - 6);
          const near = (yy - waterY) / (H - waterY);
          const tw = 0.5 + 0.5 * Math.sin(t * base * gl.f * 2 + gl.ph);
          const xx = gl.x * W + Math.sin(t * base * gl.f + gl.ph) * W * 0.02;
          g.fillStyle = rgba(fg, clamp(tw * 0.35 * (0.4 + near), 0, 0.5));
          const ww = gl.w * L.fontSize * (0.15 + near * 0.35);
          g.fillRect(xx - ww / 2, yy, ww, Math.max(1, near * 2));
        }
      },
    };
  },
};
export default impl;
