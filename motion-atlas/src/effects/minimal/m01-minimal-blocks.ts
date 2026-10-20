import { defineEffect } from '../../engine/define';
import { el } from '../../engine/dom';
import { minSide, num, timelineRuntime } from '../../engine/helpers';

// Layouts on a 4×3 grid: [col, row, colSpan, rowSpan] per block.
type Cell = [number, number, number, number];
const LAYOUTS: Cell[][] = [
  [[0, 0, 2, 2], [2, 0, 1, 1], [3, 0, 1, 2], [2, 1, 1, 1], [0, 2, 3, 1], [3, 2, 1, 1]],
  [[2, 0, 2, 2], [0, 0, 1, 1], [0, 1, 1, 2], [1, 0, 1, 1], [1, 2, 3, 1], [1, 1, 1, 1]],
  [[1, 1, 2, 2], [0, 0, 1, 1], [3, 0, 1, 3], [0, 1, 1, 2], [1, 0, 2, 1], [3, 0, 1, 1]],
  [[0, 1, 2, 2], [3, 2, 1, 1], [2, 0, 1, 2], [3, 0, 1, 2], [0, 0, 2, 1], [2, 2, 1, 1]],
];

export default defineEffect({
  id: 'minimal-blocks',
  code: 'M01',
  nameZh: '極簡色塊',
  nameEn: 'Minimal Blocks',
  category: 'minimal',
  sourceType: 'partial-reference',
  difficulty: 'beginner',
  renderer: 'dom',
  description: '少量色塊在 4×3 規律網格中交換位置與大小，每次移位後安靜停頓。',
  tags: ['極簡', '色塊', '版面', '網格', 'blocks'],
  suitable: ['品牌背景', '簡報封面', '作品集轉場'],
  principle:
    'DOM + GSAP timeline：色塊以 absolute 定位在 4×3 網格上，預先定義 4 組版面；timeline 以 power3.inOut 補間 left/top/width/height 到下一組版面，色塊間以 stagger 錯開，每組之後插入停頓。播放器以 totalTime 驅動 timeline。',
  defaultText: '',
  palette: 'MONO',
  colors: { background: '#F2E8D5', primary: '#141414', secondary: '#3450FF', accent: '#E63A2E' },
  controls: ['secondary', 'accent', 'intensity'],
  params: [
    { key: 'count', label: '色塊數量', type: 'range', min: 3, max: 6, step: 1, default: 5 },
    { key: 'gap', label: '間距', type: 'range', min: 0, max: 0.06, step: 0.005, default: 0.02 },
    { key: 'pause', label: '停頓時間', type: 'range', min: 0.2, max: 2.5, step: 0.1, default: 0.9, unit: 's' },
    { key: 'radius', label: '圓角', type: 'range', min: 0, max: 0.5, step: 0.05, default: 0.1 },
  ],
  recipe: {
    enter: '色塊在第一組版面就位。',
    motion: '色塊以 power3.inOut 移動並改變尺寸到下一組版面，彼此錯開 0.06 秒。',
    hold: '每組版面停頓（可調），留白是節奏的一部分。',
    exit: '第四組版面後回到第一組。',
    loop: '四組版面無縫循環。',
  },
  accept: [
    '色塊在網格內交換位置與大小，不互相重疊（間距 > 0 時）。',
    '每次移動後有明顯停頓。',
    '色塊數量調為 3 時只剩 3 塊。',
    '強度降低時移動更慢、更柔和。',
  ],
  limits: ['DOM renderer：PNG 以 SVG foreignObject 實驗性截取。'],
  cycle: 6.4,
  posterTime: 0.2,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const count = Math.round(num(ctx, 'count', 5));
    const gapR = num(ctx, 'gap', 0.02);
    const pause = num(ctx, 'pause', 0.9);
    const radius = num(ctx, 'radius', 0.1);
    const m = minSide(ctx);
    const pad = m * 0.08;
    const gap = m * gapR;
    const portrait = h > w;
    const cols = portrait ? 3 : 4;
    const rows = portrait ? 4 : 3;
    const cw = (w - pad * 2 + gap) / cols;
    const ch = (h - pad * 2 + gap) / rows;
    const colors = [ctx.s.primary, ctx.s.secondary, ctx.s.accent, ctx.s.primary, ctx.s.secondary, ctx.s.accent];
    const box = (c: Cell) => {
      // portrait: transpose the 4×3 layout to 3×4
      const [cc, rr, cs, rs] = portrait ? [c[1], c[0], c[3], c[2]] : c;
      return { left: pad + cc * cw, top: pad + rr * ch, width: cs * cw - gap, height: rs * ch - gap };
    };
    const blocks = Array.from({ length: count }, (_, i) =>
      el('div', { style: { position: 'absolute', background: colors[i], borderRadius: `${m * radius * 0.25}px`, ...px(box(LAYOUTS[0][i])) } }, ctx.root),
    );
    const moveDur = 0.9 / (0.5 + ctx.s.intensity * 0.5);
    return timelineRuntime(ctx, (tl) => {
      for (let li = 1; li <= LAYOUTS.length; li++) {
        const L = LAYOUTS[li % LAYOUTS.length];
        tl.to({}, { duration: pause });
        const at = tl.duration();
        blocks.forEach((b, i) => {
          tl.to(b, { ...box(L[i]), duration: moveDur, ease: 'power3.inOut' }, at + i * 0.06);
        });
      }
    });
  },
});

function px(b: { left: number; top: number; width: number; height: number }) {
  return { left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` };
}
