import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, minSide, mod, num, rgba, TAU } from '../../engine/helpers';
import { makeCamera } from './_util';

export default defineEffect({
  id: 'tilt-grid',
  code: 'G06',
  nameZh: '傾斜網格',
  nameEn: 'Tilt Grid',
  category: 'grid',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '一片網格平面在透視中緩慢前後傾斜、微微轉向，平面上少數節點輪流點亮並擴散光圈。',
  tags: ['透視', '3D', '網格平面', '節點', 'perspective'],
  suitable: ['科技／資料背景', '產品發表開場', '地圖節點'],
  principle:
    'Canvas 2D 自製 3D 投影：網格點在 y = 0 平面上 (x, 0, z)，先繞 Y 軸 yaw、再繞 X 軸傾斜 pitch = 90° − 傾角，透視投影 screen = c + (x′, −y′) · f / (d + z′)。透視強度改變相機距離 d（f 同步調整讓畫面大小一致），距離越近遠近差越大。格線以分段投影並依深度調整透明度；點亮的節點在平面上畫一個圓（16 點投影），因此光圈也呈透視橢圓。',
  defaultText: '',
  palette: 'MONO',
  colors: { accent: '#FFE35A' },
  controls: ['scale', 'intensity', 'accent', 'seed'],
  params: [
    { key: 'tilt', label: '最大傾角', type: 'range', min: 10, max: 80, step: 1, default: 58, unit: '°' },
    { key: 'persp', label: '透視強度', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'lines', label: '格線數', type: 'range', min: 6, max: 30, step: 1, default: 16 },
    { key: 'lights', label: '點亮節點數', type: 'range', min: 0, max: 12, step: 1, default: 5 },
  ],
  recipe: {
    enter: '網格平面接近正面朝向。',
    motion: '傾角以 8 秒週期的正弦緩慢在 35%–100% 之間變化，同時 ±（強度 × 10°）緩慢轉向；節點依 seed 錯開時間點亮，光圈在平面上擴散淡出。',
    hold: '連續緩動，沒有急停。',
    exit: '無離場。',
    loop: '傾斜與轉向是同一週期的函數，無縫循環。',
  },
  accept: [
    '傾斜時遠端格距變小、近端變大，格線仍為直線。',
    '透視強度 0 時近乎平行投影；1 時遠近差最明顯。',
    '點亮節點的光圈呈透視橢圓並貼在平面上。',
    '最大傾角調小時平面幾乎保持正面。',
  ],
  transparent: true,
  posterTime: 2.6,
  cycle: 16,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const maxTilt = (num(ctx, 'tilt', 58) * Math.PI) / 180;
    const persp = num(ctx, 'persp', 0.6);
    const n = Math.max(4, Math.round(num(ctx, 'lines', 16) * (ctx.mode === 'card' ? 0.75 : 1)));
    const nLights = Math.round(num(ctx, 'lights', 5));
    const yawAmp = (10 * Math.PI) / 180 * ctx.s.intensity;
    const S = 1; // half size of the plane in world units
    const dist = 1.6 + (1 - persp) * 14;
    const fit = Math.max(w, h) * 0.5 * ctx.s.scale * 0.95;
    const focal = fit * dist;
    const cam = makeCamera(w / 2, h / 2, focal, dist);
    const lights = Array.from({ length: nLights }, () => ({
      i: Math.round(n * (0.2 + 0.6 * ctx.rand())),
      j: Math.round(n * (0.25 + 0.5 * ctx.rand())),
      off: ctx.rand() * 6,
      period: 3.5 + ctx.rand() * 3,
    }));
    const seg = 10;
    const P = (i: number) => -S + (2 * S * i) / n;
    const lineRGB = ctx.s.primary;
    const m = minSide(ctx);

    return canvasRuntime(ctx, (g, t) => {
      const breathe = 0.5 - 0.5 * Math.cos((t * TAU) / 8);
      const tilt = maxTilt * (0.35 + 0.65 * breathe);
      const yaw = yawAmp * Math.sin((t * TAU) / 16);
      cam.set(Math.PI / 2 - tilt, yaw);
      g.lineWidth = 1.2;
      // grid lines in segments, alpha by depth (far = fainter)
      const zRange = S * 1.5;
      for (let dirn = 0; dirn < 2; dirn++)
        for (let i = 0; i <= n; i++) {
          const c = P(i);
          let px = 0;
          let py = 0;
          for (let k = 0; k <= seg; k++) {
            const u = -S + (2 * S * k) / seg;
            const p = dirn === 0 ? cam.p(c, 0, u) : cam.p(u, 0, c);
            if (k > 0) {
              const a = clamp(0.75 - (p.z / zRange) * 0.55, 0.12, 0.9);
              g.strokeStyle = rgba(lineRGB, a * (i === 0 || i === n ? 1 : 0.7));
              g.beginPath();
              g.moveTo(px, py);
              g.lineTo(p.x, p.y);
              g.stroke();
            }
            px = p.x;
            py = p.y;
          }
        }
      // node dots (small) at every intersection
      g.fillStyle = rgba(lineRGB, 0.55);
      for (let j = 0; j <= n; j++)
        for (let i = 0; i <= n; i++) {
          const p = cam.p(P(i), 0, P(j));
          const r = clamp(p.s / focal * dist * 1.4, 0.6, 3);
          g.fillRect(p.x - r / 2, p.y - r / 2, r, r);
        }
      // lit nodes
      for (const L of lights) {
        const ph = mod(t + L.off, L.period) / L.period;
        if (ph > 0.6) continue;
        const x = P(L.i);
        const z = P(L.j);
        const on = ph < 0.08 ? ph / 0.08 : 1 - (ph - 0.08) / 0.52;
        const ringR = (ph / 0.6) * (2 * S / n) * 2.4;
        g.strokeStyle = rgba(ctx.s.accent, clamp(on, 0, 1) * 0.9);
        g.lineWidth = 1.5;
        g.beginPath();
        for (let k = 0; k <= 24; k++) {
          const a = (k / 24) * TAU;
          const p = cam.p(x + Math.cos(a) * ringR, 0, z + Math.sin(a) * ringR);
          if (k === 0) g.moveTo(p.x, p.y);
          else g.lineTo(p.x, p.y);
        }
        g.stroke();
        const p = cam.p(x, 0, z);
        const r = Math.max(2.5, m * 0.012 * (p.s / focal) * dist);
        g.fillStyle = rgba(ctx.s.accent, clamp(on * 1.2, 0, 1));
        g.beginPath();
        g.arc(p.x, p.y, r, 0, TAU);
        g.fill();
      }
    });
  },
});
