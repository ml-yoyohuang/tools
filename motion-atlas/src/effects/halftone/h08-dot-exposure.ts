import { defineEffect } from '../../engine/define';
import { layoutMask, offscreen } from '../../engine/canvas';
import { canvasRuntime, clamp, easeInOut, easeOutBack, minSide, num, phase, str } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { starPts, pathPts } from '../../engine/shapes';
import { layoutText } from '../../engine/text';
import { capSpacing, coverageSampler, DotBatch } from './_util';

const EXPOSE = 2.8;
const HOLD = 1.8;
const FADE = 0.9;
const GAP = 0.35;

export default defineEffect({
  id: 'dot-exposure',
  code: 'H08',
  nameZh: '點陣曝光',
  nameEn: 'Dot Exposure',
  category: 'halftone',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '網點像底片顯影一樣由稀疏到密集逐顆出現，最後拼出自訂文字或簡單形狀，停留後再散去。',
  tags: ['曝光', '顯影', '遮罩', '文字', '半色調'],
  suitable: ['品牌標語揭示', '片頭標題', '活動倒數畫面'],
  principle:
    'Canvas 2D：建立時把文字（實際字形，layoutText + layoutMask）或形狀畫到離屏遮罩，只讀一次 getImageData，求每個網格點周圍 3×3 取樣的覆蓋率 c。每點有 seeded 門檻 h；曝光量 e(t) 以 ease-in-out 由 0→1，點在 e > h 時以 easeOutBack 彈出，半徑 = c·max。遮罩內門檻壓低（較早出現），遮罩外只保留 18% 的點且為細小次色雜點，因此畫面由稀疏雜點逐漸變密並顯出字形；離場時依反向門檻縮小。',
  defaultText: 'EXPOSE',
  palette: 'MONO',
  controls: ['text', 'font', 'weight', 'scale', 'secondary', 'seed'],
  maxChars: 24,
  textHint: '短詞效果最好；長字串會自動縮小並提高點密度。',
  params: [
    { key: 'res', label: '網點解析度（每字高點數）', type: 'range', min: 6, max: 20, step: 1, default: 12 },
    {
      key: 'shape',
      label: '遮罩來源',
      type: 'select',
      default: 'text',
      options: [
        { value: 'text', label: '文字' },
        { value: 'circle', label: '圓形' },
        { value: 'star', label: '星形' },
      ],
    },
    { key: 'noise', label: '背景雜點', type: 'range', min: 0, max: 0.5, step: 0.02, default: 0.18 },
  ],
  recipe: {
    enter: '空白畫面中隨機冒出零星網點。',
    motion: '曝光量以 ease-in-out 上升 2.8 秒，網點依門檻逐顆以 easeOutBack 彈出，由稀疏變密集，字形逐漸成形。',
    hold: '完整字形停留 1.8 秒。',
    exit: '網點依反向順序在 0.9 秒內縮回消失。',
    loop: '短暫空白後重新曝光。',
  },
  accept: [
    '開始時只有稀疏點，結尾時字形由密集網點清楚構成。',
    '網點大小跟隨字形邊緣覆蓋率（邊緣點較小）。',
    '更換文字、字體或遮罩形狀後顯出的內容隨之改變。',
    '停留時文字可讀，背景只有少量細點。',
  ],
  transparent: true,
  loopable: true,
  posterTime: EXPOSE + 0.8,
  cycle: EXPOSE + HOLD + FADE + GAP,
  create(ctx) {
    const res = num(ctx, 'res', 12);
    const shape = str(ctx, 'shape', 'text');
    const noise = num(ctx, 'noise', 0.18);
    const W = ctx.width;
    const H = ctx.height;
    let mask: { canvas: HTMLCanvasElement; g: CanvasRenderingContext2D };
    let unit: number;
    if (shape === 'text') {
      const layout = layoutText(ctx, ctx.text, { maxHeight: H * 0.62, maxWidth: W * 0.88, lineHeight: 1.1 });
      mask = layoutMask(ctx, layout);
      unit = layout.fontSize;
    } else {
      mask = offscreen(W, H);
      const R = minSide(ctx) * 0.36 * ctx.s.scale;
      mask.g.fillStyle = '#fff';
      mask.g.beginPath();
      if (shape === 'star') pathPts(mask.g, starPts(W / 2, H / 2, R, 0.46, 5));
      else mask.g.arc(W / 2, H / 2, R, 0, Math.PI * 2);
      mask.g.fill();
      unit = R * 0.9;
    }
    const spacing = capSpacing(ctx, Math.max(4, unit / res), 5000 * ctx.q);
    const cover = coverageSampler(mask);
    mask.canvas.width = mask.canvas.height = 0;
    const cols = Math.ceil(W / spacing) + 1;
    const rows = Math.ceil(H / spacing) + 1;
    const ox = (W - (cols - 1) * spacing) / 2;
    const oy = (H - (rows - 1) * spacing) / 2;
    const xs: number[] = [];
    const ys: number[] = [];
    const cov: number[] = [];
    const thr: number[] = [];
    const inside: boolean[] = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const x = ox + i * spacing;
        const y = oy + j * spacing;
        const c = cover(x, y, spacing / 2);
        const h = hash2(i, j, ctx.seed);
        if (c > 0.04) {
          xs.push(x);
          ys.push(y);
          cov.push(c);
          inside.push(true);
          thr.push(h * 0.82);
        } else if (h < noise) {
          xs.push(x);
          ys.push(y);
          cov.push(0);
          inside.push(false);
          thr.push(h / Math.max(noise, 0.001) * 0.9);
        }
      }
    const N = xs.length;
    const maxR = spacing * 0.54;
    const noiseR = spacing * 0.13;
    const POP = 0.16;
    return canvasRuntime(ctx, (g, t) => {
      const ph = phase(t, [EXPOSE, HOLD, FADE, GAP]);
      // exposure 0..1 (slightly > 1 so the last dots finish popping)
      let e: number;
      let fade = 0;
      if (ph.i === 0) e = easeInOut(ph.p) * (1 + POP);
      else if (ph.i === 1) e = 1 + POP;
      else if (ph.i === 2) {
        e = 1 + POP;
        fade = ph.p;
      } else e = 0;
      const a = new DotBatch(g);
      const b = new DotBatch(g);
      a.begin();
      b.begin();
      for (let k = 0; k < N; k++) {
        let s = clamp((e - thr[k]) / POP, 0, 1);
        if (fade > 0) s = Math.min(s, clamp((1 - thr[k] - fade * 1.2) / 0.2 + 1, 0, 1));
        if (s <= 0) continue;
        const pop = easeOutBack(s, 2);
        if (inside[k]) a.dot(xs[k], ys[k], maxR * (0.25 + 0.75 * Math.sqrt(cov[k])) * pop);
        else b.dot(xs[k], ys[k], noiseR * pop);
      }
      b.fill(ctx.s.secondary);
      a.fill(ctx.s.primary);
    }, { settle: EXPOSE + 0.4 });
  },
});
