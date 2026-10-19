import { el } from '../../engine/dom';
import { clamp, mod, num, PALETTE, smoothstep, TAU } from '../../engine/helpers';
import { asLines, fontString, textWidth } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// CSS preserve-3d corridor. The cross-section is slightly larger than the stage,
// so the camera (CSS perspective eye) stands *inside* it. N identical-structure
// segments (floor: one huge word, walls: rows of text running into depth,
// ceiling: fine print + a light panel) sit in a ring along −Z:
//   front_j = −((j·L − travel) mod N·L)
// A segment only wraps when it is behind the near plane / fully faded at the far
// end, so the forward motion is endless with no visible jump.
const impl: EffectImpl = {
  id: 'text-corridor',
  defaults: { ...PALETTE.darkViolet },
  posterTime: 1.2,
  maxChars: 20,
  params: [
    { key: 'depth', label: '透視深度', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1, hint: '數值越小透視越強烈。' },
    { key: 'segments', label: '走廊節數', type: 'range', min: 6, max: 14, step: 1, default: 10 },
    { key: 'sway', label: '鏡頭晃動', type: 'range', min: 0, max: 1, step: 0.05, default: 0.4 },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const word = asLines(ctx.text).replace(/\n/g, ' ');
    const sway = num(ctx, 'sway', 0.4);
    const Wc = W * 1.16;
    const Hc = H * 1.14;
    const P = Math.min(W, H) * 0.95 * num(ctx, 'depth', 1);
    // segment length < perspective distance, so even the nearest segment
    // (front edge up to 0.9·L) stays in front of the eye at z = P
    const L = Math.min(Math.max(Wc, Hc) * 0.62, P * 0.8);
    let N = Math.round(num(ctx, 'segments', 10) * (ctx.mode === 'card' ? 0.8 : 1));
    if (N % 2) N += 1; // alternating segment styles need an even ring
    const far = N * L;
    const speed = (L / 1.5) * Math.max(0.05, ctx.s.intensity);
    const sans = ctx.font.sans;
    const mono = ctx.font.mono;
    const tr = ctx.s.tracking;
    const fsc = ctx.s.fontScale;

    const viewport = el('div', { style: { position: 'absolute', inset: '0', perspective: `${P}px`, perspectiveOrigin: '50% 50%', overflow: 'hidden' } }, ctx.root);
    // vanishing-point light (sits far behind everything, flat)
    el(
      'div',
      {
        style: {
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: `${Math.min(W, H) * 0.9}px`,
          height: `${Math.min(W, H) * 0.9}px`,
          transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${acc}AA 0%, ${acc}33 18%, ${acc}00 60%)`,
        },
      },
      viewport,
    );
    const world = el('div', { style: { position: 'absolute', left: '50%', top: '50%', width: '0', height: '0', transformStyle: 'preserve-3d' } }, viewport);

    const plane = (parent: HTMLElement, w: number, h: number, transform: string, style: Record<string, string | number> = {}) =>
      el(
        'div',
        {
          style: {
            position: 'absolute',
            left: `${-w / 2}px`,
            top: `${-h / 2}px`,
            width: `${w}px`,
            height: `${h}px`,
            transform,
            overflow: 'hidden',
            backfaceVisibility: 'hidden',
            ...style,
          },
        },
        parent,
      );

    // a row of whole text units spread across `len` px (no glyph cut at seams)
    const row = (parent: HTMLElement, len: number, size0: number, family: string, weight: number, color: string, opacity: number, gapEm = 1.2) => {
      // long text: shrink so at least one whole unit fits on the plane
      const size = Math.min(size0, (len * 0.92 * 100) / Math.max(1, textWidth(word, 100, family, weight, tr) + 100 * gapEm * 0.5));
      const unitW = textWidth(word, size, family, weight, tr) + size * gapEm;
      const n = Math.max(1, Math.floor(len / unitW));
      const r = el('div', { style: { display: 'flex', justifyContent: 'space-evenly', alignItems: 'center', width: `${len}px`, height: `${size * 1.25}px`, flex: 'none' } }, parent);
      for (let i = 0; i < n; i++)
        el('span', { text: word, style: { font: fontString(size, family, weight), letterSpacing: `${tr}em`, color, opacity, whiteSpace: 'pre', lineHeight: '1' } }, r);
      return r;
    };

    const rib = `${Math.max(1, Math.min(W, H) * 0.006)}px solid ${acc}`;
    const floorFs = Math.min((Wc * 0.78 * 100) / Math.max(1, textWidth(word, 100, sans, 900, tr)), L * 0.55) * fsc;
    const wallRows = [
      { size: Hc * 0.045, family: mono, weight: 500, color: acc, opacity: 0.85 },
      { size: Hc * 0.13 * fsc, family: sans, weight: 900, color: fg, opacity: 0.95 },
      { size: Hc * 0.13 * fsc, family: sans, weight: 300, color: fg, opacity: 0.55 },
      { size: Hc * 0.045, family: mono, weight: 500, color: fg, opacity: 0.6 },
    ];

    interface Slot {
      seg: HTMLDivElement;
      planes: HTMLDivElement[];
    }
    const slots: Slot[] = [];
    for (let j = 0; j < N; j++) {
      const odd = j % 2 === 1;
      const seg = el('div', { style: { position: 'absolute', left: '0', top: '0', transformStyle: 'preserve-3d', willChange: 'transform' } }, world);
      // floor: one huge word, read standing on it (top edge far away)
      const floor = plane(seg, Wc, L, `translate3d(0,${Hc / 2}px,${-L / 2}px) rotateX(90deg)`, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: rib,
        background: `linear-gradient(0deg, ${fg}10, ${fg}00 60%)`,
      });
      el('div', { text: word, style: { font: fontString(floorFs, sans, 900), letterSpacing: `${tr}em`, color: odd ? acc : fg, whiteSpace: 'pre', lineHeight: '1' } }, floor);
      el('div', { text: String((j % 99) + 1).padStart(2, '0'), style: { position: 'absolute', left: `${Wc * 0.06}px`, bottom: `${L * 0.08}px`, font: fontString(Hc * 0.05, mono, 700), color: acc, opacity: 0.8 } }, floor);
      // ceiling: fine print rows across the width + a light panel
      const ceil = plane(seg, Wc, L, `translate3d(0,${-Hc / 2}px,${-L / 2}px) rotateX(-90deg)`, {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        borderTop: rib,
      });
      el('div', { style: { position: 'absolute', left: '50%', top: '50%', width: `${Wc * 0.22}px`, height: `${L * 0.5}px`, transform: 'translate(-50%,-50%)', background: acc, opacity: 0.28, borderRadius: `${Wc * 0.01}px`, boxShadow: `0 0 ${Wc * 0.04}px ${acc}` } }, ceil);
      const ceilRows = Math.max(4, Math.round(9 * Math.max(0.6, ctx.q)));
      for (let r = 0; r < ceilRows; r++) row(ceil, Wc * 0.96, Math.max(5, Hc * 0.026), mono, 400, fg, r % 3 === 1 ? 0.75 : 0.4, 2.2);
      // walls: rows of text running into depth (left reads near→far, right far→near)
      const walls: HTMLDivElement[] = [];
      for (const side of [-1, 1]) {
        const wall = plane(seg, L, Hc, `translate3d(${(side * Wc) / 2}px,0,${-L / 2}px) rotateY(${-side * 90}deg)`, {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
          alignItems: 'center',
          [side < 0 ? 'borderLeft' : 'borderRight']: rib,
          background: `linear-gradient(${side < 0 ? 90 : 270}deg, ${bg}00, ${fg}0D)`,
        });
        wallRows.forEach((R, ri) => row(wall, L * 0.94, R.size, R.family, R.weight, odd && ri === 1 ? acc : R.color, R.opacity, ri === 1 || ri === 2 ? 0.9 : 2));
        walls.push(wall);
      }
      slots.push({ seg, planes: [floor, ceil, ...walls] });
    }

    // floor-level haze to hide the far end + a soft vignette
    el('div', { style: { position: 'absolute', inset: '0', pointerEvents: 'none', background: `radial-gradient(ellipse at 50% 50%, ${bg}00 40%, ${bg}99 100%)` } }, ctx.root);

    return {
      render(t) {
        const travel = t * speed;
        const bobY = Math.sin(t * TAU * 0.9) * H * 0.008 * sway;
        const bobX = Math.sin(t * TAU * 0.45) * W * 0.012 * sway;
        const yaw = Math.sin((t * TAU) / 9) * 2.2 * sway;
        const roll = Math.sin((t * TAU) / 7 + 1) * 0.8 * sway;
        world.style.transform = `translate3d(${bobX}px,${bobY}px,0) rotateZ(${roll}deg) rotateY(${yaw}deg)`;
        for (let j = 0; j < N; j++) {
          const d = mod(j * L - travel, far);
          const s = slots[j];
          // front edge at z = 0.9L − d; it wraps only once its back edge is
          // already outside the visible floor / ceiling region
          s.seg.style.transform = `translate3d(0,0,${L * 0.9 - d}px)`;
          const o = 1 - smoothstep(far * 0.38, far * 0.92, d);
          const vis = o > 0.002;
          for (const p of s.planes) {
            p.style.opacity = String(clamp(o, 0, 1));
            p.style.visibility = vis ? 'visible' : 'hidden';
          }
        }
      },
    };
  },
};
export default impl;
