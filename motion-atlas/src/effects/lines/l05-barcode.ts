import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, easeInOut, minSide, num, rgba } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { C } from '../../engine/palette';

// EAN-13 module tables (L / G / R codes) — used to build a realistic bar rhythm.
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = L.map((c) => c.replace(/./g, (b) => (b === '1' ? '0' : '1')));
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

interface Bar {
  x: number; // module start
  w: number; // module width
  guard: boolean;
  digit: number; // index of the digit (1–12) the bar belongs to, -1 for guards
}

function digitsFor(k: number, seed: number): number[] {
  const d = Array.from({ length: 12 }, (_, j) => Math.floor(hash2(k, j, seed) * 10));
  let sum = 0;
  d.forEach((v, j) => (sum += v * (j % 2 ? 3 : 1)));
  d.push((10 - (sum % 10)) % 10);
  return d;
}

function barsFor(d: number[]): Bar[] {
  const segs: { bits: string; guard: boolean; digit: number }[] = [{ bits: '101', guard: true, digit: -1 }];
  const par = PARITY[d[0]];
  for (let j = 1; j <= 6; j++) segs.push({ bits: (par[j - 1] === 'L' ? L : G)[d[j]], guard: false, digit: j });
  segs.push({ bits: '01010', guard: true, digit: -1 });
  for (let j = 7; j <= 12; j++) segs.push({ bits: R[d[j]], guard: false, digit: j });
  segs.push({ bits: '101', guard: true, digit: -1 });
  const bars: Bar[] = [];
  let x = 0;
  for (const s of segs) {
    let run = 0;
    for (let b = 0; b <= s.bits.length; b++) {
      const on = b < s.bits.length && s.bits[b] === '1';
      if (on) run++;
      else if (run) {
        bars.push({ x: x + b - run, w: run, guard: s.guard, digit: s.digit });
        run = 0;
      }
    }
    x += s.bits.length;
  }
  return bars; // always 30 bars for EAN-13
}

