import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, minSide, num, rgba, TAU } from '../../engine/helpers';
import { noise2 } from '../../engine/random';
import { C } from '../../engine/palette';

export default defineEffect({
  id: 'topo-lines',
  code: 'L12',
  nameZh: '地形等高線',
  nameEn: 'Topo Lines',
  category: 'lines',
  sourceType: 'reference',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '由連續雜訊高度場以 marching squares 抽出多層等高線，山頭緩慢隆起、分裂與合併。',
  tags: ['等高線', 'topographic', 'marching squares', '地形', '雜訊場'],
  suitable: ['戶外／地理主題', '品牌紋理背景', '數據視覺化背景'],
  principle:
    'Canvas 2D：高度場 h(x,y,t) = cos(ωt)·F₁(x,y) + sin(ωt)·F₂(x,y)，F 為兩層 noise2 的 fBm；兩個獨立場做圓形混合，地形形狀持續變形且以 2π/ω 為週期無縫循環。對每個等值 v 以 marching squares 掃描網格：依四角是否高於 v 得 16 種情況，在邊上線性內插交點並連成線段；鞍點依格心值決定連法。每 5 條為較粗的計曲線。',
  defaultText: '',
  palette: 'STREET',
  colors: { background: C.cream, primary: C.black, secondary: C.red, accent: C.black },
  controls: ['scale', 'secondary', 'seed'],
  params: [
    { key: 'levels', label: '等高線層數', type: 'range', min: 6, max: 30, step: 1, default: 16 },
    { key: 'detail', label: '地形細碎度', type: 'range', min: 0.5, max: 3, step: 0.1, default: 1.3 },
    { key: 'speed', label: '變形速度', type: 'range', min: 0, max: 1, step: 0.02, default: 0.3 },
    { key: 'lineWidth', label: '線寬', type: 'range', min: 0.5, max: 3, step: 0.25, default: 1.25, unit: 'px' },
    { key: 'index', label: '計曲線（每 5 條加粗）', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '一開始即顯示完整地形。',
    motion: '高度場在兩個雜訊地形之間以 cos/sin 圓形混合，山頭緩慢升降、分裂、合併；線條間距隨坡度自然變化。',
    hold: '連續變形，無停頓。',
    exit: '無離場。',
    loop: '混合角每 2π/ω 回到原點，循環無接縫。',
  },
  accept: [
    '等高線為不規則的閉合或延伸至邊緣的曲線，不是同心圓。',
    '線與線之間不交叉，間距在陡坡處較密。',
    '開啟計曲線時每 5 條以強調色加粗。',
    '變形速度為 0 時地形靜止；換 seed 後地形不同。',
  ],
  transparent: true,
  cycle: 20,
  posterTime: 1,
  create(ctx) {
    const nLev = Math.round(num(ctx, 'levels', 16));
    const detail = num(ctx, 'detail', 1.3);
    const speed = num(ctx, 'speed', 0.3);
    const lw = num(ctx, 'lineWidth', 1.25);
    const index = bool(ctx, 'index', true);
    const W = ctx.width;
    const H = ctx.height;
    const m = minSide(ctx);
    const seed = ctx.seed;
    const cellPx = clamp(m / 90, 4, 11) / Math.sqrt(ctx.q);
    const cols = Math.ceil(W / cellPx) + 1;
    const rows = Math.ceil(H / cellPx) + 1;
    const cs = W / (cols - 1);
    const rs = H / (rows - 1);
    const freq = (detail * 2.2) / (m * clamp(ctx.s.scale, 0.5, 1.6));
    // static fields sampled once (the time-dependence is the cos/sin blend)
    const F1 = new Float32Array(cols * rows);
    const F2 = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        // rotate the lattice so value-noise cells never line up with the screen axes
        const px = i * cs * freq;
        const py = j * rs * freq;
        const x = px * 0.83 - py * 0.56;
        const y = px * 0.56 + py * 0.83;
        const k = j * cols + i;
        F1[k] = (noise2(x, y, seed) + 0.45 * noise2(x * 1.3 - y * 1.66 + 13.7, x * 1.66 + y * 1.3 - 4.2, seed + 11)) / 1.45;
        F2[k] = (noise2(x + 71.3, y - 29.1, seed + 23) + 0.45 * noise2(x * 1.95 + y * 0.9 - 8.4, -x * 0.9 + y * 1.95 + 51.6, seed + 37)) / 1.45;
      }
    }
    const h = new Float32Array(cols * rows);
    const levels = Array.from({ length: nLev }, (_, j) => -0.62 + (1.24 * (j + 0.5)) / nLev);
    // one full morph cycle = 6 / speed seconds (20 s at the default 0.3)
    const w = speed > 0 ? TAU * (speed / 6) : 0;

    return canvasRuntime(ctx, (g, t) => {
      const c = Math.cos(w * t);
      const s = Math.sin(w * t);
      for (let k = 0; k < h.length; k++) h[k] = c * F1[k] + s * F2[k];
      g.lineCap = 'round';
      g.lineJoin = 'round';
      for (let li = 0; li < nLev; li++) {
        const v = levels[li];
        const major = index && (li + 1) % 5 === 0;
        const path = new Path2D();
        for (let j = 0; j < rows - 1; j++) {
          const y0 = j * rs;
          const y1 = y0 + rs;
          for (let i = 0; i < cols - 1; i++) {
            const k = j * cols + i;
            const a = h[k];
            const b = h[k + 1];
            const cc = h[k + cols + 1];
            const d = h[k + cols];
            const idx = (a > v ? 8 : 0) | (b > v ? 4 : 0) | (cc > v ? 2 : 0) | (d > v ? 1 : 0);
            if (idx === 0 || idx === 15) continue;
            const x0 = i * cs;
            const x1 = x0 + cs;
            // edge intersection points
            const top = (): [number, number] => [x0 + ((v - a) / (b - a)) * cs, y0];
            const right = (): [number, number] => [x1, y0 + ((v - b) / (cc - b)) * rs];
            const bottom = (): [number, number] => [x0 + ((v - d) / (cc - d)) * cs, y1];
            const left = (): [number, number] => [x0, y0 + ((v - a) / (d - a)) * rs];
            const seg = (p: [number, number], q: [number, number]) => {
              path.moveTo(p[0], p[1]);
              path.lineTo(q[0], q[1]);
            };
            switch (idx) {
              case 1:
              case 14:
                seg(left(), bottom());
                break;
              case 2:
              case 13:
                seg(bottom(), right());
                break;
              case 3:
              case 12:
                seg(left(), right());
                break;
              case 4:
              case 11:
                seg(top(), right());
                break;
              case 6:
              case 9:
                seg(top(), bottom());
                break;
              case 7:
              case 8:
                seg(left(), top());
                break;
              case 5:
              case 10: {
                const center = (a + b + cc + d) / 4 > v;
                if ((idx === 5) === center) {
                  seg(left(), top());
                  seg(bottom(), right());
                } else {
                  seg(left(), bottom());
                  seg(top(), right());
                }
                break;
              }
            }
          }
        }
        g.strokeStyle = major ? ctx.s.secondary : rgba(ctx.s.primary, 0.72);
        g.lineWidth = major ? lw * 2 : lw;
        g.stroke(path);
      }
    });
  },
});
