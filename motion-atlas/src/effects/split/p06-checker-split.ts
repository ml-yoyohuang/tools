import { defineEffect } from '../../engine/define';
import { canvasRuntime, easeIn3, easeOut3, num, rgba } from '../../engine/helpers';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { AB_HINT, blit, local } from './_util';

export default defineEffect({
  id: 'checker-split',
  code: 'P06',
  nameZh: '棋盤切片',
  nameEn: 'Checker Split',
  category: 'split',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '舊畫面切成棋盤格，偶數格先浮起、旋轉、縮小掉落，露出下方新內容；奇數格隨後跟上。',
  tags: ['棋盤', '格子', '奇偶', '轉場', 'checker'],
  suitable: ['遊戲感轉場', '圖庫換頁', '節奏型影片'],
  principle:
    'Canvas 2D：A 依 cols × rows 切成格子（rows 依比例取整）。(i+j) 為偶數的格子在 0–0.62 進度內動作、奇數格在 0.38–1，同組再依距起始邊的距離錯開。單格動作：前 25% 以 power3.out 浮起到 1.08 並出現硬陰影，之後以 power3.in 朝方向位移 1.2 格、旋轉 ±25°、縮放到 0，露出同位置的 B。',
  defaultText: 'CHECK／MATE',
  palette: 'COOL',
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent'],
  directions: ['down', 'up', 'right', 'left'],
  textHint: AB_HINT,
  params: [
    ...TRANSITION_PARAMS,
    { key: 'cols', label: '欄數', type: 'range', min: 3, max: 16, step: 1, default: 7 },
    { key: 'wave', label: '同組錯開', type: 'range', min: 0, max: 1, step: 0.05, default: 0.5 },
    { key: 'drop', label: '掉落距離', type: 'range', min: 0, max: 2.5, step: 0.1, default: 1.2, unit: '格' },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '偶數格依序浮起（power3.out）後旋轉縮小、朝方向掉落（power3.in）；在畫面呈現 A／B 交錯的棋盤後，奇數格接著掉落。',
    hold: 'B 完整停留，格線消失。',
    exit: 'B 被切成棋盤，以同樣奇偶順序掉落露出 A。',
    loop: 'A → B → A。',
  },
  accept: [
    '轉場中段畫面為 A 與 B 交錯的棋盤格。',
    '格子是實際移動、旋轉、縮小的切片，有硬陰影，不是淡入淡出。',
    '改變欄數，格子數量同步改變。',
    '方向「向右」時格子往右掉落，錯開也由左而右。',
  ],
  cycle: 4.4,
  posterTime: 1.7,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const cols = Math.max(2, Math.round(num(ctx, 'cols', 7) * (ctx.q < 0.6 ? 0.8 : 1)));
    const cw = w / cols;
    const rows = Math.max(2, Math.round(h / cw));
    const ch = h / rows;
    const wave = num(ctx, 'wave', 0.5);
    const drop = num(ctx, 'drop', 1.2);
    const horiz = ctx.dir === 'left' || ctx.dir === 'right';
    const dx = horiz ? ctx.dirSign : 0;
    const dy = horiz ? 0 : ctx.dirSign;
    const cells: { i: number; j: number; par: number; ord: number; rs: number }[] = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        // order along the travel direction (0 = starting edge)
        let o = horiz ? i / Math.max(1, cols - 1) : j / Math.max(1, rows - 1);
        if (ctx.dirSign < 0) o = 1 - o;
        cells.push({ i, j, par: (i + j) % 2, ord: o, rs: ctx.rand() < 0.5 ? -1 : 1 });
      }
    const lw = Math.max(1, Math.min(w, h) * 0.004);
    const grp = 0.62; // each parity group's share of the progress
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, (x) => x);
      const imgs = [sc.a.canvas, sc.b.canvas];
      if (tr.p <= 0) return sc.draw(g, tr.from);
      if (tr.p >= 1) return sc.draw(g, tr.to);
      sc.draw(g, tr.to);
      const img = imgs[tr.from];
      const span = grp / (1 + wave);
      // static tiles first, moving tiles on top
      const moving: { c: (typeof cells)[number]; u: number }[] = [];
      for (const c of cells) {
        const base = c.par === 0 ? 0 : 1 - grp;
        const u = local(tr.p, base + c.ord * wave * span, span);
        if (u >= 1) continue;
        if (u <= 0) {
          blit(g, img, w, h, c.i * cw, c.j * ch, cw, ch, c.i * cw, c.j * ch, cw, ch);
          continue;
        }
        moving.push({ c, u });
      }
      // grid seams over the still tiles
      g.strokeStyle = rgba(ctx.s.accent, 0.55);
      g.lineWidth = lw;
      g.beginPath();
      for (let i = 1; i < cols; i++) {
        g.moveTo(i * cw, 0);
        g.lineTo(i * cw, h);
      }
      for (let j = 1; j < rows; j++) {
        g.moveTo(0, j * ch);
        g.lineTo(w, j * ch);
      }
      g.stroke();
      moving.sort((a, b) => a.u - b.u);
      for (const { c, u } of moving) {
        const lift = easeOut3(local(u, 0, 0.25));
        const fall = easeIn3(local(u, 0.25, 0.75));
        const s = (1 + 0.08 * lift) * (1 - fall);
        if (s <= 0.01) continue;
        const x = (c.i + 0.5) * cw + dx * drop * cw * fall;
        const y = (c.j + 0.5) * ch + dy * drop * ch * fall;
        const sh = Math.min(cw, ch) * 0.12 * lift;
        g.save();
        g.translate(x, y);
        g.rotate(c.rs * 0.44 * fall);
        g.scale(s, s);
        g.fillStyle = 'rgba(0,0,0,0.3)';
        g.fillRect(-cw / 2 + sh, -ch / 2 + sh, cw, ch);
        blit(g, img, w, h, c.i * cw, c.j * ch, cw, ch, -cw / 2, -ch / 2, cw, ch);
        g.strokeStyle = ctx.s.accent;
        g.lineWidth = lw * 1.5;
        g.strokeRect(-cw / 2, -ch / 2, cw, ch);
        g.restore();
      }
    });
  },
});
