import { defineEffect } from '../../engine/define';
import { canvasRuntime, ease, num, rgba } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { dirVec, extent, halfPlane } from './_util';

export default defineEffect({
  id: 'light-sweep-wipe',
  code: 'W12',
  nameZh: '光帶擦拭',
  nameEn: 'Light Sweep Wipe',
  category: 'wipe',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '一道柔和的斜向光帶掃過畫面，光帶中心就是遮罩邊界，光帶經過後新場景已經顯示。',
  tags: ['光帶', '反光', '掃光', '擦拭', 'sheen'],
  suitable: ['產品亮相', '金屬／玻璃質感', '高級感品牌'],
  principle:
    'Canvas 2D：遮罩為半平面 {p·n < front}（n 為方向向量再旋轉傾斜角），front 以 power1.inOut 等速感推進並在兩端各多走半個光帶寬。新場景以 clip 畫在邊界後方；光帶是沿 n 方向的線性漸層（透明 → accent·亮度 → 透明，中心再疊一道窄核心），以 screen 合成疊在邊界上，剛好蓋住硬邊。亮度上限 ≤ 0.75 且只占光帶寬度，不做全畫面閃白。',
  defaultText: 'LIGHT／光',
  palette: 'COOL',
  colors: { primary: '#3D7BFF', secondary: '#A8D0FF', accent: C.white },
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent'],
  directions: ['right', 'left', 'down', 'up'],
  textHint: '「／」前為 A 場景文字，後為 B 場景文字。',
  params: [
    ...TRANSITION_PARAMS,
    { key: 'band', label: '光帶寬度', type: 'range', min: 0.05, max: 0.45, step: 0.01, default: 0.2 },
    { key: 'glow', label: '光帶亮度', type: 'range', min: 0.1, max: 0.75, step: 0.05, default: 0.5 },
    { key: 'slant', label: '傾斜角度', type: 'range', min: 0, max: 40, step: 1, default: 18, unit: '°' },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '光帶以 power1.inOut 穩定掃過，光帶中心即遮罩邊界；亮度只在光帶內、柔和漸層，沒有全畫面閃光。',
    hold: 'B 完整停留，光帶已離開畫面。',
    exit: '光帶同方向再掃一次換回 A。',
    loop: 'A → B → A。',
  },
  accept: [
    '轉場中可看到一道柔和亮帶移動，亮帶後方已是新場景、前方仍是舊場景。',
    '看不到硬邊界線，邊界被亮帶覆蓋。',
    '光帶亮度調到最高時也只有光帶區域變亮，整個畫面不會閃白。',
    '光帶寬度與傾斜角度改變時，亮帶形狀同步改變。',
  ],
  cycle: 4.4,
  posterTime: 1.7,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const [dx, dy] = dirVec(ctx.dir);
    const a = (num(ctx, 'slant', 18) * Math.PI) / 180;
    const nx = dx * Math.cos(a) - dy * Math.sin(a);
    const ny = dx * Math.sin(a) + dy * Math.cos(a);
    const [lo, hi] = extent(w, h, nx, ny);
    const bw = num(ctx, 'band', 0.2) * (hi - lo);
    const glow = Math.min(0.75, num(ctx, 'glow', 0.5));
    const L = (w + h) * 2;
    const easing = ease('power1.inOut');
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, easing);
      sc.draw(g, tr.from);
      if (tr.p <= 0) return;
      const front = lo - bw / 2 + tr.e * (hi - lo + bw);
      g.save();
      g.beginPath();
      halfPlane(g, nx, ny, front, L);
      g.clip();
      sc.draw(g, tr.to);
      g.restore();
      if (tr.p >= 1) return;
      // light band: gradient along n centred on the edge
      const x0 = nx * (front - bw / 2);
      const y0 = ny * (front - bw / 2);
      const x1 = nx * (front + bw / 2);
      const y1 = ny * (front + bw / 2);
      const grad = g.createLinearGradient(x0, y0, x1, y1);
      const col = ctx.s.accent;
      grad.addColorStop(0, rgba(col, 0));
      grad.addColorStop(0.3, rgba(col, glow * 0.25));
      grad.addColorStop(0.5, rgba(col, glow));
      grad.addColorStop(0.7, rgba(col, glow * 0.25));
      grad.addColorStop(1, rgba(col, 0));
      g.globalCompositeOperation = 'screen';
      g.fillStyle = grad;
      g.beginPath();
      halfPlane(g, nx, ny, front + bw / 2, L);
      g.clip();
      g.beginPath();
      halfPlane(g, -nx, -ny, -(front - bw / 2), L);
      g.fill();
      // narrow core
      const core = Math.max(1.5, bw * 0.04);
      const gc = g.createLinearGradient(nx * (front - core), ny * (front - core), nx * (front + core), ny * (front + core));
      gc.addColorStop(0, rgba(col, 0));
      gc.addColorStop(0.5, rgba(col, glow * 0.8));
      gc.addColorStop(1, rgba(col, 0));
      g.fillStyle = gc;
      g.beginPath();
      halfPlane(g, -nx, -ny, -(front - core), L);
      g.fill();
      g.globalCompositeOperation = 'source-over';
    });
  },
});
