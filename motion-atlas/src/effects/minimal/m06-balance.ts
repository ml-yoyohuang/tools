import { defineEffect } from '../../engine/define';
import { canvasRuntime, easeOut3, minSide, num, phase, TAU } from '../../engine/helpers';
import { easeQuadIn, easeSineInOut, hair } from './_util';

export default defineEffect({
  id: 'balance',
  code: 'M06',
  nameZh: '平衡天秤',
  nameEn: 'Balance',
  category: 'minimal',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '細橫桿兩端放著一個圓與一個方塊；一端被輕輕提起又落下，橫桿像蹺蹺板一樣擺盪並逐漸回到平衡。',
  tags: ['極簡', '平衡', '天秤', '阻尼', 'balance'],
  suitable: ['品牌理念／價值說明', '比較型資訊圖', '簡報轉場'],
  principle:
    'Canvas 2D：橫桿繞支點旋轉 θ，兩個形狀以「沿桿方向 ±d、沿法線方向 + 半徑」貼在桿上並隨桿旋轉。每個循環：一端形狀以 cubic.out 被提起，橫桿以 sine.inOut 傾向另一側到 −side·A；短暫懸停後以 quad.in 落下；接著 θ(τ) = θ₀·e^(−ζτ)·cos(2πfτ) 做阻尼擺盪回到 0，最後靜止停留。下一循環換另一端。',
  defaultText: '',
  palette: 'STREET',
  colors: { background: '#141414', primary: '#F2E8D5', secondary: '#F2E8D5', accent: '#E63A2E' },
  controls: ['intensity', 'scale', 'secondary', 'accent'],
  params: [
    { key: 'damping', label: '阻尼', type: 'range', min: 0.4, max: 2.5, step: 0.1, default: 1.1 },
    { key: 'freq', label: '擺盪頻率', type: 'range', min: 0.25, max: 1.2, step: 0.05, default: 0.55, unit: 'Hz' },
    { key: 'hold', label: '平衡停留', type: 'range', min: 0.2, max: 3, step: 0.1, default: 1, unit: 's' },
  ],
  recipe: {
    enter: '橫桿水平、兩端形狀靜止。',
    motion: '一端形狀以 cubic.out 被提起約 1 秒，橫桿以 sine.inOut 傾向另一側；形狀以 quad.in 落下後橫桿做阻尼擺盪。',
    hold: '擺盪衰減到水平後停留約 1 秒。',
    exit: '無離場，換另一端被提起。',
    loop: '左右輪替，兩個循環為一組。',
  },
  accept: [
    '一端形狀被提起時，橫桿向另一端傾斜。',
    '形狀落下後橫桿越過水平再擺回，振幅逐次變小，最後靜止。',
    '阻尼調大時更快靜止；強度 0 時幾乎不傾斜。',
    '形狀始終貼著橫桿，不穿過也不離開（提起時除外）。',
  ],
  transparent: true,
  cycle: 15.6,
  posterTime: 0.2,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const zeta = num(ctx, 'damping', 1.1);
    const freq = num(ctx, 'freq', 0.55);
    const hold = num(ctx, 'hold', 1);
    const A = ((13 * Math.PI) / 180) * ctx.s.intensity;
    const sc = ctx.s.scale;
    const L = Math.min(w * 0.72, m * 1.05) * sc;
    const px = w / 2;
    const py = h / 2 + m * 0.08 * sc;
    const lw = hair(m, 0.005, 1.5);
    const s = m * 0.065 * sc;
    const d = L / 2 - s * 1.2;
    const liftH = m * 0.14 * sc;
    const settle = Math.max(2.4, 4.6 / zeta);
    const durs = [1.1, 0.35, 0.32, settle, hold];
    const total = durs.reduce((a, b) => a + b, 0);
    return canvasRuntime(ctx, (g, t) => {
      const n = Math.floor(t / total);
      const side = n % 2 === 0 ? -1 : 1; // lifted side: -1 left, +1 right
      const ph = phase(t, durs);
      const tilt = -side * A;
      let theta = 0;
      let lift = 0;
      if (ph.i === 0) {
        theta = tilt * easeSineInOut(ph.p);
        lift = easeOut3(ph.p);
      } else if (ph.i === 1) {
        theta = tilt;
        lift = 1;
      } else if (ph.i === 2) {
        theta = tilt;
        lift = 1 - easeQuadIn(ph.p);
      } else if (ph.i === 3) {
        const tau = ph.p * settle;
        theta = tilt * Math.exp(-zeta * tau) * Math.cos(TAU * freq * tau);
      }
      const ux = Math.cos(theta);
      const uy = Math.sin(theta);
      const nx = Math.sin(theta);
      const ny = -Math.cos(theta);
      // fulcrum
      g.strokeStyle = ctx.s.primary;
      g.lineWidth = lw;
      g.lineJoin = 'round';
      const fh = m * 0.06 * sc;
      g.beginPath();
      g.moveTo(px, py + lw);
      g.lineTo(px - fh * 0.62, py + fh);
      g.lineTo(px + fh * 0.62, py + fh);
      g.closePath();
      g.stroke();
      // beam
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(px - ux * L / 2, py - uy * L / 2);
      g.lineTo(px + ux * L / 2, py + uy * L / 2);
      g.stroke();
      // shapes sitting on the beam
      const off = lw / 2;
      const place = (sgn: number, r: number) => {
        const extra = sgn === side ? lift * liftH : 0;
        return [px + ux * d * sgn + nx * (r + off), py + uy * d * sgn + ny * (r + off) - extra] as const;
      };
      const [c1x, c1y] = place(-1, s);
      g.fillStyle = ctx.s.secondary;
      g.beginPath();
      g.arc(c1x, c1y, s, 0, TAU);
      g.fill();
      const half = s * 0.89;
      const [c2x, c2y] = place(1, half);
      g.save();
      g.translate(c2x, c2y);
      g.rotate(theta);
      g.fillStyle = ctx.s.accent;
      g.fillRect(-half, -half, half * 2, half * 2);
      g.restore();
    });
  },
});
