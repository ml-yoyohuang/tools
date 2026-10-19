import { el } from '../../engine/dom';
import { clamp, ease, num, PALETTE, smoothstep, TAU } from '../../engine/helpers';
import { fontString, glyphWidth100, graphemes, isSpace, phrases } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// One CSS-3D cylinder per phrase, stacked vertically and counter-rotating.
// Every glyph is placed with rotateY(θ) translateZ(r) on the cylinder surface;
// backface stays visible, so glyphs on the far side appear naturally mirrored,
// and their opacity follows the facing term cos(θ + φ) so the back half reads
// as dimmed depth. A slight rotateX tilt shows the cylinder as an ellipse.
const impl: EffectImpl = {
  id: 'text-cylinder',
  defaults: { ...PALETTE.lime },
  posterTime: 1.3,
  maxChars: 30,
  textHint: '用「／」分隔多個詞，每個詞一個圓柱，相鄰圓柱反向旋轉。',
  params: [
    { key: 'tilt', label: '俯視角度', type: 'range', min: -30, max: 30, step: 1, default: 14, unit: '°' },
    { key: 'radius', label: '圓柱半徑', type: 'range', min: 0.6, max: 1.3, step: 0.05, default: 1 },
    { key: 'motion', label: '旋轉節奏', type: 'select', default: 'smooth', options: [{ value: 'smooth', label: '等速' }, { value: 'step', label: '分段停頓' }] },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: acc } = ctx.s;
    const src = phrases(ctx.text).slice(0, 5);
    const tilt = num(ctx, 'tilt', 14);
    const step = String(ctx.s.params.motion ?? 'smooth') === 'step';
    const k = Math.max(0, ctx.s.intensity);
    const r = Math.min(W * 0.34, H * 0.46) * num(ctx, 'radius', 1);
    const totalH = H * 0.74;
    // tall stages stack extra (repeated) cylinders so the frame is filled
    const fitRings = Math.floor(totalH / (((r * 0.55) / 0.6) * 1.1));
    const nC = Math.max(src.length, Math.min(5, fitRings));
    const list = Array.from({ length: nC }, (_, i) => src[i % src.length]);
    const band = totalH / nC;
    const tr = ctx.s.tracking;
    const P = Math.max(W, H) * 1.5;

    const viewport = el('div', { style: { position: 'absolute', inset: '0', perspective: `${P}px`, perspectiveOrigin: '50% 45%' } }, ctx.root);
    const scene = el(
      'div',
      { style: { position: 'absolute', left: '50%', top: '50%', width: '0', height: '0', transformStyle: 'preserve-3d', transform: `rotateX(${-tilt}deg)` } },
      viewport,
    );

    interface Cyl {
      node: HTMLDivElement;
      glyphs: { el: HTMLElement; th: number }[];
      dir: number;
      period: number;
      unitAngle: number;
      offset: number;
    }
    const cyls: Cyl[] = list.map((p, ci) => {
      const y = (ci - (nC - 1) / 2) * band;
      const node = el('div', { style: { position: 'absolute', left: '0', top: '0', transformStyle: 'preserve-3d', willChange: 'transform' } }, scene);
      node.style.transform = `translate3d(0,${y}px,0)`;
      const rotor = el('div', { style: { position: 'absolute', left: '0', top: '0', transformStyle: 'preserve-3d' } }, node);
      const gs = graphemes(p);
      const C = TAU * r;
      let fs = Math.min(band * 0.6, r * 0.55) * ctx.s.fontScale;
      const weight = ci % 2 ? 700 : 900;
      const family = ci % 2 ? ctx.font.serif : ctx.font.sans;
      const sep = 0.9; // gap (em) holding a dot between repeats
      const unitW100 = gs.reduce((a, g) => a + glyphWidth100(g, family, weight) + tr * 100, 0) + sep * 100;
      let unitW = (unitW100 / 100) * fs;
      if (unitW > C * 0.98) {
        fs *= (C * 0.98) / unitW;
        unitW = (unitW100 / 100) * fs;
      }
      const reps = Math.max(1, Math.floor(C / unitW));
      const pxToRad = TAU / (reps * unitW);
      const glyphs: { el: HTMLElement; th: number }[] = [];
      const font = fontString(fs, family, weight);
      for (let rep = 0; rep < reps; rep++) {
        let x = rep * unitW;
        for (const g of gs) {
          const w = (glyphWidth100(g, family, weight) / 100) * fs;
          if (!isSpace(g)) {
            const th = (x + w / 2) * pxToRad;
            const span = el('span', { text: g, style: { position: 'absolute', left: '0', top: '0', font, lineHeight: '1', whiteSpace: 'pre', color: fg, willChange: 'opacity' } }, rotor);
            span.style.transform = `translate(-50%,-50%) rotateY(${th}rad) translateZ(${r}px)`;
            glyphs.push({ el: span, th });
          }
          x += w + tr * fs;
        }
        const th = (x + (sep * fs) / 2) * pxToRad;
        const d = Math.max(3, fs * 0.16);
        const dot = el('span', { style: { position: 'absolute', left: '0', top: '0', width: `${d}px`, height: `${d}px`, borderRadius: '50%', background: acc } }, rotor);
        dot.style.transform = `translate(-50%,-50%) rotateY(${th}rad) translateZ(${r}px)`;
        glyphs.push({ el: dot, th });
      }
      // rims: top & bottom circles of the cylinder
      for (const s of [-1, 1]) {
        const rim = el(
          'div',
          {
            style: {
              position: 'absolute',
              left: `${-r}px`,
              top: `${-r}px`,
              width: `${r * 2}px`,
              height: `${r * 2}px`,
              borderRadius: '50%',
              border: `${Math.max(1, fs * 0.03)}px solid ${acc}`,
              opacity: 0.55,
            },
          },
          node,
        );
        rim.style.transform = `translateY(${s * fs * 0.78}px) rotateX(90deg)`;
      }
      return { node: rotor, glyphs, dir: ci % 2 ? -1 : 1, period: 10 + ci * 2.5, unitAngle: TAU / reps, offset: ci * 0.7 };
    });

    const io = ease('expo.inOut');
    return {
      render(t) {
        for (const c of cyls) {
          let phi: number;
          if (step) {
            // one phrase-unit per beat: quick expo turn, then a held pause
            const beat = 1.6;
            const b = t / beat + c.offset * 0.3;
            const f = clamp((b - Math.floor(b)) / 0.55, 0, 1);
            phi = (Math.floor(b) + io(f)) * c.unitAngle * c.dir * Math.max(0.2, k);
          } else phi = ((t * TAU) / c.period) * c.dir * k;
          phi += c.offset;
          c.node.style.transform = `rotateY(${phi}rad)`;
          for (const g of c.glyphs) {
            const facing = Math.cos(g.th + phi);
            g.el.style.opacity = String(0.16 + 0.84 * smoothstep(-0.25, 0.55, facing));
          }
        }
      },
    };
  },
};
export default impl;
