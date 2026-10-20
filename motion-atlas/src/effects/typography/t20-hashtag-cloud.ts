import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, easeInOut, minSide, mod, num, rgba, TAU } from '../../engine/helpers';
import { phrases } from '../../engine/text';
import { drawTracked, font, rrect, strWidth } from './_t14kit';

// Seeded word-cloud layout computed once in create(): tags sorted by size are placed
// along an Archimedean spiral (aspect-corrected) at the first spot whose padded box
// does not intersect any placed tag. Every frame the tags float on sine paths whose
// frequencies are whole multiples of 1/cycle (seamless loop). A seeded subset turns
// into cards: scaleX = |cos θ| flip, swapping to the card face at θ = 90°.

interface Tag {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fs: number;
  weight: number;
  tier: 0 | 1 | 2;
  fx: number;
  fy: number;
  px: number;
  py: number;
  card: boolean;
  off: number;
}

export default defineEffect({
  id: 'hashtag-cloud',
  code: 'T20',
  nameZh: '標籤雲',
  nameEn: 'Hashtag Cloud',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '大小不同的 hashtag 以固定 seed 排成標籤雲緩慢漂浮，其中幾個輪流翻面成字卡再翻回。',
  tags: ['hashtag', '標籤雲', '字卡', '漂浮', 'word cloud'],
  suitable: ['社群活動', '關鍵字總覽', '直播背景'],
  principle:
    'Canvas 2D：create 時依 seed 決定每個標籤的大小級距（大／中／小），由大到小沿阿基米德螺線 r = a·θ 搜尋第一個不與既有標籤（含間距）重疊、且在舞台內的位置，布局固定。每幀以 sin(2π·n·t/週期) 漂浮（n 為整數 → 無縫循環）。被選為字卡的標籤依各自偏移時間翻面：scaleX = |cos θ|，θ 過 90° 時換成實心字卡面，停留後翻回。',
  defaultText: 'MOTION／DESIGN／動效／TYPE／ATLAS／LOOP',
  palette: 'POP',
  colors: { background: '#F2E8D5', primary: '#3450FF', secondary: '#ED589A', accent: '#141414' },
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'secondary', 'accent', 'seed'],
  maxChars: 60,
  textHint: '用「／」分隔關鍵字，會自動加上 #，並重複填滿標籤雲。',
  params: [
    { key: 'count', label: '標籤數量', type: 'range', min: 6, max: 32, step: 1, default: 18 },
    { key: 'cards', label: '字卡比例', type: 'range', min: 0, max: 0.6, step: 0.05, default: 0.3 },
    { key: 'float', label: '漂浮幅度', type: 'range', min: 0, max: 2, step: 0.1, default: 1 },
    { key: 'contrast', label: '大小差異', type: 'range', min: 0.3, max: 1, step: 0.05, default: 0.75 },
  ],
  recipe: {
    enter: '標籤雲已排好（seed 固定布局），所有標籤可見。',
    motion: '每個標籤以各自頻率與相位緩慢漂浮；字卡標籤以 easeInOut 翻面（0.5s），翻到一半換成實心字卡。',
    hold: '字卡面停留約 2s，標籤面停留其餘時間，任何時刻大部分標籤可讀。',
    exit: '字卡翻回標籤面。',
    loop: '漂浮頻率與翻面排程都以 8 秒為週期，無縫循環。',
  },
  accept: [
    '標籤大小明顯不同且互不重疊。',
    '同一 seed 重新整理後布局完全相同；更換 seed 後布局改變。',
    '可看到部分標籤以水平翻轉變成實心字卡再翻回。',
    '字卡比例 0 時沒有任何翻面。',
  ],
  transparent: true,
  cycle: 8,
  posterTime: 1.6,
  create(ctx) {
    const { width: W, height: H } = ctx;
    const CYCLE = 8;
    const m = minSide(ctx);
    const count = Math.max(4, Math.round(num(ctx, 'count', 18) * (0.6 + 0.4 * ctx.q)));
    const cardRatio = num(ctx, 'cards', 0.3);
    const floatAmp = num(ctx, 'float', 1) * clamp(ctx.s.intensity, 0, 2);
    const contrast = num(ctx, 'contrast', 0.75);
    const words = phrases(ctx.text).map((p) => (p.startsWith('#') || p.startsWith('＃') ? p : '#' + p.replace(/\s+/g, '')));
    const tr = ctx.s.tracking;
    const big = m * 0.13 * ctx.s.scale;
    const sizes = [big, big * (1 - contrast * 0.45), big * (1 - contrast * 0.68)];
    const maxW = W * 0.9;

    // candidates: first pass gives every word one large/medium slot, the rest random tiers
    const cands = Array.from({ length: count }, (_, i) => {
      const r = ctx.rand();
      const tier: 0 | 1 | 2 = i < Math.min(2, words.length) ? 0 : r < 0.12 ? 0 : r < 0.45 ? 1 : 2;
      return { text: words[i % words.length], tier, order: ctx.rand() };
    }).sort((a, b) => a.tier - b.tier || a.order - b.order);

    const placed: Tag[] = [];
    const padX = m * 0.018;
    const padY = m * 0.01;
    const hit = (x: number, y: number, w: number, h: number) =>
      x - w / 2 < m * 0.03 ||
      x + w / 2 > W - m * 0.03 ||
      y - h / 2 < m * 0.04 ||
      y + h / 2 > H - m * 0.04 ||
      placed.some((p) => Math.abs(p.x - x) * 2 < p.w + w + padX * 2 && Math.abs(p.y - y) * 2 < p.h + h + padY * 2);
    const aspect = W / H;
    for (const c of cands) {
      const weight = c.tier === 0 ? ctx.weight : Math.min(ctx.weight, c.tier === 1 ? 800 : 600);
      let fs = sizes[c.tier];
      let w = strWidth(c.text, fs, ctx.family, weight, tr);
      if (w > maxW) {
        fs *= maxW / w;
        w = maxW;
      }
      const h = fs * 1.15;
      const a0 = ctx.rand() * TAU;
      const stepA = 0.35;
      const grow = m * 0.006;
      let ok = false;
      for (let s = 0; s < 900 && !ok; s++) {
        const th = a0 + s * stepA;
        const r = grow * s * 0.35;
        const x = W / 2 + Math.cos(th) * r * Math.sqrt(aspect);
        const y = H / 2 + Math.sin(th) * r / Math.sqrt(aspect);
        if (r > Math.max(W, H)) break;
        if (!hit(x, y, w + fs * 0.5, h)) {
          placed.push({
            text: c.text,
            x,
            y,
            w,
            h,
            fs,
            weight,
            tier: c.tier,
            fx: 1 + Math.floor(ctx.rand() * 2),
            fy: 1 + Math.floor(ctx.rand() * 2),
            px: ctx.rand() * TAU,
            py: ctx.rand() * TAU,
            card: false,
            off: 0,
          });
          ok = true;
        }
      }
    }
    // pick card tags (seeded) and spread their flip times over the cycle
    const idx = placed.map((_, i) => i).sort((a, b) => placed[a].px - placed[b].px);
    const nCards = Math.round(placed.length * cardRatio);
    idx.slice(0, nCards).forEach((i, j) => {
      placed[i].card = true;
      placed[i].off = (j / Math.max(1, nCards)) * CYCLE + ctx.rand() * 0.4;
    });
    const FLIP = 0.5;
    const SHOW = 2.1;
    const colors = [ctx.s.primary, ctx.s.secondary, ctx.s.accent];

    return canvasRuntime(ctx, (g, t) => {
      const amp = m * 0.014 * floatAmp;
      for (const tag of placed) {
        const x = tag.x + amp * Math.sin((TAU * tag.fx * t) / CYCLE + tag.px);
        const y = tag.y + amp * 0.8 * Math.sin((TAU * tag.fy * t) / CYCLE + tag.py);
        // flip angle 0 → π (card) → 0
        let th = 0;
        if (tag.card) {
          const u = mod(t - tag.off, CYCLE);
          if (u < FLIP) th = Math.PI * easeInOut(u / FLIP);
          else if (u < FLIP + SHOW) th = Math.PI;
          else if (u < FLIP * 2 + SHOW) th = Math.PI * (1 - easeInOut((u - FLIP - SHOW) / FLIP));
        }
        const sx = Math.abs(Math.cos(th));
        const cardFace = th > Math.PI / 2;
        g.save();
        g.translate(x, y - Math.sin(th) * tag.h * 0.12);
        g.scale(Math.max(0.001, sx), 1);
        g.font = font(tag.fs, ctx.family, tag.weight);
        if (cardFace) {
          const cw = tag.w + tag.fs * 0.9;
          const ch = tag.h * 1.25;
          g.fillStyle = ctx.s.secondary;
          rrect(g, -cw / 2, -ch / 2, cw, ch, ch * 0.22);
          g.fill();
          g.fillStyle = ctx.s.accent;
          drawTracked(g, tag.text, 0, tag.fs * 0.04, tag.fs, ctx.family, tag.weight, tr, 'center');
        } else {
          g.fillStyle = tag.tier === 2 ? rgba(colors[2], 0.78) : colors[tag.tier];
          drawTracked(g, tag.text, 0, tag.fs * 0.04, tag.fs, ctx.family, tag.weight, tr, 'center');
          if (tag.card && th > 0) {
            // thin edge so the flip reads as a card turning
            g.strokeStyle = rgba(ctx.s.secondary, Math.sin(th));
            g.lineWidth = 2;
            rrect(g, -(tag.w + tag.fs * 0.9) / 2, -tag.h * 0.625, tag.w + tag.fs * 0.9, tag.h * 1.25, tag.h * 0.27);
            g.stroke();
          }
        }
        g.restore();
      }
    });
  },
});
