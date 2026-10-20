import { defineEffect } from '../../engine/define';
import { C } from '../../engine/palette';
import { canvasRuntime, clamp, easeInOut, minSide, num, phase } from '../../engine/helpers';
import { noise1 } from '../../engine/random';
import { capSpacing, DotBatch, dotGrid } from './_util';

export default defineEffect({
  id: 'halftone-sweep',
  code: 'H01',
  nameZh: '半色調掃掠',
  nameEn: 'Halftone Sweep',
  category: 'halftone',
  sourceType: 'partial-reference',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '一道掃描帶橫越規則點陣，帶內的網點依距離脹大成實色，帶過之後留下逐漸縮回的餘暉。',
  tags: ['半色調', '掃描', 'sweep', '點陣', 'scan'],
  suitable: ['載入／處理中畫面', '章節轉場', '科技感背景'],
  principle:
    'Canvas 2D：固定網格上每點投影到掃描方向 s，與掃描帶位置 b(t)（ease-in-out 往返一次）的距離 d = s − b。帶前方半徑 = base + (max − base)·exp(−(d/w)²)；帶後方取 max(高斯, trail·exp(d/3w)) 形成餘暉；帶核心（影響 > 0.55）改用次色。帶邊緣以 1D 平滑雜訊輕微起伏，網點並沿掃描方向被推擠一點。',
  defaultText: '',
  palette: 'STREET',
  colors: { background: C.cream, primary: C.black, secondary: C.red },
  controls: ['direction', 'intensity', 'secondary'],
  directions: ['right', 'left', 'down', 'up'],
  params: [
    { key: 'spacing', label: '點距', type: 'range', min: 8, max: 36, step: 1, default: 16, unit: 'px' },
    { key: 'width', label: '影響寬度', type: 'range', min: 0.03, max: 0.4, step: 0.01, default: 0.11, hint: '相對舞台短邊' },
    { key: 'trail', label: '餘暉', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45 },
    { key: 'pass', label: '單次掃描時間', type: 'range', min: 1, max: 5, step: 0.1, default: 2.2, unit: 's' },
  ],
  recipe: {
    enter: '靜止的細小網點鋪滿畫面。',
    motion: '掃描帶以 ease-in-out 從一側掃到另一側，帶內網點脹大並轉為次色，帶前緣陡、後緣留下指數衰減的餘暉。',
    hold: '掃描帶離開畫面後停約 0.6 秒，網點全部回到最小。',
    exit: '餘暉縮回原始大小。',
    loop: '同方向重新掃描，無限循環。',
  },
  accept: [
    '可看見一條垂直於掃描方向的寬帶，帶內圓點最大且為次色。',
    '切換方向後掃描帶改從另一側進入。',
    '「影響寬度」變大時帶變寬、邊緣更柔和。',
    '「餘暉」為 0 時帶後方立刻恢復細點。',
  ],
  transparent: true,
  posterTime: 1.1,
  cycle: 2.8,
  create(ctx) {
    const spacing = capSpacing(ctx, num(ctx, 'spacing', 16) * (ctx.mode === 'card' ? 1.2 : 1), 5200 * ctx.q);
    const width = num(ctx, 'width', 0.11) * minSide(ctx);
    const trail = num(ctx, 'trail', 0.45);
    const pass = num(ctx, 'pass', 2.2);
    const grid = dotGrid(ctx.width, ctx.height, spacing);
    const horiz = ctx.dir === 'left' || ctx.dir === 'right';
    const L = horiz ? ctx.width : ctx.height;
    const sign = ctx.dirSign;
    const base = spacing * 0.12;
    const maxR = spacing * (0.42 + 0.14 * ctx.s.intensity);
    const push = spacing * 0.35 * ctx.s.intensity;
    const seed = ctx.seed;
    const core: number[] = [];
    const wobScale = minSide(ctx) * 0.18;
    return canvasRuntime(ctx, (g, t) => {
      const a = new DotBatch(g);
      const b = new DotBatch(g);
      const ph = phase(t, [pass, 0.6]);
      const p = ph.i === 0 ? easeInOut(ph.p) : 1;
      // band position along the travel axis, from fully before to fully after the stage
      const margin = width * 2;
      const bandPos = -margin + (L + margin * 2) * p;
      a.begin();
      core.length = 0;
      for (let k = 0; k < grid.n; k++) {
        const x = grid.x[k];
        const y = grid.y[k];
        const along = horiz ? (sign > 0 ? x : ctx.width - x) : sign > 0 ? y : ctx.height - y;
        const across = horiz ? y : x;
        const wob = noise1(across / wobScale + t * 0.6, seed) * width * 0.35;
        const d = along - (bandPos + wob);
        const gauss = Math.exp(-((d / width) ** 2));
        const f = d > 0 ? gauss : Math.max(gauss, trail * Math.exp(d / (width * 3)));
        const r = base + (maxR - base) * f;
        const shift = clamp(-d / width, -1.5, 1.5) * gauss * push * sign;
        const px = horiz ? x + shift : x;
        const py = horiz ? y : y + shift;
        if (f > 0.55) core.push(px, py, r);
        else a.dot(px, py, r);
      }
      a.fill(ctx.s.primary);
      b.begin();
      for (let i = 0; i < core.length; i += 3) b.dot(core[i], core[i + 1], core[i + 2]);
      b.fill(ctx.s.secondary);
    });
  },
});
