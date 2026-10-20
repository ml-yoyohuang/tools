import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, easeOut3, minSide, num, rgba, str } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { rng } from '../../engine/random';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { decoFade } from './_util';

/** Rank of every cell (row-major index) along a clockwise square spiral from the outer ring inward. */
function spiralRanks(cols: number, rows: number): number[] {
  const rank = new Array<number>(cols * rows).fill(0);
  let top = 0;
  let bottom = rows - 1;
  let left = 0;
  let right = cols - 1;
  let k = 0;
  while (top <= bottom && left <= right) {
    for (let c = left; c <= right; c++) rank[top * cols + c] = k++;
    for (let r = top + 1; r <= bottom; r++) rank[r * cols + right] = k++;
    if (top < bottom) for (let c = right - 1; c >= left; c--) rank[bottom * cols + c] = k++;
    if (left < right) for (let r = bottom - 1; r > top; r--) rank[r * cols + left] = k++;
    top++;
    bottom--;
    left++;
    right--;
  }
  return rank;
}

export default defineEffect({
  id: 'tile-wipe',
  code: 'W08',
  nameZh: '格塊揭露',
  nameEn: 'Tile Wipe',
  category: 'wipe',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '畫面分成格子，每格依選定順序（逐列、對角、隨機、螺旋）由中心長出新場景。',
  tags: ['格子', '馬賽克', '順序', '擦拭', 'tiles'],
  suitable: ['資訊圖表轉場', '遊戲／像素主題', '多項目揭曉'],
  principle:
    'Canvas 2D：舞台切成 cols × rows 格，依順序模式算出每格排名 rank（逐列 = 行優先索引、對角 = col + row、隨機 = 種子洗牌、螺旋 = 由外圈順時針向內），正規化為 0–1。每格開始時間 = rank·(1 − 窗口)，局部進度 = (e − 開始)/窗口；新場景只在格內一個以格中心為準、邊長 = easeOut3(局部)·格寬的方形內以 drawImage 子矩形畫出（場景不移動、只改變露出範圍）。轉場中畫淡格線。',
  defaultText: 'TILE／拼格',
  palette: 'POP',
  colors: { primary: C.white, secondary: C.yellow, accent: C.pink },
  controls: ['text', 'font', 'weight', 'secondary', 'accent', 'seed'],
  textHint: '「／」前為 A 場景文字，後為 B 場景文字。',
  params: [
    ...TRANSITION_PARAMS,
    {
      key: 'order',
      label: '切換順序',
      type: 'select',
      options: [
        { value: 'rows', label: '逐列' },
        { value: 'diagonal', label: '對角' },
        { value: 'random', label: '隨機（種子）' },
        { value: 'spiral', label: '螺旋' },
      ],
      default: 'diagonal',
    },
    { key: 'cols', label: '欄數', type: 'range', min: 4, max: 24, step: 1, default: 10 },
    { key: 'window', label: '同時切換量', type: 'range', min: 0.05, max: 0.8, step: 0.05, default: 0.25 },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '格子依排名逐一切換：每格的新場景從格中心以 easeOut3 長成滿格；整體轉場用等速推進，讓順序清楚可讀。',
    hold: 'B 完整停留，格線消失。',
    exit: '同一順序再切換一次換回 A。',
    loop: 'A → B → A。',
  },
  accept: [
    '轉場中能看出格子依所選順序（逐列／對角／隨機／螺旋）切換。',
    '改變欄數，格子大小同步改變並維持接近正方形。',
    '同時切換量越大，同時處於半開狀態的格子越多。',
    '隨機順序在改變種子後順序改變。',
  ],
  cycle: 4.4,
  posterTime: 1.7,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h, dpr } = ctx;
    const cols = Math.round(num(ctx, 'cols', 10));
    const rows = Math.max(2, Math.round((cols * h) / w));
    const tw = w / cols;
    const th = h / rows;
    const win = num(ctx, 'window', 0.25);
    const order = str(ctx, 'order', 'diagonal');
    const N = cols * rows;
    let rank: number[];
    if (order === 'rows') rank = Array.from({ length: N }, (_, i) => i);
    else if (order === 'random') {
      const sh = rng(ctx.rand).shuffle(Array.from({ length: N }, (_, i) => i));
      rank = new Array<number>(N);
      sh.forEach((cell, k) => (rank[cell] = k));
    } else if (order === 'spiral') rank = spiralRanks(cols, rows);
    else rank = Array.from({ length: N }, (_, i) => (i % cols) + Math.floor(i / cols));
    const maxRank = Math.max(1, ...rank);
    const start = rank.map((k) => (k / maxRank) * (1 - win));
    const m = minSide(ctx);
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, (x) => x);
      sc.draw(g, tr.from);
      if (tr.p <= 0) return;
      const img = sc.scene(tr.to).canvas;
      for (let i = 0; i < N; i++) {
        const local = clamp((tr.e - start[i]) / win, 0, 1);
        if (local <= 0) continue;
        const f = easeOut3(local);
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x0 = c * tw;
        const y0 = r * th;
        const sw = local >= 1 ? tw : tw * f;
        const sh = local >= 1 ? th : th * f;
        const x = x0 + (tw - sw) / 2;
        const y = y0 + (th - sh) / 2;
        if (sw < 0.5 || sh < 0.5) continue;
        // pad finished tiles by a hair so no seams remain
        const pad = local >= 1 ? 0.5 : 0;
        g.drawImage(img, (x - pad) * dpr, (y - pad) * dpr, (sw + pad * 2) * dpr, (sh + pad * 2) * dpr, x - pad, y - pad, sw + pad * 2, sh + pad * 2);
      }
      const fade = decoFade(tr.p);
      if (fade > 0) {
        g.strokeStyle = rgba(ctx.s.accent, 0.55 * fade);
        g.lineWidth = Math.max(1, m * 0.0025);
        g.beginPath();
        for (let c = 1; c < cols; c++) {
          g.moveTo(c * tw, 0);
          g.lineTo(c * tw, h);
        }
        for (let r = 1; r < rows; r++) {
          g.moveTo(0, r * th);
          g.lineTo(w, r * th);
        }
        g.stroke();
      }
    });
  },
});
