import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, minSide, mod, num, rgba, TAU } from '../../engine/helpers';
import { glyphWidth100, graphemes, phrases } from '../../engine/text';
import { font } from './_t14kit';

// Ported from kinetic-typography e13-text-ribbon (SVG textPath) to Canvas 2D so it
// exports PNG / WebM: the wave path is sampled into a polyline every frame, its
// cumulative arc length is built, and each glyph is placed at an arc position and
// rotated to the local tangent (atan2 of the segment it falls on).

interface Ribbon {
  cy: number;
  front: boolean;
  fs: number;
  /** grapheme + advance (px) of one repeat unit */
  unit: { ch: string; w: number }[];
  unitLen: number;
  phase: number;
  kx: number;
}

export default defineEffect({
  id: 'text-ribbon',
  code: 'T14',
  nameZh: '文字緞帶',
  nameEn: 'Text Ribbon',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '文字排在起伏的緞帶曲線上持續流動，每個字元的角度跟著路徑切線轉動。',
  tags: ['緞帶', '路徑文字', '波浪', '切線', 'ribbon'],
  suitable: ['配樂視覺', '活動主視覺', '裝飾標語'],
  principle:
    'Canvas 2D：路徑 y(x) = cy + A·sin(kx − ωt + φ) + 0.35A·sin(2.1kx + 0.6ωt + 2φ)，每幀取樣成折線並累積弧長 s。字串（以「•」連接成重複單位）中每個字的弧長位置 = 偏移 + 累積字寬，偏移 = (t·v) mod 單位長，保證無縫；在該弧長所在線段內插座標，字元旋轉角 = atan2(dy, dx)（路徑切線）。緞帶本體是同一折線的粗描邊；後方緞帶反向流動、只留外框。',
  defaultText: '跟著節奏走／FOLLOW THE FLOW',
  palette: 'COOL',
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'direction', 'secondary', 'accent'],
  directions: ['left', 'right'],
  maxChars: 36,
  textHint: '用「／」分隔多個詞，會以「•」串成連續緞帶。',
  params: [
    { key: 'ribbons', label: '緞帶數', type: 'range', min: 1, max: 3, step: 1, default: 2 },
    { key: 'amp', label: '起伏幅度', type: 'range', min: 0, max: 0.4, step: 0.01, default: 0.18, hint: '相對於舞台短邊' },
    { key: 'wave', label: '波長', type: 'range', min: 0.6, max: 2, step: 0.05, default: 1, hint: '1 = 約一個舞台寬' },
    { key: 'flow', label: '文字流速', type: 'range', min: 0, max: 3, step: 0.1, default: 1 },
    { key: 'band', label: '顯示緞帶底色', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '進場即為完整緞帶，路徑已在畫面中。',
    motion: '緞帶以兩個疊加的正弦波緩慢起伏（振幅隨時間呼吸 ±20%），文字沿路徑等速流動；字元隨切線傾斜。',
    hold: '流速適中，主緞帶上的詞可連續閱讀；流速 0 時文字固定只剩起伏。',
    exit: '無離場，連續循環。',
    loop: '文字偏移量對單位長取餘數，循環點無跳動。',
  },
  accept: [
    '字元在上坡處向上傾斜、下坡處向下傾斜（角度跟隨切線）。',
    '文字沿路徑持續流動，切換方向後流向相反。',
    '緞帶數 = 3 時可看到前後三條，後方緞帶較淡且反向流動。',
    '起伏幅度 0 時緞帶變成水平直線。',
  ],
  transparent: true,
  cycle: 10,
  posterTime: 1.5,
  legacyIds: ['text-ribbon'],
  create(ctx) {
    const { width: W, height: H } = ctx;
    const k = Math.max(0.05, ctx.s.intensity);
    const nR = Math.round(num(ctx, 'ribbons', 2));
    const flow = num(ctx, 'flow', 1);
    const band = bool(ctx, 'band', true);
    const portrait = H > W;
    const m = minSide(ctx);
    const fs = Math.min(H * 0.105, W * (portrait ? 0.12 : 0.085)) * ctx.s.scale;
    const lambda = Math.max(W * (portrait ? 1.1 : 0.95), fs * 13) * num(ctx, 'wave', 1);
    const amp0 = Math.min(m * num(ctx, 'amp', 0.18) * Math.min(1.5, k) * 1.2, lambda * 0.16);
    const sep = '  •  ';
    const unitText = phrases(ctx.text).join(sep) + sep;
    const gs = graphemes(unitText);
    const SEG = Math.max(40, Math.round(90 * ctx.q));
    const x0 = -W * 0.15;
    const x1 = W * 1.15;
    const family = ctx.family;
    const wt = ctx.weight;
    const tr = ctx.s.tracking;

    const ribbons: Ribbon[] = Array.from({ length: nR }, (_, i) => {
      const front = i === 0;
      const rfs = fs * (front ? 1 : 0.82);
      const unit = gs.map((ch) => ({ ch, w: (glyphWidth100(ch, family, wt) / 100) * rfs + tr * rfs }));
      const unitLen = Math.max(rfs, unit.reduce((a, u) => a + u.w, 0));
      const spread = portrait ? H * 0.26 : H * 0.24;
      const cy = H / 2 + (front ? 0 : (i % 2 ? 1 : -1) * spread * Math.ceil(i / 2) * (nR === 2 && !portrait ? 0.62 : 1));
      return { cy, front, fs: rfs, unit, unitLen, phase: i * 1.7, kx: (TAU / lambda) * (1 + i * 0.18) };
    });
    // back → front drawing order
    const order = ribbons.slice().reverse();
    const xs = new Float32Array(SEG + 1);
    const ys = new Float32Array(SEG + 1);
    const acc = new Float32Array(SEG + 1);

    return canvasRuntime(ctx, (g, t) => {
      for (const r of order) {
        const A = amp0 * (0.8 + 0.2 * Math.sin(t * 0.7 + r.phase)) * (r.front ? 1 : 0.8);
        const w = t * 1.3 * k * (r.front ? 1 : -0.8);
        acc[0] = 0;
        for (let i = 0; i <= SEG; i++) {
          const x = x0 + ((x1 - x0) * i) / SEG;
          xs[i] = x;
          ys[i] = r.cy + A * Math.sin(x * r.kx - w + r.phase) + A * 0.35 * Math.sin(x * r.kx * 2.1 + w * 0.6 + r.phase * 2);
          if (i) acc[i] = acc[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
        }
        const total = acc[SEG];
        // ribbon body
        const bw = r.fs * (r.front ? 1.75 : 1.5);
        g.lineJoin = 'round';
        g.lineCap = 'butt';
        g.beginPath();
        for (let i = 0; i <= SEG; i++) (i ? g.lineTo(xs[i], ys[i]) : g.moveTo(xs[i], ys[i]));
        if (band) {
          g.strokeStyle = r.front ? ctx.s.accent : rgba(ctx.s.accent, 0.35);
          g.lineWidth = bw + Math.max(3, r.fs * 0.12);
          g.stroke();
          g.strokeStyle = r.front ? ctx.s.secondary : ctx.s.background;
          g.lineWidth = bw;
          g.stroke();
        } else if (r.front) {
          g.strokeStyle = rgba(ctx.s.accent, 0.4);
          g.lineWidth = 1;
          g.stroke();
        }
        // glyphs along the path
        const speed = r.fs * 2.2 * flow * k;
        // front ribbon travels in the chosen direction, back ribbons the other way
        const off = mod(t * speed * (r.front ? 1 : -1) * ctx.dirSign, r.unitLen);
        g.font = font(r.fs, family, r.front ? wt : Math.min(wt, 700));
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = r.front ? ctx.s.primary : rgba(ctx.s.primary, 0.6);
        let s = off - r.unitLen;
        let si = 0;
        while (s < total) {
          for (const u of r.unit) {
            const mid = s + (u.w - tr * r.fs) / 2;
            s += u.w;
            if (mid < 0 || u.ch === ' ') continue;
            if (mid >= total) break;
            while (si < SEG - 1 && acc[si + 1] < mid) si++;
            const segLen = Math.max(1e-6, acc[si + 1] - acc[si]);
            const f = clamp((mid - acc[si]) / segLen, 0, 1);
            const dx = xs[si + 1] - xs[si];
            const dy = ys[si + 1] - ys[si];
            const px = xs[si] + dx * f;
            const py = ys[si] + dy * f;
            if (px < -r.fs * 2 || px > W + r.fs * 2) continue;
            g.save();
            g.translate(px, py);
            g.rotate(Math.atan2(dy, dx));
            g.fillText(u.ch, 0, r.fs * 0.04);
            g.restore();
          }
        }
      }
    });
  },
});
