import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, num, TAU } from '../../engine/helpers';
import { C } from '../../engine/palette';

export default defineEffect({
  id: 'stripe-twist',
  code: 'L09',
  nameZh: '扭動條紋',
  nameEn: 'Stripe Twist',
  category: 'lines',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '一束平行色帶像緞帶一樣沿長軸整體扭轉，條紋在扭結處收成一線再翻面展開，扭結沿畫面滑動。',
  tags: ['條紋', 'twist', '緞帶', '扭轉', '歐普藝術'],
  suitable: ['品牌色帶動態', '活動主視覺', '音樂視覺背景'],
  principle:
    'Canvas 2D：把 N 條色帶視為一條緞帶的截面座標 uₖ ∈ [−1, 1]。在每個 x 取樣緞帶繞長軸的旋轉角 φ(x,t) = 扭轉數·π·x/W − dir·ω·t，色帶邊界 y = 中線(x,t) + uₖ·半寬·cos φ；中線另有緩慢正弦擺動。所有色帶共用同一個 φ，因此永遠是連續、不交錯的條紋；cos φ < 0 時為背面（順序翻轉），以 x 方向漸層疊上明暗表現受光。',
  defaultText: '',
  palette: 'POP',
  colors: { background: C.yellow, primary: C.blue, secondary: C.pink, accent: C.white },
  controls: ['intensity', 'scale', 'secondary', 'direction'],
  directions: ['left', 'right'],
  params: [
    { key: 'stripes', label: '色帶數', type: 'range', min: 3, max: 16, step: 1, default: 8 },
    { key: 'twists', label: '扭轉次數', type: 'range', min: 0.5, max: 5, step: 0.25, default: 2 },
    { key: 'speed', label: '扭轉速度', type: 'range', min: 0, max: 3, step: 0.05, default: 0.9, unit: 'rad/s' },
    { key: 'ribbons', label: '緞帶數', type: 'range', min: 1, max: 3, step: 1, default: 1 },
    { key: 'shade', label: '明暗', type: 'range', min: 0, max: 0.8, step: 0.05, default: 0.4 },
  ],
  recipe: {
    enter: '一開始緞帶已在畫面中。',
    motion: '扭結點以等速沿水平方向滑動（linear），緞帶中線以較慢的正弦擺動；色帶在扭結處收窄、翻面後再展開。',
    hold: '連續運動，無停頓。',
    exit: '無離場。',
    loop: 'φ 與擺動為週期函數，循環無接縫。',
  },
  accept: [
    '所有色帶同時在同一位置收窄成線，不是各自隨機晃動。',
    '經過扭結後色帶順序上下翻轉，背面較暗。',
    '色帶數改變時條紋變細或變粗，仍連續不斷。',
    '方向切換後扭結往反方向移動。',
  ],
  transparent: true,
  cycle: 7,
  posterTime: 1.2,
  create(ctx) {
    const N = Math.round(num(ctx, 'stripes', 8));
    const twists = num(ctx, 'twists', 2);
    const speed = num(ctx, 'speed', 0.9);
    const ribbons = Math.round(num(ctx, 'ribbons', 1));
    const shade = num(ctx, 'shade', 0.4);
    const W = ctx.width;
    const H = ctx.height;
    const dir = ctx.dirSign;
    const cols = Math.round(clamp(W / 8, 60, 180) * (ctx.q < 0.6 ? 0.7 : 1));
    const xs = Array.from({ length: cols + 1 }, (_, i) => (i / cols) * W);
    const slot = H / ribbons;
    const half = Math.min(slot * 0.36, H * 0.3) * clamp(ctx.s.scale, 0.5, 1.6);
    const sway = slot * 0.12 * ctx.s.intensity;
    const colors = [ctx.s.primary, ctx.s.secondary];
    const cosA = new Float32Array(cols + 1);
    const mid = new Float32Array(cols + 1);

    return canvasRuntime(ctx, (g, t) => {
      for (let r = 0; r < ribbons; r++) {
        const cy = slot * (r + 0.5);
        const off = r * 1.3;
        for (let i = 0; i <= cols; i++) {
          const x = xs[i] / W;
          const phi = twists * Math.PI * x - dir * speed * t + off;
          cosA[i] = Math.cos(phi);
          mid[i] = cy + sway * Math.sin(TAU * (x * 0.7 + dir * t * 0.11) + off);
        }
        const y = (i: number, u: number) => mid[i] + u * half * cosA[i];
        for (let k = 0; k < N; k++) {
          const u0 = -1 + (2 * k) / N;
          const u1 = -1 + (2 * (k + 1)) / N;
          g.fillStyle = colors[(k + r) % 2];
          g.beginPath();
          g.moveTo(xs[0], y(0, u0));
          for (let i = 1; i <= cols; i++) g.lineTo(xs[i], y(i, u0));
          for (let i = cols; i >= 0; i--) g.lineTo(xs[i], y(i, u1));
          g.closePath();
          g.fill();
        }
        if (shade > 0) {
          // light: bright when the ribbon faces the viewer, darker edge-on and on the back face
          const grad = g.createLinearGradient(0, 0, W, 0);
          const stops = Math.min(cols, 64);
          for (let s = 0; s <= stops; s++) {
            const i = Math.round((s / stops) * cols);
            const c = cosA[i];
            const a = shade * (0.85 * (1 - Math.abs(c)) ** 2 + (c < 0 ? 0.35 : 0));
            grad.addColorStop(s / stops, `rgba(20,20,20,${clamp(a, 0, 0.9).toFixed(3)})`);
          }
          g.fillStyle = grad;
          g.beginPath();
          g.moveTo(xs[0], y(0, -1));
          for (let i = 1; i <= cols; i++) g.lineTo(xs[i], y(i, -1));
          for (let i = cols; i >= 0; i--) g.lineTo(xs[i], y(i, 1));
          g.closePath();
          g.fill();
        }
      }
    });
  },
});
