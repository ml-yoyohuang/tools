import { defineEffect } from '../../engine/define';
import { canvasRuntime, ease, num, rgba, str } from '../../engine/helpers';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { AB_HINT, drawPiece, drawScaled, local, type Pts } from './_util';

export default defineEffect({
  id: 'quadrant-split',
  code: 'P03',
  nameZh: '四象限',
  nameEn: 'Quadrant Split',
  category: 'split',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '十字切線把舊畫面分成四塊，四塊依序朝四個角落旋轉飛出，中央的新場景由小放大顯露。',
  tags: ['四象限', '十字', '分割', '轉場', 'quadrant'],
  suitable: ['揭曉時刻', '產品亮相', '章節轉場'],
  principle:
    'Canvas 2D：十字交點 (W/2, H/2) 把 A 分成 TL / TR / BR / BL 四個矩形。第 i 塊的局部進度依順時針（或逆時針）錯開，以 expo.inOut 沿對角向量 (±W/2, ±H/2)·1.3 位移並旋轉 ±spin，以硬陰影呈現壓在 B 之上。B 由 0.72 放大到 1，強調中央顯露。',
  defaultText: '四方／CENTER',
  palette: 'MONO',
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent'],
  directions: ['cw', 'ccw'],
  textHint: AB_HINT,
  params: [
    ...TRANSITION_PARAMS,
    { key: 'spin', label: '旋轉角度', type: 'range', min: 0, max: 60, step: 1, default: 18, unit: '°' },
    { key: 'stagger', label: '依序間隔', type: 'range', min: 0, max: 0.2, step: 0.01, default: 0.09, hint: '0 = 四塊同時飛出' },
    {
      key: 'reveal',
      label: '中央顯露',
      type: 'select',
      default: 'zoom',
      options: [
        { value: 'zoom', label: '由小放大' },
        { value: 'still', label: '靜止' },
      ],
    },
  ],
  recipe: {
    enter: '完整顯示 A 場景，中心出現十字切線。',
    motion: '四個象限依順時針錯開 0.09 進度，以 expo.inOut 朝各自角落位移並旋轉；中央 B 從 0.72 放大到 1。',
    hold: 'B 完整停留。',
    exit: 'B 被切成四塊向外飛出，露出 A。',
    loop: 'A → B → A。',
  },
  accept: [
    '轉場中看得到四塊 A 朝四個角落分開，中央露出 B。',
    '每塊邊緣有切線色邊與硬陰影，顯示遮擋關係。',
    '方向切換順／逆時針時，飛出順序改變。',
    '依序間隔設為 0 時四塊同時離開。',
  ],
  cycle: 4.4,
  posterTime: 1.7,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const cx = w / 2;
    const cy = h / 2;
    const spin = (num(ctx, 'spin', 18) * Math.PI) / 180;
    const stag = num(ctx, 'stagger', 0.09);
    const zoom = str(ctx, 'reveal', 'zoom') === 'zoom';
    const fly = ease('expo.inOut');
    // cw order from top-left
    const quads: { pts: Pts; vx: number; vy: number; rs: number }[] = [
      { pts: [-2, -2, cx, -2, cx, cy, -2, cy], vx: -1, vy: -1, rs: -1 },
      { pts: [cx, -2, w + 2, -2, w + 2, cy, cx, cy], vx: 1, vy: -1, rs: 1 },
      { pts: [cx, cy, w + 2, cy, w + 2, h + 2, cx, h + 2], vx: 1, vy: 1, rs: -1 },
      { pts: [-2, cy, cx, cy, cx, h + 2, -2, h + 2], vx: -1, vy: 1, rs: 1 },
    ];
    const lw = Math.max(2, Math.min(w, h) * 0.006);
    const span = 1 - stag * 3;
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, (x) => x);
      const imgs = [sc.a.canvas, sc.b.canvas];
      if (tr.p <= 0) return sc.draw(g, tr.from);
      if (tr.p >= 1) return sc.draw(g, tr.to);
      const firstE = fly(local(tr.p, 0, span));
      drawScaled(g, imgs[tr.to], w, h, zoom ? 0.72 + 0.28 * fly(tr.p) : 1);
      // draw the pieces that have moved furthest first (later pieces sit on top)
      const order = [0, 1, 2, 3].map((i) => (ctx.dirSign > 0 ? i : (4 - i) % 4));
      const items = order.map((qi, k) => ({ q: quads[qi], e: fly(local(tr.p, k * stag, span)) }));
      items.sort((a, b) => b.e - a.e);
      for (const { q, e } of items) {
        if (e >= 1) continue;
        drawPiece(
          g,
          imgs[tr.from],
          w,
          h,
          q.pts,
          { tx: q.vx * cx * 1.35 * e, ty: q.vy * cy * 1.35 * e, rot: q.rs * spin * e },
          { shadow: Math.min(w, h) * 0.025 * Math.min(1, e * 5), shadowAlpha: 0.3, edge: ctx.s.accent, edgeWidth: lw },
        );
      }
      // cross hair while the cut is still closed
      if (firstE < 0.02) {
        g.strokeStyle = rgba(ctx.s.accent, 1);
        g.lineWidth = lw;
        g.beginPath();
        g.moveTo(cx, 0);
        g.lineTo(cx, h);
        g.moveTo(0, cy);
        g.lineTo(w, cy);
        g.stroke();
      }
    });
  },
});
