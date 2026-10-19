import { el } from '../../engine/dom';
import { bool, clamp, ease, mod, num } from '../../engine/helpers';
import { asLines, fontString } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Caution tapes crossing in an X. Each tape is a long rotated strip with hazard
// stripes on both edges and a drop shadow; the text track inside slides by
// (t·v) mod unitWidth so the flow is seamless. On entry each tape is yanked in
// along its own axis (expo.out) and snaps taut with a damped wobble.
const impl: EffectImpl = {
  id: 'tape-cross',
  defaults: { background: '#F4F1E8', primary: '#101114', secondary: '#D7FF00' },
  posterTime: 2,
  maxChars: 24,
  params: [
    { key: 'tapes', label: '膠帶數', type: 'range', min: 2, max: 4, step: 1, default: 2 },
    { key: 'angle', label: '交叉角度', type: 'range', min: 8, max: 50, step: 1, default: 24, unit: '°' },
    { key: 'stripes', label: '斜紋邊', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: ink, secondary: tapeColor } = ctx.s;
    const nT = Math.round(num(ctx, 'tapes', 2));
    // tall stages get a steeper X so the tapes still span the frame
    const ang = num(ctx, 'angle', 24) * Math.pow(clamp(ctx.height / ctx.width, 1, 2), 0.6);
    const stripes = bool(ctx, 'stripes', true);
    const k = Math.max(0, ctx.s.intensity);
    const diag = Math.hypot(W, H);
    const len = diag * 1.5;
    const tapeH = clamp(Math.min(W, H) * 0.19, 34, 220);
    const edge = tapeH * 0.15;
    const fs = Math.min(tapeH - edge * 2, tapeH) * 0.62 * clamp(ctx.s.fontScale, 0.5, 1.25);
    const word = asLines(ctx.text).replace(/\n/g, ' ');
    const stripeW = edge * 1.1;

    // tape configs: [rotation, offsetY (px, across the stage), flow direction, inverted colours]
    const confs: [number, number, number, boolean][] = [
      [-ang, 0, 1, false],
      [ang, 0, -1, true],
      [ang * 0.25 + 4, H * 0.3, 1, false],
      [-ang * 0.3 - 6, -H * 0.3, -1, true],
    ].slice(0, nT) as [number, number, number, boolean][];

    const tapes = confs.map(([rot, oy, dirn, inv], ti) => {
      const face = inv ? ink : tapeColor;
      const txt = inv ? tapeColor : ink;
      const wrap = el(
        'div',
        {
          style: {
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: `${len}px`,
            height: `${tapeH}px`,
            marginLeft: `${-len / 2}px`,
            marginTop: `${-tapeH / 2}px`,
            zIndex: String(ti + 1),
            willChange: 'transform',
          },
        },
        ctx.root,
      );
      const tape = el(
        'div',
        {
          style: {
            position: 'absolute',
            inset: '0',
            background: face,
            overflow: 'hidden',
            boxShadow: `0 ${tapeH * 0.12}px ${tapeH * 0.28}px rgba(0,0,0,.32), 0 1px 0 rgba(255,255,255,.18) inset`,
          },
        },
        wrap,
      );
      // plastic sheen
      el('div', { style: { position: 'absolute', inset: '0', background: 'linear-gradient(180deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 38%, rgba(0,0,0,0) 70%, rgba(0,0,0,.14) 100%)', zIndex: '3', pointerEvents: 'none' } }, tape);
      const stripeBg = `repeating-linear-gradient(-45deg, ${txt} 0 ${stripeW}px, ${face} ${stripeW}px ${stripeW * 2}px)`;
      const edges: HTMLDivElement[] = [];
      if (stripes) {
        for (const side of ['top', 'bottom'] as const) {
          edges.push(el('div', { style: { position: 'absolute', left: '0', width: `${len + stripeW * 6}px`, [side]: '0', height: `${edge}px`, backgroundImage: stripeBg, willChange: 'transform' } }, tape));
        }
      } else {
        for (const side of ['top', 'bottom'] as const)
          el('div', { style: { position: 'absolute', left: '0', right: '0', [side]: `${edge * 0.35}px`, height: `${Math.max(1, edge * 0.18)}px`, background: txt } }, tape);
      }
      const track = el('div', { style: { position: 'absolute', left: '0', top: '50%', display: 'flex', alignItems: 'center', whiteSpace: 'pre', willChange: 'transform' } }, tape);
      const unit = el('div', { style: { display: 'flex', alignItems: 'center', flex: 'none' } }, track);
      el(
        'span',
        {
          text: word,
          style: {
            font: fontString(fs, ctx.font.sans, 900),
            letterSpacing: `${ctx.s.tracking + 0.06}em`,
            lineHeight: '1',
            color: txt,
            padding: `0 ${fs * 0.55}px`,
          },
        },
        unit,
      );
      // diamond separator (drawn, so no extra glyph is needed)
      el('div', { style: { width: `${fs * 0.34}px`, height: `${fs * 0.34}px`, background: txt, transform: 'rotate(45deg)', flex: 'none' } }, unit);
      const unitW = Math.max(10, unit.getBoundingClientRect().width);
      const copies = Math.ceil(len / unitW) + 2;
      for (let i = 1; i < copies; i++) track.appendChild(unit.cloneNode(true));
      const v = (W / 6.5 + 40) * (1 + ti * 0.12) * Math.max(0.05, k) * dirn;
      return { wrap, track, edges, unitW, v, rot, oy, dirn, start: 0.12 + ti * 0.28 };
    });

    const pull = ease('expo.out');
    const PULL_DUR = 1.05;

    return {
      render(t) {
        for (const tp of tapes) {
          const u = clamp((t - tp.start) / PULL_DUR, 0, 1);
          // yanked in along its own axis from the side the text flows from
          const slide = (1 - pull(u)) * len * 0.95 * -tp.dirn;
          // snap taut: damped wobble after the pull
          const since = Math.max(0, t - tp.start - PULL_DUR * 0.35);
          const wob = u <= 0 ? 0 : Math.exp(-since * 5.5) * Math.sin(since * 22) * 2.2 * k;
          const sy = u <= 0 ? 1 : 1 + Math.exp(-since * 6) * Math.sin(since * 26) * 0.06 * k;
          tp.wrap.style.visibility = u <= 0 ? 'hidden' : 'visible';
          tp.wrap.style.transform = `translate3d(0,${tp.oy}px,0) rotate(${tp.rot + wob}deg) translate3d(${slide}px,0,0) scaleY(${sy})`;
          const x = mod(t * Math.abs(tp.v), tp.unitW);
          const off = tp.v > 0 ? -tp.unitW + x : -x;
          tp.track.style.transform = `translate3d(${off}px,-50%,0)`;
          // stripes crawl with the tape (period = 2 stripe widths along x·√2)
          const sp = stripeW * 2 * Math.SQRT2;
          const so = tp.v > 0 ? -sp + mod(t * Math.abs(tp.v), sp) : -mod(t * Math.abs(tp.v), sp);
          for (const e of tp.edges) e.style.transform = `translate3d(${so - sp}px,0,0)`;
        }
      },
    };
  },
};
export default impl;
