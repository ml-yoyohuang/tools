import { rgba, stageCanvas } from '../../engine/canvas';
import { el, listen } from '../../engine/dom';
import { clamp, mod, num, PALETTE } from '../../engine/helpers';
import { hash2, noise1 } from '../../engine/random';
import { fontString, layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// Each glyph listens to one frequency band: its height, weight (variable font,
// 300–900) and lift follow that band; the global volume opens the tracking and
// pulses the whole line on kicks. Default source is a deterministic, seeded
// "drum machine" spectrum (pure function of t). In detail mode the user may pick a
// local audio file: only then an AudioContext + AnalyserNode is created (no mic).

const BANDS = 32;

/** Deterministic spectrum at time t (120 BPM pattern). */
function simSpectrum(t: number, seed: number, out: Float32Array) {
  const beat = 0.5;
  const bt = mod(t, beat * 4); // one bar
  const kickT = mod(t, beat);
  const kick = Math.exp(-kickT * 9) * (Math.floor(bt / beat) === 3 && kickT > 0.25 ? 0.6 : 1);
  const kick2 = mod(t + beat * 0.75, beat * 2) < 0.06 ? 0.7 : 0; // syncopated ghost kick
  const snareT = mod(t - beat, beat * 2);
  const snare = Math.exp(-snareT * 7);
  const hatT = mod(t, beat / 2);
  const hat = Math.exp(-hatT * 22) * (0.55 + 0.45 * hash2(Math.floor(t / (beat / 2)), 7, seed));
  const bar = Math.floor(t / (beat * 4));
  for (let b = 0; b < BANDS; b++) {
    const f = b / (BANDS - 1);
    const low = Math.exp(-f * 9) * (kick + kick2 * Math.exp(-mod(t + beat * 0.75, beat * 2) * 12));
    const mid = Math.exp(-((f - 0.38) ** 2) / 0.02) * snare * 0.85;
    const high = Math.exp(-((f - 0.82) ** 2) / 0.03) * hat * 0.7;
    // a little seeded melody wandering through the mids
    const mel = 0.22 * (0.5 + 0.5 * noise1(t * 2.2 + b * 0.35 + bar * 3.1, seed)) * Math.exp(-((f - 0.55) ** 2) / 0.06);
    const floor = 0.06 + 0.05 * (0.5 + 0.5 * noise1(t * 4 + b, seed + 3));
    out[b] = clamp(low + mid + high + mel + floor, 0, 1);
  }
  return kick;
}

const btnStyle = (on: boolean) => ({
  font: '600 12px system-ui, sans-serif',
  padding: '6px 11px',
  borderRadius: '999px',
  border: '1px solid rgba(255,255,255,.35)',
  background: on ? 'rgba(215,255,0,.92)' : 'rgba(16,17,20,.72)',
  color: on ? '#101114' : '#F4F1E8',
  cursor: 'pointer',
  backdropFilter: 'blur(6px)',
});

const impl: EffectImpl = {
  id: 'audio-reactive',
  defaults: { ...PALETTE.limeOnDark },
  posterTime: 2.02,
  maxChars: 24,
  params: [
    { key: 'react', label: '反應強度', type: 'range', min: 0.3, max: 2, step: 0.05, default: 1, unit: '×' },
    { key: 'bars', label: '顯示頻譜條', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const sc = stageCanvas(ctx);
    const { g } = sc;
    const W = ctx.width;
    const H = ctx.height;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.42, maxWidth: W * 0.72, weight: 900 });
    const fs = L.fontSize;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const react = num(ctx, 'react', 1) * clamp(ctx.s.intensity, 0.1, 2);
    const showBars = ctx.s.params.bars !== false;
    const spec = new Float32Array(BANDS);
    const smooth = new Float32Array(BANDS);
    const n = L.chars.length;
    // band per glyph: spread across the useful range (skip the very top)
    const bandOf = L.chars.map((_, i) => Math.round((n === 1 ? 0.2 : i / (n - 1)) * (BANDS * 0.8 - 1)));

    // ---- optional real audio (detail only, created on user action) ----------
    let actx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let audio: HTMLAudioElement | null = null;
    let url = '';
    let fbin: Uint8Array<ArrayBuffer> | null = null;
    let useFile = false;
    const offs: (() => void)[] = [];
    if (ctx.mode === 'detail') {
      const bar = el('div', { style: { position: 'absolute', left: '10px', top: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' } }, ctx.ui);
      const simBtn = el('button', { text: '模擬頻譜', attrs: { type: 'button', 'aria-pressed': 'true' } }, bar);
      const fileBtn = el('button', { text: '選擇本機音檔', attrs: { type: 'button', 'aria-pressed': 'false' } }, bar);
      const input = el('input', { attrs: { type: 'file', accept: 'audio/*', 'aria-label': '選擇本機音檔', tabindex: '-1' }, style: { display: 'none' } }, bar);
      const status = el('span', { text: '模擬中', attrs: { 'aria-live': 'polite' }, style: { font: '500 11px system-ui, sans-serif', color: 'rgba(244,241,232,.75)', padding: '0 4px', textShadow: '0 1px 2px rgba(0,0,0,.6)' } }, bar);
      const sync = () => {
        Object.assign(simBtn.style, btnStyle(!useFile));
        Object.assign(fileBtn.style, btnStyle(useFile));
        simBtn.setAttribute('aria-pressed', String(!useFile));
        fileBtn.setAttribute('aria-pressed', String(useFile));
      };
      sync();
      offs.push(
        listen(simBtn, 'click', () => {
          useFile = false;
          audio?.pause();
          status.textContent = '模擬中';
          sync();
        }),
        listen(fileBtn, 'click', () => input.click()),
        listen(input, 'change', () => {
          const file = input.files?.[0];
          if (!file) return;
          try {
            if (!actx) {
              const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
              actx = new AC();
              analyser = actx.createAnalyser();
              analyser.fftSize = 1024;
              analyser.smoothingTimeConstant = 0.72;
              fbin = new Uint8Array(analyser.frequencyBinCount);
              audio = new Audio();
              audio.loop = true;
              const srcNode = actx.createMediaElementSource(audio);
              srcNode.connect(analyser);
              analyser.connect(actx.destination);
            }
            if (url) URL.revokeObjectURL(url);
            url = URL.createObjectURL(file);
            audio!.src = url;
            void actx.resume();
            void audio!.play().catch(() => (status.textContent = '無法播放此檔案'));
            useFile = true;
            status.textContent = `播放：${file.name}`;
          } catch {
            useFile = false;
            status.textContent = '此瀏覽器不支援 Web Audio';
          }
          sync();
          input.value = '';
        }),
      );
    }

    const readFile = () => {
      if (!analyser || !fbin || !actx) return 0;
      analyser.getByteFrequencyData(fbin);
      // log-spaced bands from ~40 Hz to ~14 kHz
      const ny = actx.sampleRate / 2;
      const N = fbin.length;
      let vol = 0;
      for (let b = 0; b < BANDS; b++) {
        const f0 = 40 * Math.pow(14000 / 40, b / BANDS);
        const f1 = 40 * Math.pow(14000 / 40, (b + 1) / BANDS);
        const i0 = clamp(Math.floor((f0 / ny) * N), 0, N - 1);
        const i1 = clamp(Math.ceil((f1 / ny) * N), i0 + 1, N);
        let m = 0;
        for (let i = i0; i < i1; i++) m = Math.max(m, fbin[i]);
        spec[b] = clamp((m / 255 - 0.25) / 0.7, 0, 1);
        vol += spec[b];
      }
      return clamp((spec[0] + spec[1] + spec[2]) / 3, 0, 1) * 0.8 + (vol / BANDS) * 0.2;
    };

    const fontCache = new Map<number, string>();
    const fontFor = (w: number) => {
      let f = fontCache.get(w);
      if (!f) fontCache.set(w, (f = fontString(fs, L.family, w)));
      return f;
    };

    return {
      canvas: sc.canvas,
      render(t, dt) {
        let kick: number;
        if (useFile && analyser) kick = readFile();
        else kick = simSpectrum(t, ctx.seed, spec);
        // light smoothing on the way down only (attack stays sharp); exact on seek
        const fall = dt > 0 && useFile ? 1 - Math.exp(-dt * 14) : 1;
        let vol = 0;
        for (let b = 0; b < BANDS; b++) {
          smooth[b] = spec[b] > smooth[b] ? spec[b] : smooth[b] + (spec[b] - smooth[b]) * fall;
          vol += smooth[b];
        }
        vol /= BANDS;

        sc.clear(bg);
        // spectrum bars (subtle), mirrored from the bottom and top edges
        if (showBars) {
          const bwid = W / BANDS;
          for (let b = 0; b < BANDS; b++) {
            const v = smooth[b];
            const h = v * H * 0.22;
            g.fillStyle = rgba(acc, 0.1 + 0.16 * v);
            g.fillRect(b * bwid + bwid * 0.18, H - h, bwid * 0.64, h);
            g.fillStyle = rgba(acc, 0.05 + 0.06 * v);
            g.fillRect(b * bwid + bwid * 0.18, 0, bwid * 0.64, h * 0.4);
          }
        }
        // glyphs
        const pulse = 1 + 0.07 * kick * react;
        const track = 1 + 0.22 * vol * react;
        const cx = L.x + L.width / 2;
        const cy = L.y + L.height / 2;
        g.save();
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        for (let i = 0; i < n; i++) {
          const c = L.chars[i];
          const e = clamp(smooth[bandOf[i]] * react, 0, 1.4);
          const w = clamp(Math.round((300 + 600 * Math.min(1, e)) / 100) * 100, 100, 900);
          const x = cx + (c.cx - cx) * track * pulse;
          const y = cy + (c.cy - cy) * pulse - fs * 0.16 * e;
          const sy = 0.82 + 0.38 * e;
          const sx = 1 + 0.06 * e;
          g.font = fontFor(w);
          if (e > 0.7) {
            // beat echo: an outline copy pushed further out
            g.save();
            const m = 1 + 0.22 * (e - 0.7);
            g.translate(x, y + fs * 0.42);
            g.scale(sx * m, sy * m);
            g.strokeStyle = rgba(acc, clamp((e - 0.7) * 1.6, 0, 0.7));
            g.lineWidth = Math.max(1, fs * 0.012);
            g.strokeText(c.ch, 0, -fs * 0.42);
            g.restore();
          }
          g.save();
          g.translate(x, y + fs * 0.42);
          g.scale(sx, sy);
          g.fillStyle = fg;
          g.fillText(c.ch, 0, -fs * 0.42);
          g.restore();
        }
        g.restore();
      },
      dispose() {
        offs.forEach((f) => f());
        if (audio) {
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
        }
        if (url) URL.revokeObjectURL(url);
        if (actx) void actx.close().catch(() => undefined);
        actx = null;
        analyser = null;
      },
    };
  },
};
export default impl;
