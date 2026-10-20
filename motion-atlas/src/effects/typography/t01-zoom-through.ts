import { defineEffect } from '../../engine/define';
import { drawLayout, offscreen } from '../../engine/canvas';
import { canvasRuntime, clamp, easeInOut, mod, num, rgba, smoothstep, TAU } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { layoutText, phrases, type TextLayout } from '../../engine/text';
import type { EffectContext } from '../../engine/types';

// Ported from kinetic-typography e07-zoom-through (DOM → Canvas 2D).
// Word m has phase q = p(t) − m; its log-scale is ln s = c·q − d·sin(2πq)/2π
// (d < c → monotonic, slowest at integer q). The scale origin is the most open
// point between strokes (distance transform of the rasterised glyphs, computed once
// in create) and drifts to the stage centre as the word grows, so the camera passes
// through that gap while the next word already waits inside it.
function findGap(ctx: EffectContext, L: TextLayout): { x: number; y: number } {
  const sc = clamp(90 / L.fontSize, 0.12, 0.5);
  const o = offscreen(ctx.width * sc, ctx.height * sc);
  drawLayout(o.g, L, { fill: '#fff', scale: sc });
  const W = o.canvas.width;
  const H = o.canvas.height;
  const data = o.g.getImageData(0, 0, W, H).data;
  const INF = 1e6;
  const d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = data[i * 4 + 3] > 60 ? 0 : INF;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!d[i]) continue;
      let v = d[i];
      if (x > 0) v = Math.min(v, d[i - 1] + 1);
      if (y > 0) v = Math.min(v, d[i - W] + 1);
      if (x > 0 && y > 0) v = Math.min(v, d[i - W - 1] + 1.414);
      if (x < W - 1 && y > 0) v = Math.min(v, d[i - W + 1] + 1.414);
      d[i] = v;
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      let v = d[i];
      if (x < W - 1) v = Math.min(v, d[i + 1] + 1);
      if (y < H - 1) v = Math.min(v, d[i + W] + 1);
      if (x < W - 1 && y < H - 1) v = Math.min(v, d[i + W + 1] + 1.414);
      if (x > 0 && y < H - 1) v = Math.min(v, d[i + W - 1] + 1.414);
      d[i] = v;
    }
  const bx0 = Math.floor((L.x + L.width * 0.08) * sc);
  const bx1 = Math.ceil((L.x + L.width * 0.92) * sc);
  const by0 = Math.floor((L.y + L.height * 0.2) * sc);
  const by1 = Math.ceil((L.y + L.height * 0.8) * sc);
  const cx = (L.x + L.width / 2) * sc;
  const cy = (L.y + L.height / 2) * sc;
  const fsS = L.fontSize * sc;
  let best = { x: L.x + L.width / 2, y: L.y + L.height / 2, score: -Infinity };
  for (let y = Math.max(0, by0); y < Math.min(H, by1); y++)
    for (let x = Math.max(0, bx0); x < Math.min(W, bx1); x++) {
      const v = d[y * W + x];
      if (!v || v >= INF) continue;
      const clear = Math.min(v, fsS * 0.35);
      const score = clear / fsS - (0.12 * Math.hypot(x - cx, y - cy)) / fsS;
      if (score > best.score) best = { x: x / sc, y: y / sc, score };
    }
  o.canvas.width = o.canvas.height = 0;
  return best;
}

