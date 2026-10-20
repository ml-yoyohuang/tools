import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, mix, mod, num, rgba, str } from '../../engine/helpers';
import { fontString, phrases, textWidth } from '../../engine/text';

// Ported from kinetic-typography e54-pulse-grid and turned into a side-sweeping surge.
// The phrases tile a brick grid (rows × cols). Every beat a wave is launched from one
// stage edge; a cell at normalised distance d (along the chosen direction) responds
// with  w(t) = Σ_k amp_k · kernel(t − k·beat − d / v)  where the kernel is a fast
// attack + damped elastic rebound (dips below zero). w drives the cell's scale and /
// or its colour (primary → secondary, every 4th wave → accent). Cells are drawn
// small → large so a growing word sits on top of its neighbours.
export default defineEffect({
  id: 'word-surge-grid',
  code: 'T12',
  nameZh: '文字波浪網格',
  nameEn: 'Word Surge Grid',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '重複的詞平鋪成網格，一道道尺寸與色彩的波從畫面一側掃到另一側，帶彈性回彈。',
  tags: ['網格', '波浪', '重複', '節奏', 'surge'],
  suitable: ['節奏背景', '活動主視覺', '音樂播放畫面'],
  principle:
    'Canvas 2D：詞以磚砌網格平鋪（奇數列錯開半格）。每隔 beat 秒從一側發出一道波，網格 d = 沿方向的正規化距離，反應 w = Σ amp·kernel(t − k·beat − d/v)，kernel = 0.07s 快速上升 + cos(11u)·e^(−4.2u) 彈性衰減；w 控制縮放 1 + 強度·0.55·w 和／或顏色 mix(主色 → 副色)，每第 4 道波為強拍並使用強調色。依縮放由小到大繪製，放大的詞疊在上層。',
  defaultText: 'SURGE／波浪／WAVE',
  palette: 'COOL',
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'direction', 'secondary', 'accent'],
  directions: ['right', 'left', 'down', 'up'],
  maxChars: 30,
  textHint: '用「／」分隔多個詞，每一列輪流使用。',
  params: [
    { key: 'rows', label: '列數', type: 'range', min: 3, max: 14, step: 1, default: 7 },
    { key: 'cols', label: '每列字數', type: 'range', min: 2, max: 9, step: 1, default: 4 },
    { key: 'speed', label: '傳播速度', type: 'range', min: 0.2, max: 2, step: 0.05, default: 0.7, unit: '畫面/秒' },
    { key: 'beat', label: '波間隔', type: 'range', min: 0.6, max: 3, step: 0.1, default: 1.5, unit: 's' },
    {
      key: 'mode',
      label: '波的作用',
      type: 'select',
      default: 'both',
      options: [
        { value: 'both', label: '尺寸＋色彩' },
        { value: 'size', label: '只有尺寸' },
        { value: 'color', label: '只有色彩' },
      ],
    },
    { key: 'front', label: '顯示波前線', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '網格一開始就鋪滿畫面，第一道波在 t = 0 從起始邊發出。',
    motion: '波以固定速度掃過網格；每格在波前抵達時 0.07s 內快速放大／變色，再以彈性衰減回到原樣（會略小於原尺寸後回彈）。',
    hold: '兩道波之間網格安靜停住，每個詞清楚可讀。',
    exit: '波掃出另一側後消失。',
    loop: '每 beat 秒一道波，第 4 道為強拍；長時間播放保持規律。',
  },
  accept: [
    '同一個詞重複平鋪成整齊網格。',
    '波明顯從方向起始的一側掃到另一側，而非同時變化。',
    '改變列數／每列字數時網格密度改變。',
    '波的作用切到「只有色彩」時尺寸不變只有顏色變化。',
  ],
  transparent: true,
  cycle: 6,
  posterTime: 0.75,
  legacyIds: ['pulse-grid'],
  create(ctx) {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: sec, accent: acc } = ctx.s;
    const list = phrases(ctx.text);
    const rows = Math.round(num(ctx, 'rows', 7));
    const cols = Math.round(num(ctx, 'cols', 4) * (W / H < 0.8 ? 0.6 : 1)) || 1;
    const v = num(ctx, 'speed', 0.7);
    const beat = num(ctx, 'beat', 1.5);
    const mode = str(ctx, 'mode', 'both');
    const showFront = bool(ctx, 'front', true);
    const A = 0.55 * ctx.s.intensity;
    const useSize = mode !== 'color';
    const useColor = mode !== 'size';
    const cellW = W / Math.max(1, cols);
    const cellH = H / rows;
    const fam = ctx.family;
    const wt = ctx.weight;
    const tr = ctx.s.tracking;
    const widest = Math.max(...list.map((p) => textWidth(p, 100, fam, wt, tr)), 1);
    const fs = Math.max(6, Math.min(((cellW * 0.8) / widest) * 100, cellH * 0.62) * clamp(ctx.s.scale, 0.5, 1.6));
    const font = fontString(fs, fam, wt);
    const horizontal = ctx.dir === 'left' || ctx.dir === 'right';
    const cells: { x: number; y: number; d: number; word: string }[] = [];
    for (let r = -1; r <= rows; r++) {
      const off = mod(r, 2) ? cellW / 2 : 0;
      for (let c = -1; c <= cols; c++) {
        const x = (c + 0.5) * cellW + off;
        const y = (r + 0.5) * cellH;
        if (x < -cellW || x > W + cellW) continue;
        const nx = clamp(x / W, 0, 1);
        const ny = clamp(y / H, 0, 1);
        const d = horizontal ? (ctx.dirSign > 0 ? nx : 1 - nx) : ctx.dirSign > 0 ? ny : 1 - ny;
        cells.push({ x, y, d, word: list[mod(r, list.length)] });
      }
    }
    const kernel = (tau: number) => {
      if (tau < 0) return 0;
      const atk = 0.07;
      if (tau < atk) return Math.sin((tau / atk) * (Math.PI / 2));
      const u = tau - atk;
      return Math.cos(u * 11) * Math.exp(-u * 4.2);
    };
    const TAIL = 1.6;
    // waves are still alive on stage for (1/v + TAIL) seconds
    const wave = (t: number, d: number) => {
      let s = 0;
      let cs = 0;
      let accent = 0;
      const kmax = Math.floor(t / beat);
      const kmin = Math.max(0, Math.floor((t - 1 / v - TAIL) / beat));
      for (let k = kmin; k <= kmax; k++) {
        const strong = k % 4 === 0;
        const w = kernel(t - k * beat - d / v);
        if (!w) continue;
        s += (strong ? 1.3 : 0.8) * w;
        if (w > cs) {
          cs = w;
          accent = strong ? 1 : 0;
        }
      }
      return { s, c: clamp(cs, 0, 1), accent };
    };

    return canvasRuntime(ctx, (g, t) => {
      if (showFront) {
        g.lineWidth = Math.max(1, fs * 0.04);
        const kmax = Math.floor(t / beat);
        for (let k = Math.max(0, kmax - 3); k <= kmax; k++) {
          const p = (t - k * beat) * v;
          if (p < 0 || p > 1.05) continue;
          g.strokeStyle = rgba(k % 4 === 0 ? acc : sec, 0.55 * (1 - p * 0.6));
          g.beginPath();
          if (horizontal) {
            const x = ctx.dirSign > 0 ? p * W : W - p * W;
            g.moveTo(x, 0);
            g.lineTo(x, H);
          } else {
            const y = ctx.dirSign > 0 ? p * H : H - p * H;
            g.moveTo(0, y);
            g.lineTo(W, y);
          }
          g.stroke();
        }
      }
      g.font = font;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.letterSpacing = `${tr * fs}px`;
      const list2 = cells.map((cl) => {
        const w = wave(t, cl.d);
        return { cl, w, s: useSize ? clamp(1 + A * w.s, 0.4, 2.3) : 1 };
      });
      list2.sort((a, b) => a.s - b.s);
      for (const { cl, w, s } of list2) {
        g.save();
        g.translate(cl.x, cl.y);
        if (s !== 1) g.scale(s, s);
        g.fillStyle = useColor && w.c > 0.01 ? mix(fg, w.accent ? acc : sec, clamp(w.c * Math.min(1.2, 0.6 + 0.5 * ctx.s.intensity), 0, 1)) : fg;
        g.fillText(cl.word, 0, 0);
        g.restore();
      }
    });
  },
});
