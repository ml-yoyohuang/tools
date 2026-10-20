import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, easeIn3, easeOut3, minSide, mixHex, num, phase } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import { drawPanel, makePanels } from './_panels';
import { polyPath } from './_util';

export default defineEffect({
  id: 'comic-panels',
  code: 'C06',
  nameZh: '漫畫分鏡',
  nameEn: 'Comic Panels',
  category: 'comic',
  sourceType: 'original',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '一頁漫畫格線先以虛線預留，接著各格依閱讀順序被墨線掃入，格間距始終一致。',
  tags: ['漫畫', '分鏡', '格線', '揭露', 'panels'],
  suitable: ['故事介紹', '產品步驟', '活動流程', '作品集封面'],
  principle:
    'Canvas 2D：以 seed 決定列高權重與每列 1～3 格，格與格之間的分隔線可斜切；每格左右邊各向內偏移 (g/2)·√(1 + slope²)，讓斜線 gutter 的垂直寬度與水平 gutter 相同。揭露時以「格多邊形 ∩ 沿閱讀方向成長的矩形」作 clip，依閱讀順序錯開 stagger 秒；格內內容（網點、集中線、地平線、人物佔位、爆炸框、文字格）皆為原創幾何。',
  defaultText: '第一話／開始',
  palette: 'POP',
  colors: { background: '#F2E8D5', primary: '#141414', secondary: '#3450FF', accent: '#FFE35A' },
  controls: ['text', 'font', 'weight', 'scale', 'direction', 'secondary', 'accent', 'seed'],
  directions: ['right', 'left'],
  textHint: '顯示在最大的一格中，可用「／」換行。',
  maxChars: 24,
  params: [
    { key: 'gutter', label: '格間距', type: 'range', min: 0.008, max: 0.06, step: 0.002, default: 0.024 },
    { key: 'slant', label: '斜切程度', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: 'stagger', label: '揭露間隔', type: 'range', min: 0.1, max: 0.6, step: 0.02, default: 0.24, unit: 's' },
    { key: 'hold', label: '整頁停留', type: 'range', min: 0.5, max: 3, step: 0.1, default: 1.4, unit: 's' },
  ],
  recipe: {
    enter: '所有格子的位置先以細虛線顯示，讓格線結構從第一幀就固定。',
    motion: '每格依閱讀順序（方向：右 = 左到右，左 = 日式右到左）以 easeOut³ 從一側掃入 0.42 秒，格與格錯開「揭露間隔」。',
    hold: '整頁完成後停留，格內只有很輕微的網點呼吸。',
    exit: '各格反向順序快速淡出（easeIn³），只留下虛線格。',
    loop: '回到只有虛線格的狀態後重新揭露。',
  },
  accept: [
    '揭露前即可看到完整格線結構，揭露時格子位置不移動。',
    '每格依閱讀順序出現，方向切到「左」時改為右到左。',
    '所有 gutter（包括斜切的分隔線）寬度一致。',
    '格間距與斜切參數改變時版面明顯變化，文字留在最大格內。',
  ],
  transparent: true,
  cycle: 5,
  posterTime: 3,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const gut = num(ctx, 'gutter', 0.024) * m;
    const slant = num(ctx, 'slant', 0.5);
    const stagger = num(ctx, 'stagger', 0.24);
    const hold = num(ctx, 'hold', 1.4);
    const rtl = ctx.dir === 'left';
    const margin = m * 0.06;
    const rows = clamp(Math.round((h / w) * 2.6), 2, 4);
    const panels = makePanels(ctx.rand, margin, margin, w - margin * 2, h - margin * 2, gut, {
      rows,
      slant,
      rtl,
      maxCols: w < h ? 2 : 3,
    });
    for (const p of panels) {
      if (p.kind === 'caption') {
        p.layout = layoutText(ctx, ctx.text, { cx: p.cx, cy: p.cy, maxWidth: p.w * 0.72, maxHeight: p.h * 0.62, fill: 0.95 });
      }
    }
    const colors = { ink: ctx.s.primary, paper: mixHex(ctx.s.background, '#FFFFFF', 0.75), tone: ctx.s.secondary, accent: ctx.s.accent };
    const lw = Math.max(2, m * 0.007);
    const REVEAL = 0.42;
    const n = panels.length;
    const inDur = (n - 1) * stagger + REVEAL;
    const outDur = 0.3 + (n - 1) * 0.05;
    const durs = [0.35, inDur, hold, outDur];
    return canvasRuntime(ctx, (g, t) => {
      const ph = phase(t, durs);
      const local = ph.p * durs[ph.i];
      // dashed guides (always: the grid structure is fixed)
      g.save();
      g.setLineDash([lw * 2.5, lw * 2.5]);
      g.lineWidth = Math.max(1, lw * 0.5);
      g.strokeStyle = colors.ink;
      g.globalAlpha = 0.35;
      for (const p of panels) {
        g.beginPath();
        polyPath(g, p.pts);
        g.stroke();
      }
      g.restore();
      for (const p of panels) {
        let k = 0;
        let alpha = 1;
        if (ph.i === 1) k = easeOut3(clamp((local - p.order * stagger) / REVEAL, 0, 1));
        else if (ph.i === 2) k = 1;
        else if (ph.i === 3) {
          k = 1;
          alpha = 1 - easeIn3(clamp((local - (n - 1 - p.order) * 0.05) / 0.3, 0, 1));
        }
        if (k <= 0 || alpha <= 0) continue;
        g.save();
        g.globalAlpha = alpha;
        g.beginPath();
        const ww = (p.w + gut) * k;
        if (rtl) g.rect(p.x1 - ww, p.y0 - lw, ww + lw, p.h + lw * 2);
        else g.rect(p.x0 - lw, p.y0 - lw, ww + lw, p.h + lw * 2);
        g.clip();
        drawPanel(g, p, colors, lw, t);
        // leading ink edge while sweeping
        if (k < 1) {
          const ex = rtl ? p.x1 - ww : p.x0 + ww;
          g.beginPath();
          polyPath(g, p.pts);
          g.clip();
          g.fillStyle = colors.ink;
          g.fillRect(ex - lw * (rtl ? 0 : 1.5), p.y0, lw * 1.5, p.h);
        }
        g.restore();
      }
    });
  },
});
