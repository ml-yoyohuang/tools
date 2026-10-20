import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, damp, easeInOut, mix, mod, num, rgba } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import { font, seg } from './_t14kit';

// Ported from kinetic-typography e02-letter-sequence (DOM + GSAP drop & squash) and
// reworked per the atlas spec as a pure function of time on canvas: every glyph
// zooms in from a large scale on its own beat (power3.in → it accelerates into the
// stage), squashes on impact around its foot, recovers with a damped wobble, kicks
// dust and extends the baseline rule. While the sequence plays, the line sits on a
// widened tracking; after the last impact it contracts back to the stable spacing.

export default defineEffect({
  id: 'letter-sequence',
  code: 'T16',
  nameZh: '逐字重擊',
  nameEn: 'Letter Sequence',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '每個字依節拍從大尺寸撞入定位、壓扁回彈，全部到位後字距收回成穩定狀態。',
  tags: ['逐字', '重擊', '節拍', '擠壓', 'stagger'],
  suitable: ['節拍字幕', '標題強調', '短影音口號'],
  principle:
    'Canvas 2D：字 i 的落點時間 = 0.12 + i·節拍 + 0.42s；落下前 scale = 1 + (Z−1)(1 − u³)（power3.in，u 為入場進度），以字底為變形原點。撞擊瞬間 scaleY = 1 − q、scaleX = 1 + 0.75q，之後以 q·e^(−5.5τ)·cos(2π·2.6τ) 衰減回彈；落點同時噴出兩條塵線並延長基線。序列期間整行以 1+0.3k 倍字距排列，最後一字落定後以 easeInOut 收回原字距。',
  defaultText: '一字一句／ONE BY ONE',
  palette: 'POP',
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'secondary', 'accent'],
  maxChars: 30,
  textHint: '用「／」換行，每個字會依序撞進畫面。',
  loopable: true,
  params: [
    { key: 'beat', label: '節拍間隔', type: 'range', min: 0.06, max: 0.4, step: 0.01, default: 0.16, unit: 's' },
    { key: 'zoom', label: '入場放大倍率', type: 'range', min: 1, max: 5, step: 0.1, default: 2.8 },
    { key: 'squash', label: '壓扁程度', type: 'range', min: 0, max: 0.6, step: 0.02, default: 0.38 },
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.5, max: 4, step: 0.1, default: 1.6, unit: 's' },
  ],
  recipe: {
    enter: '字依節拍逐一從放大狀態（power3.in）撞入定位，間隔可調。',
    motion: '撞擊時以字底為原點壓扁，再以衰減振盪回彈；落點噴出塵線、基線向右延伸；最後一字落定後整行字距以 easeInOut 收回。',
    hold: '完整文字以穩定字距停留（預設 1.6s）。',
    exit: '字依同樣順序以 power2.in 掉出畫面下緣，基線由右向左收回。',
    loop: '清空後重新開始；關閉循環時停在完整文字。',
  },
  accept: [
    '字依序出現，前後字之間有明確時間差，且每個字撞擊時被壓扁再回彈。',
    '全部字落定後字距明顯收窄到穩定狀態，再停留閱讀。',
    '入場放大倍率 = 1 時只剩壓扁回彈，沒有放大。',
    '長文字與多行文字不會超出畫面。',
  ],
  transparent: true,
  cycle: 6,
  posterTime: 3.4,
  legacyIds: ['letter-sequence'],
  create(ctx) {
    const { width: W, height: H } = ctx;
    const k = clamp(ctx.s.intensity, 0, 2);
    const sq = num(ctx, 'squash', 0.38) * Math.min(1.4, k);
    const Z = num(ctx, 'zoom', 2.8);
    const hold = num(ctx, 'hold', 1.6);
    const L = layoutText(ctx, ctx.text, { maxWidth: W * 0.78, maxHeight: H * 0.5, lineHeight: 1.4 });
    const fs = L.fontSize;
    const chars = L.chars;
    const n = chars.length;
    const beat = Math.min(num(ctx, 'beat', 0.16), 3.2 / Math.max(1, n));
    const fall = 0.42;
    const t0 = 0.12;
    const lands = chars.map((_, i) => t0 + i * beat + fall);
    const lastLand = lands[n - 1] ?? 0.6;
    const settle = lastLand + 0.9;
    const exit = settle + hold;
    const exitStag = Math.min(0.05, 0.9 / Math.max(1, n));
    const cycle = exit + (n - 1) * exitStag + 0.4 + 0.35;
    const spMax = Math.max(1, Math.min(1 + 0.3 * Math.max(0.3, k), (W * 0.95) / Math.max(1, L.width)));
    const cx0 = W / 2;
    const foot = fs * 0.42;
    const thick = Math.max(2, fs * 0.05);
    const lines = L.lines.map((line) => {
      const vis = line.glyphs.filter((g) => !g.space);
      return { a: vis.length ? vis[0].x : L.x, b: vis.length ? vis[vis.length - 1].x + vis[vis.length - 1].w : L.x + L.width, y: line.cy + fs * 0.58 };
    });

    return canvasRuntime(
      ctx,
      (g, time) => {
        const t = mod(time, cycle);
        const sp = 1 + (spMax - 1) * (1 - easeInOut(seg(t, lastLand + 0.12, 0.65)));
        const X = (x: number) => cx0 + (x - cx0) * sp;
        // baseline rules: grow with the landed glyphs, retract right→left on exit
        lines.forEach((ln, li) => {
          let right = -Infinity;
          chars.forEach((c, i) => {
            if (c.line === li && t >= lands[i]) right = Math.max(right, X(c.x + c.w) + fs * 0.1);
          });
          if (right === -Infinity) return;
          const left = X(ln.a) - fs * 0.1;
          const ex = seg(t, exit + 0.1, 0.35);
          const r2 = right - (right - left) * ex * ex;
          if (r2 <= left) return;
          g.fillStyle = ctx.s.secondary;
          g.fillRect(left, ln.y, r2 - left, thick);
        });
        g.font = font(fs, L.family, L.weight);
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        chars.forEach((c, i) => {
          const land = lands[i];
          if (t < land - fall) return;
          const x = X(c.cx);
          let y = c.cy + foot; // foot = transform origin
          let sx = 1;
          let sy = 1;
          let alpha = 1;
          if (t < land) {
            const u = (t - (land - fall)) / fall;
            const z = 1 + (Z - 1) * (1 - u * u * u);
            sx = sy = z;
            y -= fs * 0.5 * (1 - u * u * u) * Math.min(1, k);
            alpha = clamp(u * 3, 0, 1);
          } else {
            const tau = t - land;
            const d = tau < 0.07 ? sq * (tau / 0.07) : sq * damp(tau - 0.07, 2.6, 5.5);
            sy = 1 - d;
            sx = 1 + 0.75 * d;
          }
          const ex = t - (exit + i * exitStag);
          if (ex > 0) {
            const u = clamp(ex / 0.4, 0, 1);
            y += (H - c.cy + fs * 1.2) * u * u;
            sy *= 1 + 0.15 * u;
            sx *= 1 - 0.1 * u;
          }
          const col = t < land ? ctx.s.accent : mix(ctx.s.accent, ctx.s.primary, seg(t, land, 0.35));
          g.save();
          g.globalAlpha = alpha;
          g.translate(x, y);
          g.scale(sx, sy);
          g.fillStyle = col;
          g.fillText(c.ch, 0, -foot);
          g.restore();
          // dust
          const dt = t - land;
          if (dt > 0 && dt < 0.42 && sq > 0) {
            const u = dt / 0.42;
            const e = 1 - (1 - u) * (1 - u);
            g.fillStyle = rgba(ctx.s.secondary, 1 - u);
            for (const side of [-1, 1]) {
              const dw = fs * 0.16 * (0.3 + 0.7 * e);
              const dx = x + side * (c.w * 0.42 + fs * 0.38 * e);
              g.fillRect(dx - dw / 2, c.cy + fs * 0.46 - fs * 0.1 * e, dw, Math.max(1.5, fs * 0.035));
            }
          }
        });
      },
      { settle },
    );
  },
});
