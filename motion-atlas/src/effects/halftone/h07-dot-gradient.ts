import { defineEffect } from '../../engine/define';
import { C } from '../../engine/palette';
import { canvasRuntime, minSide, num, str, TAU } from '../../engine/helpers';
import { capSpacing, DotBatch } from './_util';

export default defineEffect({
  id: 'dot-gradient',
  code: 'H07',
  nameZh: '點陣漸層',
  nameEn: 'Dot Gradient',
  category: 'halftone',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '單一墨色的 45° 網屏，只靠網點大小由小到大形成平滑漸層，漸層帶沿指定方向持續移動。',
  tags: ['漸層', '網屏', 'gradient', '半色調', '單色'],
  suitable: ['海報底紋', '印刷感背景', '標題後方的動態材質'],
  principle:
    'Canvas 2D：在旋轉 screen angle 的網格上取點（覆蓋舞台對角線再裁切），所有點同一顏色。調子 v = 0.5 + 0.5·cos(2π(f·s − t·speed))，s 為點在移動方向上的投影（線性）或到中心的距離（放射），f 為頻率；半徑 = spacing·(min + (max − min)·√v) —— 用 √ 讓面積（墨量）與調子成正比，因此漸層看起來均勻，而不是依靠顏色或模糊。',
  defaultText: '',
  palette: 'POP',
  colors: { background: C.yellow, primary: C.blue, secondary: C.pink },
  controls: ['direction', 'intensity'],
  directions: ['right', 'left', 'down', 'up'],
  params: [
    { key: 'freq', label: '頻率（漸層週期數）', type: 'range', min: 0.3, max: 4, step: 0.1, default: 1.2 },
    { key: 'min', label: '最小點', type: 'range', min: 0, max: 0.4, step: 0.01, default: 0.04, hint: '相對點距' },
    { key: 'max', label: '最大點', type: 'range', min: 0.3, max: 0.8, step: 0.01, default: 0.66, hint: '> 0.5 時相鄰點會融成實色' },
    { key: 'spacing', label: '網點間距', type: 'range', min: 6, max: 30, step: 1, default: 13, unit: 'px' },
    { key: 'angle', label: '網屏角度', type: 'range', min: 0, max: 90, step: 1, default: 45, unit: '°' },
    {
      key: 'shape',
      label: '漸層形狀',
      type: 'select',
      default: 'linear',
      options: [
        { value: 'linear', label: '線性' },
        { value: 'radial', label: '放射' },
      ],
    },
  ],
  recipe: {
    enter: '畫面一開始即為完整的網點漸層。',
    motion: '調子函數隨時間相位平移，漸層帶等速沿方向移動；點的位置固定，只有大小改變。',
    hold: '連續移動，無停頓。',
    exit: '無離場。',
    loop: '相位為週期函數，可無縫循環。',
  },
  accept: [
    '畫面只用一種墨色，濃淡完全由點的大小形成。',
    '點的位置不動，只有大小隨漸層移動而改變。',
    '「頻率」增加時畫面中出現更多深淺週期。',
    '「最小／最大點」改變漸層的明暗範圍；放射模式時漸層為同心擴散。',
  ],
  transparent: true,
  posterTime: 0.5,
  cycle: 5,
  create(ctx) {
    const freq = num(ctx, 'freq', 1.2);
    const lo = num(ctx, 'min', 0.04);
    const hi = Math.max(lo, num(ctx, 'max', 0.66));
    const spacing = capSpacing(ctx, num(ctx, 'spacing', 13) * (ctx.mode === 'card' ? 1.2 : 1), 5200 * ctx.q);
    const ang = (num(ctx, 'angle', 45) * Math.PI) / 180;
    const radial = str(ctx, 'shape', 'linear') === 'radial';
    const W = ctx.width;
    const H = ctx.height;
    const cx = W / 2;
    const cy = H / 2;
    // rotated screen grid covering the stage
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const half = Math.hypot(W, H) / 2 + spacing;
    const xs: number[] = [];
    const ys: number[] = [];
    const n = Math.ceil(half / spacing);
    for (let j = -n; j <= n; j++)
      for (let i = -n; i <= n; i++) {
        const u = i * spacing;
        const v = j * spacing;
        const x = cx + u * ca - v * sa;
        const y = cy + u * sa + v * ca;
        if (x < -spacing || y < -spacing || x > W + spacing || y > H + spacing) continue;
        xs.push(x);
        ys.push(y);
      }
    const N = xs.length;
    // projection coordinate (in "gradient periods") for each dot
    const s = new Float32Array(N);
    const horiz = ctx.dir === 'left' || ctx.dir === 'right';
    const ms = minSide(ctx);
    for (let k = 0; k < N; k++) {
      if (radial) s[k] = (Math.hypot(xs[k] - cx, ys[k] - cy) / ms) * freq;
      else s[k] = ((horiz ? xs[k] / W : ys[k] / H) * freq);
    }
    const speed = 0.3 * ctx.s.intensity * ctx.dirSign;
    return canvasRuntime(ctx, (g, t) => {
      const b = new DotBatch(g);
      b.begin();
      const shift = t * speed;
      for (let k = 0; k < N; k++) {
        const v = 0.5 + 0.5 * Math.cos(TAU * (s[k] - shift));
        b.dot(xs[k], ys[k], spacing * (lo + (hi - lo) * Math.sqrt(v)));
      }
      b.fill(ctx.s.primary);
    });
  },
});
