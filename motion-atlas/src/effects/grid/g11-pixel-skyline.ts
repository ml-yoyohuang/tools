import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, easeIn3, easeOutBack, minSide, mix, num, rgba, str } from '../../engine/helpers';
import { hash2, rng } from '../../engine/random';

interface Col {
  h: number;
  start: number;
  win: number; // window density 0..1
  bld: number; // building id (for window pattern)
}

export default defineEffect({
  id: 'pixel-skyline',
  code: 'G11',
  nameZh: '像素城市',
  nameEn: 'Pixel Skyline',
  category: 'grid',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '格子方塊一欄一欄從地平線往上堆疊，長成前後兩層的像素城市剪影，窗戶陸續亮起後整座城沉回地面。',
  tags: ['像素', '城市', 'skyline', '堆疊', '剪影'],
  suitable: ['城市／地產主題', '夜間活動視覺', '遊戲開場'],
  principle:
    'Canvas 2D：舞台切成像素格，seeded PRNG 依序產生 2–5 欄寬的建築與其高度（偶爾加天線），高度在 create 時固定，同一 seed 永遠相同。每欄依升起順序（左到右 / 中心向外 / 隨機）得到開始時間，第 k 塊方塊在 start + k·Δ 以 back-out 從下方彈入；後排建築使用較暗的次色並晚一步升起。停留時窗格依 hash 決定亮燈時間逐個亮起，離場時整座城以 ease-in 沉入地平線（clip）。',
  defaultText: '',
  palette: 'POP',
  colors: { background: '#141414', primary: '#3450FF', secondary: '#ED589A', accent: '#FFE35A' },
  controls: ['scale', 'secondary', 'accent', 'seed'],
  params: [
    { key: 'pixel', label: '像素格大小', type: 'range', min: 0.02, max: 0.07, step: 0.0025, default: 0.035, hint: '相對舞台短邊' },
    { key: 'height', label: '最高樓層', type: 'range', min: 0.3, max: 1, step: 0.05, default: 0.75 },
    {
      key: 'order',
      label: '升起順序',
      type: 'select',
      default: 'ltr',
      options: [
        { value: 'ltr', label: '左到右' },
        { value: 'center', label: '中心向外' },
        { value: 'random', label: '隨機' },
      ],
    },
    { key: 'back', label: '後排建築', type: 'toggle', default: true },
    { key: 'windows', label: '窗戶亮燈', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '只有地平線與淡淡的像素格點。',
    motion: '各欄依序由下往上一塊塊堆疊，每塊 back-out 小彈跳；後排建築晚 0.4 s 升起，形成前後層次。',
    hold: '城市完成後停留約 2.6 秒，窗戶以不同時間逐一亮起（不閃爍）。',
    exit: '整座城以 ease-in 沉入地平線下方。',
    loop: '沉沒後重新升起，高度與窗戶位置不變（固定 seed）。',
  },
  accept: [
    '方塊對齊像素格，一欄一欄往上堆疊。',
    '相同 seed 每次的天際線剪影都一樣；改 seed 剪影改變。',
    '可分辨前後兩排建築（後排較暗）。',
    '亮窗只出現在建築內，緩慢亮起不閃爍。',
  ],
  transparent: true,
  posterTime: 4.1,
  cycle: 7.5,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const px = Math.max(5, num(ctx, 'pixel', 0.035) * minSide(ctx) * ctx.s.scale * (ctx.mode === 'card' ? 1.3 : 1));
    const hMax = num(ctx, 'height', 0.75);
    const order = str(ctx, 'order', 'ltr');
    const backOn = bool(ctx, 'back', true);
    const winOn = bool(ctx, 'windows', true);
    const R = rng(ctx.rand);
    const ncol = Math.ceil(w / px);
    const ox = (w - ncol * px) / 2;
    const ground = Math.round(h * 0.86);
    const maxRows = Math.max(3, Math.floor(((ground - h * 0.08) / px) * hMax));

    const makeLayer = (scaleH: number, minF: number): Col[] => {
      const cols: Col[] = [];
      let b = 0;
      while (cols.length < ncol) {
        const bw = R.int(2, 5);
        const bh = Math.max(2, Math.round(maxRows * scaleH * R.range(minF, 1)));
        const antenna = R.range(0, 1) < 0.2;
        const win = R.range(0.25, 0.6);
        for (let k = 0; k < bw && cols.length < ncol; k++) {
          const isAnt = antenna && k === Math.floor(bw / 2);
          cols.push({ h: Math.min(maxRows, bh + (isAnt ? R.int(2, 4) : 0)), start: 0, win: isAnt && k > 0 ? 0 : win, bld: b });
        }
        if (R.range(0, 1) < 0.3 && cols.length < ncol) cols.push({ h: R.int(1, 2), start: 0, win: 0, bld: -1 }); // gap
        b++;
      }
      return cols;
    };
    const front = makeLayer(0.62, 0.25);
    const back = makeLayer(1, 0.45);
    const shuffled = R.shuffle(Array.from({ length: ncol }, (_, i) => i));
    const colDelay = 1.4 / ncol;
    const startOf = (i: number) => {
      if (order === 'center') return Math.abs(i - (ncol - 1) / 2) * colDelay * 2;
      if (order === 'random') return shuffled[i] * colDelay;
      return i * colDelay;
    };
    front.forEach((c, i) => (c.start = startOf(i)));
    back.forEach((c, i) => (c.start = startOf(i) + 0.4));
    const blockDt = 0.035;
    const riseEnd = 1.4 + 0.4 + maxRows * blockDt + 0.3;
    const hold = 2.6;
    const sink = 1.2;
    const rest = 0.5;
    const total = riseEnd + hold + sink + rest;
    const backCol = mix(ctx.s.secondary, ctx.s.background, 0.4);
    const frontCol = ctx.s.primary;
    const gp = Math.max(1, px * 0.08);
    const dots = rgba(ctx.s.accent, 0.13);

    const drawLayer = (g: CanvasRenderingContext2D, cols: Col[], col: string, lt: number, sinkY: number, layer: number) => {
      for (let i = 0; i < cols.length; i++) {
        const c = cols[i];
        const x = ox + i * px;
        for (let k = 0; k < c.h; k++) {
          const p = (lt - c.start - k * blockDt) / 0.22;
          if (p <= 0) break;
          const e = easeOutBack(clamp(p, 0, 1), 2);
          const y = ground - (k + 1) * px + sinkY + (1 - e) * px * 0.9;
          g.fillStyle = col;
          g.fillRect(x + gp / 2, y + gp / 2, px - gp, px - gp);
          if (winOn && c.win > 0 && k < c.h - 1 && k > 0) {
            const hv = hash2(i * 7 + layer * 1301, k, ctx.seed);
            if (hv < c.win) {
              const on = riseEnd * 0.7 + hash2(k, i + layer * 977, ctx.seed + 1) * hold;
              const a = clamp((lt - on) / 0.5, 0, 1) * (layer ? 0.55 : 1);
              if (a > 0) {
                g.fillStyle = rgba(ctx.s.accent, a);
                const m = px * 0.3;
                g.fillRect(x + m, y + m, px - m * 2, px - m * 2);
              }
            }
          }
        }
      }
    };

    return canvasRuntime(ctx, (g, t) => {
      const lt = t % total;
      // pixel lattice dots
      g.fillStyle = dots;
      for (let y = ground - px; y > 0; y -= px) for (let i = 0; i <= ncol; i++) g.fillRect(ox + i * px - 1, y - 1, 2, 2);
      const sinkY = easeIn3(clamp((lt - riseEnd - hold) / sink, 0, 1)) * (maxRows + 4) * px;
      g.save();
      g.beginPath();
      g.rect(0, 0, w, ground);
      g.clip();
      if (backOn) drawLayer(g, back, backCol, lt, sinkY, 1);
      drawLayer(g, front, frontCol, lt, sinkY, 0);
      g.restore();
      // horizon
      g.fillStyle = ctx.s.secondary;
      g.fillRect(0, ground, w, Math.max(2, px * 0.15));
    });
  },
});
