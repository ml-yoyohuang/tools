import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, minSide, mod, num, rgba, str, TAU } from '../../engine/helpers';
import { easeQuartInOut, easeSineInOut, hair } from './_util';

interface FoldShape {
  /** relative segment lengths */
  segs: number[];
  /** turn at each joint (rad, negative = turn up / left in screen space) */
  turns: number[];
  /** whole-chain rotation when fully folded */
  rot: number;
}

const D = Math.PI / 180;
const SHAPES: Record<string, FoldShape> = {
  angle: { segs: [1, 1], turns: [-90 * D], rot: 45 * D },
  frame: { segs: [1, 1, 1, 1], turns: [-90 * D, -90 * D, -90 * D], rot: 0 },
  triangle: { segs: [1, 1, 1], turns: [-120 * D, -120 * D], rot: 0 },
  bracket: { segs: [1, 2, 1], turns: [-90 * D, -90 * D], rot: 90 * D },
};
const SEQUENCES: Record<string, string[]> = {
  all: ['angle', 'frame', 'triangle'],
  angle: ['angle', 'bracket'],
  frame: ['frame', 'triangle'],
};

export default defineEffect({
  id: 'line-fold',
  code: 'M08',
  nameZh: '細線折疊',
  nameEn: 'Line Fold',
  category: 'minimal',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '一條水平細線在幾個折點彎折，依序變成角形、方框、三角形，每次停留後再攤平回一條線。',
  tags: ['極簡', '折線', '摺疊', '框線', 'fold'],
  suitable: ['Logo／圖示開場', '章節轉場', '設計系統說明'],
  principle:
    'Canvas 2D：線段鏈（forward kinematics）。總長 L 固定，依形狀切成 n 段；每個折點的轉角 = 目標角 × 該折點進度，折點之間錯開 0.12 讓摺疊有先後。點位由第一段起依序累加方向角求得，再以「線段質心」對齊舞台中心並旋轉到形狀的正位。攤平時所有轉角回到 0，換下一個形狀時重新切段（攤平狀態下看不出差別）。摺疊用 quart.inOut、攤平用 sine.inOut。',
  defaultText: '',
  palette: 'COOL',
  colors: { background: '#FFFFFF', primary: '#3450FF', secondary: '#8A8A8A', accent: '#141414' },
  controls: ['scale', 'accent'],
  params: [
    {
      key: 'shapes',
      label: '折出形狀',
      type: 'select',
      options: [
        { value: 'all', label: '角形→方框→三角' },
        { value: 'angle', label: '角形→ㄈ形' },
        { value: 'frame', label: '方框→三角' },
      ],
      default: 'all',
    },
    { key: 'fold', label: '摺疊時間', type: 'range', min: 0.6, max: 3, step: 0.1, default: 1.3, unit: 's' },
    { key: 'hold', label: '停留時間', type: 'range', min: 0.2, max: 3, step: 0.1, default: 1, unit: 's' },
    { key: 'line', label: '線寬', type: 'range', min: 0.002, max: 0.02, step: 0.001, default: 0.007 },
    { key: 'joints', label: '顯示折點', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '一條水平細線在畫面中央。',
    motion: '折點依序以 quart.inOut 彎折，線收成角形或框形並轉到正位。',
    hold: '折好的形狀停留約 1 秒，折點小點可見。',
    exit: '以 sine.inOut 攤平回直線，停 0.6 秒。',
    loop: '依序換下一個形狀，三個形狀循環。',
  },
  accept: [
    '線條總長不變，只在折點彎折。',
    '方框與三角形折好時首尾相接、封閉。',
    '每個形狀之後都會攤平回一條直線。',
    '「折出形狀」切換後出現不同形狀序列。',
  ],
  transparent: true,
  cycle: 12,
  posterTime: 2.4,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const seq = (SEQUENCES[str(ctx, 'shapes', 'all')] ?? SEQUENCES.all).map((k) => SHAPES[k]);
    const foldT = num(ctx, 'fold', 1.3);
    const hold = num(ctx, 'hold', 1);
    const showJ = bool(ctx, 'joints', true);
    const lw = hair(m, num(ctx, 'line', 0.007) * ctx.s.scale, 1.2);
    const L = Math.min(w * 0.76 * ctx.s.scale, w * 0.92, h * 1.5);
    const flatT = foldT * 0.85;
    const pre = 0.6;
    const per = pre + foldT + hold + flatT;
    const total = per * seq.length;
    const cx = w / 2;
    const cy = h / 2;
    const stag = 0.12;
    return canvasRuntime(ctx, (g, t) => {
      const u = mod(t, total);
      const k = Math.floor(u / per);
      const sh = seq[k];
      const v = u - k * per;
      // global fold amount 0..1
      let f = 0;
      let folding = true;
      if (v < pre) f = 0;
      else if (v < pre + foldT) f = (v - pre) / foldT;
      else if (v < pre + foldT + hold) f = 1;
      else {
        f = 1 - (v - pre - foldT - hold) / flatT;
        folding = false;
      }
      const nj = sh.turns.length;
      const span = 1 - stag * (nj - 1);
      const ease = folding ? easeQuartInOut : easeSineInOut;
      const jp = sh.turns.map((_, j) => {
        // unfold in reverse joint order so the line "unrolls"
        const jj = folding ? j : nj - 1 - j;
        return ease(clamp((f - jj * stag) / span, 0, 1));
      });
      const segSum = sh.segs.reduce((a, b) => a + b, 0);
      const avg = jp.reduce((a, b) => a + b, 0) / Math.max(1, nj);
      let ang = sh.rot * avg;
      let x = 0;
      let y = 0;
      const pts: [number, number][] = [[0, 0]];
      let mx = 0;
      let my = 0;
      for (let i = 0; i < sh.segs.length; i++) {
        if (i > 0) ang += sh.turns[i - 1] * jp[i - 1];
        const len = (sh.segs[i] / segSum) * L;
        const nx = x + Math.cos(ang) * len;
        const ny = y + Math.sin(ang) * len;
        mx += ((x + nx) / 2) * len;
        my += ((y + ny) / 2) * len;
        x = nx;
        y = ny;
        pts.push([x, y]);
      }
      mx /= L;
      my /= L;
      g.translate(cx - mx, cy - my);
      g.strokeStyle = ctx.s.primary;
      g.lineWidth = lw;
      g.lineCap = 'round';
      g.lineJoin = 'miter';
      g.miterLimit = 4;
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
      g.stroke();
      if (showJ) {
        const r = Math.max(2.2, lw * 1.4);
        for (let j = 0; j < nj; j++) {
          // fold points: faint marks on the flat line, solid while folded
          const a = 0.25 + 0.75 * jp[j];
          g.fillStyle = rgba(ctx.s.accent, a);
          g.beginPath();
          g.arc(pts[j + 1][0], pts[j + 1][1], r, 0, TAU);
          g.fill();
        }
      }
    });
  },
});