export default defineEffect({
  id: 'zoom-through',
  code: 'T01',
  nameZh: '穿越放大',
  nameEn: 'Text Zoom Through',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '完整的詞快速放大衝出畫面，鏡頭彷彿穿過字形之間的縫隙，下一個詞已在縫隙深處等待。',
  tags: ['穿越', '放大', '速度', '轉場', 'zoom'],
  suitable: ['片頭轉場', '速度感標語', '關鍵詞串場'],
  principle:
    'Canvas 2D：第 m 個詞的相位 q = p(t) − m，縮放 ln s = c·q − d·sin(2πq)/2π（d < c 時單調，整數 q 時最慢）；p(t) 在每個詞先停留 hold 秒再以時間前進。縮放原點以距離轉換找出字形筆畫間最空曠的一點，並隨放大漂向畫面中心，所以鏡頭會穿過縫隙，下一個詞同時從深處出現。放射速度線的長度與透明度跟隨 d ln s / dq。',
  defaultText: 'MOTION／穿越／ATLAS',
  palette: 'COOL',
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'secondary', 'accent', 'seed'],
  maxChars: 30,
  textHint: '用「／」分隔多個詞，鏡頭會依序穿過；只有一個詞時重複穿越。',
  params: [
    { key: 'zoom', label: '放大幅度', type: 'range', min: 2, max: 4.5, step: 0.1, default: 3.1, hint: '每個詞放大 e^幅度 倍後離場' },
    { key: 'hold', label: '停留時間', type: 'range', min: 0, max: 3, step: 0.1, default: 1.1, unit: 's' },
    { key: 'travel', label: '穿越秒數', type: 'range', min: 0.5, max: 2.5, step: 0.1, default: 1.1, unit: 's' },
    { key: 'streaks', label: '速度線', type: 'range', min: 0, max: 60, step: 2, default: 28 },
  ],
  recipe: {
    enter: '下一個詞以極小尺寸出現在上一個詞的筆畫縫隙中，從深處淡入。',
    motion: '縮放依 ln s = c·q − d·sin(2πq)/2π 指數成長，接近整數相位時減速；離開讀取點後加速放大並衝出畫面，速度線同步變長變亮。',
    hold: '每個詞在正常大小停住 hold 秒（預設 1.1s），完整可讀。',
    exit: '放大超過約 e^2.4 倍後在 0.78→0.97 相位淡出，鏡頭穿過字形。',
    loop: '詞序列循環；p(t) 為連續函數，最後一個詞穿越後接回第一個詞。',
  },
  accept: [
    '每個詞在畫面中央停住可讀，然後放大衝出畫面。',
    '放大時可看到下一個詞已在筆畫縫隙中出現並跟著放大。',
    '速度線在穿越時變長變亮，停留時變弱。',
    '調整停留時間為 0 時變成連續穿越。',
  ],
  transparent: true,
  cycle: 6.6,
  posterTime: 0.3,
  legacyIds: ['zoom-through'],
  create(ctx) {
    const list = phrases(ctx.text);
    const W = ctx.width;
    const H = ctx.height;
    const C = { x: W / 2, y: H / 2 };
    const c = num(ctx, 'zoom', 3.1);
    const d = c * 0.88;
    const hold = num(ctx, 'hold', 1.1);
    const travel = num(ctx, 'travel', 1.1);
    const P = hold + travel;
    const k = ctx.s.intensity;
    const nStreaks = Math.round(num(ctx, 'streaks', 28) * ctx.q * (0.4 + 0.6 * Math.min(1.5, k)));
    const reach = Math.hypot(W, H) / 2;
    const streaks = Array.from({ length: nStreaks }, (_, i) => ({
      a: hash2(i, 1, ctx.seed) * TAU,
      th: Math.max(1, Math.min(W, H) * 0.004 * (1 + hash2(i, 2, ctx.seed) * 1.5)),
      off: hash2(i, 3, ctx.seed),
      rate: 0.6 + hash2(i, 4, ctx.seed) * 0.6,
      col: i % 4 === 0 ? ctx.s.accent : ctx.s.secondary,
    }));
    const words = list.map((p) => {
      const L = layoutText(ctx, p, { maxWidth: W * 0.76, maxHeight: H * 0.46 });
      return { L, G: findGap(ctx, L) };
    });
    const n = words.length;
    const logScale = (q: number) => c * q - (d * Math.sin(TAU * q)) / TAU;
    // time warp: each word rests for `hold`, then the camera travels one word
    const warp = (t: number) => {
      const kk = Math.floor(t / P);
      const u = t - kk * P;
      return kk + (u < hold ? 0 : (u - hold) / travel);
    };

    return canvasRuntime(ctx, (g, t) => {
      const p = warp(t);
      const base = Math.floor(p);
      // camera speed (d ln s / dq) normalised to 0..1, 0 while holding
      const ph = p - base;
      const moving = mod(t, P) >= hold ? 1 : 0;
      const speed = moving * clamp((c - d * Math.cos(TAU * ph)) / (c + d), 0, 1);
      // streaks (behind the words)
      g.lineCap = 'round';
      const drift = logScale(p) + t * 0.12;
      for (const st of streaks) {
        const u = mod(drift * st.rate * 0.45 + st.off, 1);
        const r = reach * (0.08 + 1.05 * u * u);
        const len = reach * (0.04 + 0.4 * u * u) * (0.3 + speed) * Math.min(1.6, 0.5 + 0.5 * k);
        const a = (0.1 + 0.75 * speed) * Math.sin(Math.PI * u);
        if (a < 0.01) continue;
        g.strokeStyle = rgba(st.col, clamp(a, 0, 1));
        g.lineWidth = st.th;
        g.beginPath();
        g.moveTo(C.x + Math.cos(st.a) * r, C.y + Math.sin(st.a) * r);
        g.lineTo(C.x + Math.cos(st.a) * (r + len), C.y + Math.sin(st.a) * (r + len));
        g.stroke();
      }
      // words, far → near
      for (let m = base + 3; m >= base - 2; m--) {
        const q = p - m;
        if (q < -2.3 || q > 1) continue;
        const word = words[mod(m, n)];
        const s = Math.exp(logScale(q));
        const op = smoothstep(-2.2, -1.4, q) * (1 - smoothstep(0.78, 0.97, q));
        if (op <= 0.001) continue;
        const mb = easeInOut(smoothstep(0, 0.6, q));
        const G = word.G;
        const f = (1 - s) * (1 - mb) + mb;
        const tx = (C.x - G.x) * f;
        const ty = (C.y - G.y) * f;
        g.save();
        g.globalAlpha = op;
        g.translate(G.x + tx, G.y + ty);
        g.scale(s, s);
        g.translate(-G.x, -G.y);
        drawLayout(g, word.L, { fill: mod(m, 2) ? ctx.s.secondary : ctx.s.primary });
        g.restore();
      }
    });
  },
});
