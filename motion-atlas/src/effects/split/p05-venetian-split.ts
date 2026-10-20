import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, num, rgba } from '../../engine/helpers';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';

export default defineEffect({
  id: 'venetian-split',
  code: 'P05',
  nameZh: '百葉分片',
  nameEn: 'Venetian Split',
  category: 'split',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '畫面切成多條百葉，每片依序翻轉：前半段壓扁舊畫面，後半段展開新畫面。',
  tags: ['百葉窗', '轉場', '分片', '翻轉', 'blinds'],
  suitable: ['章節轉場', '產品切換', '投影片換頁'],
  principle:
    'Canvas 2D：A、B 兩個場景預先繪製到離屏畫布。每片百葉的進度 = 全域進度依序錯開；角度 θ = 進度·π，θ<90° 時把 A 的對應切片沿短軸縮放 cos θ，θ>90° 時改畫 B 的切片並縮放 −cos θ，切片邊緣加上陰影線表現翻轉面。',
  defaultText: 'BEFORE／AFTER',
  palette: 'POP',
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent'],
  directions: ['down', 'up', 'right', 'left'],
  textHint: '「／」前為 A 場景文字，後為 B 場景文字。',
  params: [
    ...TRANSITION_PARAMS,
    { key: 'slices', label: '分片數', type: 'range', min: 3, max: 24, step: 1, default: 9 },
    { key: 'stagger', label: '錯開程度', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55 },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '百葉從起始邊依序翻轉，每片先壓扁 A 再展開 B，形成波浪式推進。',
    hold: 'B 完整停留，切片接縫完全消失。',
    exit: '同樣機制由 B 翻回 A。',
    loop: 'A → B → A，停留時間可調。',
  },
  accept: [
    '轉場途中同時看到 A、B 的切片，切片之間有明顯分割線。',
    '改變分片數，百葉條數同步改變。',
    '方向「向下」時由上而下依序翻轉，「向右」時改為直向百葉由左而右。',
    '開啟「手動進度」並拖曳進度滑桿時畫面停在對應狀態。',
  ],
  cycle: 4.4,
  posterTime: 1.6,
  create(ctx) {
    const sc = makeScenes(ctx);
    const n = Math.round(num(ctx, 'slices', 9));
    const stagger = num(ctx, 'stagger', 0.55);
    const vertical = ctx.dir === 'left' || ctx.dir === 'right'; // vertical blinds
    const rev = ctx.dirSign < 0;
    const { width: w, height: h, dpr } = ctx;
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t);
      const src = [sc.a.canvas, sc.b.canvas];
      for (let i = 0; i < n; i++) {
        const order = rev ? n - 1 - i : i;
        const local = clamp((tr.e * (1 + stagger) - (stagger * order) / Math.max(1, n - 1)) / 1, 0, 1);
        const ang = local * Math.PI;
        const showTo = ang > Math.PI / 2;
        const f = Math.abs(Math.cos(ang));
        const img = src[showTo ? tr.to : tr.from];
        const bg = showTo ? sc.scene(tr.to).bg : sc.scene(tr.from).bg;
        if (vertical) {
          const x0 = (i * w) / n;
          const sw = w / n;
          const cw = sw * f;
          g.fillStyle = rgba(bg === ctx.s.background ? ctx.s.primary : ctx.s.background, 0.9);
          g.fillRect(x0, 0, sw, h);
          g.drawImage(img, x0 * dpr, 0, sw * dpr, h * dpr, x0 + (sw - cw) / 2, 0, cw, h);
          if (local > 0 && local < 1) {
            g.fillStyle = rgba('#000000', 0.25 * (1 - f));
            g.fillRect(x0 + (sw - cw) / 2, 0, cw, h);
          }
        } else {
          const y0 = (i * h) / n;
          const sh = h / n;
          const ch = sh * f;
          g.fillStyle = rgba(bg === ctx.s.background ? ctx.s.primary : ctx.s.background, 0.9);
          g.fillRect(0, y0, w, sh);
          g.drawImage(img, 0, y0 * dpr, w * dpr, sh * dpr, 0, y0 + (sh - ch) / 2, w, ch);
          if (local > 0 && local < 1) {
            g.fillStyle = rgba('#000000', 0.25 * (1 - f));
            g.fillRect(0, y0 + (sh - ch) / 2, w, ch);
          }
        }
      }
      // slice seams while moving
      if (tr.moving && tr.p > 0 && tr.p < 1) {
        g.strokeStyle = rgba(ctx.s.accent, 0.7);
        g.lineWidth = 1;
        g.beginPath();
        for (let i = 1; i < n; i++) {
          if (vertical) {
            g.moveTo((i * w) / n, 0);
            g.lineTo((i * w) / n, h);
          } else {
            g.moveTo(0, (i * h) / n);
            g.lineTo(w, (i * h) / n);
          }
        }
        g.stroke();
      }
    });
  },
});
