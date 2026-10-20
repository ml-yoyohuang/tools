import { defineEffect } from '../../engine/define';
import { canvasRuntime, ease, num } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { AB_HINT, bump, drawPiece, line, local } from './_util';

export default defineEffect({
  id: 'diagonal-split',
  code: 'P04',
  nameZh: '對角切分',
  nameEn: 'Diagonal Split',
  category: 'split',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '畫面沿對角線切成兩個三角形，兩片沿切線反向錯開滑出，縫隙中露出新場景。',
  tags: ['對角', '斜切', '三角', '轉場', 'diagonal'],
  suitable: ['運動感轉場', '對決／比較', '海報切換'],
  principle:
    'Canvas 2D：對角線 P0→P1（「/」或「\\」），單位向量 u 與法向量 n。上三角形位移 +u·L·e + n·gap·sin(πe)，下三角形位移 −u·L·e₂ − n·gap·sin(πe₂)，e 為 power2.inOut、e₂ 延遲 lag。沿切線錯開＝剪切式分離，兩片斜邊畫切線色邊。',
  defaultText: 'SLASH／CUT',
  palette: 'POP',
  colors: { background: C.black, primary: C.yellow, secondary: C.red, accent: C.white },
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent'],
  directions: ['right', 'left'],
  textHint: AB_HINT,
  params: [
    ...TRANSITION_PARAMS,
    { key: 'gap', label: '垂直撐開', type: 'range', min: 0, max: 0.2, step: 0.01, default: 0.06 },
    { key: 'lag', label: '下片延遲', type: 'range', min: 0, max: 0.4, step: 0.02, default: 0.12 },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '上三角沿對角線往一端滑、下三角往另一端滑（power2.inOut），同時垂直切線方向微微撐開；下片延遲 0.12 進度。',
    hold: 'B 完整停留。',
    exit: 'B 沿同一條對角線被剪開，露出 A。',
    loop: 'A → B → A。',
  },
  accept: [
    '轉場中兩片三角形沿同一條斜線錯開，而不是各自往外推。',
    '斜邊有清楚切線，縫隙中看得到 B。',
    '方向「向右」為「/」斜線，「向左」為「\\」斜線。',
    '垂直撐開設為 0 時兩片只沿切線滑動。',
  ],
  cycle: 4.4,
  posterTime: 1.7,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const slash = ctx.dir === 'right';
    // diagonal P0 → P1
    const p0 = slash ? [0, h] : [0, 0];
    const p1 = slash ? [w, 0] : [w, h];
    const L = Math.hypot(w, h);
    const ux = (p1[0] - p0[0]) / L;
    const uy = (p1[1] - p0[1]) / L;
    const ext = 0.06;
    const ax = p0[0] - (p1[0] - p0[0]) * ext;
    const ay = p0[1] - (p1[1] - p0[1]) * ext;
    const bx = p1[0] + (p1[0] - p0[0]) * ext;
    const by = p1[1] + (p1[1] - p0[1]) * ext;
    const m = 0.06;
    // corner on the "upper" side of the diagonal and on the "lower" side
    const upC = slash ? [-w * m, -h * m] : [w * (1 + m), -h * m];
    const loC = slash ? [w * (1 + m), h * (1 + m)] : [-w * m, h * (1 + m)];
    const upper = [ax, ay, bx, by, upC[0], upC[1]];
    const lower = [ax, ay, bx, by, loC[0], loC[1]];
    // normal pointing to the upper piece
    let nx = -uy;
    let ny = ux;
    if (nx * (upC[0] - w / 2) + ny * (upC[1] - h / 2) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const gap = num(ctx, 'gap', 0.06) * Math.min(w, h);
    const lag = num(ctx, 'lag', 0.12);
    const mv = ease('power2.inOut');
    const D = L * 1.12;
    const lw = Math.max(2, Math.min(w, h) * 0.008);
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, (x) => x);
      const imgs = [sc.a.canvas, sc.b.canvas];
      if (tr.p <= 0) return sc.draw(g, tr.from);
      if (tr.p >= 1) return sc.draw(g, tr.to);
      sc.draw(g, tr.to);
      const e1 = mv(local(tr.p, 0, 1 - lag));
      const e2 = mv(local(tr.p, lag, 1 - lag));
      const sh = Math.min(w, h) * 0.02;
      const pieces: [number[], number, number][] = [
        [lower, -ux * D * e2 - nx * gap * bump(e2), -uy * D * e2 - ny * gap * bump(e2)],
        [upper, ux * D * e1 + nx * gap * bump(e1), uy * D * e1 + ny * gap * bump(e1)],
      ];
      for (const [pts, tx, ty] of pieces) {
        drawPiece(g, imgs[tr.from], w, h, pts, { tx, ty }, { shadow: sh, shadowAlpha: 0.35 });
        line(g, [ax + tx, ay + ty, bx + tx, by + ty], ctx.s.accent, lw);
      }
    });
  },
});
