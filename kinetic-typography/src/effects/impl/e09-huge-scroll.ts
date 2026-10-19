import { el } from '../../engine/dom';
import { bool, mod, num, PALETTE } from '../../engine/helpers';
import { asLines, fontString } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Type set at ~1.3× the stage height crawls sideways; only fragments of the strokes
// are ever in frame. One repeat unit = [filled copy + outlined copy]; the offset is
// (t·v) mod measured unit width, so the loop is pixel-seamless. A thin info strip
// runs the other way at a different speed for scale contrast.
const impl: EffectImpl = {
  id: 'huge-scroll',
  defaults: { ...PALETTE.darkCoral },
  posterTime: 2,
  maxChars: 30,
  params: [
    { key: 'size', label: '字高倍率', type: 'range', min: 0.8, max: 1.8, step: 0.05, default: 1.3, unit: '×', hint: '相對於舞台高度' },
    { key: 'outline', label: '交替鏤空', type: 'toggle', default: true },
    { key: 'strip', label: '資訊帶', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const k = ctx.s.intensity;
    const outline = bool(ctx, 'outline', true);
    const strip = bool(ctx, 'strip', true);
    const word = asLines(ctx.text).replace(/\n/g, ' ');
    // in portrait the stage height is huge; cap by width so a glyph still reads as a shape
    const fs = num(ctx, 'size', 1.3) * Math.min(H, W * 1.15) * ctx.s.fontScale;
    const font = fontString(fs, ctx.font.sans, 900);

    const track = el('div', {
      style: { position: 'absolute', left: '0', top: `${H * 0.5}px`, display: 'flex', whiteSpace: 'pre', willChange: 'transform', lineHeight: '1' },
    }, ctx.root);
    const mkUnit = (hollow: boolean) =>
      el('span', {
        text: word,
        style: {
          font, letterSpacing: `${ctx.s.tracking}em`, paddingRight: `${fs * 0.28}px`, color: hollow ? 'transparent' : ctx.s.primary,
          WebkitTextStroke: hollow ? `${Math.max(1.5, fs * 0.012)}px ${ctx.s.primary}` : '',
        },
      }, track);
    const units = [mkUnit(false)];
    if (outline) units.push(mkUnit(true));
    const unitW = Math.max(1, units.reduce((a, u) => a + u.getBoundingClientRect().width, 0));
    const copies = Math.ceil(W / unitW) + 1;
    for (let i = 0; i < copies; i++) for (const u of units) track.appendChild(u.cloneNode(true));
    const speed = W * 0.07 * Math.max(0.1, k) + fs * 0.05; // px / s

    // info strip
    let stripTrack: HTMLDivElement | null = null;
    let stripW = 1;
    const stripH = Math.max(14, Math.min(H, W) * 0.065);
    let stamp: HTMLDivElement | null = null;
    if (strip) {
      const band = el('div', {
        style: { position: 'absolute', left: '0', right: '0', bottom: `${H * 0.07}px`, height: `${stripH}px`, background: ctx.s.secondary, overflow: 'hidden' },
      }, ctx.root);
      stripTrack = el('div', { style: { position: 'absolute', left: '0', top: '0', height: '100%', display: 'flex', alignItems: 'center', whiteSpace: 'pre', willChange: 'transform' } }, band);
      const info = `${word}   ●   25.0330°N 121.5654°E   ●   NIGHT WALK   ●   `;
      const unit = el('span', { text: info, style: { font: fontString(stripH * 0.48, ctx.font.mono, 700), color: ctx.s.background, letterSpacing: '0.08em' } }, stripTrack);
      stripW = Math.max(1, unit.getBoundingClientRect().width);
      const n = Math.ceil(W / stripW) + 1;
      for (let i = 0; i < n; i++) stripTrack.appendChild(unit.cloneNode(true));
      // running timecode in the corner
      stamp = el('div', {
        text: '00:00:00',
        style: { position: 'absolute', right: `${W * 0.04}px`, top: `${H * 0.06}px`, font: fontString(Math.max(9, stripH * 0.42), ctx.font.mono, 700), color: ctx.s.secondary, letterSpacing: '0.1em' },
      }, ctx.root);
    }

    return {
      render(t) {
        const x = -mod(t * speed, unitW);
        track.style.transform = `translate3d(${x}px,-50%,0)`;
        if (stripTrack) {
          const sx = -stripW + mod(t * speed * 1.9, stripW);
          stripTrack.style.transform = `translate3d(${sx}px,0,0)`;
        }
        if (stamp) {
          const f = Math.floor(t * 24);
          const ss = Math.floor(f / 24);
          stamp.textContent = `● ${String(Math.floor(ss / 60)).padStart(2, '0')}:${String(ss % 60).padStart(2, '0')}:${String(f % 24).padStart(2, '0')}`;
        }
      },
    };
  },
};
export default impl;
