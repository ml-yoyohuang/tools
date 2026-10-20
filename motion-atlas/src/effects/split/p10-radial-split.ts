import { defineEffect } from '../../engine/define';
import { canvasRuntime, ease, num, TAU } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { AB_HINT, drawPiece, drawScaled, local, type Pts } from './_util';

export default defineEffect({
  id: 'radial-split',
  code: 'P10',
  nameZh: '扇形切分',
  nameEn: 'Radial Split',
  category: 'split',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '畫面從中心切成扇形，各片依序沿自己的角平分線向外推出並微轉，中心的新場景像花開一樣擴大。',
  tags: ['扇形', '放射', '中心', '綻放', 'radial'],
  suitable: ['揭曉／開箱', '節慶主題', 'Logo 出場'],
  principle:
    'Canvas 2D：以中心為頂點把 A 切成 n 個扇形多邊形（外緣取對角線半長）。第 k 片的局部進度依角度順序錯開（sweep），以 power2.in 沿角平分線 b 位移 d = e·R·1.25 並繞中心轉 ±twist·e。因為扇形上每點 p·b ≥ 0，d ≥ R 時整片必然離開畫面。B 由 0.85 放大到 1。',
  defaultText: 'BLOOM／綻放',
  palette: 'POP',
  colors: { background: C.yellow, primary: C.blue, secondary: C.pink, accent: C.white },
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent'],
  directions: ['cw', 'ccw'],
  textHint: AB_HINT,
  params: [
    ...TRANSITION_PARAMS,
    { key: 'sectors', label: '扇形數', type: 'range', min: 3, max: 18, step: 1, default: 8 },
    { key: 'sweep', label: '依序掃過', type: 'range', min: 0, max: 0.7, step: 0.05, default: 0.45, hint: '0 = 全部同時推出' },
    { key: 'twist', label: '扭轉', type: 'range', min: 0, max: 40, step: 1, default: 12, unit: '°' },
  ],
  recipe: {
    enter: '完整顯示 A 場景，中心浮現放射切線。',
    motion: '扇形依順／逆時針順序（sweep 0.45）以 power2.in 由中心向外推出並同向扭轉；B 自中心由 0.85 放大到 1。',
    hold: 'B 完整停留。',
    exit: 'B 被切成扇形向外推出，露出 A。',
    loop: 'A → B → A。',
  },
  accept: [
    '轉場中心先露出 B，扇形之間出現放射狀縫隙。',
    '扇形依角度順序推出，順／逆時針可切換。',
    '改變扇形數，切片數量同步改變。',
    '扭轉為 0 時扇形只沿角平分線直線推出。',
  ],
  cycle: 4.4,
  posterTime: 1.75,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const cx = w / 2;
    const cy = h / 2;
    const n = Math.round(num(ctx, 'sectors', 8));
    const sweep = num(ctx, 'sweep', 0.45);
    const twist = (num(ctx, 'twist', 12) * Math.PI) / 180;
    const R = Math.hypot(w, h) / 2 + 4;
    const start = -Math.PI / 2;
    const push = ease('power2.in');
    const grow = ease('power2.out');
    const sectors: { pts: Pts; bx: number; by: number; ord: number }[] = [];
    for (let k = 0; k < n; k++) {
      const a0 = start + (k * TAU) / n;
      const a1 = start + ((k + 1) * TAU) / n;
      const pts: Pts = [cx, cy];
      const steps = Math.max(2, Math.ceil(((a1 - a0) / TAU) * 48));
      // outer edge pushed out so the polygon chord still covers the corners
      const Ro = R / Math.cos((a1 - a0) / steps / 2);
      for (let s = 0; s <= steps; s++) {
        const a = a0 + ((a1 - a0) * s) / steps;
        pts.push(cx + Math.cos(a) * Ro, cy + Math.sin(a) * Ro);
      }
      const am = (a0 + a1) / 2;
      const ord = ctx.dirSign > 0 ? k / n : ((n - k) % n) / n;
      sectors.push({ pts, bx: Math.cos(am), by: Math.sin(am), ord });
    }
    const lw = Math.max(1.5, Math.min(w, h) * 0.006);
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, (x) => x);
      const imgs = [sc.a.canvas, sc.b.canvas];
      if (tr.p <= 0) return sc.draw(g, tr.from);
      if (tr.p >= 1) return sc.draw(g, tr.to);
      drawScaled(g, imgs[tr.to], w, h, 0.85 + 0.15 * grow(tr.p));
      const span = 1 - sweep;
      const items = sectors.map((s) => ({ s, e: push(local(tr.p, s.ord * sweep, span)) }));
      items.sort((a, b) => b.e - a.e);
      for (const { s, e } of items) {
        if (e >= 1) continue;
        const d = e * R * 1.25;
        drawPiece(
          g,
          imgs[tr.from],
          w,
          h,
          s.pts,
          { tx: s.bx * d, ty: s.by * d, rot: ctx.dirSign * twist * e, px: cx, py: cy },
          { edge: ctx.s.accent, edgeWidth: lw, shadow: e > 0 ? Math.min(w, h) * 0.018 : 0, shadowAlpha: 0.3 },
        );
      }
    });
  },
});
