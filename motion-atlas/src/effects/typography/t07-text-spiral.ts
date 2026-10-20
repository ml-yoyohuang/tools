import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, minSide, num, rgba, smoothstep, TAU } from '../../engine/helpers';
import { fontString, glyphWidth100, graphemes, isSpace, phrases } from '../../engine/text';

// A single continuous Archimedes-like spiral is integrated once in create: going
// inwards, dr/dθ = −spacing(r)/2π with spacing ∝ glyph size(r) (glyphs shrink towards
// the centre, so the turns tighten). Each point stores an "em coordinate"
// u = ∫ ds / size(r), so text laid out in em units follows the path with spacing that
// scales with the glyph size. The phrase stream sits at u = f(t) − e (e = em offset in
// the stream) and flows inwards; f(t) = v·t − v·a·P·sin(2πt/P)/2π gives a periodic
// near-stop (a = pause) so the outer turn can be read. Glyphs rotate with the path
// tangent and fade out into the centre.
export default defineEffect({
  id: 'text-spiral',
  code: 'T07',
  nameZh: '文字螺旋',
  nameEn: 'Text Spiral',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '連續的詞句排在一條螺旋線上，字沿切線旋轉、越往內越小，整串文字一拍一拍流向中心。',
  tags: ['螺旋', '路徑文字', '流動', '向心', 'spiral'],
  suitable: ['詩句展示', '催眠感背景', '品牌口號'],
  principle:
    'Canvas 2D：在 create 中積分一條螺旋（dr/dθ = −spacing(r)/2π，spacing ∝ 字級 size(r)），每個取樣點記錄 em 座標 u = ∫ds/size(r)。文字串以 em 寬度排在 u = f(t) − e，f(t) = v·t − v·a·P·sin(2πt/P)/2π 讓流動週期性減速到幾乎停住；每個字依路徑切線旋轉、依半徑縮放，接近中心時淡出。是單一路徑上的平面流動，不是同心圓文字或 Z 軸隧道。',
  defaultText: '一直往前走／KEEP GOING／動效圖鑑',
  palette: 'MONO',
  colors: { background: '#F2E8D5', primary: '#141414', secondary: '#E63A2E', accent: '#3450FF' },
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'direction', 'secondary', 'accent'],
  directions: ['ccw', 'cw'],
  maxChars: 60,
  textHint: '用「／」分隔多個詞句，會以分隔符號串成一條連續文字流。',
  params: [
    { key: 'gap', label: '圈距', type: 'range', min: 1, max: 2, step: 0.05, default: 1.25, hint: '相鄰兩圈間距（倍數字級）' },
    { key: 'inner', label: '中心字級', type: 'range', min: 0.1, max: 0.8, step: 0.05, default: 0.22, hint: '中心附近字級相對外圈的比例' },
    { key: 'pause', label: '閱讀停頓', type: 'range', min: 0, max: 1, step: 0.05, default: 0.85, hint: '0 = 等速流動，1 = 每拍完全停住' },
    { key: 'beat', label: '每拍秒數', type: 'range', min: 1, max: 4, step: 0.1, default: 2.2, unit: 's' },
  ],
  recipe: {
    enter: '新的字從螺旋最外端淡入（約 1.5 個字寬內）。',
    motion: '整串文字沿螺旋向中心流動，每拍以 1 − a·cos(2πt/P) 的速度曲線前進約一個短詞的距離。',
    hold: '每拍的速度谷底幾乎停住（預設停頓 0.85），外圈的詞可閱讀。',
    exit: '字在接近中心時縮小並淡出，像被吸入中心。',
    loop: '文字串無限重複，流動距離是時間的連續函數。',
  },
  accept: [
    '文字排在單一條螺旋線上，字的角度跟隨切線。',
    '整串文字持續流向中心並在中心縮小消失。',
    '流動有週期性的減速停頓，外圈文字可讀。',
    '方向切換時螺旋的旋向相反。',
  ],
  transparent: true,
  cycle: 8.8,
  posterTime: 0.1,
  create(ctx) {
    const W = ctx.width;
    const H = ctx.height;
    const cx = W / 2;
    const cy = H / 2;
    const m = minSide(ctx);
    const base = m * 0.068 * ctx.s.scale;
    const gap = num(ctx, 'gap', 1.25);
    const inner = num(ctx, 'inner', 0.22);
    const pause = num(ctx, 'pause', 0.85);
    const P = num(ctx, 'beat', 2.2);
    const v = (2.6 + 1.6 * ctx.s.intensity) / P; // em per second (average)
    const ax = clamp(W / H, 1, 1.45);
    const ay = clamp(H / W, 1, 1.45);
    const R0 = m * 0.47 - base * 0.5;
    const rMin = base * inner * 0.8;
    const size = (r: number) => base * (inner + (1 - inner) * clamp(r / R0, 0, 1));
    // the winding: flow towards the centre turns cw (screen) for dirSign = +1
    const s = ctx.dirSign;

    // integrate the path once
    const px: number[] = [];
    const py: number[] = [];
    const pr: number[] = [];
    const pu: number[] = [];
    let r = R0;
    let th = -Math.PI / 2;
    let u = 0;
    let lx = cx + Math.cos(th) * r * ax;
    let ly = cy + Math.sin(th) * r * ay;
    const dth = 0.025;
    while (r > rMin && px.length < 8000) {
      px.push(lx);
      py.push(ly);
      pr.push(r);
      pu.push(u);
      r -= (size(r) * gap * dth) / TAU;
      th += dth * s;
      const nx = cx + Math.cos(th) * r * ax;
      const ny = cy + Math.sin(th) * r * ay;
      u += Math.hypot(nx - lx, ny - ly) / size(r);
      lx = nx;
      ly = ny;
    }
    const U = pu[pu.length - 1];
    const at = (uu: number) => {
      let lo = 0;
      let hi = pu.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (pu[mid] <= uu) lo = mid;
        else hi = mid;
      }
      const f = clamp((uu - pu[lo]) / Math.max(1e-6, pu[hi] - pu[lo]), 0, 1);
      return {
        x: px[lo] + (px[hi] - px[lo]) * f,
        y: py[lo] + (py[hi] - py[lo]) * f,
        r: pr[lo] + (pr[hi] - pr[lo]) * f,
        // reading direction = outwards (towards smaller u)
        a: Math.atan2(py[lo] - py[hi], px[lo] - px[hi]),
      };
    };

    // the text stream: phrases separated by a dot; em offsets from the stream head
    const list = phrases(ctx.text);
    const tr = ctx.s.tracking;
    interface G {
      ch: string;
      e: number;
      w: number;
      col: string;
    }
    const stream: G[] = [];
    let e = 0;
    const push = (ch: string, col: string) => {
      const w = glyphWidth100(ch, ctx.family, ctx.weight) / 100;
      if (!isSpace(ch)) stream.push({ ch, e: e + w / 2, w, col });
      e += w + tr;
    };
    list.forEach((p, i) => {
      for (const ch of graphemes(p)) push(ch, i % 2 ? ctx.s.secondary : ctx.s.primary);
      e += 0.45;
      push('●', ctx.s.accent);
      e += 0.45;
    });
    const E = Math.max(1, e);
    // the stream repeats every E em, so the whole path is always filled
    const flow = (t: number) => v * t - (v * pause * P * Math.sin((TAU * t) / P)) / TAU;
    const sep = '●';

    return canvasRuntime(ctx, (g, t) => {
      const f = flow(t) + U * 0.55;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      // faint guide line of the path
      g.strokeStyle = rgba(ctx.s.secondary, 0.14);
      g.lineWidth = Math.max(1, base * 0.03);
      g.beginPath();
      for (let i = 0; i < px.length; i += 3) (i ? g.lineTo(px[i], py[i]) : g.moveTo(px[i], py[i]));
      g.stroke();
      const rep0 = Math.floor((f - U) / E) - 1;
      const rep1 = Math.floor(f / E) + 1;
      g.font = fontString(base, ctx.family, ctx.weight);
      for (let rep = rep0; rep <= rep1; rep++) {
        for (const gl of stream) {
          const uu = f - (rep * E + gl.e);
          if (uu < 0 || uu > U) continue;
          const p = at(uu);
          const sz = size(p.r);
          const alpha = smoothstep(0, 1.6, uu) * smoothstep(rMin, rMin + base * 1.2, p.r);
          if (alpha < 0.02) continue;
          g.save();
          g.globalAlpha = alpha;
          g.translate(p.x, p.y);
          g.rotate(p.a);
          g.scale(sz / base, sz / base);
          g.fillStyle = gl.col;
          if (gl.ch === sep) {
            g.beginPath();
            g.arc(0, 0, base * 0.13, 0, TAU);
            g.fill();
          } else g.fillText(gl.ch, 0, 0);
          g.restore();
        }
      }
      // the drain
      g.fillStyle = ctx.s.accent;
      g.beginPath();
      g.arc(cx, cy, Math.max(2, base * 0.12), 0, TAU);
      g.fill();
    });
  },
});
