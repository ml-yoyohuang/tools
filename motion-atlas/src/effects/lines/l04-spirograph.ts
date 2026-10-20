import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, easeInOut, minSide, num, phase, rgba, TAU } from '../../engine/helpers';

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

export default defineEffect({
  id: 'spirograph',
  code: 'L04',
  nameZh: '萬花尺',
  nameEn: 'Spirograph',
  category: 'lines',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '小齒輪在大圓內滾動，筆尖依旋輪線公式逐步畫出圖樣，完成後換相位重畫。',
  tags: ['旋輪線', 'hypotrochoid', '描繪', '幾何', '線條'],
  suitable: ['載入畫面', '數學／教育內容', '裝飾背景'],
  principle:
    'Canvas 2D：hypotrochoid x = (R−r)cos θ + d·cos((R−r)θ/r)，y = (R−r)sin θ − d·sin((R−r)θ/r)。θ 的終點 = 2π·r/gcd(R,r) 讓曲線剛好閉合；每幀依進度畫到目前 θ，並畫出滾動中的小齒輪與筆尖。',
  defaultText: '',
  palette: 'COOL',
  controls: ['scale', 'secondary', 'accent', 'direction'],
  directions: ['ccw', 'cw'],
  params: [
    { key: 'r', label: '小齒輪齒數', type: 'range', min: 17, max: 83, step: 1, default: 35 },
    { key: 'd', label: '筆尖偏移', type: 'range', min: 0.2, max: 1.2, step: 0.05, default: 0.8 },
    { key: 'lineWidth', label: '線寬', type: 'range', min: 0.5, max: 4, step: 0.25, default: 1.5, unit: 'px' },
    { key: 'draw', label: '描繪時間', type: 'range', min: 2, max: 12, step: 0.5, default: 6, unit: 's' },
    { key: 'gears', label: '顯示齒輪', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '空白畫面中出現外圓與小齒輪。',
    motion: '小齒輪沿外圓內側滾動，筆尖留下連續曲線，速度以 ease-in-out 起停。',
    hold: '圖樣閉合後停留約 1 秒。',
    exit: '線條淡出，筆尖偏移量（相位）改變。',
    loop: '以新的相位重畫，三種相位輪替。',
  },
  accept: [
    '可看見小齒輪在大圓內滾動，筆尖與線條末端重合。',
    '完成時曲線首尾閉合。',
    '改變齒數後花瓣數量改變（R=96 固定）。',
    '關閉「顯示齒輪」只留曲線。',
  ],
  transparent: true,
  cycle: 8,
  posterTime: 4,
  create(ctx) {
    const R0 = 96;
    const rT = Math.round(num(ctx, 'r', 35));
    const dRatio = num(ctx, 'd', 0.8);
    const lw = num(ctx, 'lineWidth', 1.5);
    const drawT = num(ctx, 'draw', 6);
    const gears = bool(ctx, 'gears', true);
    const thetaEnd = (TAU * rT) / gcd(R0, rT);
    const size = minSide(ctx) * 0.42 * ctx.s.scale;
    const k = size / R0;
    const R = R0 * k;
    const r = rT * k;
    const cx = ctx.width / 2;
    const cy = ctx.height / 2;
    const steps = Math.min(4000, Math.ceil(thetaEnd * 40));
    const dir = ctx.dirSign;
    const pt = (th: number, d: number) => {
      const a = th * dir;
      return [cx + (R - r) * Math.cos(a) + d * Math.cos(((R - r) / r) * a), cy + (R - r) * Math.sin(a) - d * Math.sin(((R - r) / r) * a)] as const;
    };
    return canvasRuntime(ctx, (g, t) => {
      const ph = phase(t, [drawT, 1.2, 0.8]);
      const round = Math.floor(t / ph.total);
      const d = r * dRatio * [1, 0.72, 1.18][((round % 3) + 3) % 3];
      const prog = ph.i === 0 ? easeInOut(ph.p) : 1;
      const alpha = ph.i === 2 ? 1 - ph.p : 1;
      const thNow = thetaEnd * prog;
      g.lineWidth = lw;
      g.lineJoin = 'round';
      g.strokeStyle = rgba(ctx.s.primary, alpha);
      g.beginPath();
      const n = Math.max(2, Math.ceil(steps * prog));
      for (let i = 0; i <= n; i++) {
        const [x, y] = pt((thNow * i) / n, d);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
      if (gears && ph.i !== 2) {
        g.lineWidth = 1;
        g.strokeStyle = rgba(ctx.s.accent, 0.55);
        g.beginPath();
        g.arc(cx, cy, R, 0, TAU);
        g.stroke();
        const a = thNow * dir;
        const gx = cx + (R - r) * Math.cos(a);
        const gy = cy + (R - r) * Math.sin(a);
        g.beginPath();
        g.arc(gx, gy, r, 0, TAU);
        g.stroke();
        const [px, py] = pt(thNow, d);
        g.beginPath();
        g.moveTo(gx, gy);
        g.lineTo(px, py);
        g.stroke();
        g.fillStyle = ctx.s.secondary;
        g.beginPath();
        g.arc(px, py, clamp(lw * 2.5, 3, 8), 0, TAU);
        g.fill();
      }
    });
  },
});
