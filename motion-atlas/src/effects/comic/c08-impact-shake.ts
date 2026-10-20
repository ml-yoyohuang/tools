import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, easeIn3, easeOut3, minSide, num, phase, str, TAU } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import { roundRectPath } from '../../engine/shapes';
import { inkText } from './_util';

export default defineEffect({
  id: 'impact-shake',
  code: 'C08',
  nameZh: '動感震動',
  nameEn: 'Impact Shake',
  category: 'comic',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '一顆衝擊球從側面撞上主圖形：撞擊點閃出衝擊星，圖形被推開、擠壓後以快速衰減的彈簧震動回位。',
  tags: ['漫畫', '震動', '衝擊', '彈簧', 'impact'],
  suitable: ['錯誤提示', '遊戲受擊', '按鈕回饋', '強調標籤'],
  principle:
    'Canvas 2D：撞擊時間 t₀ 之後，主圖形的位移 x(τ) = A·e^(−kτ)·sin(2πfτ)（沿撞擊方向）、旋轉 θ(τ) = B·e^(−kτ)·sin(2πfτ + 0.6)、沿撞擊軸的擠壓 1 − c·e^(−2kτ)；只有主圖形套用這個 transform，背景與畫面其他部分不動。衝擊球以 easeIn³ 加速飛入、撞擊後沿反方向彈開並淡出，撞擊點畫一個鋸齒衝擊星與放射短線。',
  defaultText: 'HIT!',
  palette: 'POP',
  colors: { background: '#FFE35A', primary: '#E63A2E', secondary: '#141414', accent: '#FFFFFF' },
  controls: ['text', 'font', 'weight', 'intensity', 'scale', 'direction', 'secondary', 'accent'],
  directions: ['right', 'left'],
  textHint: '印在主圖形上的短字，建議 1～6 個字。',
  maxChars: 16,
  params: [
    {
      key: 'shape',
      label: '主圖形',
      type: 'select',
      options: [
        { value: 'block', label: '圓角方塊' },
        { value: 'disc', label: '圓形' },
        { value: 'diamond', label: '菱形' },
      ],
      default: 'block',
    },
    { key: 'decay', label: '衰減速度', type: 'range', min: 2, max: 14, step: 0.5, default: 6 },
    { key: 'freq', label: '震動頻率', type: 'range', min: 2, max: 12, step: 0.5, default: 6, unit: 'Hz' },
    { key: 'marks', label: '衝擊星與放射線', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '衝擊球從畫面外以 easeIn³ 加速飛向主圖形（0.5 秒），身後帶三條速度線。',
    motion: '撞擊瞬間主圖形沿撞擊方向被推開並壓扁，接著以指數衰減的正弦彈簧左右震動與微旋轉，約 0.8 秒內歸零；衝擊星在撞擊點炸開後縮小。',
    hold: '主圖形完全靜止停留。',
    exit: '衝擊球撞擊後彈回畫面外並淡出。',
    loop: '1.2 秒停留後下一顆衝擊球再次飛入。',
  },
  accept: [
    '只有一次明確撞擊，之後的震動明顯快速衰減到完全靜止。',
    '只有主圖形在震動，背景與畫面邊界完全不動。',
    '「衰減速度」越大震動越快停止；強度為 0 時圖形不移動。',
    '方向切換後衝擊球從另一側飛入，圖形朝反方向被推開。',
  ],
  transparent: true,
  cycle: 3.4,
  posterTime: 0.62,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const cx = w / 2;
    const cy = h / 2;
    const shape = str(ctx, 'shape', 'block');
    const k = num(ctx, 'decay', 6);
    const f = num(ctx, 'freq', 6);
    const marks = bool(ctx, 'marks', true);
    const from = ctx.dir === 'left' ? 1 : -1; // ball comes from this side
    const push = -from; // shape is pushed this way
    const S = m * 0.25 * ctx.s.scale;
    const hw = shape === 'block' ? S * Math.min(1.5, (w / h) * 0.9) : S;
    const hh = S;
    const layout = layoutText(ctx, ctx.text, {
      cx: 0,
      cy: 0,
      maxWidth: hw * (shape === 'block' ? 1.55 : 1.15),
      maxHeight: hh * (shape === 'block' ? 1.1 : 0.85),
      fill: 0.95,
      noScale: true,
    });
    const ballR = m * 0.07;
    const edgeX = cx + from * hw;
    const lw = Math.max(3, m * 0.012);
    const IN = 0.5;
    const durs = [IN, 1.7, 1.2];
    const burstPts = Array.from({ length: 22 }, (_, i) => (i % 2 ? 0.45 : 0.85 + ((i * 7) % 5) * 0.05));
    const shapePath = (g: CanvasRenderingContext2D) => {
      g.beginPath();
      if (shape === 'disc') g.ellipse(0, 0, hw, hh, 0, 0, TAU);
      else if (shape === 'diamond') {
        g.moveTo(0, -hh * 1.2);
        g.lineTo(hw * 1.2, 0);
        g.lineTo(0, hh * 1.2);
        g.lineTo(-hw * 1.2, 0);
        g.closePath();
      } else roundRectPath(g, -hw, -hh, hw * 2, hh * 2, S * 0.22);
    };
    return canvasRuntime(ctx, (g, t) => {
      const ph = phase(t, durs);
      const I = ctx.s.intensity;
      const tau = ph.i === 1 ? ph.p * durs[1] : ph.i === 2 ? durs[1] + ph.p * durs[2] : -1;
      // spring response after impact
      let dx = 0;
      let rot = 0;
      let sq = 0;
      if (tau >= 0) {
        const env = Math.exp(-k * tau);
        dx = push * m * 0.09 * I * env * Math.sin(TAU * f * tau + 0.25);
        rot = push * 0.12 * I * env * Math.sin(TAU * f * tau + 0.85);
        sq = 0.22 * I * Math.exp(-2 * k * tau) * Math.max(0, Math.cos(TAU * f * 0.5 * tau));
      }
      // ball
      let bx = 0;
      let alpha = 1;
      const far = cx + from * (w / 2 + ballR * 2);
      const hit = edgeX + from * ballR * (1 - sq);
      if (ph.i === 0) bx = far + (hit - far) * easeIn3(ph.p);
      else if (tau < 0.6) {
        const u = tau / 0.6;
        bx = hit + from * easeOut3(u) * m * 0.28;
        alpha = 1 - u;
      } else alpha = 0;
      const by = cy + (ph.i === 0 ? 0 : -Math.sin(Math.min(1, tau / 0.6) * Math.PI) * m * 0.06);
      // impact star (static in world space, at the contact point)
      if (marks && tau >= 0 && tau < 0.5) {
        const u = tau / 0.5;
        const R = m * 0.16 * (0.6 + 0.6 * easeOut3(u / 0.3)) * (1 - easeIn3(u));
        g.save();
        g.translate(edgeX + from * m * 0.01, cy);
        g.beginPath();
        burstPts.forEach((r, i) => {
          const a = (i / burstPts.length) * TAU;
          const x = Math.cos(a) * R * r;
          const y = Math.sin(a) * R * r;
          if (i) g.lineTo(x, y);
          else g.moveTo(x, y);
        });
        g.closePath();
        g.fillStyle = ctx.s.accent;
        g.fill();
        g.lineWidth = lw * 0.6;
        g.strokeStyle = ctx.s.secondary;
        g.stroke();
        // radial marks
        g.lineCap = 'round';
        g.lineWidth = lw * 0.7 * (1 - u);
        g.beginPath();
        for (let i = 0; i < 7; i++) {
          const a = (from > 0 ? 0 : Math.PI) + (i - 3) * 0.32;
          const r0 = R * 1.05 + u * m * 0.06;
          g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
          g.lineTo(Math.cos(a) * (r0 + m * 0.05), Math.sin(a) * (r0 + m * 0.05));
        }
        g.stroke();
        g.restore();
      }
      // main shape: only it receives the spring transform
      g.save();
      g.translate(cx + dx, cy);
      g.rotate(rot);
      g.scale(1 - sq, 1 + sq * 0.6);
      g.save();
      g.translate(m * 0.022, m * 0.026);
      shapePath(g);
      g.fillStyle = ctx.s.secondary;
      g.fill();
      g.restore();
      shapePath(g);
      g.fillStyle = ctx.s.primary;
      g.fill();
      g.lineWidth = lw;
      g.lineJoin = 'round';
      g.strokeStyle = ctx.s.secondary;
      g.stroke();
      inkText(g, layout, ctx.s.accent, ctx.s.secondary, layout.fontSize * 0.12);
      g.restore();
      // ball on top with speed lines
      if (alpha > 0.01) {
        g.save();
        g.globalAlpha = alpha;
        if (ph.i === 0) {
          const v = easeIn3(ph.p);
          g.strokeStyle = ctx.s.secondary;
          g.lineCap = 'round';
          g.lineWidth = lw * 0.6;
          g.beginPath();
          for (let i = -1; i <= 1; i++) {
            const len = m * (0.1 + 0.18 * v) * (1 - Math.abs(i) * 0.3);
            g.moveTo(bx + from * ballR * 1.3, by + i * ballR * 0.55);
            g.lineTo(bx + from * (ballR * 1.3 + len), by + i * ballR * 0.55);
          }
          g.stroke();
        }
        g.beginPath();
        g.arc(bx, by, ballR, 0, TAU);
        g.fillStyle = ctx.s.secondary;
        g.fill();
        g.beginPath();
        g.arc(bx - ballR * 0.35, by - ballR * 0.35, ballR * 0.25, 0, TAU);
        g.fillStyle = ctx.s.accent;
        g.fill();
        g.restore();
      }
    });
  },
});
