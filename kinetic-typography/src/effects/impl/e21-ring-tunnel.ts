import { rgba, stageCanvas } from '../../engine/canvas';
import { clamp, mod, num, PALETTE, smoothstep, TAU } from '../../engine/helpers';
import { asLines, fontString, glyphWidth100, graphemes, isSpace } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Rings of circular text facing the camera fly toward it along Z. Each ring is
// the whole sentence (repeated to close the circle) laid out by measured glyph
// widths; radius and glyph size come from a 1/z projection. Rings alternate
// rotation direction and colour. Slots wrap only when faded at either end.
const impl: EffectImpl = {
  id: 'ring-tunnel',
  defaults: { ...PALETTE.tealOnDark },
  posterTime: 1.6,
  maxChars: 30,
  params: [
    { key: 'rings', label: '圓環數', type: 'range', min: 6, max: 20, step: 1, default: 12 },
    { key: 'spin', label: '旋轉速度', type: 'range', min: 0, max: 2, step: 0.05, default: 0.8 },
    { key: 'curve', label: '隧道彎曲', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
  ],
  create(ctx): EffectRuntime {
    const sc = stageCanvas(ctx);
    const g = sc.g;
    const W = ctx.width;
    const H = ctx.height;
    const cx = W / 2;
    const cy = H / 2;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const K = Math.max(5, Math.round(num(ctx, 'rings', 12) * (ctx.mode === 'card' ? 0.75 : 1)));
    const spin = num(ctx, 'spin', 0.8);
    const curve = num(ctx, 'curve', 0.5);
    const k = Math.max(0.05, ctx.s.intensity);
    const f = Math.min(W, H) * 0.42; // px per world unit at z = 1
    const D = 0.62; // ring spacing (world)
    const zNear = 0.22;
    const span = K * D;
    const v = (D / 0.85) * k;
    const family = ctx.font.sans;
    const weight = 800;
    const tr = ctx.s.tracking;
    const dprv = sc.dpr;

    // ring layout in world units (radius 1)
    const gs = graphemes(asLines(ctx.text).replace(/\n/g, ' '));
    const sepEm = 1.4;
    const w100 = gs.map((c) => glyphWidth100(c, family, weight) + tr * 100);
    const unit100 = w100.reduce((a, b) => a + b, 0) + sepEm * 100;
    let S = 0.2 * ctx.s.fontScale; // glyph size (world)
    if ((unit100 / 100) * S > TAU * 0.96) S = (TAU * 0.96 * 100) / unit100;
    const unitW = (unit100 / 100) * S;
    const reps = Math.max(1, Math.floor(TAU / unitW));
    const radPer = TAU / (reps * unitW); // radians per world unit along the arc
    const glyphs: { ch: string; a: number }[] = [];
    const dots: number[] = [];
    for (let r = 0; r < reps; r++) {
      let x = r * unitW;
      gs.forEach((c, i) => {
        const w = (w100[i] / 100) * S;
        if (!isSpace(c)) glyphs.push({ ch: c, a: (x + w / 2) * radPer });
        x += w;
      });
      dots.push((x + (sepEm * S) / 2) * radPer);
    }
    const font = fontString(100, family, weight);

    return {
      canvas: sc.canvas,
      render(t) {
        sc.clear(bg);
        const dx = Math.sin(t * 0.47) * W * 0.09 * curve;
        const dy = Math.cos(t * 0.31) * H * 0.07 * curve;
        // vanishing glow
        const vx = cx + dx;
        const vy = cy + dy;
        const gr = g.createRadialGradient(vx, vy, 0, vx, vy, Math.min(W, H) * 0.35);
        gr.addColorStop(0, rgba(fg, 0.22));
        gr.addColorStop(1, rgba(fg, 0));
        g.fillStyle = gr;
        g.fillRect(0, 0, W, H);

        const rings = Array.from({ length: K }, (_, i) => ({ i, z: zNear + mod(i * D - t * v, span) })).sort((a, b) => b.z - a.z);
        g.font = font;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        for (const { i, z } of rings) {
          const depth = (z - zNear) / span; // 0 near … 1 far
          const alpha = (1 - smoothstep(0.55, 1, depth)) * smoothstep(0, 0.07, depth);
          if (alpha < 0.01) continue;
          const bend = 1 - zNear / z; // far rings follow the drifting vanishing point
          const ox = cx + dx * bend;
          const oy = cy + dy * bend;
          const rad = f / z;
          const px = (f * S) / z;
          const dir = i % 2 ? -1 : 1;
          const rot = i * 2.399 + dir * t * spin * 0.6 * k;
          const odd = i % 2 === 1;
          const col = odd ? acc : fg;
          // rails
          g.setTransform(dprv, 0, 0, dprv, 0, 0);
          g.globalAlpha = alpha * (odd ? 0.18 : 0.32);
          g.strokeStyle = col;
          g.lineWidth = Math.max(0.5, px * 0.03);
          for (const m of [1 - S * 0.75, 1 + S * 0.75]) {
            g.beginPath();
            g.arc(ox, oy, rad * m, 0, TAU);
            g.stroke();
          }
          // glyphs, tangent, tops pointing outward
          g.globalAlpha = alpha;
          g.fillStyle = col;
          const s = (px / 100) * dprv;
          for (const gl of glyphs) {
            const a = gl.a + rot - Math.PI / 2;
            const x = ox + Math.cos(a) * rad;
            const y = oy + Math.sin(a) * rad;
            const ca = Math.cos(a + Math.PI / 2) * s;
            const sa = Math.sin(a + Math.PI / 2) * s;
            g.setTransform(ca, sa, -sa, ca, x * dprv, y * dprv);
            g.fillText(gl.ch, 0, 0);
          }
          g.setTransform(dprv, 0, 0, dprv, 0, 0);
          for (const d of dots) {
            const a = d + rot - Math.PI / 2;
            g.beginPath();
            g.arc(ox + Math.cos(a) * rad, oy + Math.sin(a) * rad, Math.max(0.8, px * 0.09), 0, TAU);
            g.fill();
          }
        }
        g.globalAlpha = 1;
        g.setTransform(dprv, 0, 0, dprv, 0, 0);
        // soft depth vignette at the edges
        const vg = g.createRadialGradient(cx, cy, Math.min(W, H) * 0.3, cx, cy, Math.hypot(W, H) * 0.6);
        vg.addColorStop(0, rgba(bg, 0));
        vg.addColorStop(1, rgba(bg, clamp(0.55, 0, 1)));
        g.fillStyle = vg;
        g.fillRect(0, 0, W, H);
      },
    };
  },
};
export default impl;
