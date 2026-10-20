import { defineEffect } from '../../engine/define';
import { canvasRuntime, ease, easeIn3, num, rgba } from '../../engine/helpers';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { AB_HINT, drawPiece, line, local } from './_util';

export default defineEffect({
  id: 'horizontal-split',
  code: 'P02',
  nameZh: '上下分割',
  nameEn: 'Horizontal Split',
  category: 'split',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '舊畫面沿水平線裂開，上半往上、下半往下反向離場；分開的新畫面上下兩半再從兩端合攏。',
  tags: ['分割', '上下', '合攏', '轉場', 'split'],
  suitable: ['標題換頁', '影片片頭', '前後對照'],
  principle:
    'Canvas 2D：切線 y = cut·H。第一段（0–0.6）A 的上半以 power3.in 位移 −(cutY+pad)、下半位移 +(H−cutY+pad)；B 也被同一切線分成兩半，起始時各自外推 gap·H，第二段（0.42–1）以 power3.out 與 bounce.out 混合（回彈參數）合攏到 0，碰撞後小幅彈開再闔上，形成「先分開、再合回」。兩組切片之間露出強調色縫帶與切線。',
  defaultText: 'UPPER／LOWER',
  palette: 'PASTEL',
  controls: ['text', 'font', 'weight', 'secondary', 'accent'],
  textHint: AB_HINT,
  params: [
    ...TRANSITION_PARAMS,
    { key: 'cut', label: '切線位置', type: 'range', min: 0.25, max: 0.75, step: 0.01, default: 0.5 },
    { key: 'gap', label: '合攏距離', type: 'range', min: 0.05, max: 0.45, step: 0.01, default: 0.22 },
    { key: 'bounce', label: '合攏回彈', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: 'A 上下兩半以 power3.in 反向離場（上往上、下往下）；同時已分開的 B 兩半出現在縫隙中，後段由兩端合攏，碰撞時依回彈參數彈開再闔上（power3.out ↔ bounce.out）。',
    hold: '合攏後切線消失，B 完整停留。',
    exit: 'B 依同樣機制上下分開離場，A 的兩半合回。',
    loop: 'A → B → A。',
  },
  accept: [
    '轉場前段看得到 A 的兩半正在上下分開，中間露出分開狀態的 B。',
    '轉場後段 B 的上下兩半由外往內合攏，合攏瞬間有輕微回彈。',
    '調整切線位置，上下兩半的比例改變。',
    '手動進度 50% 時同時看到 A 片、B 片與中央縫帶。',
  ],
  cycle: 4.4,
  posterTime: 1.65,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const cy = num(ctx, 'cut', 0.5) * h;
    const gap = num(ctx, 'gap', 0.22) * h;
    const bounce = num(ctx, 'bounce', 0.6);
    const closeA = ease('power3.out');
    const closeB = ease('bounce.out');
    const close = (u: number) => closeA(u) * (1 - bounce) + closeB(u) * bounce;
    const top = [-2, -2, w + 2, -2, w + 2, cy, -2, cy];
    const bot = [-2, cy, w + 2, cy, w + 2, h + 2, -2, h + 2];
    const pad = Math.min(w, h) * 0.05;
    const lw = Math.max(2, Math.min(w, h) * 0.007);
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, (x) => x);
      const imgs = [sc.a.canvas, sc.b.canvas];
      if (tr.p <= 0) return sc.draw(g, tr.from);
      if (tr.p >= 1) return sc.draw(g, tr.to);
      // seam band behind everything
      g.fillStyle = ctx.s.secondary;
      g.fillRect(0, 0, w, h);
      g.fillStyle = rgba('#000000', 0.18);
      for (let y = cy % (lw * 6); y < h; y += lw * 6) g.fillRect(0, y, w, lw);
      // B halves: start pushed apart by gap, close back together
      const c = close(local(tr.p, 0.42, 0.58));
      const open = gap * (1 - c);
      drawPiece(g, imgs[tr.to], w, h, top, { ty: -open });
      drawPiece(g, imgs[tr.to], w, h, bot, { ty: open });
      if (open > 0.5) {
        line(g, [0, cy - open, w, cy - open], ctx.s.accent, lw);
        line(g, [0, cy + open, w, cy + open], ctx.s.accent, lw);
      } else if (c < 1) {
        line(g, [0, cy, w, cy], ctx.s.accent, lw);
      }
      // A halves leave in opposite directions
      const a = easeIn3(local(tr.p, 0, 0.6));
      if (a < 1) {
        const up = -(cy + pad) * a;
        const dn = (h - cy + pad) * a;
        g.fillStyle = rgba('#000000', 0.3);
        g.fillRect(0, cy + up, w, lw * 3);
        g.fillRect(0, cy + dn - lw * 3, w, lw * 3);
        drawPiece(g, imgs[tr.from], w, h, top, { ty: up });
        drawPiece(g, imgs[tr.from], w, h, bot, { ty: dn });
        line(g, [0, cy + up, w, cy + up], ctx.s.accent, lw);
        line(g, [0, cy + dn, w, cy + dn], ctx.s.accent, lw);
      }
    });
  },
});
