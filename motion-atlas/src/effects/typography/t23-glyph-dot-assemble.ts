import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, easeIn3, easeOut3, minSide, mod, num, TAU } from '../../engine/helpers';
import { sampleLayout } from '../../engine/canvas';
import { hash2, noise2 } from '../../engine/random';
import { layoutText, phrases } from '../../engine/text';

// Targets come from the REAL glyph alpha mask: sampleLayout() rasterises each phrase
// once in create() and keeps the filled grid cells. Particle i has one target per
// phrase and one "cloud" position after each phrase (an outward burst from that
// phrase). Per phrase: gather (cloud_{k-1} → target_k, eased, delayed left→right)
// → hold (tiny noise shimmer) → scatter (target_k → cloud_k). Clouds are cyclic, so
// the last scatter is the first gather's start: a seamless loop.

export default defineEffect({
  id: 'glyph-dot-assemble',
  code: 'T23',
  nameZh: '字形點陣重組',
  nameEn: 'Glyph Dot Assemble',
  category: 'typography',
  sourceType: 'original',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '散落的粒子依實際字形的 alpha 遮罩聚集成字，停留閱讀後再炸開散去，接著組成下一個詞。',
  tags: ['粒子', '點陣', '聚集', '字形遮罩', 'particles'],
  suitable: ['品牌開場', '數位科技主視覺', '倒數與揭曉'],
  principle:
    'Canvas 2D：create 時以 sampleLayout 把每個詞畫到離屏畫布並一次讀取 alpha（只讀一次，不每幀 getImageData），在 step px 網格上取 alpha > 128 的點作為目標。粒子 i 在每個詞有目標 Tk[i]（點數不足時循環取用並加微小偏移）與散開位置 Ck[i]（自字中心向外爆開）。聚集：p = easeOut3((t − di)/0.65G)，di 依目標 x 由左到右遞增；位置 = lerp(Ck−1, Tk, p) + 垂直方向的 sin(πp) 旋流偏移；停留時加上 noise2 微擾；散開時以 easeOut3 由 Tk 飛到 Ck。',
  defaultText: 'DOTS／點陣',
  palette: 'POP',
  colors: { background: '#141414', primary: '#FFE35A', secondary: '#3450FF', accent: '#ED589A' },
  controls: ['text', 'font', 'weight', 'intensity', 'scale', 'accent', 'seed'],
  maxChars: 30,
  textHint: '用「／」分隔多個詞，粒子會輪流組成每個詞。',
  params: [
    { key: 'density', label: '粒子密度', type: 'range', min: 0.2, max: 1, step: 0.05, default: 0.6 },
    { key: 'gather', label: '聚集速度', type: 'range', min: 0.4, max: 2.5, step: 0.1, default: 1 },
    { key: 'drift', label: '漂移量', type: 'range', min: 0, max: 2, step: 0.1, default: 1 },
    { key: 'hold', label: '停留時間', type: 'range', min: 0.6, max: 4, step: 0.1, default: 1.8, unit: 's' },
  ],
  recipe: {
    enter: '粒子由散開狀態以 easeOut3 聚集，左側先到、右側後到，路徑帶輕微旋流。',
    motion: '聚集完成後形成清楚的字形點陣，點在原位以雜訊微微顫動（漂移量控制）。',
    hold: '字形停留（預設 1.8s），可完整閱讀。',
    exit: '粒子由字中心向外爆開（easeOut3）並持續漂移，成為下一個詞的起點。',
    loop: '多個詞輪流組成；最後一個詞散開的位置就是第一個詞的起點，無縫循環。',
  },
  accept: [
    '停留時點陣的外形與實際字形一致（中文筆畫可辨識）。',
    '調高粒子密度後點變多變小，字形更細緻。',
    '聚集速度提高後成形更快；漂移量 0 時停留中的點完全靜止。',
    '多個詞時，粒子散開後組成下一個詞。',
  ],
  transparent: true,
  cycle: 9,
  posterTime: 2.4,
  create(ctx) {
    const { width: W, height: H } = ctx;
    const m = minSide(ctx);
    const k = clamp(ctx.s.intensity, 0, 2);
    const density = num(ctx, 'density', 0.6);
    const G = 1.8 / num(ctx, 'gather', 1);
    const HOLD = num(ctx, 'hold', 1.8);
    const S = 1.2;
    const drift = num(ctx, 'drift', 1);
    const words = phrases(ctx.text);
    const maxPts = Math.round(4200 * ctx.q);
    const sets = words.map((w) => {
      const L = layoutText(ctx, w, { maxWidth: W * 0.86, maxHeight: H * 0.6, lineHeight: 1.15 });
      const step = Math.max(2.5, L.fontSize / (6 + 22 * density));
      let pts = sampleLayout(ctx, L, step, maxPts);
      if (!pts.length) pts = [{ x: W / 2, y: H / 2, gi: 0 }];
      return { pts, step, cx: L.x + L.width / 2, cy: L.y + L.height / 2 };
    });
    const N = Math.max(...sets.map((s) => s.pts.length));
    const K = sets.length;
    const step = Math.min(...sets.map((s) => s.step));
    const dot = Math.max(0.9, step * 0.4);
    // targets per phrase
    const T = sets.map((s) => {
      const tx = new Float32Array(N);
      const ty = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const p = s.pts[i % s.pts.length];
        const dup = i >= s.pts.length;
        tx[i] = p.x + (dup ? (hash2(i, 1, ctx.seed) - 0.5) * s.step * 0.5 : 0);
        ty[i] = p.y + (dup ? (hash2(i, 2, ctx.seed) - 0.5) * s.step * 0.5 : 0);
      }
      return { tx, ty };
    });
    // clouds after each phrase: outward burst from the phrase centre
    const C = sets.map((s, k2) => {
      const cxs = new Float32Array(N);
      const cys = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const a = Math.atan2(T[k2].ty[i] - s.cy, T[k2].tx[i] - s.cx) + (ctx.rand() - 0.5) * 1.4;
        const d = m * (0.12 + ctx.rand() * 0.42) * (0.5 + 0.5 * k);
        cxs[i] = clamp(T[k2].tx[i] + Math.cos(a) * d, -W * 0.05, W * 1.05);
        cys[i] = clamp(T[k2].ty[i] + Math.sin(a) * d, -H * 0.05, H * 1.05);
      }
      return { x: cxs, y: cys };
    });
    const delay = new Float32Array(N);
    const swirl = new Float32Array(N);
    const accent = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      swirl[i] = (ctx.rand() - 0.5) * m * 0.12 * k;
      accent[i] = ctx.rand() < 0.14 ? 1 : 0;
    }
    const PH = G + HOLD + S;
    const cycle = PH * K;
    const amp = m * 0.012 * drift;
    const xs = new Float32Array(N);
    const ys = new Float32Array(N);

    return canvasRuntime(ctx, (g, time) => {
      const t = mod(time, cycle);
      const kk = Math.min(K - 1, Math.floor(t / PH));
      const tp = t - kk * PH;
      const tgt = T[kk];
      const from = C[(kk - 1 + K) % K];
      const to = C[kk];
      const nt = time * 0.5;
      let alpha = 1;
      for (let i = 0; i < N; i++) {
        let x: number;
        let y: number;
        let wob: number;
        if (tp < G) {
          // gather, delayed left → right
          delay[i] = (tgt.tx[i] / W) * 0.3 * G + hash2(i, 7, ctx.seed) * 0.08 * G;
          const p = easeOut3(clamp((tp - delay[i]) / (G * 0.62), 0, 1));
          const dx = tgt.tx[i] - from.x[i];
          const dy = tgt.ty[i] - from.y[i];
          const len = Math.hypot(dx, dy) || 1;
          const sw = Math.sin(Math.PI * p) * swirl[i];
          x = from.x[i] + dx * p - (dy / len) * sw;
          y = from.y[i] + dy * p + (dx / len) * sw;
          wob = 1 - p * 0.85;
        } else if (tp < G + HOLD) {
          x = tgt.tx[i];
          y = tgt.ty[i];
          wob = 0.15;
        } else {
          const u = clamp((tp - G - HOLD - hash2(i, 9, ctx.seed) * 0.15) / (S * 0.8), 0, 1);
          const p = easeOut3(u);
          x = tgt.tx[i] + (to.x[i] - tgt.tx[i]) * p;
          y = tgt.ty[i] + (to.y[i] - tgt.ty[i]) * p;
          wob = 0.15 + 0.85 * p;
        }
        if (amp > 0) {
          x += noise2(i * 0.37, nt, ctx.seed) * amp * wob;
          y += noise2(i * 0.37 + 50, nt, ctx.seed) * amp * wob;
        }
        xs[i] = x;
        ys[i] = y;
      }
      if (tp < G) alpha = 0.45 + 0.55 * easeOut3(tp / G);
      else if (tp >= G + HOLD) alpha = 1 - 0.55 * easeIn3((tp - G - HOLD) / S);
      g.globalAlpha = alpha;
      for (let pass = 0; pass < 2; pass++) {
        g.fillStyle = pass ? ctx.s.accent : ctx.s.primary;
        g.beginPath();
        for (let i = 0; i < N; i++) {
          if (accent[i] !== pass) continue;
          g.moveTo(xs[i] + dot, ys[i]);
          g.arc(xs[i], ys[i], dot, 0, TAU);
        }
        g.fill();
      }
    });
  },
});
