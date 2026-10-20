import { defineEffect } from '../../engine/define';
import { drawLayout } from '../../engine/canvas';
import { canvasRuntime, clamp, ease, mod, num, rgba, TAU } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { fontString, graphemes, isSpace, layoutText, phrases } from '../../engine/text';

// Ported from kinetic-typography e20-text-vortex.
// Fragments travel on log spirals r = r0·(rEnd/r0)^p, θ = θ0 + dir·Θ·p with an
// accelerating p (faster and smaller toward the centre). Θ and the release turn are
// whole turns, so at the end of the release every fragment is back at (r0, θ0): the
// cycle gather → readable word → release is seamless. Trails are earlier samples of
// the same pure function (t − j·0.035 s), drawn as fading ghost layers.
export default defineEffect({
  id: 'text-vortex',
  code: 'T06',
  nameZh: '文字漩渦',
  nameEn: 'Text Vortex',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '大量文字碎片沿螺旋扭轉、越靠中心越快越小，聚集後浮現完整可讀的詞，再旋轉釋放。',
  tags: ['漩渦', '螺旋', '聚集', '殘影', 'vortex'],
  suitable: ['焦點聚集', '奇幻片頭', '關鍵詞揭曉'],
  principle:
    'Canvas 2D：每個碎片沿對數螺旋 r = r0·(rEnd/r0)^p、θ = θ0 ± Θ·p 移動，p 以加速曲線前進（越近中心越快、字越小、扁橢圓 y×0.82）。Θ 與釋放圈數皆為整圈，所以釋放結束時每個碎片回到 (r0, θ0)，循環無縫。殘影層是同一純函數在 t − j·Δ 的取樣，主詞在聚集完成時以 expo.out 旋轉放大浮現並停留。',
  defaultText: '漩渦／VORTEX',
  palette: 'MONO',
  colors: { background: '#141414', primary: '#FFFFFF', secondary: '#ED589A', accent: '#8A8A8A' },
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'direction', 'secondary', 'accent', 'seed'],
  directions: ['cw', 'ccw'],
  maxChars: 24,
  loopable: true,
  textHint: '用「／」分隔多個詞，每次聚集輪流浮現下一個詞。',
  params: [
    { key: 'turns', label: '旋轉圈數', type: 'range', min: 1, max: 4, step: 1, default: 2 },
    { key: 'shrink', label: '收縮程度', type: 'range', min: 0, max: 1, step: 0.05, default: 0.7, hint: '碎片接近中心時縮小的比例' },
    { key: 'trails', label: '殘影層數', type: 'range', min: 0, max: 6, step: 1, default: 3 },
    { key: 'count', label: '碎片數量', type: 'range', min: 60, max: 500, step: 10, default: 240 },
    { key: 'cycle', label: '循環秒數', type: 'range', min: 4, max: 12, step: 0.5, default: 7, unit: 's' },
  ],
  recipe: {
    enter: '碎片散佈在畫面外圈，沿螺旋臂開始緩慢旋入。',
    motion: '碎片以加速曲線 u²(0.4+0.6u) 沿對數螺旋旋向中心，越近越快越小；最後一批抵達時中心發出一圈衝擊波。',
    hold: '主詞在週期 44% 時以 expo.out 旋轉放大浮現，停留到 80%（7 秒週期約 2.5 秒）。',
    exit: '主詞放大淡出，碎片以 expo.out 反向旋出一整圈回到起點。',
    loop: '旋轉角為整圈，釋放結束位置 = 起始位置，無縫循環；多個詞時每圈換下一個詞。',
  },
  accept: [
    '碎片沿螺旋軌跡旋轉並被吸向中心，越近中心越小越快。',
    '聚集後中央出現完整可讀的詞並停留。',
    '殘影層數 > 0 時碎片後方有漸淡的殘影。',
    '方向改為逆時針時旋轉方向相反。',
  ],
  transparent: true,
  cycle: 7,
  posterTime: 4.2,
  legacyIds: ['text-vortex'],
  create(ctx) {
    const W = ctx.width;
    const H = ctx.height;
    const cx = W / 2;
    const cy = H / 2;
    const { primary: fg, secondary: acc, accent: guide } = ctx.s;
    const T = num(ctx, 'cycle', 7);
    const turns = Math.round(num(ctx, 'turns', 2));
    const THETA = turns * TAU * ctx.dirSign;
    const shrink = num(ctx, 'shrink', 0.7);
    const trails = Math.round(num(ctx, 'trails', 3) * (ctx.q < 0.5 ? 0.67 : 1));
    const M = Math.round(num(ctx, 'count', 240) * ctx.q);
    const R = Math.hypot(W, H) * 0.5;
    const rEnd = Math.min(W, H) * 0.02;
    const k = clamp(ctx.s.intensity, 0.2, 2);
    const list = phrases(ctx.text);
    const chars = graphemes(list.join('')).filter((c) => !isSpace(c));
    const base = Math.min(W, H) * 0.075 * clamp(ctx.s.scale, 0.6, 1.4);
    const font = fontString(base, ctx.family, ctx.weight);
    const ARRIVE = 0.5;
    const WORD_IN = 0.44;
    const REL = 0.8;

    const parts = Array.from({ length: M }, (_, i) => {
      const h1 = hash2(i, 1, ctx.seed);
      return {
        r0: R * (0.18 + 0.95 * Math.sqrt(hash2(i, 2, ctx.seed))),
        th0: hash2(i, 3, ctx.seed) * TAU,
        arrive: T * (ARRIVE - 0.16 * hash2(i, 4, ctx.seed)),
        relDelay: T * 0.05 * hash2(i, 5, ctx.seed),
        size: 0.6 + 1.1 * h1 * h1,
        ch: chars[i % Math.max(1, chars.length)] ?? '・',
        accent: hash2(i, 6, ctx.seed) < 0.24,
      };
    });
    type Part = (typeof parts)[number];
    const inEase = (u: number) => u * u * (0.4 + 0.6 * u); // gentle start, strong acceleration
    const outEase = ease('expo.out');
    const wordIn = ease('expo.out');

    const pos = (p: Part, time: number) => {
      const tc = mod(time, T);
      let q: number;
      let th: number;
      let visible = 1;
      if (tc < p.arrive) {
        const u = inEase(clamp(tc / p.arrive, 0, 1));
        q = u;
        th = p.th0 + THETA * u;
        visible = 1 - clamp((u - 0.9) / 0.1, 0, 1);
      } else if (tc < T * REL + p.relDelay) {
        return null;
      } else {
        const s = clamp((tc - T * REL - p.relDelay) / (T * (1 - REL) - p.relDelay), 0, 1);
        const o = outEase(s);
        q = 1 - o;
        th = p.th0 + THETA + TAU * ctx.dirSign * o;
        visible = clamp(s / 0.08, 0, 1);
      }
      const r = p.r0 * Math.pow(rEnd / p.r0, q);
      return { x: cx + Math.cos(th) * r, y: cy + Math.sin(th) * r * 0.82, r, th, visible };
    };

    const layouts = list.map((w) => layoutText(ctx, w, { maxWidth: W * 0.72, maxHeight: H * 0.42 }));

    return canvasRuntime(
      ctx,
      (g, t, cv) => {
        const tc = mod(t, T);
        const dpr = cv.dpr;
        // spiral arms (guide of the flow), slowly rotating
        g.save();
        g.translate(cx, cy);
        g.strokeStyle = rgba(guide, 0.18);
        g.lineWidth = 1;
        const armRot = -t * 0.35 * ctx.dirSign;
        for (let a = 0; a < 3; a++) {
          g.beginPath();
          for (let s = 0; s <= 80; s++) {
            const ph = (s / 80) * TAU * 1.6;
            const rr = R * 1.1 * Math.exp(-0.42 * ph);
            const an = ph * ctx.dirSign + armRot + (a * TAU) / 3;
            const x = Math.cos(an) * rr;
            const y = Math.sin(an) * rr * 0.82;
            if (s) g.lineTo(x, y);
            else g.moveTo(x, y);
          }
          g.stroke();
        }
        g.restore();

        const gather = clamp((tc / T - 0.3) / (ARRIVE - 0.3), 0, 1);
        const glowA = tc / T < REL ? gather * 0.4 : 0.4 * (1 - clamp((tc / T - REL) / 0.08, 0, 1));
        if (glowA > 0.01) {
          const gr = g.createRadialGradient(cx, cy, 0, cx, cy, Math.min(W, H) * 0.45);
          gr.addColorStop(0, rgba(acc, glowA * 0.6));
          gr.addColorStop(1, rgba(acc, 0));
          g.fillStyle = gr;
          g.fillRect(0, 0, W, H);
        }

        g.font = font;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        // trails first (oldest → newest), then the fragments
        for (let j = trails; j >= 0; j--) {
          const ta = j === 0 ? 1 : 0.38 * (1 - j / (trails + 1));
          for (const p of parts) {
            const a = pos(p, t - j * 0.035);
            if (!a || a.visible <= 0.01) continue;
            const sz = p.size * (1 - shrink + shrink * Math.pow(a.r / R, 0.6)) * (0.7 + 0.3 * k);
            const rot = a.th + (Math.PI / 2) * ctx.dirSign;
            const s = sz * dpr;
            const c = Math.cos(rot) * s;
            const si = Math.sin(rot) * s;
            g.setTransform(c, si, -si, c, a.x * dpr, a.y * dpr);
            g.globalAlpha = ta * a.visible * (0.45 + 0.55 * Math.min(1, a.r / (R * 0.4)));
            g.fillStyle = p.accent ? acc : fg;
            g.fillText(p.ch, 0, 0);
          }
        }
        g.globalAlpha = 1;
        g.setTransform(dpr, 0, 0, dpr, 0, 0);

        // shockwave when the last fragments arrive
        const sw = (tc / T - ARRIVE) / 0.12;
        if (sw > 0 && sw < 1) {
          const rr = Math.min(W, H) * 0.6 * outEase(sw);
          g.strokeStyle = rgba(acc, 0.7 * (1 - sw));
          g.lineWidth = Math.max(1, base * 0.12 * (1 - sw));
          g.beginPath();
          g.ellipse(cx, cy, rr, rr * 0.82, 0, 0, TAU);
          g.stroke();
        }

        // the word emerges at the centre, then dissolves into the release
        const L = layouts[Math.floor(t / T) % layouts.length];
        const inU = clamp((tc / T - WORD_IN) / 0.14, 0, 1);
        const outU = clamp((tc / T - REL) / 0.07, 0, 1);
        const alpha = clamp(inU * 1.4, 0, 1) * (1 - outU);
        if (alpha > 0.001) {
          const e = wordIn(inU);
          const scale = (0.35 + 0.65 * e) * (1 + 0.25 * outU);
          const spin = (1 - e) * -0.6 * ctx.dirSign;
          g.save();
          g.globalAlpha = alpha;
          g.translate(cx, cy);
          g.rotate(spin);
          g.scale(scale, scale);
          g.translate(-cx, -cy);
          drawLayout(g, L, { fill: fg });
          g.restore();
        }
      },
      { settle: T * 0.66 },
    );
  },
});
