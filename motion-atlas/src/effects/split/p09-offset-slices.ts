import { defineEffect } from '../../engine/define';
import { canvasRuntime, ease, num, rgba, str } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { AB_HINT, blit, local } from './_util';

export default defineEffect({
  id: 'offset-slices',
  code: 'P09',
  nameZh: '錯位切片',
  nameEn: 'Offset Slices',
  category: 'split',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '畫面切成水平切片，每片先反向抽動、再左右錯位滑過，新內容接在後面滑入並帶一點回彈後穩定。',
  tags: ['錯位', '切片', '故障', '水平', 'offset'],
  suitable: ['故障風轉場', '音樂／節奏影片', '科技標題'],
  principle:
    'Canvas 2D：每條水平切片是一段「A｜縫帶｜B」的橫向膠捲。切片 k 有隨機延遲與方向 σₖ（交錯或隨機）。位移 x(u) = 先以 sin 做 −σ·kick 的反向抽動（u<0.18），再以 power3.inOut 移動 σ·(W+縫)，最後疊加衰減正弦回彈；切片之間的錯位就是分割線。',
  defaultText: 'GLITCH／STABLE',
  palette: 'MONO',
  colors: { accent: C.red },
  controls: ['text', 'font', 'weight', 'direction', 'intensity', 'secondary', 'accent'],
  directions: ['right', 'left'],
  textHint: AB_HINT,
  params: [
    ...TRANSITION_PARAMS,
    { key: 'slices', label: '切片數', type: 'range', min: 3, max: 30, step: 1, default: 11 },
    {
      key: 'pattern',
      label: '錯位方式',
      type: 'select',
      default: 'alt',
      options: [
        { value: 'alt', label: '左右交錯' },
        { value: 'random', label: '隨機' },
        { value: 'same', label: '同向' },
      ],
    },
    { key: 'spread', label: '時間錯開', type: 'range', min: 0, max: 0.6, step: 0.05, default: 0.35 },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '每條切片在隨機時間先反向抽動一下（kick，強度控制幅度），再以 power3.inOut 橫向滑過一個畫面寬，B 接在縫帶後滑入，結尾以衰減正弦回彈穩定。',
    hold: '所有切片對齊，B 完整停留。',
    exit: '同樣機制把 B 錯位滑走、換回 A。',
    loop: 'A → B → A。',
  },
  accept: [
    '轉場中切片彼此左右錯位，同一畫面出現 A 片段、B 片段與強調色縫帶。',
    '每條切片落定前有短暫回彈，最後完全對齊。',
    '改變切片數與錯位方式，切片數量與方向分布改變。',
    '強度為 0 時沒有反向抽動與回彈，只剩純滑動。',
  ],
  cycle: 4.4,
  posterTime: 1.75,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const n = Math.max(2, Math.round(num(ctx, 'slices', 11)));
    const sh = h / n;
    const pattern = str(ctx, 'pattern', 'alt');
    const spread = num(ctx, 'spread', 0.35);
    const inten = ctx.s.intensity;
    const gap = Math.max(4, Math.min(w, h) * 0.03);
    const T = w + gap;
    const slide = ease('power3.inOut');
    const slices = Array.from({ length: n }, (_, k) => {
      const sig = pattern === 'same' ? ctx.dirSign : pattern === 'alt' ? (k % 2 ? -ctx.dirSign : ctx.dirSign) : ctx.rand() < 0.5 ? -1 : 1;
      return {
        sig,
        delay: ctx.rand() * spread,
        kick: (0.03 + ctx.rand() * 0.07) * w * inten,
        wob: (0.02 + ctx.rand() * 0.03) * w * inten,
      };
    });
    const lw = Math.max(1, Math.min(w, h) * 0.004);
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, (x) => x);
      const imgs = [sc.a.canvas, sc.b.canvas];
      if (tr.p <= 0) return sc.draw(g, tr.from);
      if (tr.p >= 1) return sc.draw(g, tr.to);
      const span = 1 - spread;
      for (let k = 0; k < n; k++) {
        const s = slices[k];
        const u = local(tr.p, s.delay, span);
        const y = k * sh;
        let x: number;
        if (u < 0.18) x = -s.kick * Math.sin((Math.PI * u) / 0.18);
        else {
          const v = (u - 0.18) / 0.82;
          const m = slide(Math.min(1, v / 0.72));
          const r = Math.max(0, (v - 0.72) / 0.28);
          x = T * m + s.wob * Math.sin(r * Math.PI * 2) * (1 - r);
        }
        x *= s.sig;
        g.save();
        g.beginPath();
        g.rect(0, y, w, sh + 0.5);
        g.clip();
        g.fillStyle = ctx.s.accent;
        g.fillRect(0, y, w, sh);
        if (Math.abs(x) < w) blit(g, imgs[tr.from], w, h, 0, y, w, sh, x, y, w, sh);
        const bx = x - s.sig * T;
        if (Math.abs(bx) < w) blit(g, imgs[tr.to], w, h, 0, y, w, sh, bx, y, w, sh);
        g.restore();
      }
      // horizontal slice seams
      g.fillStyle = rgba('#000000', 0.35);
      for (let k = 1; k < n; k++) g.fillRect(0, k * sh - lw / 2, w, lw);
    });
  },
});
