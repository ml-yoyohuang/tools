import { hexToRgb, rgba } from '../../engine/canvas';
import { textBlock } from '../../engine/dom';
import { C, mod, num, str, TAU } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// background-clip:text — the gradient only exists inside the glyphs. The gradient is a
// repeating band (c1 → c2 → c3 → c1) of period P along angle A; shifting the
// background by exactly P / |sin A| along x is the identity, so position = (t·v) mod that.
function rotateHue(hex: string, deg: number): string {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d > 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  h = mod(h + deg, 360);
  // keep it vivid
  s = Math.max(s, 0.65);
  const L2 = Math.min(Math.max(l, 0.55), 0.68);
  const c = (1 - Math.abs(2 * L2 - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = L2 - c / 2;
  const [r1, g1, b1] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return '#' + [r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

const THIRD: Record<string, string> = { lime: C.lime, teal: C.teal, pink: C.pink, paper: C.paper, coral: C.coral, violet: C.violet };

const impl: EffectImpl = {
  id: 'gradient-flow',
  defaults: { background: C.ink, primary: C.coral, secondary: C.violet },
  posterTime: 1.2,
  maxChars: 40,
  params: [
    {
      key: 'third',
      label: '第三色',
      type: 'select',
      default: 'auto',
      options: [
        { value: 'auto', label: '自動（色相推算）' },
        { value: 'lime', label: '萊姆' },
        { value: 'teal', label: '青綠' },
        { value: 'pink', label: '粉紅' },
        { value: 'paper', label: '米白' },
      ],
    },
    { key: 'angle', label: '流動角度', type: 'range', min: 20, max: 160, step: 5, default: 115, unit: '°' },
    { key: 'band', label: '色帶寬度', type: 'range', min: 0.3, max: 2, step: 0.05, default: 0.9, hint: '相對於文字寬度' },
  ],
  create(ctx): EffectRuntime {
    const { primary: c1, secondary: c2, background: bg } = ctx.s;
    const tk = str(ctx, 'third', 'auto');
    const c3 = THIRD[tk] ?? rotateHue(c1, -150);
    const A = num(ctx, 'angle', 115);
    const band = num(ctx, 'band', 0.9);
    const L = layoutText(ctx, ctx.text, { maxHeight: ctx.height * 0.6, maxWidth: ctx.width * 0.86, lineHeight: 1.12 });
    const P = Math.max(40, Math.max(L.width, L.height) * band);
    const sinA = Math.abs(Math.sin((A * Math.PI) / 180)) || 1;
    const shift = P / sinA; // background-position period along x
    const v = shift / (4.5 / Math.max(0.15, ctx.s.intensity)); // one full colour loop ≈ 4.5 s
    const grad = `repeating-linear-gradient(${A}deg, ${c1} 0px, ${c2} ${P / 3}px, ${c3} ${(2 * P) / 3}px, ${c1} ${P}px)`;
    // a second, softer, slower sheen layer (also periodic) adds depth inside the glyphs
    const P2 = P * 0.5;
    const sheen = `repeating-linear-gradient(${A + 40}deg, rgba(255,255,255,0) 0px, rgba(255,255,255,0.22) ${P2 * 0.12}px, rgba(255,255,255,0) ${P2 * 0.3}px, rgba(255,255,255,0) ${P2}px)`;
    const sinB = Math.abs(Math.sin(((A + 40) * Math.PI) / 180)) || 1;
    const shift2 = P2 / sinB;

    const { block, lines } = textBlock(ctx.root, L, {
      style: {
        backgroundImage: `${sheen}, ${grad}`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        WebkitTextFillColor: 'transparent',
        paddingBottom: `${L.fontSize * 0.1}px`,
        willChange: 'background-position',
      },
    });
    void lines;
    // tiny swatch legend (outside the glyphs stays clean: just three dots)
    const dotR = Math.max(3, Math.min(ctx.width, ctx.height) * 0.012);
    const legend = document.createElement('div');
    Object.assign(legend.style, { position: 'absolute', left: '50%', bottom: `${Math.max(10, ctx.height * 0.07)}px`, transform: 'translateX(-50%)', display: 'flex', gap: `${dotR * 1.4}px` });
    const dots = [c1, c2, c3].map((c) => {
      const d = document.createElement('div');
      Object.assign(d.style, { width: `${dotR * 2}px`, height: `${dotR * 2}px`, borderRadius: '50%', background: c, boxShadow: `0 0 0 1px ${rgba(bg === '#000000' ? '#ffffff' : bg, 0.2)}` });
      legend.appendChild(d);
      return d;
    });
    ctx.root.appendChild(legend);

    return {
      render(t) {
        const x1 = mod(t * v, shift);
        const x2 = mod(-t * v * 0.37, shift2);
        block.style.backgroundPosition = `${x2}px 0px, ${x1}px 0px`;
        // legend dot that is "currently" dominant pulses gently (in phase with the flow)
        const ph = (x1 / shift) * 3;
        dots.forEach((d, i) => {
          const k = 0.5 + 0.5 * Math.cos(((ph - i) / 3) * TAU);
          d.style.transform = `scale(${0.75 + 0.45 * k})`;
        });
      },
    };
  },
};
export default impl;
