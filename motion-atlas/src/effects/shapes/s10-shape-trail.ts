import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, minSide, mix, num, str, TAU } from '../../engine/helpers';
import { shapePath, type Kind } from './_util';

const PERIOD = 6;

export default defineEffect({
  id: 'shape-trail',
  code: 'S10',
  nameZh: '軌跡留影',
  nameEn: 'Shape Trail',
  category: 'shapes',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '一個主圖形沿 8 字或繩結軌跡移動並轉向，身後留下時間延遲的副本，越舊越淡、越小。',
  tags: ['殘影', 'trail', 'echo', '軌跡', '時間延遲'],
  suitable: ['速度感標題背景', '運動品牌', '游標／指示動畫'],
  principle:
    'Canvas 2D 純時間函數：路徑為 Lissajous 曲線 p(u)。第 k 個副本畫在 p(t − k·延遲) 的位置與當時的切線角度，透明度 = 衰減^k、尺寸 = 衰減^(k/2)，顏色由主色漸變到次色。由最舊的副本往新的畫，主圖形最後以不透明實色畫上，因此殘影永遠在主體後方、不遮住主體。',
  defaultText: '',
  palette: 'POP',
  controls: ['scale', 'direction', 'secondary', 'accent'],
  directions: ['cw', 'ccw'],
  params: [
    { key: 'copies', label: '副本數', type: 'range', min: 2, max: 30, step: 1, default: 12 },
    { key: 'delay', label: '副本延遲', type: 'range', min: 0.02, max: 0.2, step: 0.01, default: 0.06, unit: 's' },
    { key: 'decay', label: '衰減', type: 'range', min: 0.6, max: 0.97, step: 0.01, default: 0.84 },
    {
      key: 'path',
      label: '路徑',
      type: 'select',
      default: 'eight',
      options: [
        { value: 'eight', label: '8 字形' },
        { value: 'knot', label: '繩結（3:2）' },
        { value: 'orbit', label: '橢圓' },
      ],
    },
    {
      key: 'shape',
      label: '主圖形',
      type: 'select',
      default: 'square',
      options: [
        { value: 'square', label: '方形' },
        { value: 'triangle', label: '三角形' },
        { value: 'star', label: '星形' },
        { value: 'pill', label: '膠囊' },
      ],
    },
    { key: 'outline', label: '副本只畫外框', type: 'toggle', default: false },
  ],
  recipe: {
    enter: '主圖形已在路徑上移動，殘影跟隨。',
    motion: '主圖形沿 Lissajous 路徑非等速移動並沿切線轉向；速度快處副本拉開、慢處副本疊在一起。',
    hold: '連續運動，無停頓。',
    exit: '無離場。',
    loop: '路徑週期 6 秒，無縫循環。',
  },
  accept: [
    '主圖形永遠在最上層、完整不透明，殘影只出現在它後方。',
    '副本數增加時殘影變長；衰減調低時殘影快速消失。',
    '副本延遲調大時副本之間的距離變大。',
    '切換路徑後主圖形改走不同軌跡。',
  ],
  transparent: true,
  cycle: PERIOD,
  posterTime: 1.1,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const copies = Math.max(2, Math.round(num(ctx, 'copies', 12) * (ctx.q < 0.6 ? 0.6 : 1)));
    const delay = num(ctx, 'delay', 0.06);
    const decay = num(ctx, 'decay', 0.84);
    const path = str(ctx, 'path', 'eight');
    const kind = str(ctx, 'shape', 'square') as Kind;
    const outline = bool(ctx, 'outline', false);
    const r = m * 0.075 * ctx.s.scale;
    const A = Math.min(w * 0.5 - r * 1.6, m * 0.62);
    const B = h * 0.5 - r * 1.6;
    const cx = w / 2;
    const cy = h / 2;
    const pos = (t: number): [number, number] => {
      const u = (ctx.dirSign * TAU * t) / PERIOD;
      if (path === 'knot') return [cx + A * Math.sin(2 * u), cy + B * Math.sin(3 * u)];
      if (path === 'orbit') return [cx + A * Math.cos(u), cy + B * 0.72 * Math.sin(u)];
      return [cx + A * Math.sin(u), cy + B * 0.8 * Math.sin(2 * u)];
    };
    const heading = (t: number) => {
      const a = pos(t - 0.01);
      const b = pos(t + 0.01);
      return Math.atan2(b[1] - a[1], b[0] - a[0]);
    };
    const lw = Math.max(1.5, m * 0.005);
    return canvasRuntime(ctx, (g, t) => {
      // oldest copy first → main shape last (always on top)
      for (let k = copies; k >= 0; k--) {
        const tk = t - k * delay;
        const [x, y] = pos(tk);
        const a = heading(tk);
        const alpha = k === 0 ? 1 : 0.8 * decay ** k;
        if (alpha < 0.015) continue;
        const sc = k === 0 ? 1 : decay ** (k * 0.5);
        g.save();
        g.translate(x, y);
        g.rotate(a);
        g.beginPath();
        shapePath(g, kind, r * sc);
        g.globalAlpha = alpha;
        if (k === 0) {
          g.fillStyle = ctx.s.primary;
          g.fill();
          g.lineWidth = lw;
          g.strokeStyle = ctx.s.accent;
          g.lineJoin = 'round';
          g.stroke();
        } else {
          const col = mix(ctx.s.primary, ctx.s.secondary, Math.min(1, k / Math.max(3, copies * 0.5)));
          if (outline) {
            g.lineWidth = lw;
            g.lineJoin = 'round';
            g.strokeStyle = col;
            g.stroke();
          } else {
            g.fillStyle = col;
            g.fill();
          }
        }
        g.restore();
      }
    });
  },
});
