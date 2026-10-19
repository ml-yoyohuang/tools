import { drawLayout, offscreen } from '../../engine/canvas';
import { el, textBlock } from '../../engine/dom';
import { clamp, mod, num, PALETTE, smoothstep, TAU } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { layoutText, phrases, type TextLayout } from '../../engine/text';
import type { EffectContext, EffectImpl, EffectRuntime } from '../../engine/types';

// Continuous fly-through. Word m has phase q = t/P − m; its log-scale is
//   ln s = c·q − d·sin(2πq)/2π   (d < c → monotonic, slowest at integer q)
// so the camera surges between words and eases at each reading pose (q = 0, s = 1).
// The transform origin is the most open point between strokes (found with a distance
// transform of the rasterised glyphs), and it drifts to the stage centre as the word
// grows, so the camera really passes through that gap while the next word waits in it.
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
  // two-pass chamfer distance transform
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
  // candidates inside the glyph box (between strokes), favour the centre
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
  return best;
}

const impl: EffectImpl = {
  id: 'zoom-through',
  defaults: { ...PALETTE.darkViolet },
  posterTime: 0.05,
  maxChars: 30,
  textHint: '用「／」分隔多個詞，鏡頭會依序穿過；只有一個詞時重複穿越。',
  params: [
    { key: 'period', label: '每詞秒數', type: 'range', min: 0.8, max: 3, step: 0.1, default: 1.6, unit: 's' },
    { key: 'pause', label: '閱讀停頓', type: 'range', min: 0, max: 1, step: 0.05, default: 0.8, hint: '0 = 等速穿越，1 = 在每個詞前明顯減速' },
    { key: 'streaks', label: '速度線', type: 'range', min: 0, max: 60, step: 2, default: 28 },
  ],
  create(ctx): EffectRuntime {
    const list = phrases(ctx.text);
    const P = num(ctx, 'period', 1.6) / Math.max(0.35, Math.sqrt(ctx.s.intensity || 0.35));
    const c = 3.1;
    const d = c * 0.9 * num(ctx, 'pause', 0.8);
    const nStreaks = Math.round(num(ctx, 'streaks', 28) * ctx.q);
    const W = ctx.width;
    const H = ctx.height;
    const C = { x: W / 2, y: H / 2 };

    const streakLayer = el('div', { style: { position: 'absolute', inset: '0' } }, ctx.root);
    const reach = Math.hypot(W, H) / 2;
    const streaks = Array.from({ length: nStreaks }, (_, i) => {
      const a = hash2(i, 1, ctx.seed) * 360;
      const node = el('div', {
        style: {
          position: 'absolute', left: C.x, top: C.y, width: 100, height: Math.max(1, Math.min(W, H) * 0.004 * (1 + hash2(i, 2, ctx.seed) * 1.5)),
          background: i % 4 === 0 ? ctx.s.primary : ctx.s.secondary, transformOrigin: '0 50%', borderRadius: 4, opacity: 0, willChange: 'transform,opacity',
        },
      }, streakLayer);
      return { node, a, off: hash2(i, 3, ctx.seed), rate: 0.6 + hash2(i, 4, ctx.seed) * 0.6 };
    });

    // per phrase: layout, gap; 4 DOM copies so consecutive instances can coexist
    const SLOTS = 4;
    const words = list.map((p) => {
      const L = layoutText(ctx, p, { maxWidth: W * 0.76, maxHeight: H * 0.46 });
      const G = findGap(ctx, L);
      const copies = Array.from({ length: SLOTS }, () => {
        const wrap = el('div', {
          style: { position: 'absolute', inset: '0', transformOrigin: `${G.x}px ${G.y}px`, visibility: 'hidden', pointerEvents: 'none' },
        }, ctx.root);
        const { block } = textBlock(wrap, L, { color: ctx.s.primary });
        return { wrap, block };
      });
      return { L, G, copies };
    });
    const n = words.length;
    const logScale = (q: number) => c * q - (d * Math.sin(TAU * q)) / TAU;

    let shown: HTMLDivElement[] = [];
    return {
      render(t) {
        const p = t / P;
        const base = Math.floor(p);
        const next: HTMLDivElement[] = [];
        for (let m = base - 2; m <= base + 3; m++) {
          const q = p - m;
          if (q < -2.3 || q > 1) continue;
          const word = words[mod(m, n)];
          const copy = word.copies[mod(m, SLOTS)];
          const s = Math.exp(logScale(q));
          const fadeIn = smoothstep(-2.2, -1.4, q);
          const fadeOut = 1 - smoothstep(0.78, 0.97, q);
          const op = fadeIn * fadeOut;
          if (op <= 0.001) continue;
          const mb = smoothstep(0, 0.6, q);
          const G = word.G;
          // block is centred on C, so at mb = 0 the whole word sits at the vanishing point
          const f = (1 - s) * (1 - mb) + mb;
          const tx = (C.x - G.x) * f;
          const ty = (C.y - G.y) * f;
          copy.wrap.style.transform = `translate(${tx}px,${ty}px) scale(${s})`;
          copy.wrap.style.opacity = String(op);
          copy.wrap.style.zIndex = String(Math.round(100 + q * 20));
          copy.wrap.style.visibility = 'visible';
          copy.block.style.color = mod(m, 2) ? ctx.s.secondary : ctx.s.primary;
          next.push(copy.wrap);
        }
        for (const w of shown) if (!next.includes(w)) w.style.visibility = 'hidden';
        shown = next;

        // camera speed (d ln s / dq), normalised to 0..1
        const ph = p - base;
        const speed = clamp((c - d * Math.cos(TAU * ph)) / (c + d), 0, 1);
        for (const st of streaks) {
          const u = mod(logScale(p) * st.rate * 0.45 + st.off, 1);
          const r = reach * (0.08 + 1.05 * u * u);
          const len = reach * (0.04 + 0.4 * u * u) * (0.4 + speed);
          st.node.style.transform = `rotate(${st.a}deg) translateX(${r}px) scaleX(${len / 100})`;
          st.node.style.opacity = String((0.15 + 0.75 * speed) * Math.sin(Math.PI * u));
        }
      },
    };
  },
};
export default impl;
