import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, mixHex, num, rgba, str, TAU } from '../../engine/helpers';
import { makeCamera } from './_util';

export default defineEffect({
  id: 'grid-wave-surface',
  code: 'G12',
  nameZh: '波浪表面',
  nameEn: 'Grid Wave Surface',
  category: 'grid',
  sourceType: 'original',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '規律網格變成連續起伏的 3D 曲面，波峰較亮、波谷較暗，整片表面緩慢翻湧。',
  tags: ['3D', '曲面', '波浪', '網格', 'surface'],
  suitable: ['音樂／聲波意象', '科技背景', '沉浸式開場'],
  principle:
    'Canvas 2D 自製 3D：高度場 y = A·[0.55·sin(k₁·p − ω₁t) + 0.3·sin(k₂·p − ω₂t) + 0.35·sin(k₃|p − c| − ω₃t)]，兩個方向與漣漪中心由 seed 決定。網格點經 yaw / pitch 旋轉後透視投影，四邊形由遠到近（畫家演算法）填色；顏色由高度查表（波谷 → 中 → 波峰三段色），所以明暗與位置同時反映高度。ctx.q 低（卡片 / 手機）時網格解析度降到約一半並省略格線描邊。',
  defaultText: '',
  palette: 'COOL',
  colors: { primary: '#FFE35A' },
  controls: ['intensity', 'scale', 'secondary', 'seed'],
  params: [
    { key: 'res', label: '網格解析度', type: 'range', min: 12, max: 60, step: 1, default: 40 },
    { key: 'height', label: '起伏高度', type: 'range', min: 0.05, max: 0.4, step: 0.01, default: 0.16 },
    { key: 'freq', label: '波長密度', type: 'range', min: 0.5, max: 3, step: 0.1, default: 1.4 },
    { key: 'pitch', label: '俯視角', type: 'range', min: 15, max: 75, step: 1, default: 38, unit: '°' },
    {
      key: 'style',
      label: '表現方式',
      type: 'select',
      default: 'shaded',
      options: [
        { value: 'shaded', label: '填色曲面' },
        { value: 'lines', label: '線框' },
        { value: 'dots', label: '點陣' },
      ],
    },
  ],
  recipe: {
    enter: '曲面一開始即在起伏中。',
    motion: '兩組方向波與一個漣漪疊加，連續平滑地起伏；相機以 20 秒週期 ±14° 緩慢轉向。',
    hold: '連續運動，無停頓。',
    exit: '無離場。',
    loop: '所有波都是時間的週期函數，可無限播放。',
  },
  accept: [
    '可看出一片連續曲面（遠小近大），而不是平面上的顏色動畫。',
    '波峰亮、波谷暗，亮處同時位置較高。',
    '線框模式下看得到網格四邊形隨高度變形。',
    '卡片與低效能模式解析度降低但形狀相同。',
  ],
  limits: ['ctx.q < 0.7（卡片 / 手機）時解析度約減半並省略格線描邊。'],
  transparent: true,
  posterTime: 1.3,
  cycle: 20,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const lowQ = ctx.q < 0.7;
    const resParam = Math.round(num(ctx, 'res', 40));
    const N = Math.max(8, Math.round(resParam * (lowQ ? 0.55 : 1)));
    const M = Math.max(6, Math.round(N * 0.8));
    const amp = num(ctx, 'height', 0.16) * ctx.s.intensity;
    const freq = num(ctx, 'freq', 1.4);
    const pitch = (num(ctx, 'pitch', 38) * Math.PI) / 180;
    const style = str(ctx, 'style', 'shaded');
    const r = ctx.rand;
    const a1 = r() * TAU;
    const a2 = a1 + 1 + r() * 2;
    const k1 = [Math.cos(a1) * freq * 3.2, Math.sin(a1) * freq * 3.2];
    const k2 = [Math.cos(a2) * freq * 5.1, Math.sin(a2) * freq * 5.1];
    const rc = [r() * 1.2 - 0.6, r() * 1.2 - 0.6];
    const k3 = freq * 6;
    const yawPh = r() * TAU;
    const dist = 3.2;
    const HX = 1.25;
    const HZ = 1;
    // fit: project the patch bounds with focal = 1 at the yaw extremes, then scale to the stage
    const probe = makeCamera(0, 0, 1, dist);
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    const yawMax = (14 * Math.PI) / 180;
    for (const yw of [-yawMax, 0, yawMax]) {
      probe.set(pitch, yw);
      for (const bx of [-HX, 0, HX])
        for (const bz of [-HZ, 0, HZ])
          for (const by of [-amp * 2, amp * 2]) {
            const p = probe.p(bx, by, bz);
            x0 = Math.min(x0, p.x);
            x1 = Math.max(x1, p.x);
            y0 = Math.min(y0, p.y);
            y1 = Math.max(y1, p.y);
          }
    }
    const focal = Math.min((w * 0.94) / (x1 - x0), (h * 0.9) / (y1 - y0)) * ctx.s.scale;
    const cam = makeCamera(w / 2, h / 2 - ((y0 + y1) / 2) * focal, focal, dist);
    const npts = (N + 1) * (M + 1);
    const sx = new Float32Array(npts);
    const sy = new Float32Array(npts);
    const hv = new Float32Array(npts);
    const LUT = 48;
    const low = mixHex(ctx.s.secondary, ctx.s.background, 0.6);
    const mid = ctx.s.secondary;
    const high = ctx.s.primary;
    const lut = Array.from({ length: LUT }, (_, i) => {
      const u = i / (LUT - 1);
      return u < 0.5 ? mixHex(low, mid, u * 2) : mixHex(mid, high, (u - 0.5) * 2);
    });
    const edge = rgba(ctx.s.background, 0.4);
    const colAt = (v: number) => lut[clamp(Math.round(((v + 1) / 2) * (LUT - 1)), 0, LUT - 1)];

    return canvasRuntime(ctx, (g, t) => {
      cam.set(pitch, ((14 * Math.PI) / 180) * Math.sin((t * TAU) / 20 + yawPh));
      for (let j = 0; j <= M; j++) {
        const z = -HZ + (2 * HZ * j) / M;
        for (let i = 0; i <= N; i++) {
          const x = -HX + (2 * HX * i) / N;
          const v =
            0.55 * Math.sin(k1[0] * x + k1[1] * z - t * 1.1) +
            0.3 * Math.sin(k2[0] * x + k2[1] * z - t * 1.7) +
            0.35 * Math.sin(Math.hypot(x - rc[0], z - rc[1]) * k3 - t * 2.2);
          const k = j * (N + 1) + i;
          const vn = clamp(v / 1.2, -1, 1);
          hv[k] = vn;
          const p = cam.p(x, vn * amp * 2, z);
          sx[k] = p.x;
          sy[k] = p.y;
        }
      }
      if (style === 'dots') {
        for (let k = 0; k < npts; k++) {
          g.fillStyle = colAt(hv[k]);
          const rr = 1 + (hv[k] + 1) * 1.3;
          g.fillRect(sx[k] - rr / 2, sy[k] - rr / 2, rr, rr);
        }
        return;
      }
      if (style === 'lines') {
        g.lineWidth = 1.1;
        for (let j = 0; j <= M; j++)
          for (let i = 0; i <= N; i++) {
            const k = j * (N + 1) + i;
            g.strokeStyle = colAt(hv[k]);
            g.beginPath();
            if (i < N) {
              g.moveTo(sx[k], sy[k]);
              g.lineTo(sx[k + 1], sy[k + 1]);
            }
            if (j < M) {
              g.moveTo(sx[k], sy[k]);
              g.lineTo(sx[k + N + 1], sy[k + N + 1]);
            }
            g.stroke();
          }
        return;
      }
      // shaded quads, far rows (large z) first
      g.lineWidth = 0.8;
      g.strokeStyle = edge;
      g.lineJoin = 'round';
      for (let j = M - 1; j >= 0; j--)
        for (let i = 0; i < N; i++) {
          const a = j * (N + 1) + i;
          const b = a + 1;
          const c = a + N + 2;
          const d = a + N + 1;
          g.fillStyle = colAt((hv[a] + hv[b] + hv[c] + hv[d]) / 4);
          g.beginPath();
          g.moveTo(sx[a], sy[a]);
          g.lineTo(sx[b], sy[b]);
          g.lineTo(sx[c], sy[c]);
          g.lineTo(sx[d], sy[d]);
          g.closePath();
          g.fill();
          if (!lowQ) g.stroke();
        }
    });
  },
});
