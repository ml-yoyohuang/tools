import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, minSide, mod, num, rgba, str, TAU } from '../../engine/helpers';
import { noise1 } from '../../engine/random';

export default defineEffect({
  id: 'sound-wave',
  code: 'L01',
  nameZh: '聲波',
  nameEn: 'Sound Wave',
  category: 'lines',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '一排直線依「模擬訊號」（由時間與 seed 計算，不讀取音訊）上下伸縮，可切換頻譜或波形模式，峰值帽緩慢落下。',
  tags: ['聲波', 'equalizer', '頻譜', '模擬訊號', '音樂視覺'],
  suitable: ['音樂／Podcast 封面', '直播等待畫面', '語音介面'],
  principle:
    'Canvas 2D，模擬訊號模式：頻譜模式每根線代表一個頻帶 f，高度 = 頻譜斜率 (1−f)^0.6 × 低頻鼓點包絡 exp(−拍內時間/0.16) × 高頻 hi-hat 包絡 × noise1(t, 頻帶) 的平滑抖動；波形模式取樣 Σ aₖ·sin(kₖx − ωₖt) 的絕對值。峰值帽 = max(過去 0.6 s 的高度 − 落下速度 × 經過時間)，全部由 t 與 seed 決定，可 seek。',
  defaultText: '',
  palette: 'POP',
  controls: ['intensity', 'scale', 'secondary', 'accent', 'seed'],
  params: [
    {
      key: 'mode',
      label: '訊號模式',
      type: 'select',
      options: [
        { value: 'spectrum', label: '頻譜（模擬訊號）' },
        { value: 'wave', label: '波形（模擬訊號）' },
      ],
      default: 'spectrum',
    },
    { key: 'bars', label: '線條數量', type: 'range', min: 12, max: 96, step: 1, default: 48 },
    { key: 'bpm', label: '節拍 BPM', type: 'range', min: 60, max: 170, step: 1, default: 112 },
    { key: 'thick', label: '線條粗細', type: 'range', min: 0.15, max: 0.85, step: 0.05, default: 0.55 },
    { key: 'mirror', label: '上下對稱', type: 'toggle', default: true },
    { key: 'peaks', label: '峰值帽', type: 'toggle', default: true },
    { key: 'badge', label: '顯示「模擬訊號」標記', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '一開始即在播放，線條從靜音高度隨第一拍跳起。',
    motion: '低頻線條隨 BPM 鼓點瞬間拉長、指數衰減；高頻線條隨反拍輕顫；整體音量以慢速雜訊起伏。',
    hold: '連續播放，無停頓。',
    exit: '無離場。',
    loop: '訊號為 t 的連續函數，長時間播放保持流暢；同 seed 每次相同。',
  },
  accept: [
    '頻譜模式左側（低頻）線條隨 BPM 同步跳動，右側較短較碎。',
    '波形模式線條高度連成一條向一側移動的波形。',
    '畫面角落標示「模擬訊號」，不播放任何聲音、不要求麥克風。',
    '改變 seed 後線條起伏不同，同 seed 重新整理相同。',
  ],
  limits: [
    '目前只有模擬訊號模式：高度由時間與 seed 計算，不分析真實音訊。',
    '未實作本機音檔／麥克風輸入；若日後加入必須手動啟動、不可自動播放，並明確切換標記。',
  ],
  transparent: true,
  cycle: 8,
  posterTime: 1.1,
  create(ctx) {
    const mode = str(ctx, 'mode', 'spectrum');
    const n = Math.round(num(ctx, 'bars', 48) * (ctx.q < 0.6 ? 0.75 : 1));
    const bpm = num(ctx, 'bpm', 112);
    const thick = num(ctx, 'thick', 0.55);
    const mirror = bool(ctx, 'mirror', true);
    const peaks = bool(ctx, 'peaks', true);
    const badge = bool(ctx, 'badge', true);
    const seed = ctx.seed;
    const intensity = ctx.s.intensity;
    const beat = 60 / bpm;
    const m = minSide(ctx);
    const W = Math.min(ctx.width * 0.86, Math.max(m, ctx.width * 0.6) * 1.2);
    const maxH = Math.min(ctx.height * 0.8, (mirror ? ctx.height * 0.62 : ctx.height * 0.6) * clamp(ctx.s.scale, 0.5, 1.6));
    const pitch = W / n;
    const bw = Math.max(1, pitch * thick);
    const x0 = ctx.width / 2 - W / 2 + pitch / 2;
    const base = mirror ? ctx.height / 2 : ctx.height * 0.5 + maxH / 2;
    // per-band seeded offsets (computed once)
    const bandOff = Array.from({ length: n }, () => ctx.rand() * 100);
    const waves = Array.from({ length: 3 }, (_, k) => ({
      k: (1.5 + k * 2.3 + ctx.rand() * 1.5) * TAU,
      w: (0.6 + ctx.rand() * 0.9) * (k % 2 ? -1 : 1) * TAU,
      a: [1, 0.55, 0.3][k],
      p: ctx.rand() * TAU,
    }));

    const kick = (t: number) => Math.exp(-mod(t, beat) / 0.16);
    const hat = (t: number) => Math.exp(-mod(t - beat / 2, beat) / 0.06);
    const loud = (t: number) => 0.72 + 0.28 * noise1(t * 0.18, seed + 7);

    /** simulated signal amplitude 0..1 for bar i at time t */
    const amp = (i: number, t: number): number => {
      if (t < 0) return 0.04;
      const f = n > 1 ? i / (n - 1) : 0;
      if (mode === 'wave') {
        const x = f;
        let s = 0;
        for (const w of waves) s += w.a * Math.sin(w.k * x - w.w * t + w.p);
        const env = 0.55 + 0.45 * kick(t) * (1 - x * 0.5);
        return clamp(Math.abs(s / 1.85) * env * loud(t) * (0.7 + 0.3 * intensity), 0.03, 1);
      }
      const tilt = Math.pow(1 - f, 0.6) * 0.75 + 0.12;
      const k = kick(t) * Math.pow(1 - f, 2.2);
      const h = hat(t) * Math.pow(f, 1.4) * 0.55;
      const jit = 0.5 + 0.5 * noise1(t * (2.2 + f * 5) + bandOff[i], seed);
      const v = (tilt * (0.3 + 0.55 * jit) + k * 0.6 + h) * loud(t);
      return clamp(0.03 + v * (0.55 + 0.45 * intensity), 0.03, 1);
    };

    const PEAK_WIN = 0.6;
    const PEAK_STEPS = 10;
    const FALL = 1.1; // units per second
    const peakOf = (i: number, t: number) => {
      let p = 0;
      for (let k = 0; k <= PEAK_STEPS; k++) {
        const back = (k / PEAK_STEPS) * PEAK_WIN;
        p = Math.max(p, amp(i, t - back) - FALL * back * back * 1.6);
      }
      return p;
    };

    const label = mode === 'wave' ? '模擬訊號 · WAVE' : '模擬訊號 · SPECTRUM';
    const runtime = canvasRuntime(ctx, (g, t) => {
      g.lineCap = 'round';
      // baseline
      g.strokeStyle = rgba(ctx.s.primary, 0.25);
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x0 - pitch / 2, base);
      g.lineTo(x0 + W - pitch / 2, base);
      g.stroke();
      g.fillStyle = ctx.s.primary;
      for (let i = 0; i < n; i++) {
        const a = amp(i, t);
        const h = Math.max(bw * 0.5, a * maxH);
        const x = x0 + i * pitch - bw / 2;
        if (mirror) g.fillRect(x, base - h / 2, bw, h);
        else g.fillRect(x, base - h, bw, h);
      }
      if (peaks) {
        g.fillStyle = ctx.s.secondary;
        const ph = Math.max(2, bw * 0.35);
        for (let i = 0; i < n; i++) {
          const p = peakOf(i, t) * maxH;
          const x = x0 + i * pitch - bw / 2;
          if (mirror) {
            g.fillRect(x, base - p / 2 - ph - 2, bw, ph);
            g.fillRect(x, base + p / 2 + 2, bw, ph);
          } else g.fillRect(x, base - p - ph - 2, bw, ph);
        }
      }
      if (badge) {
        const fs = clamp(m * 0.032, 9, 15);
        g.font = `700 ${fs}px ${ctx.font.mono}`;
        g.textBaseline = 'middle';
        const tw = g.measureText(label).width;
        const pad = fs * 0.6;
        const bx = fs * 1.2;
        const by = fs * 1.2;
        g.fillStyle = rgba(ctx.s.accent, 0.14);
        g.fillRect(bx, by, tw + pad * 2 + fs, fs * 2);
        g.fillStyle = ctx.s.secondary;
        g.beginPath();
        g.arc(bx + pad + fs * 0.3, by + fs, fs * 0.3, 0, TAU);
        g.fill();
        g.fillStyle = ctx.s.accent;
        g.fillText(label, bx + pad + fs, by + fs);
      }
    });
    return Object.assign(runtime, {
      notice: '模擬訊號模式：線條高度由時間與 seed 計算，不讀取麥克風或音檔，也不播放任何聲音。',
    });
  },
});
