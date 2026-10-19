import { el } from '../../engine/dom';
import { clamp, ease, lerp, num, PALETTE, str } from '../../engine/helpers';
import { fontString, layoutText, phrases } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// News lower-third: phrase 1 is a fixed tag box, the rest rotate inside an
// overflow-hidden mask. The outgoing headline leaves with power3.in, the incoming
// one arrives line by line with expo.out; the underline morphs between the two
// headline widths (dipping in the middle) and fills up as a hold-time progress bar.
const impl: EffectImpl = {
  id: 'headline-swap',
  defaults: { ...PALETTE.paperInk },
  posterTime: 1.6,
  maxChars: 48,
  textHint: '第一段是固定標籤，其餘用「／」分隔的詞會輪流成為標題。',
  hide: ['intensity'],
  params: [
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.8, max: 5, step: 0.1, default: 2, unit: 's' },
    { key: 'dir', label: '進場方向', type: 'select', default: 'up', options: [{ value: 'up', label: '由下往上' }, { value: 'down', label: '由上往下' }] },
  ],
  create(ctx): EffectRuntime {
    const list = phrases(ctx.text);
    const label = list.length > 1 ? list[0] : 'LIVE';
    const heads = list.length > 1 ? list.slice(1) : list;
    const hold = num(ctx, 'hold', 2);
    const dir = str(ctx, 'dir', 'up') === 'down' ? -1 : 1;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const W = ctx.width;
    const H = ctx.height;
    const portrait = H > W * 1.1;

    // Fit every headline, then use the smallest size for all so the mask never changes height.
    const maxW = W * (portrait ? 0.84 : 0.8);
    const lays = heads.map((h) => layoutText(ctx, h, { align: 'left', maxWidth: maxW, maxHeight: H * (portrait ? 0.34 : 0.42), lineHeight: 1.12, fill: 0.9 }));
    const fs = Math.min(...lays.map((l) => l.fontSize));
    const lh = fs * 1.12;
    const items = lays.map((L) => {
      const k = fs / L.fontSize;
      return { lines: L.lines.map((l) => l.text), width: Math.max(...L.lines.map((l) => l.width)) * k };
    });
    const maxLines = Math.max(...items.map((i) => i.lines.length));
    const maskH = maxLines * lh + fs * 0.08;
    const tagFs = Math.max(10, Math.min(fs * 0.36, H * 0.06));
    const blockW = Math.max(...items.map((i) => i.width), tagFs * 4);
    const ulH = Math.max(3, fs * 0.075);
    const gap = tagFs * 0.7;
    const blockH = tagFs * 1.7 + gap + maskH + ulH * 3;
    const left = (W - blockW) / 2;
    const top = (H - blockH) / 2;

    const root = el('div', { style: { position: 'absolute', left: `${left}px`, top: `${top}px`, width: `${blockW}px`, height: `${blockH}px` } }, ctx.root);
    // tag box
    const tag = el(
      'div',
      {
        style: {
          position: 'absolute',
          left: '0',
          top: '0',
          display: 'flex',
          alignItems: 'center',
          gap: `${tagFs * 0.45}px`,
          padding: `${tagFs * 0.32}px ${tagFs * 0.6}px ${tagFs * 0.32}px ${tagFs * 0.45}px`,
          background: acc,
          color: bg,
          font: fontString(tagFs, ctx.font.sans, 900),
          lineHeight: '1.05',
          letterSpacing: '0.08em',
          whiteSpace: 'pre',
          transformOrigin: '0 50%',
        },
      },
      root,
    );
    const dot = el('div', { style: { width: `${tagFs * 0.42}px`, height: `${tagFs * 0.42}px`, borderRadius: '50%', background: bg, flex: 'none' } }, tag);
    el('span', { text: label }, tag);
    const tagRule = el('div', { style: { position: 'absolute', left: '0', top: `${tagFs * 1.7 + gap * 0.5}px`, height: '1px', width: '100%', background: fg, opacity: 0.18 } }, root);
    void tagRule;

    // headline mask
    const maskTop = tagFs * 1.7 + gap;
    const mask = el('div', { style: { position: 'absolute', left: '0', top: `${maskTop}px`, width: `${blockW + fs}px`, height: `${maskH}px`, overflow: 'hidden' } }, root);
    const heads$ = items.map((it) =>
      it.lines.map((line, li) =>
        el(
          'div',
          {
            text: line,
            style: {
              position: 'absolute',
              left: '0',
              top: `${li * lh}px`,
              font: fontString(fs, ctx.font.sans, 900),
              lineHeight: `${lh}px`,
              letterSpacing: `${ctx.s.tracking}em`,
              whiteSpace: 'pre',
              color: fg,
              willChange: 'transform',
              visibility: 'hidden',
            },
          },
          mask,
        ),
      ),
    );
    // underline track + morphing bar + progress
    const ulTop = maskTop + maskH + ulH;
    const ul = el('div', { style: { position: 'absolute', left: '0', top: `${ulTop}px`, height: `${ulH}px`, width: '1px', background: fg, opacity: 0.16, transformOrigin: '0 0' } }, root);
    const bar = el('div', { style: { position: 'absolute', left: '0', top: `${ulTop}px`, height: `${ulH}px`, width: '1px', background: acc, transformOrigin: '0 0' } }, root);

    const inDur = 0.85;
    const outDur = 0.45;
    const delay = 0.28; // incoming waits until the old headline is half way out
    const slot = hold + inDur + delay; // each headline owns one slot; its exit overlaps the next entrance
    const n = items.length;
    const period = slot * n;
    const intro = 0.25;
    const eIn = ease('expo.out');
    const eOut = ease('power2.in');
    const eW = ease('power2.inOut');
    const travel = maskH + fs * 0.2;

    const place = (hi: number, p: number, entering: boolean) => {
      // p: 0..1 progress of the entrance or exit
      heads$[hi].forEach((node, li) => {
        const st = clamp((p * (entering ? inDur : outDur) - li * 0.07) / ((entering ? inDur : outDur) - (heads$[hi].length - 1) * 0.07), 0, 1);
        const y = entering ? (1 - eIn(st)) * travel * dir : -eOut(st) * travel * dir;
        const skew = entering ? (1 - eIn(st)) * -6 * dir : eOut(st) * 4 * dir;
        node.style.visibility = 'visible';
        node.style.transform = `translate3d(0,${y}px,0) skewY(${skew}deg)`;
      });
    };

    let shown: number[] = [];
    return {
      settle: intro + inDur + hold * 0.5,
      render(time) {
        const vis: number[] = [];
        let cur: number;
        let prev = -1;
        let pIn: number;
        let pOut = 1;
        let local: number;
        if (time < intro + slot) {
          cur = 0;
          local = time - intro;
          pIn = clamp(local / inDur, 0, 1);
        } else {
          const tt = (time - intro - slot) % period;
          const k = Math.floor(tt / slot);
          cur = (k + 1) % n;
          prev = k % n;
          local = tt - k * slot;
          pIn = clamp((local - delay) / inDur, 0, 1);
          pOut = clamp(local / outDur, 0, 1);
        }
        if (prev === cur) {
          // single headline: exit fully, then re-enter
          if (local < outDur) place(cur, pOut, false);
          else place(cur, clamp((local - outDur) / inDur, 0, 1), true);
        } else {
          if (prev >= 0 && pOut < 1) {
            place(prev, pOut, false);
            vis.push(prev);
          }
          place(cur, pIn, true);
        }
        if (!vis.includes(cur)) vis.push(cur);
        for (const i of shown) if (!vis.includes(i)) heads$[i].forEach((node) => (node.style.visibility = 'hidden'));
        shown = vis;

        // underline: morph old → new width with a dip, then fill as hold progress
        const wNew = items[cur].width;
        const wOld = prev >= 0 ? items[prev].width : 0;
        const m = clamp(local / (inDur * 0.9 + delay), 0, 1);
        const dip = prev >= 0 ? 1 - 0.55 * Math.sin(Math.PI * m) : 1;
        const w = Math.max(0, lerp(wOld, wNew, eW(m)) * dip);
        ul.style.transform = `scaleX(${w})`;
        const fill = clamp((local - inDur * 0.6) / (hold + inDur * 0.4), 0, 1);
        bar.style.transform = `scaleX(${Math.max(0, w * (prev >= 0 || time > intro ? 0.18 + 0.82 * fill : 0))})`;

        // tag: kick on every swap, dot breathes
        const kick = Math.exp(-Math.max(0, local) * 9) * (local >= 0 ? 1 : 0);
        tag.style.transform = `translateX(${kick * -tagFs * 0.25}px) scaleX(${1 + kick * 0.06})`;
        dot.style.opacity = String(0.35 + 0.65 * (0.5 + 0.5 * Math.cos(time * Math.PI * 2 * 1.1)));
      },
    };
  },
};
export default impl;
