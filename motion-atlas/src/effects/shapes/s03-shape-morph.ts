import { defineEffect } from '../../engine/define';
import { stageSvg, svgEl } from '../../engine/dom';
import { bool, ease, minSide, num, phase } from '../../engine/helpers';
import { alignStart, circlePts, lerpPts, regularPoly, resample, starPts, type Pt } from '../../engine/shapes';

const N = 144;

export default defineEffect({
  id: 'shape-morph',
  code: 'S03',
  nameZh: '圖形變形',
  nameEn: 'Shape Morph',
  category: 'shapes',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'svg',
  description: '圓、方、三角、星形依序平滑變形，輪廓點一一對應不打結。',
  tags: ['morph', '變形', 'SVG', '幾何', '過渡'],
  suitable: ['Logo 動態', '狀態切換', '品牌圖形'],
  principle:
    'SVG path：每個形狀沿周長重新取樣成 144 個等距點，並把起點對齊到正上方，使頂點順序一致；每幀線性插值兩組點並寫回 path d，緩動使用 expo.inOut。',
  defaultText: '',
  palette: 'STREET',
  colors: { background: '#F2E8D5', primary: '#E63A2E', secondary: '#141414' },
  controls: ['scale', 'secondary', 'direction'],
  directions: ['cw', 'ccw'],
  params: [
    { key: 'morph', label: '變形時間', type: 'range', min: 0.3, max: 2.5, step: 0.1, default: 0.9, unit: 's' },
    { key: 'hold', label: '停留時間', type: 'range', min: 0.2, max: 2.5, step: 0.1, default: 0.8, unit: 's' },
    { key: 'spin', label: '變形時旋轉', type: 'range', min: 0, max: 180, step: 15, default: 90, unit: '°' },
    { key: 'ghost', label: '顯示下一個形狀輪廓', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '圓形已在畫面中央。',
    motion: '形狀以 expo.inOut 插值到下一個形狀，同時旋轉指定角度；輪廓在變形中始終是單一封閉路徑。',
    hold: '每個形狀完整停留，外側細線預告下一個形狀。',
    exit: '星形變回圓形，回到起點。',
    loop: '圓 → 方 → 三角 → 星 → 圓，無縫循環。',
  },
  accept: [
    '可依序辨認圓、方、三角、星四種形狀並各自停留。',
    '變形過程輪廓不自交、不翻轉。',
    '「變形時旋轉」為 0 時形狀只變形不旋轉。',
    '截取 PNG 後得到目前的形狀畫面。',
  ],
  transparent: true,
  cycle: 6.8,
  posterTime: 0.4,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const cx = w / 2;
    const cy = h / 2;
    const r = minSide(ctx) * 0.3 * ctx.s.scale;
    const morph = num(ctx, 'morph', 0.9);
    const hold = num(ctx, 'hold', 0.8);
    const spin = num(ctx, 'spin', 90) * ctx.dirSign;
    const ghost = bool(ctx, 'ghost', true);
    const shapes: Pt[][] = [
      circlePts(cx, cy, r, N),
      regularPoly(cx, cy, r * 1.05, 4, -Math.PI / 4),
      regularPoly(cx, cy + r * 0.12, r * 1.2, 3),
      starPts(cx, cy, r * 1.15, 0.45, 5),
    ].map((p) => alignStart(resample(p, N), cx, cy));
    const svg = stageSvg(ctx.root, w, h);
    const ghostPath = svgEl('path', { fill: 'none', stroke: ctx.s.secondary, 'stroke-width': Math.max(1, r * 0.012), 'stroke-dasharray': `${r * 0.04} ${r * 0.04}`, opacity: 0.5 }, svg);
    const path = svgEl('path', { fill: ctx.s.primary }, svg);
    const ex = ease('expo.inOut');
    const d = (pts: Pt[]) => 'M' + pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('L') + 'Z';
    const durs = shapes.flatMap(() => [hold, morph]);
    return {
      svg,
      render(t) {
        const ph = phase(t, durs);
        const si = Math.floor(ph.i / 2);
        const a = shapes[si];
        const b = shapes[(si + 1) % shapes.length];
        const morphing = ph.i % 2 === 1;
        const k = morphing ? ex(ph.p) : 0;
        const pts = lerpPts(a, b, k);
        const rot = (si + k) * spin;
        path.setAttribute('d', d(pts));
        path.setAttribute('transform', `rotate(${rot.toFixed(2)} ${cx} ${cy})`);
        ghostPath.style.display = ghost ? '' : 'none';
        if (ghost) {
          ghostPath.setAttribute('d', d(b.map((p) => [cx + (p[0] - cx) * 1.18, cy + (p[1] - cy) * 1.18] as Pt)));
          ghostPath.setAttribute('transform', `rotate(${((si + 1) * spin).toFixed(2)} ${cx} ${cy})`);
          ghostPath.setAttribute('opacity', String(morphing ? 0.5 * (1 - k) : 0.5));
        }
      },
    };
  },
});