export default defineEffect({
  id: 'barcode',
  code: 'L05',
  nameZh: '條碼',
  nameEn: 'Barcode',
  category: 'lines',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '垂直條碼線的粗細與位置平滑滑動到下一組號碼，下方數字以翻滾方式同步切換。',
  tags: ['條碼', 'barcode', '數字', '資訊感', '線條節奏'],
  suitable: ['商品／電商主視覺', '票券與標籤', '科技資訊感背景'],
  principle:
    'Canvas 2D：依 EAN-13 的 L／G／R 模組表把 13 位數字（含檢查碼）轉成 95 個模組、固定 30 根黑條；號碼 k 由 hash2(k, 位數, seed) 產生。切換時第 i 根條的起點與寬度 x = lerp(舊, 新, ease(p − 延遲ᵢ))，延遲由左至右遞增；同一位數的數字在其條碼移動的同一時段上下翻滾。',
  defaultText: '',
  palette: 'MONO',
  colors: { background: C.white, primary: C.black, secondary: C.red, accent: '#8A8A8A' },
  controls: ['scale', 'secondary', 'seed'],
  params: [
    { key: 'hold', label: '號碼停留', type: 'range', min: 0.6, max: 4, step: 0.1, default: 1.6, unit: 's' },
    { key: 'morph', label: '切換時間', type: 'range', min: 0.3, max: 2, step: 0.1, default: 0.9, unit: 's' },
    { key: 'stagger', label: '由左至右延遲', type: 'range', min: 0, max: 0.8, step: 0.05, default: 0.45 },
    { key: 'scan', label: '掃描紅線', type: 'toggle', default: true },
    { key: 'digits', label: '顯示數字', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '一開始即顯示第一組號碼。',
    motion: '條碼線由左至右依序滑動、變粗變細到新號碼的位置（ease-in-out），數字同步向上翻滾。',
    hold: '每組號碼停留約 1.6 秒，紅色掃描線來回掃過。',
    exit: '下一次切換直接接續，無淡出。',
    loop: '號碼由 seed 決定的序列無限輪替。',
  },
  accept: [
    '條碼線在切換時是滑動與粗細漸變，不是整張瞬間替換。',
    '每位數字切換時，正上方那一組條碼也在同時移動。',
    '護線（左、中、右）較長且位置不變。',
    '換 seed 後號碼序列不同。',
  ],
  limits: ['此為視覺圖樣，條紋依 EAN-13 規則排列但不保證可被掃描器讀取；切換中的中間狀態不是有效條碼。'],
  transparent: true,
  cycle: 10,
  posterTime: 1,
  create(ctx) {
    const hold = num(ctx, 'hold', 1.6);
    const morph = num(ctx, 'morph', 0.9);
    const stagger = num(ctx, 'stagger', 0.45);
    const scan = bool(ctx, 'scan', true);
    const showDigits = bool(ctx, 'digits', true);
    const seed = ctx.seed;
    const period = hold + morph;
    const m = minSide(ctx);
    const totalMods = 95 + 11 + 4; // quiet zone left (for the first digit) + right
    const W = Math.min(ctx.width * 0.86, m * 1.35) * clamp(ctx.s.scale, 0.5, 1.6) / 1.15;
    const mw = W / totalMods;
    const barH = Math.min(ctx.height * 0.5, W * 0.55);
    const guardExt = mw * 5;
    const fs = mw * 9.5;
    const blockH = barH + (showDigits ? fs * 1.15 : guardExt);
    const left = ctx.width / 2 - W / 2 + mw * 11;
    const top = ctx.height / 2 - blockH / 2;
    const cache = new Map<number, { d: number[]; bars: Bar[] }>();
    const code = (k: number) => {
      let c = cache.get(k);
      if (!c) {
        const d = digitsFor(k, seed);
        c = { d, bars: barsFor(d) };
        if (cache.size > 24) cache.clear();
        cache.set(k, c);
      }
      return c;
    };
    // where each digit sits (module x of its centre)
    const digitX = (j: number) => (j === 0 ? -6 : j <= 6 ? 3 + (j - 1) * 7 + 3.5 : 50 + (j - 7) * 7 + 3.5);
    const span = 1 - stagger;
    const localP = (p: number, xMod: number) => {
      const delay = (xMod / 95) * stagger;
      return easeInOut(clamp((p - delay) / Math.max(0.05, span), 0, 1));
    };

    return canvasRuntime(ctx, (g, t) => {
      const tt = Math.max(0, t);
      const k = Math.floor(tt / period);
      const inP = tt - k * period;
      const p = inP < hold ? 0 : (inP - hold) / morph;
      const A = code(k);
      const B = code(k + 1);
      g.fillStyle = ctx.s.primary;
      for (let i = 0; i < A.bars.length; i++) {
        const a = A.bars[i];
        const b = B.bars[i];
        const e = a.guard ? 0 : localP(p, (a.x + b.x) / 2);
        const x = a.x + (b.x - a.x) * e;
        const w = a.w + (b.w - a.w) * e;
        const h = barH + (a.guard ? guardExt : 0);
        g.fillRect(left + x * mw, top, w * mw, h);
      }
      if (showDigits) {
        g.font = `600 ${fs}px ${ctx.font.mono}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const ty = top + barH + fs * 0.62;
        for (let j = 0; j < 13; j++) {
          const xm = digitX(j);
          const x = left + xm * mw;
          const e = j === 0 ? easeInOut(clamp(p / Math.max(0.05, span), 0, 1)) : localP(p, xm);
          const da = A.d[j];
          const db = B.d[j];
          if (da === db || e <= 0 || e >= 1) {
            g.fillStyle = ctx.s.primary;
            g.fillText(String(e >= 1 ? db : da), x, ty);
            continue;
          }
          g.save();
          g.beginPath();
          g.rect(x - fs * 0.5, ty - fs * 0.6, fs, fs * 1.2);
          g.clip();
          g.fillStyle = ctx.s.primary;
          g.fillText(String(da), x, ty - e * fs * 1.1);
          g.fillText(String(db), x, ty + (1 - e) * fs * 1.1);
          g.restore();
        }
      }
      if (scan && p === 0) {
        const s = inP / hold;
        const u = 0.5 - 0.5 * Math.cos(s * Math.PI * 2);
        const x = left - mw * 4 + u * (95 + 8) * mw;
        const a = Math.sin(Math.min(1, s) * Math.PI);
        g.fillStyle = rgba(ctx.s.secondary, 0.18 * a);
        g.fillRect(x - mw * 3, top - mw * 3, mw * 6, barH + guardExt + mw * 6);
        g.fillStyle = rgba(ctx.s.secondary, 0.95 * a);
        g.fillRect(x - 1, top - mw * 3, 2, barH + guardExt + mw * 6);
      }
    });
  },
});
