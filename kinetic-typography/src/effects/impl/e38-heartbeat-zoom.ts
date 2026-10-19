import { textBlock } from '../../engine/dom';
import { clamp, num, PALETTE } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Cardiac rhythm "lub-dub-pause": a strong beat, a lighter beat ~0.24 s later, then a
// long rest. Each pulse = fast sine attack + exponential release with a slight
// undershoot. Every beat releases a hollow outline copy (text-stroke) that expands
// and fades; a small ECG trace under the text draws the same rhythm.
const impl: EffectImpl = {
  id: 'heartbeat-zoom',
  defaults: { ...PALETTE.pink },
  posterTime: 0.12,
  maxChars: 30,
  params: [
    { key: 'bpm', label: '心率 BPM', type: 'range', min: 40, max: 140, step: 1, default: 68 },
    { key: 'ring', label: '輪廓擴散', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'ecg', label: '顯示心電圖', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: acc } = ctx.s;
    const k = ctx.s.intensity;
    const P = 60 / num(ctx, 'bpm', 68);
    const ringAmt = num(ctx, 'ring', 0.6);
    const showEcg = ctx.s.params.ecg !== false;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.42, maxWidth: W * 0.72, cy: H * (showEcg ? 0.46 : 0.5) });
    const fs = L.fontSize;
    const cx = L.x + L.width / 2;
    const cy = L.y + L.height / 2;
    const origin = `${cx - L.x}px ${cy - L.y}px`;

    // outline echoes behind the main text
    const echoes = Array.from({ length: 6 }, () => {
      const { block } = textBlock(ctx.root, L, {
        style: { color: 'transparent', WebkitTextStroke: `${Math.max(1.2, fs * 0.022)}px ${acc}`, transformOrigin: origin, opacity: 0, willChange: 'transform, opacity' },
      });
      return block;
    });
    const { block: main } = textBlock(ctx.root, L, { color: fg, style: { transformOrigin: origin, willChange: 'transform' } });

    // ECG trace: one SVG path redrawn per frame
    const ecgW = Math.min(W * 0.7, Math.max(L.width, W * 0.4));
    const ecgH = Math.min(H * 0.12, fs * 0.6);
    const ecgY = Math.min(H - ecgH * 0.6, L.y + L.height + fs * 0.3 + ecgH);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', String(ecgW));
    svg.setAttribute('height', String(ecgH * 2));
    Object.assign(svg.style, { position: 'absolute', left: `${W / 2 - ecgW / 2}px`, top: `${ecgY - ecgH}px`, overflow: 'visible', display: showEcg ? 'block' : 'none' });
    const trace = document.createElementNS(NS, 'path');
    trace.setAttribute('fill', 'none');
    trace.setAttribute('stroke', fg);
    trace.setAttribute('stroke-width', String(Math.max(1.5, fs * 0.03)));
    trace.setAttribute('stroke-linejoin', 'round');
    trace.setAttribute('stroke-linecap', 'round');
    svg.appendChild(trace);
    const dot = document.createElementNS(NS, 'circle');
    dot.setAttribute('r', String(Math.max(2.5, fs * 0.045)));
    dot.setAttribute('fill', acc);
    svg.appendChild(dot);
    ctx.root.appendChild(svg);

    const LUB = 0;
    const DUB = Math.min(0.26, P * 0.3);
    const A1 = 0.16 * k;
    const A2 = 0.085 * k;
    // pulse: sine attack (70 ms) then damped release with a light undershoot
    const pulse = (tau: number) => {
      if (tau < 0) return 0;
      const a = 0.07;
      if (tau < a) return Math.sin((Math.PI / 2) * (tau / a));
      const r = tau - a;
      return Math.exp(-r / 0.11) * Math.cos(r * 9);
    };
    const beatScale = (t: number) => {
      const u = ((t % P) + P) % P;
      // include the previous cycle's tail so the loop is seamless
      return 1 + A1 * (pulse(u - LUB) + pulse(u + P - LUB)) + A2 * (pulse(u - DUB) + pulse(u + P - DUB));
    };
    // ECG waveform for one beat period (phase 0..1 of P)
    const ecg = (s: number) => {
      const tt = s * P;
      const spike = (c: number, w: number, h: number) => h * Math.exp(-(((tt - c) / w) ** 2));
      return spike(LUB + 0.02, 0.012, -1) + spike(LUB + 0.045, 0.014, 0.45) + spike(DUB + 0.02, 0.016, -0.55) + spike(DUB + 0.05, 0.02, 0.2) + spike(P * 0.75, 0.06, -0.12);
    };
    const SAMPLES = 120;
    const LIFE = Math.min(1.1, P * 0.9);

    return {
      render(t) {
        const s = beatScale(t);
        main.style.transform = `scale(${s.toFixed(4)})`;
        // echoes: one per beat, alive ~1.1 s
        const nBeat = Math.floor(t / P);
        for (let b = nBeat - 2; b <= nBeat; b++) {
          ([
            [LUB, 1],
            [DUB, 0.6],
          ] as const).forEach(([off, amp], j) => {
            const e = echoes[(((b % 3) + 3) % 3) * 2 + j];
            const age = t - (b * P + off);
            if (age < 0 || age > LIFE || ringAmt <= 0) {
              e.style.opacity = '0';
              return;
            }
            const p = age / LIFE;
            const grow = 1 + (0.15 + amp * 0.55) * ringAmt * k * (1 - (1 - p) ** 3);
            e.style.transform = `scale(${(grow * (1 + amp * A1 * 0.5)).toFixed(4)})`;
            e.style.opacity = String(clamp((1 - p) ** 2 * amp, 0, 1));
          });
        }
        // ECG: scrolling trace, newest sample at the right
        if (showEcg) {
          let d = '';
          for (let i = 0; i <= SAMPLES; i++) {
            const x = (i / SAMPLES) * ecgW;
            const tt = t - (1 - i / SAMPLES) * P * 1.5;
            const ph = (((tt % P) + P) % P) / P;
            const y = ecgH + ecg(ph) * ecgH * 0.9;
            d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
          }
          trace.setAttribute('d', d);
          const ph = (((t % P) + P) % P) / P;
          dot.setAttribute('cx', String(ecgW));
          dot.setAttribute('cy', String(ecgH + ecg(ph) * ecgH * 0.9));
        }
      },
    };
  },
};
export default impl;
