import { el } from '../../engine/dom';
import { bool, mod, num, PALETTE, TAU } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { fontString, phrases } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Three depth layers of vertical (tategaki) columns. Each column is a track of
// repeated units; offset = (t·v + phase) mod unitHeight, so every column loops
// pixel-exactly. Far = small / slow / faint / blurred, near = big / fast / sharp.
// A slow lateral camera sway is scaled by depth to strengthen the parallax.
interface LayerDef {
  size: number;
  opacity: number;
  blur: number;
  speed: number; // px per second
  spacing: number; // column pitch in multiples of size
  weight: number;
  depth: number; // 0 far … 1 near
}

const impl: EffectImpl = {
  id: 'parallax-columns',
  defaults: { ...PALETTE.darkTeal },
  posterTime: 1.5,
  maxChars: 30,
  textHint: '用「／」分隔多個詞，會分配到不同的直排欄位。',
  params: [
    { key: 'dir', label: '流動方向', type: 'select', default: 'down', options: [{ value: 'down', label: '向下（落雨）' }, { value: 'up', label: '向上（升起）' }] },
    { key: 'blur', label: '景深模糊', type: 'toggle', default: true },
    { key: 'sway', label: '鏡頭平移', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5, hint: '左右平移量，越近的層移動越多。' },
  ],
  create(ctx): EffectRuntime {
    const list = phrases(ctx.text);
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const W = ctx.width;
    const H = ctx.height;
    const base = Math.min(H, W * 1.05);
    const k = Math.max(0.05, ctx.s.intensity);
    const dir = String(ctx.s.params.dir ?? 'down') === 'up' ? -1 : 1;
    const blurOn = bool(ctx, 'blur', true);
    const sway = num(ctx, 'sway', 0.5);
    const fsc = ctx.s.fontScale;

    const layers: LayerDef[] = [
      { size: base * 0.055 * fsc, opacity: 0.22, blur: 1.6, speed: base * 0.07, spacing: 1.9, weight: 400, depth: 0 },
      { size: base * 0.1 * fsc, opacity: 0.5, blur: 0.6, speed: base * 0.16, spacing: 2.3, weight: 700, depth: 0.45 },
      { size: base * 0.2 * fsc, opacity: 1, blur: 0, speed: base * 0.36, spacing: 2.9, weight: 900, depth: 1 },
    ];

    const stage = el('div', { style: { position: 'absolute', inset: '0', overflow: 'hidden' } }, ctx.root);
    interface Col {
      track: HTMLDivElement;
      unitH: number;
      v: number;
      phase: number;
    }
    const cols: Col[] = [];
    const layerEls: { node: HTMLDivElement; depth: number }[] = [];
    let colIndex = 0;
    layers.forEach((L, li) => {
      const node = el('div', { style: { position: 'absolute', inset: '0', willChange: 'transform' } }, stage);
      layerEls.push({ node, depth: L.depth });
      const pitch = L.size * L.spacing * (1 + Math.max(0, ctx.s.tracking) * 0.5);
      const extra = W * 0.12 * sway * L.depth + pitch; // room for the sway
      const n = Math.max(2, Math.ceil((W + extra * 2) / pitch));
      const start = (W - (n - 1) * pitch) / 2;
      for (let c = 0; c < n; c++) {
        const jx = (hash2(c, li, ctx.seed) - 0.5) * pitch * 0.35;
        const x = start + c * pitch + jx;
        const off = (c + li * 2 + colIndex) % list.length;
        const p = [...list.slice(off), ...list.slice(0, off)].join(li === 2 ? "　" : "・");
        // near layer alternates accent / serif columns for rhythm
        const accent = li === 2 && c % 3 === 1;
        const serif = li === 2 && c % 3 === 2;
        const col = el(
          'div',
          {
            style: {
              position: 'absolute',
              left: `${x}px`,
              top: '0',
              height: `${H}px`,
              width: `${L.size * 1.3}px`,
              transform: 'translateX(-50%)',
              overflow: 'visible',
            },
          },
          node,
        );
        const track = el('div', { style: { position: 'absolute', left: '0', top: '0', width: '100%', willChange: 'transform' } }, col);
        const unit = el(
          'div',
          {
            text: p,
            style: {
              writingMode: 'vertical-rl',
              textOrientation: 'mixed',
              whiteSpace: 'nowrap',
              font: fontString(L.size, li === 0 || serif ? ctx.font.serif : ctx.font.sans, serif ? 700 : L.weight),
              letterSpacing: `${ctx.s.tracking + (li === 0 ? 0.25 : 0.08)}em`,
              lineHeight: '1.3',
              paddingBottom: `${L.size * (1.2 + hash2(c, li + 7, ctx.seed) * 1.6)}px`,
              margin: '0 auto',
              color: accent ? acc : fg,
              opacity: String(L.opacity),
              filter: blurOn && L.blur > 0 ? `blur(${L.blur * (ctx.mode === 'card' ? 0.6 : 1)}px)` : '',
            },
          },
          track,
        );
        const unitH = Math.max(8, unit.getBoundingClientRect().height);
        const copies = Math.ceil(H / unitH) + 2;
        for (let i = 1; i < copies; i++) track.appendChild(unit.cloneNode(true));
        const v = L.speed * k * (0.85 + hash2(c, li + 3, ctx.seed) * 0.3) * dir;
        cols.push({ track, unitH, v, phase: hash2(c, li + 11, ctx.seed) * unitH });
      }
      colIndex += n;
    });

    // atmosphere: fade top / bottom into the background so columns emerge from mist
    el(
      'div',
      {
        style: {
          position: 'absolute',
          inset: '0',
          pointerEvents: 'none',
          background: `linear-gradient(180deg, ${bg} 0%, ${bg}00 22%, ${bg}00 78%, ${bg} 100%)`,
        },
      },
      ctx.root,
    );

    return {
      render(t) {
        const camX = Math.sin((t * TAU) / 14) * W * 0.06 * sway;
        for (const L of layerEls) L.node.style.transform = `translate3d(${camX * (0.15 + L.depth * 0.85)}px,0,0)`;
        for (const c of cols) {
          // track holds copies stacked downward; shift by -(unitH) … 0
          const y = mod(t * c.v + c.phase, c.unitH) - c.unitH;
          c.track.style.transform = `translate3d(0,${y}px,0)`;
        }
      },
    };
  },
};
export default impl;
