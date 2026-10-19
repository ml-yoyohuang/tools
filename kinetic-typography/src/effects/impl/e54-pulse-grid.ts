import { rgba, stageCanvas } from '../../engine/canvas';
import { bool, clamp, mod, num, PALETTE } from '../../engine/helpers';
import { asLines, fontString, textWidth } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// The word is tiled on a brick grid. On every beat the centre emits a pulse; a cell at
// distance d responds with scale = 1 + A·Σ kernel(τ − d/c)·falloff(d), where the kernel
// is a fast attack + damped elastic rebound. Every 4th beat is an accent. All times are
// taken modulo the 4-beat bar, so the loop is seamless. Only size changes — not brightness.
const impl: EffectImpl = {
  id: 'pulse-grid',
  defaults: { ...PALETTE.coral },
  posterTime: 0.45,
  maxChars: 24,
  params: [
    { key: 'bpm', label: '節拍 BPM', type: 'range', min: 60, max: 180, step: 1, default: 104 },
    { key: 'cols', label: '每列字數', type: 'range', min: 2, max: 9, step: 1, default: 5 },
    { key: 'rings', label: '顯示波前線', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const sc = stageCanvas(ctx);
    const g = sc.g;
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const bpm = num(ctx, 'bpm', 104);
    const beat = 60 / bpm;
    const bar = beat * 4;
    const showRings = bool(ctx, 'rings', true);
    const A = 0.55 * ctx.s.intensity;
    const word = asLines(ctx.text).replace(/\n/g, ' ');
    const fam = ctx.font.sans;
    const wantCols = Math.round(num(ctx, 'cols', 5) * (W / H < 0.8 ? 0.6 : 1));
    // cell width from the requested number of columns; font size from the word width
    const cellW = W / Math.max(1.5, wantCols);
    const w100 = Math.max(1, textWidth(word, 100, fam, 900, ctx.s.tracking));
    let fs = ((cellW * 0.74) / w100) * 100 * ctx.s.fontScale;
    fs = Math.min(fs, H * 0.16);
    // long words: keep them legible (fewer columns) rather than tiny
    fs = Math.max(fs, Math.min(H * 0.075, ((W * 0.8) / w100) * 100));
    const cellH = fs * 1.55;
    const ww = (w100 / 100) * fs;
    const cw = Math.max(cellW, ww * 1.3);
    const font = fontString(fs, fam, 900);
    const cx = W / 2;
    const cy = H / 2;
    const rows = Math.ceil(H / cellH / 2) + 1;
    const cols = Math.ceil(W / cw / 2) + 2;
    const cells: { x: number; y: number; d: number; centre: boolean }[] = [];
    for (let r = -rows; r <= rows; r++) {
      const off = mod(r, 2) ? cw / 2 : 0;
      for (let c = -cols; c <= cols; c++) {
        const x = cx + c * cw + off;
        const y = cy + r * cellH;
        if (x < -cw || x > W + cw || y < -cellH || y > H + cellH) continue;
        cells.push({ x, y, d: Math.hypot(x - cx, (y - cy) * 1.15), centre: r === 0 && c === 0 });
      }
    }
    const maxD = Math.hypot(W / 2, H / 2) * 1.15;
    const c = maxD / (beat * 2.6); // wave speed: reaches the corners in ~2.6 beats
    const decay = maxD * 0.85;

    // kernel: quick attack then a damped elastic rebound (dips below 1)
    const kernel = (tau: number) => {
      if (tau < 0) return 0;
      const atk = 0.07;
      if (tau < atk) return Math.sin((tau / atk) * (Math.PI / 2));
      const u = tau - atk;
      return Math.cos(u * 11) * Math.exp(-u * 4.2);
    };
    const pulseAt = (t: number, d: number) => {
      const tb = mod(t, bar);
      let s = 0;
      // sum the pulses of this bar and the two previous bars (older tails are negligible)
      for (let k = -8; k < 4; k++) {
        const t0 = k * beat;
        const accent = mod(k, 4) === 0 ? 1.35 : 0.75;
        s += accent * kernel(tb - t0 - d / c);
      }
      return s * Math.exp(-d / decay);
    };

    return {
      canvas: sc.canvas,
      render(t) {
        sc.clear(bg);
        // wavefront rings (thin, low contrast)
        if (showRings) {
          const tb = mod(t, bar);
          g.lineWidth = Math.max(1, fs * 0.03);
          for (let k = -4; k < 4; k++) {
            const age = tb - k * beat;
            if (age < 0) continue;
            const r = age * c;
            if (r > maxD * 1.2) continue;
            const a = mod(k, 4) === 0 ? 0.5 : 0.25;
            g.strokeStyle = rgba(fg, a * Math.exp(-r / decay) * (1 - r / (maxD * 1.2)));
            g.beginPath();
            g.ellipse(cx, cy, r, r / 1.15, 0, 0, Math.PI * 2);
            g.stroke();
          }
        }
        g.font = font;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.letterSpacing = `${ctx.s.tracking * fs}px`;
        const list = cells.map((cl) => ({ cl, s: clamp(1 + A * pulseAt(t, cl.d), 0.35, 2.2) }));
        list.sort((a, b) => a.s - b.s);
        for (const { cl, s } of list) {
          g.save();
          g.translate(cl.x, cl.y);
          g.scale(s, s);
          g.fillStyle = cl.centre ? acc : fg;
          g.fillText(word, 0, 0);
          g.restore();
        }
      },
    };
  },
};
export default impl;
