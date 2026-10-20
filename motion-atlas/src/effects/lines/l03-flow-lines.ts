import { defineEffect } from '../../engine/define';
import { canvasRuntime, minSide, num, rgba } from '../../engine/helpers';
import { hash2, noise2 } from '../../engine/random';

export default defineEffect({
  id: 'flow-lines',
  code: 'L03',
  nameZh: '流動線',
  nameEn: 'Flow Lines',
  category: 'lines',
  sourceType: 'reference',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '大量短曲線沿著連續的雜訊向量場漂流，像風或水流的流線，曲線出生、流動、淡出不斷輪替。',
  tags: ['向量場', 'flow field', '流線', '雜訊', '生成藝術'],
  suitable: ['生成藝術背景', '品牌主視覺', '天氣／流體主題'],
  principle:
    'Canvas 2D：向量場角度 θ(x,y,t) = 主方向 + 曲率 × π × noise2(x·f, y·f + 0.04t)（src/engine/random.ts 的平滑值雜訊）。每條線有固定壽命 L 與 seeded 出生點，畫面時間 t 時從出生點以 Δ=1/20 s 的步長積分 p += v·(cosθ, sinθ)·Δ 到目前年齡，最後一段軌跡就是短曲線；透明度 = sin(π·年齡/L)。全部由 t 計算，可 seek。',
  defaultText: '',
  palette: 'PASTEL',
  controls: ['scale', 'secondary', 'direction', 'seed'],
  directions: ['right', 'left', 'up', 'down'],
  params: [
    { key: 'density', label: '密度', type: 'range', min: 10, max: 100, step: 5, default: 55, unit: '%' },
    { key: 'speed', label: '速度', type: 'range', min: 10, max: 200, step: 5, default: 70, unit: 'px/s' },
    { key: 'curve', label: '場曲率', type: 'range', min: 0, max: 2, step: 0.05, default: 0.8 },
    { key: 'length', label: '線段長度', type: 'range', min: 0.2, max: 1.6, step: 0.05, default: 0.6, unit: 's' },
    { key: 'lineWidth', label: '線寬', type: 'range', min: 0.5, max: 4, step: 0.25, default: 1.75, unit: 'px' },
  ],
  recipe: {
    enter: '一開始畫面即有流線，各線出生時間錯開。',
    motion: '每條線沿向量場前進，彎曲程度由場曲率決定；向量場本身極慢地漂移。',
    hold: '連續流動，無停頓。',
    exit: '每條線在壽命結束前淡出。',
    loop: '線條依壽命不斷在新的 seeded 位置重生，畫面密度維持穩定。',
  },
  accept: [
    '相鄰曲線彎曲方向一致，看得出同一個連續場（不是各自亂飄）。',
    '場曲率為 0 時全部平行直線，調高後出現漩渦與 S 形彎曲。',
    '密度控制線條數量，速度控制流動快慢。',
    '同一 seed 重新整理後流場相同。',
  ],
  transparent: true,
  cycle: 12,
  posterTime: 2,
  create(ctx) {
    const density = num(ctx, 'density', 55) / 100;
    const speed = num(ctx, 'speed', 70);
    const curve = num(ctx, 'curve', 0.8);
    const trailT = num(ctx, 'length', 0.6);
    const lw = num(ctx, 'lineWidth', 1.75);
    const W = ctx.width;
    const H = ctx.height;
    const m = minSide(ctx);
    const seed = ctx.seed;
    const freq = 1.6 / (m * 0.5 * ctx.s.scale);
    const baseA = { right: 0, left: Math.PI, down: Math.PI / 2, up: -Math.PI / 2 }[ctx.dir as 'right'] ?? 0;
    const count = Math.min(900, Math.round(((W * H) / 900) * density * ctx.q * 0.9));
    const DT = 1 / 20;
    const life = Math.max(2.2, trailT + 1.6);
    const trailSteps = Math.max(2, Math.round(trailT / DT));
    const parts = Array.from({ length: count }, (_, i) => ({ off: ctx.rand() * life, col: i % 3 === 0 ? 1 : 0, id: i }));
    // margin upstream so lines can flow in from the edge
    const mg = Math.max(W, H) * 0.08;
    const field = (x: number, y: number, t: number) => baseA + curve * Math.PI * noise2(x * freq, y * freq + t * 0.04, seed);
    const BUCKETS = 4;
    const xs = new Float32Array(trailSteps + 1);
    const ys = new Float32Array(trailSteps + 1);

    return canvasRuntime(ctx, (g, t) => {
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.lineWidth = lw;
      // two colours × alpha buckets → few stroke calls
      const paths: Path2D[][] = [Array.from({ length: BUCKETS }, () => new Path2D()), Array.from({ length: BUCKETS }, () => new Path2D())];
      for (const p of parts) {
        const tt = t + p.off;
        const gen = Math.floor(tt / life);
        const age = tt - gen * life;
        const birthT = t - age;
        let x = -mg + hash2(p.id, gen, seed) * (W + mg * 2);
        let y = -mg + hash2(p.id, gen + 7919, seed) * (H + mg * 2);
        const steps = Math.floor(age / DT);
        const first = steps - trailSteps;
        let k = 0;
        for (let s = 0; s <= steps; s++) {
          if (s >= first) {
            xs[k] = x;
            ys[k] = y;
            k++;
          }
          if (s === steps) break;
          const a = field(x, y, birthT + s * DT);
          x += Math.cos(a) * speed * DT;
          y += Math.sin(a) * speed * DT;
        }
        if (k < 2) continue;
        const alpha = Math.sin((Math.PI * age) / life);
        const b = Math.min(BUCKETS - 1, Math.floor(alpha * BUCKETS));
        const path = paths[p.col][b];
        path.moveTo(xs[0], ys[0]);
        for (let j = 1; j < k; j++) path.lineTo(xs[j], ys[j]);
      }
      for (let c = 0; c < 2; c++) {
        for (let b = 0; b < BUCKETS; b++) {
          g.strokeStyle = rgba(c ? ctx.s.secondary : ctx.s.primary, ((b + 0.75) / BUCKETS) * 0.95);
          g.stroke(paths[c][b]);
        }
      }
    });
  },
});
