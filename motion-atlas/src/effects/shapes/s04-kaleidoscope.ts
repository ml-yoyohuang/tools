import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, minSide, num, rgba, TAU } from '../../engine/helpers';
import { shapePath, type Kind } from './_util';

const CYCLE = 16;
const KINDS: Kind[] = ['triangle', 'circle', 'square', 'diamond', 'star', 'pill', 'hexagon'];

interface Src {
  kind: Kind;
  r: number;
  col: string;
  /** integer frequencies (cycles per CYCLE) keep the loop seamless */
  fr: number;
  fa: number;
  fs: number;
  pr: number;
  pa: number;
  r0: number;
  r1: number;
}

export default defineEffect({
  id: 'kaleidoscope',
  code: 'S04',
  nameZh: '幾何萬花筒',
  nameEn: 'Kaleidoscope',
  category: 'shapes',
  sourceType: 'reference',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '一組在扇形內漂移的幾何圖形經多軸鏡射複製，圖形跨過鏡線時與自己的倒影接合、分開。',
  tags: ['萬花筒', 'kaleidoscope', '鏡射', '對稱', '幾何'],
  suitable: ['音樂視覺', '品牌背景', '節慶動態'],
  principle:
    'Canvas 2D：只描述一個扇形（角度 2π/N）內的來源圖形，圖形以極座標在扇形內外漂移。繪製時以 N 個扇形裁切 (clip)，偶數扇形旋轉 i·θ，奇數扇形先 scale(1,−1) 鏡射再旋轉 (i+1)·θ，因此相鄰扇形互為鏡像；圖形跨越扇形邊界時在鏡線上與自身倒影融合，這是多軸鏡射而非單純一圈旋轉的圖形。所有頻率皆為 1/16 Hz 的整數倍，16 秒無縫循環。',
  defaultText: '',
  palette: 'POP',
  controls: ['intensity', 'scale', 'direction', 'secondary', 'accent', 'seed'],
  directions: ['cw', 'ccw'],
  params: [
    { key: 'mirrors', label: '鏡射軸數', type: 'range', min: 3, max: 8, step: 1, default: 4, hint: '扇形數 = 軸數 × 2' },
    { key: 'count', label: '來源圖形數', type: 'range', min: 3, max: 10, step: 1, default: 6 },
    { key: 'frame', label: '圓形視窗', type: 'toggle', default: true },
    { key: 'axes', label: '顯示鏡射軸', type: 'toggle', default: false },
  ],
  recipe: {
    enter: '圖樣已完整呈現。',
    motion: '來源圖形在扇形內沿徑向與角向做慢速正弦漂移並自轉，整體圖樣同時緩慢旋轉；跨過鏡線時與倒影接合成新圖形。',
    hold: '連續變化，無停頓。',
    exit: '無離場。',
    loop: '16 秒無縫循環。',
  },
  accept: [
    '畫面任一時刻都對每條鏡射軸左右對稱。',
    '圖形接近扇形邊界時與鏡像接合成對稱的新形狀，而不是各自獨立旋轉。',
    '改變鏡射軸數後花瓣數量改變。',
    '強度為 0 時圖樣只整體旋轉、不再變形。',
  ],
  transparent: true,
  cycle: CYCLE,
  posterTime: 2.2,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const pairs = Math.round(num(ctx, 'mirrors', 4));
    const segs = pairs * 2;
    const wa = TAU / segs;
    const count = Math.round(num(ctx, 'count', 6));
    const frame = bool(ctx, 'frame', true);
    const axes = bool(ctx, 'axes', false);
    const inten = ctx.s.intensity;
    const cx = w / 2;
    const cy = h / 2;
    const R = frame ? m * 0.46 * Math.min(1.08, ctx.s.scale) : Math.hypot(w, h) / 2 + 2;
    const Rs = m * 0.46 * ctx.s.scale; // shape field radius (independent of the frame)
    const cols = [ctx.s.primary, ctx.s.secondary, ctx.s.accent];
    const src: Src[] = [];
    for (let i = 0; i < count; i++) {
      src.push({
        kind: KINDS[i % KINDS.length],
        r: Rs * (0.07 + ctx.rand() * 0.09),
        col: cols[i % 3 === 2 && i > 3 ? 2 : i % 2],
        fr: 1 + Math.floor(ctx.rand() * 3),
        fa: 1 + Math.floor(ctx.rand() * 3),
        fs: (ctx.rand() < 0.5 ? -1 : 1) * (1 + Math.floor(ctx.rand() * 2)),
        pr: ctx.rand() * TAU,
        pa: ctx.rand() * TAU,
        r0: 0.12 + ctx.rand() * 0.5,
        r1: 0.25 + ctx.rand() * 0.35,
      });
    }
    return canvasRuntime(ctx, (g, t) => {
      const u = (TAU * t) / CYCLE;
      const rot = ctx.dirSign * u;
      // pre-compute source shapes in wedge-local coordinates
      const pos = src.map((s) => {
        const rr = Rs * (s.r0 + s.r1 * 0.5 * (1 + Math.sin(s.fr * u + s.pr)) * Math.min(1, inten));
        // angle swings beyond the wedge edges (0 and wa) so the shape meets its own reflection
        const aa = wa * (0.5 + 0.85 * Math.sin(s.fa * u + s.pa) * Math.min(1.2, inten));
        return { x: rr * Math.cos(aa), y: rr * Math.sin(aa), a: s.fs * u * Math.min(1.5, 0.3 + inten) };
      });
      g.save();
      g.translate(cx, cy);
      if (frame) {
        g.beginPath();
        g.arc(0, 0, R, 0, TAU);
        g.clip();
      }
      for (let i = 0; i < segs; i++) {
        g.save();
        if (i % 2 === 0) g.rotate(rot + i * wa);
        else {
          g.rotate(rot + (i + 1) * wa);
          g.scale(1, -1);
        }
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, R * 1.02, -0.004, wa + 0.004);
        g.closePath();
        g.clip();
        for (let k = 0; k < src.length; k++) {
          const s = src[k];
          const p = pos[k];
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.a);
          g.beginPath();
          shapePath(g, s.kind, s.r);
          g.fillStyle = s.col;
          g.fill();
          g.restore();
        }
        g.restore();
      }
      if (axes) {
        g.strokeStyle = rgba(ctx.s.accent, 0.35);
        g.lineWidth = Math.max(1, m * 0.002);
        g.beginPath();
        // each diameter covers boundaries j and j + pairs (π = pairs · wa)
        for (let j = 0; j < pairs; j++) {
          const a = rot + j * wa;
          g.moveTo(-Math.cos(a) * R, -Math.sin(a) * R);
          g.lineTo(Math.cos(a) * R, Math.sin(a) * R);
        }
        g.stroke();
      }
      g.restore();
      if (frame) {
        g.strokeStyle = ctx.s.accent;
        g.lineWidth = Math.max(1.5, m * 0.006);
        g.beginPath();
        g.arc(cx, cy, R, 0, TAU);
        g.stroke();
      }
    });
  },
});
