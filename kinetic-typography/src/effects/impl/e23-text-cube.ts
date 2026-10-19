import { el, textBlock } from '../../engine/dom';
import { clamp, ease, mod, num, PALETTE } from '../../engine/helpers';
import { layoutText, phrases } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// CSS preserve-3d cube tumbling around X: every beat it holds, then rolls 90°
// with back.inOut, dipping slightly in scale. The four ring faces are slots;
// slot (j mod 4) shows phrase (j mod n) for j = k−1 … k+2, so any number of
// phrases cycles while only hidden faces ever change content. Each face gets a
// Lambert shade from a top-front light; end caps make the cube read as solid.
const impl: EffectImpl = {
  id: 'text-cube',
  defaults: { ...PALETTE.violet },
  posterTime: 0.8,
  maxChars: 32,
  textHint: '用「／」分隔多個詞，每個詞是立方體的一面。',
  params: [
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.3, max: 3, step: 0.1, default: 1.2, unit: 's' },
    { key: 'flip', label: '翻轉秒數', type: 'range', min: 0.4, max: 1.6, step: 0.05, default: 0.85, unit: 's' },
    { key: 'yaw', label: '側視角度', type: 'range', min: 0, max: 40, step: 1, default: 22, unit: '°' },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: face } = ctx.s;
    const list = phrases(ctx.text);
    const n = list.length;
    const hold = num(ctx, 'hold', 1.2);
    const flipDur = num(ctx, 'flip', 0.85);
    const yawBase = num(ctx, 'yaw', 22);
    const k = clamp(ctx.s.intensity, 0, 2);
    const s = Math.min(W * 0.5, H * 0.56);
    const half = s / 2;

    // floor shadow
    const shadow = el(
      'div',
      {
        style: {
          position: 'absolute',
          left: `${W / 2 - s * 0.7}px`,
          top: `${H / 2 + s * 0.6}px`,
          width: `${s * 1.4}px`,
          height: `${s * 0.22}px`,
          borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(0,0,0,.35), rgba(0,0,0,0) 70%)',
          willChange: 'transform, opacity',
        },
      },
      ctx.root,
    );
    const viewport = el('div', { style: { position: 'absolute', inset: '0', perspective: `${s * 3.6}px`, perspectiveOrigin: '50% 40%' } }, ctx.root);
    const cube = el('div', { style: { position: 'absolute', left: `${W / 2}px`, top: `${H / 2}px`, width: '0', height: '0', transformStyle: 'preserve-3d', willChange: 'transform' } }, viewport);

    const mkFace = (transform: string, color: string) => {
      const f = el(
        'div',
        {
          style: {
            position: 'absolute',
            left: `${-half}px`,
            top: `${-half}px`,
            width: `${s}px`,
            height: `${s}px`,
            background: color,
            transform,
            backfaceVisibility: 'hidden',
            overflow: 'hidden',
            boxShadow: `inset 0 0 0 ${Math.max(1, s * 0.012)}px ${fg}22`,
          },
        },
        cube,
      );
      const shade = el('div', { style: { position: 'absolute', inset: '0', background: '#000', opacity: 0, zIndex: '2' } }, f);
      return { f, shade };
    };

    const faces = [0, 1, 2, 3].map((i) => {
      const { f, shade } = mkFace(`rotateX(${i * 90}deg) translateZ(${half}px)`, face);
      // a tiny index tag in the corner (typographic detail)
      el('div', { text: `0${i + 1}`, style: { position: 'absolute', left: `${s * 0.06}px`, top: `${s * 0.05}px`, font: `700 ${Math.max(7, s * 0.05)}px ${ctx.font.mono}`, color: fg, opacity: 0.45 } }, f);
      const blocks = list.map((p) => {
        const L = layoutText(ctx, p, { maxWidth: s * 0.8, maxHeight: s * 0.66, cx: half, cy: half });
        const { block } = textBlock(f, L, { color: fg });
        block.style.visibility = 'hidden';
        return block;
      });
      return { f, shade, blocks, shown: -1 };
    });
    // end caps (left / right) so the cube reads as a solid block
    const caps = [-1, 1].map((sd) => {
      const c = mkFace(`rotateY(${sd * 90}deg) translateZ(${half}px)`, face);
      el('div', { style: { position: 'absolute', inset: `${s * 0.12}px`, border: `${Math.max(1, s * 0.01)}px solid ${fg}`, opacity: 0.4 } }, c.f);
      return c;
    });

    const flipEase = ease('back.inOut(1.6)');
    const beat = hold + flipDur;
    const light = { y: -0.6, z: 0.8 };

    return {
      render(t) {
        const kk = Math.floor(t / beat);
        const local = t - kk * beat;
        const u = clamp((local - hold) / flipDur, 0, 1);
        const e = flipEase(u);
        const ang = -90 * (kk + e);
        const yaw = -yawBase * (0.7 + 0.3 * Math.sin(t * 0.45)) * Math.min(1, k + 0.2);
        const dip = 1 - 0.08 * Math.sin(Math.PI * u) * k;
        cube.style.transform = `translateZ(${-half}px) rotateY(${yaw}deg) rotateX(${ang}deg) scale3d(${dip},${dip},${dip})`;
        shadow.style.transform = `scale(${0.9 + 0.1 * dip}, ${0.85 + 0.15 * dip})`;
        shadow.style.opacity = String(0.7 + 0.3 * dip);
        // content: slot j mod 4 shows phrase j mod n around the current step
        for (let j = kk - 1; j <= kk + 2; j++) {
          const F = faces[mod(j, 4)];
          const pi = mod(j, n);
          if (F.shown !== pi) {
            if (F.shown >= 0) F.blocks[F.shown].style.visibility = 'hidden';
            F.blocks[pi].style.visibility = 'visible';
            F.shown = pi;
          }
        }
        // lighting
        faces.forEach((F, i) => {
          const a = ((i * 90 + ang) * Math.PI) / 180;
          const ny = -Math.sin(a);
          const nz = Math.cos(a);
          const lam = Math.max(0, ny * light.y + nz * light.z);
          F.shade.style.opacity = String(Math.min(1, 1 - lam) * 0.55 - 0.05 * lam);
        });
        caps.forEach((c, i) => (c.shade.style.opacity = String(i === 0 ? 0.2 : 0.5)));
      },
    };
  },
};
export default impl;
