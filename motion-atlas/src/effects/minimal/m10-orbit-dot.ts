import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, lerp, minSide, num, rgba, TAU } from '../../engine/helpers';
import { easeSineInOut, hair } from './_util';

export default defineEffect({
  id: 'orbit-dot',
  code: 'M10',
  nameZh: '軌道點',
  nameEn: 'Orbit Dot',
  category: 'minimal',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '單一小點沿細圓環繞行，每圈在 12 點鐘附近放慢、在下半圈加速，幾乎沒有其他裝飾。',
  tags: ['極簡', '軌道', '圓點', '繞行', 'orbit'],
  suitable: ['載入指示', '時間／計時視覺', '品牌背景'],
  principle:
    'Canvas 2D：角度 θ(t) = 2π·(n + mix(p, sine.inOut(p), 節奏))，n 為圈數、p 為圈內進度；節奏 0 為等速，1 為每圈頭尾慢、中段快。選用的速度殘影是一段極淡的弧，長度 = 角速度 × 0.12 秒，所以只在快的時候看得到。12 點鐘的小刻度是唯一的參考點。',
  defaultText: '',
  palette: 'COOL',
  colors: { background: '#0D1A4A', primary: '#FFFFFF', secondary: '#A8D0FF', accent: '#A8D0FF' },
  controls: ['scale', 'direction', 'secondary'],
  directions: ['cw', 'ccw'],
  params: [
    { key: 'lap', label: '一圈時間', type: 'range', min: 1.5, max: 10, step: 0.5, default: 4, unit: 's' },
    { key: 'rhythm', label: '快慢節奏', type: 'range', min: 0, max: 1, step: 0.05, default: 0.7 },
    { key: 'dot', label: '點大小', type: 'range', min: 0.008, max: 0.05, step: 0.002, default: 0.02 },
    { key: 'trail', label: '速度殘影', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '點在 12 點鐘刻度上。',
    motion: '點沿圓環繞行，sine.inOut 與等速以「快慢節奏」混合，下半圈最快。',
    hold: '每圈經過 12 點鐘時自然放慢，近似短暫停留。',
    exit: '無離場。',
    loop: '每圈相同，無縫循環。',
  },
  accept: [
    '畫面只有一條細圓環、一個小點與 12 點鐘的小刻度。',
    '點在頂端附近較慢、在底部較快（節奏 > 0 時）。',
    '節奏調為 0 時等速繞行。',
    '方向 ccw 時逆時針。',
  ],
  transparent: true,
  cycle: 4,
  posterTime: 1.2,
  create(ctx) {
    const m = minSide(ctx);
    const lap = num(ctx, 'lap', 4);
    const rhythm = num(ctx, 'rhythm', 0.7);
    const dotR = Math.max(2.5, m * num(ctx, 'dot', 0.02) * ctx.s.scale);
    const trail = bool(ctx, 'trail', true);
    const R = m * 0.32 * ctx.s.scale;
    const cx = ctx.width / 2;
    const cy = ctx.height / 2;
    const lw = hair(m, 0.0025);
    const dir = ctx.dirSign;
    const turns = (t: number) => {
      const n = Math.floor(t / lap);
      const p = t / lap - n;
      return n + lerp(p, easeSineInOut(p), rhythm);
    };
    const angle = (tr: number) => -Math.PI / 2 + dir * tr * TAU;
    return canvasRuntime(ctx, (g, t) => {
      g.strokeStyle = rgba(ctx.s.secondary, 0.55);
      g.lineWidth = lw;
      g.beginPath();
      g.arc(cx, cy, R, 0, TAU);
      g.stroke();
      // the single reference tick at 12 o'clock
      g.beginPath();
      g.moveTo(cx, cy - R - dotR * 1.6);
      g.lineTo(cx, cy - R - dotR * 2.8);
      g.stroke();
      const tr = turns(t);
      if (trail) {
        const back = turns(Math.max(0, t - 0.12));
        if (tr - back > 0.005) {
          g.strokeStyle = rgba(ctx.s.primary, 0.22);
          g.lineWidth = dotR * 1.1;
          g.lineCap = 'round';
          g.beginPath();
          g.arc(cx, cy, R, angle(back), angle(tr), dir < 0);
          g.stroke();
        }
      }
      const a = angle(tr);
      g.fillStyle = ctx.s.primary;
      g.beginPath();
      g.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, dotR, 0, TAU);
      g.fill();
    });
  },
});
