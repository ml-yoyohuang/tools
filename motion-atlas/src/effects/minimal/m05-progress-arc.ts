import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, easeInOut, minSide, num, rgba, str, TAU } from '../../engine/helpers';
import { easeQuartInOut, hair } from './_util';

export default defineEffect({
  id: 'progress-arc',
  code: 'M05',
  nameZh: '進度弧',
  nameEn: 'Progress Arc',
  category: 'minimal',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '圓弧從起點平滑延長，接著尾端追上把起點交給前端，下一段從新的起點再延長，形成乾淨循環。',
  tags: ['極簡', '進度', '圓弧', '載入', 'progress'],
  suitable: ['載入指示', '上傳／處理中', '倒數畫面'],
  principle:
    'Canvas 2D：每一圈分兩段。延長段：前端角 = base + S·cubic.inOut(p)，尾端固定在 base；交接段：尾端以 quart.inOut 從 base 追到 base + S，前端停在原處。下一圈 base += S，所以新起點正是上一段的終點。S 取 90／180／270°，n·S 為 360° 的倍數時每 n 圈完全回到原位；弧長保留最小 4° 讓圓頭不消失。',
  defaultText: '',
  palette: 'POP',
  colors: { background: '#3450FF', primary: '#FFFFFF', secondary: '#0D1A4A', accent: '#FFFFFF' },
  controls: ['scale', 'direction', 'secondary'],
  directions: ['cw', 'ccw'],
  params: [
    {
      key: 'sweep',
      label: '每段角度',
      type: 'select',
      options: [
        { value: '90', label: '90°' },
        { value: '180', label: '180°' },
        { value: '270', label: '270°' },
      ],
      default: '270',
    },
    { key: 'grow', label: '延長時間', type: 'range', min: 0.5, max: 3, step: 0.1, default: 1.3, unit: 's' },
    { key: 'line', label: '線寬', type: 'range', min: 0.01, max: 0.06, step: 0.002, default: 0.028 },
    { key: 'track', label: '底軌', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '一個圓點（最小弧）在 12 點鐘位置。',
    motion: '前端以 cubic.inOut 延長 S 度；尾端再以 quart.inOut 追上，把起點交給前端。',
    hold: '延長與交接之間有極短的自然停頓（兩條 easing 的尾端）。',
    exit: '交接完成時又只剩一個圓點，位置前進了 S 度。',
    loop: 'n·S = 360° 的倍數時精確回到原位，無縫循環。',
  },
  accept: [
    '弧先延長、再從尾端收短，收短後的起點就是剛才的終點。',
    '弧的位置每圈前進固定角度，數圈後回到起點。',
    '方向 ccw 時逆時針前進。',
    '關閉底軌時只剩弧線。',
  ],
  transparent: true,
  cycle: 9.6,
  posterTime: 1.0,
  create(ctx) {
    const m = minSide(ctx);
    const S = (Number(str(ctx, 'sweep', '270')) || 270) * (Math.PI / 180);
    const grow = num(ctx, 'grow', 1.3);
    const shrink = grow * 0.85;
    const line = num(ctx, 'line', 0.028);
    const track = bool(ctx, 'track', true);
    const R = m * 0.3 * ctx.s.scale;
    const lw = hair(m, line * ctx.s.scale, 2);
    const cx = ctx.width / 2;
    const cy = ctx.height / 2;
    const lap = grow + shrink;
    const minArc = (4 * Math.PI) / 180;
    const dir = ctx.dirSign;
    return canvasRuntime(ctx, (g, t) => {
      const n = Math.floor(t / lap);
      const u = t - n * lap;
      const base = n * S;
      let head: number;
      let tail: number;
      if (u < grow) {
        tail = base;
        head = base + S * easeInOut(u / grow);
      } else {
        head = base + S;
        tail = base + S * easeQuartInOut((u - grow) / shrink);
      }
      if (head - tail < minArc) {
        const mid = (head + tail) / 2;
        head = mid + minArc / 2;
        tail = mid - minArc / 2;
      }
      const a0 = -Math.PI / 2 + dir * tail;
      const a1 = -Math.PI / 2 + dir * head;
      g.lineCap = 'round';
      if (track) {
        g.strokeStyle = rgba(ctx.s.secondary, 0.4);
        g.lineWidth = lw;
        g.beginPath();
        g.arc(cx, cy, R, 0, TAU);
        g.stroke();
      }
      g.strokeStyle = ctx.s.primary;
      g.lineWidth = lw;
      g.beginPath();
      g.arc(cx, cy, R, a0, a1, dir < 0);
      g.stroke();
    });
  },
});
