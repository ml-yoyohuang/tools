import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, mod, num, rgba, smoothstep, TAU } from '../../engine/helpers';

export default defineEffect({
  id: 'line-tunnel',
  code: 'L02',
  nameZh: '線條隧道',
  nameEn: 'Line Tunnel',
  category: 'lines',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '一層層矩形或多邊形外框從消失點往鏡頭前進並緩慢旋轉，近大遠小形成無限隧道。',
  tags: ['隧道', 'tunnel', '透視', '消失點', '幾何線框'],
  suitable: ['音樂視覺', '轉場背景', '科技主題開場'],
  principle:
    'Canvas 2D 透視投影：每層深度 z = mod(i/N − t·v/N, 1)，螢幕尺度 s = n / (n + z·D)。外框頂點 = 中心 + 旋轉(θ₀·t + z·扭轉) × s；中心 = 消失點 + (畫面中心 − 消失點) × s，消失點以慢速正弦漂移。相鄰層對應頂點以導軌線相連，透明度隨遠近淡入淡出。',
  defaultText: '',
  palette: 'MONO',
  controls: ['intensity', 'scale', 'secondary', 'direction'],
  directions: ['cw', 'ccw'],
  params: [
    { key: 'layers', label: '層數', type: 'range', min: 6, max: 40, step: 1, default: 22 },
    { key: 'sides', label: '邊數（4 = 畫面比例矩形）', type: 'range', min: 3, max: 8, step: 1, default: 4 },
    { key: 'speed', label: '前進速度', type: 'range', min: 0.2, max: 4, step: 0.1, default: 1.4, unit: '層/s' },
    { key: 'twist', label: '深度扭轉', type: 'range', min: 0, max: 180, step: 5, default: 50, unit: '°' },
    { key: 'spin', label: '旋轉速度', type: 'range', min: 0, max: 40, step: 1, default: 8, unit: '°/s' },
    { key: 'rails', label: '導軌連線', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '一開始即在行進中，遠處外框由消失點淡入。',
    motion: '每層以等速沿深度前進；因透視尺度 1/z，越接近鏡頭放大越快，形成加速感；整體緩慢旋轉，消失點輕微漂移。',
    hold: '連續行進，無停頓。',
    exit: '外框衝出畫面邊緣後淡出。',
    loop: '外框到達鏡頭後回到最遠處，循環無接縫。',
  },
  accept: [
    '遠處外框小而密集、靠近鏡頭的外框大而稀疏（非等距縮放）。',
    '外框會緩慢旋轉，深度扭轉讓遠近層角度不同。',
    '開啟導軌時相鄰層頂點以線連接，形成螺旋走廊。',
    '邊數改為 3／6 時隧道變成三角形／六角形。',
  ],
  transparent: true,
  cycle: 10,
  posterTime: 1.5,
  create(ctx) {
    const N = Math.max(4, Math.round(num(ctx, 'layers', 22) * (ctx.q < 0.6 ? 0.75 : 1)));
    const sides = Math.round(num(ctx, 'sides', 4));
    const speed = num(ctx, 'speed', 1.4);
    const twist = (num(ctx, 'twist', 50) * Math.PI) / 180;
    const spin = (num(ctx, 'spin', 8) * Math.PI) / 180;
    const rails = bool(ctx, 'rails', true);
    const dir = ctx.dirSign;
    const W = ctx.width;
    const H = ctx.height;
    const cx = W / 2;
    const cy = H / 2;
    const near = 0.22;
    const depth = 4.2;
    const sc = ctx.s.scale;
    // unit outline (at scale 1 the outline just exceeds the stage)
    const unit: [number, number][] = [];
    if (sides === 4) {
      const hw = (W / 2) * 1.08 * sc;
      const hh = (H / 2) * 1.08 * sc;
      unit.push([-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]);
    } else {
      const r = (Math.hypot(W, H) / 2) * 1.04 * sc;
      for (let k = 0; k < sides; k++) {
        const a = -Math.PI / 2 + (k / sides) * TAU;
        unit.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
    }
    const drift = 0.06 * ctx.s.intensity;
    return canvasRuntime(ctx, (g, t) => {
      const vpx = cx + W * drift * Math.sin(t * 0.23 * TAU);
      const vpy = cy + H * drift * 0.8 * Math.sin(t * 0.17 * TAU + 1.1);
      // layers far → near
      const ls: { z: number; i: number; pts: [number, number][]; a: number }[] = [];
      for (let i = 0; i < N; i++) {
        const z = mod(i / N - (t * speed) / N, 1);
        const s = near / (near + z * depth);
        const rot = dir * (spin * t + z * twist);
        const c = Math.cos(rot);
        const sn = Math.sin(rot);
        const ox = vpx + (cx - vpx) * s;
        const oy = vpy + (cy - vpy) * s;
        const pts = unit.map(([x, y]) => [ox + (x * c - y * sn) * s, oy + (x * sn + y * c) * s] as [number, number]);
        const a = smoothstep(0.95, 0.55, z) * smoothstep(0, 0.06, z);
        ls.push({ z, i, pts, a });
      }
      ls.sort((p, q) => q.z - p.z);
      g.lineJoin = 'round';
      if (rails) {
        g.lineWidth = 1;
        for (let k = 0; k + 1 < ls.length; k++) {
          const A = ls[k];
          const B = ls[k + 1];
          if (B.z > A.z) continue; // wrap seam
          g.strokeStyle = rgba(ctx.s.secondary, 0.55 * Math.min(A.a, B.a));
          g.beginPath();
          for (let v = 0; v < A.pts.length; v++) {
            g.moveTo(A.pts[v][0], A.pts[v][1]);
            g.lineTo(B.pts[v][0], B.pts[v][1]);
          }
          g.stroke();
        }
      }
      for (const L of ls) {
        if (L.a <= 0.01) continue;
        const s = near / (near + L.z * depth);
        g.lineWidth = 0.6 + 3.2 * s;
        g.strokeStyle = rgba(L.i % 4 === 0 ? ctx.s.secondary : ctx.s.primary, L.a);
        g.beginPath();
        L.pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.closePath();
        g.stroke();
      }
    });
  },
});
