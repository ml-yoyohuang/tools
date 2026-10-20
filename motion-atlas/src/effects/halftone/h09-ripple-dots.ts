import { defineEffect } from '../../engine/define';
import { C } from '../../engine/palette';
import { bool, canvasRuntime, clamp, minSide, num, TAU } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { capSpacing, DotBatch, dotGrid } from './_util';

interface Source {
  x: number;
  y: number;
  t0: number;
}

export default defineEffect({
  id: 'ripple-dots',
  code: 'H09',
  nameZh: '波紋點場',
  nameEn: 'Ripple Dots',
  category: 'halftone',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '點擊（或自動觸發）產生波源，波紋以固定速度擴散，每顆網點依距離延遲後做衰減的放大縮小；多個波源可疊加。',
  tags: ['波紋', 'ripple', '互動', '干涉', '點陣'],
  suitable: ['互動背景', '按鈕／點擊回饋展示', '水面意象'],
  principle:
    'Canvas 2D：每個波源有位置與起始時間 t0。網點到波源距離 d，延遲 τ = (t − t0) − d/c（c = 波速），τ > 0 時反應 = exp(−2.4τ)·sin(2π·1.6·τ)·1/(1 + d/0.6短邊)，多個波源相加後縮放網點半徑；超過門檻的點換成次色。自動波源每 interval 秒於 seeded 位置產生，點擊時讀取 ctx.pointer.lastDown 的變化記錄新波源；同時存在的波源只保留最新 N 個。',
  defaultText: '',
  palette: 'POP',
  colors: { background: C.pink, primary: C.white, secondary: C.blue },
  controls: ['intensity', 'secondary', 'seed'],
  interactive: true,
  params: [
    { key: 'spacing', label: '點距', type: 'range', min: 10, max: 36, step: 1, default: 18, unit: 'px' },
    { key: 'sources', label: '同時波源上限', type: 'range', min: 1, max: 6, step: 1, default: 3 },
    { key: 'speed', label: '波速', type: 'range', min: 0.2, max: 1.5, step: 0.05, default: 0.55, hint: '每秒擴散的短邊比例' },
    { key: 'interval', label: '自動觸發間隔', type: 'range', min: 0.6, max: 4, step: 0.1, default: 1.4, unit: 's' },
    { key: 'auto', label: '自動觸發', type: 'toggle', default: true, hint: '關閉後只在點擊舞台時產生波紋' },
  ],
  recipe: {
    enter: '均勻的小點陣，第一個波源立即觸發。',
    motion: '波前以等速擴散，經過的網點先脹大再以阻尼振盪回到原尺寸；多個波相遇時大小疊加形成干涉。',
    hold: '波紋衰減後點陣回到靜止。',
    exit: '每個波源約 3 秒內衰減完畢。',
    loop: '自動波源週期出現；詳情頁點擊舞台立即在點擊處新增波源。',
  },
  accept: [
    '網點由波源向外依距離延遲反應，而不是整片同時縮放。',
    '兩個波紋相遇時可看到疊加變化。',
    '同時存在的波源數不超過「同時波源上限」。',
    '詳情頁點擊舞台，點擊位置立即出現新波紋。',
  ],
  transparent: true,
  posterTime: 1.1,
  cycle: 8.4,
  create(ctx) {
    const spacing = capSpacing(ctx, num(ctx, 'spacing', 18) * (ctx.mode === 'card' ? 1.2 : 1), 4200 * ctx.q);
    const maxSrc = Math.round(clamp(num(ctx, 'sources', 3), 1, 6));
    const ms = minSide(ctx);
    const c = num(ctx, 'speed', 0.55) * ms;
    const interval = num(ctx, 'interval', 1.4);
    const auto = bool(ctx, 'auto', true);
    const grid = dotGrid(ctx.width, ctx.height, spacing);
    const base = spacing * 0.2;
    const amp = 1.4 * ctx.s.intensity;
    const life = Math.hypot(ctx.width, ctx.height) / c + 1.6;
    const atten = ms * 0.6;
    const W = ctx.width;
    const H = ctx.height;
    const seed = ctx.seed;
    const clicks: Source[] = [];
    let seenDown = ctx.pointer.lastDown;
    const autoSource = (k: number): Source => ({
      x: W * (0.15 + 0.7 * hash2(k, 1, seed)),
      y: H * (0.15 + 0.7 * hash2(k, 2, seed)),
      t0: k * interval,
    });
    const resp = new Float32Array(grid.n);
    return canvasRuntime(ctx, (g, t) => {
      // pick up new clicks (pointer coordinates are stage css px)
      const p = ctx.pointer;
      if (p.lastDown !== seenDown) {
        seenDown = p.lastDown;
        if (p.lastDown > 0) clicks.push({ x: p.x, y: p.y, t0: t });
      }
      // seeking backwards drops clicks from the "future"
      for (let i = clicks.length - 1; i >= 0; i--) if (clicks[i].t0 > t + 1e-6 || t - clicks[i].t0 > life) clicks.splice(i, 1);
      const list: Source[] = [];
      if (auto) {
        const kNow = Math.floor(t / interval);
        for (let k = kNow; k >= Math.max(0, kNow - maxSrc); k--) {
          const s = autoSource(k);
          if (t - s.t0 <= life) list.push(s);
        }
      } else if (t < life) list.push({ x: W / 2, y: H / 2, t0: 0 });
      list.push(...clicks);
      list.sort((a, b) => b.t0 - a.t0);
      const active = list.slice(0, maxSrc);
      resp.fill(0);
      for (const s of active) {
        const age = t - s.t0;
        const fade = 1 - clamp((age - life + 1) / 1, 0, 1);
        for (let k = 0; k < grid.n; k++) {
          const d = Math.hypot(grid.x[k] - s.x, grid.y[k] - s.y);
          const tau = age - d / c;
          if (tau <= 0 || tau > 2.4) continue;
          resp[k] += (Math.exp(-2.4 * tau) * Math.sin(TAU * 1.6 * tau) * fade) / (1 + d / atten);
        }
      }
      const a = new DotBatch(g);
      const b = new DotBatch(g);
      a.begin();
      b.begin();
      for (let k = 0; k < grid.n; k++) {
        const v = resp[k] * amp;
        const r = base * clamp(1 + v * 1.4, 0.15, 2.6);
        if (v > 0.28) b.dot(grid.x[k], grid.y[k], r);
        else a.dot(grid.x[k], grid.y[k], r);
      }
      a.fill(ctx.s.primary);
      b.fill(ctx.s.secondary);
    });
  },
});
