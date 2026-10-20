import { defineEffect } from '../../engine/define';
import { stageSvg, svgEl } from '../../engine/dom';
import { bool, clamp, damp, ease, minSide, num, phase } from '../../engine/helpers';
import { fitSize, phrases } from '../../engine/text';

export default defineEffect({
  id: 'comic-burst',
  code: 'C01',
  nameZh: '漫畫爆炸框',
  nameEn: 'Comic Burst',
  category: 'comic',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'svg',
  description: '鋸齒爆炸框以過衝彈出，中央短詞稍晚撞進定位並短暫震動。',
  tags: ['漫畫', '爆炸框', '彈出', '擬聲', 'burst'],
  suitable: ['促銷標語', '社群貼文', '遊戲提示'],
  principle:
    'SVG：以 seed 產生半徑交錯的鋸齒星形 polygon（外框 + 內框 + 偏移陰影三層），scale 使用 back.out 過衝；文字延遲 0.12 秒以 expo.out 由大縮回，落定時套用指數衰減的位移震動。',
  defaultText: 'BOOM!／哇！',
  palette: 'POP',
  colors: { background: '#FFE35A', primary: '#E63A2E', secondary: '#141414', accent: '#FFFFFF' },
  controls: ['text', 'font', 'weight', 'intensity', 'scale', 'secondary', 'accent', 'seed'],
  textHint: '用「／」分隔多個短詞，會輪流彈出。建議 2～6 個字。',
  maxChars: 24,
  params: [
    { key: 'spikes', label: '尖角數', type: 'range', min: 8, max: 28, step: 1, default: 16 },
    { key: 'jag', label: '鋸齒深度', type: 'range', min: 0.15, max: 0.6, step: 0.05, default: 0.34 },
    { key: 'hold', label: '停留時間', type: 'range', min: 0.4, max: 3, step: 0.1, default: 1.2, unit: 's' },
    { key: 'shadow', label: '偏移陰影', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '爆炸框從 0 以 back.out(2.2) 過衝放大到約 110% 後回到 100%，同時小幅旋轉。',
    motion: '文字晚 0.12 秒從 180% 撞入定位，落定瞬間做 3～4 次快速衰減的震動。',
    hold: '畫面穩定停留，方便閱讀。',
    exit: '框與文字一起以 power3.in 縮小消失。',
    loop: '換下一個詞，鋸齒形狀依 seed 改變。',
  },
  accept: [
    '爆炸框邊緣為不規則鋸齒，且每個詞的鋸齒形狀不同。',
    '文字比框晚出現，落定時有短暫震動後靜止。',
    '停留期間畫面完全靜止，可清楚閱讀。',
    '強度為 0 時沒有震動。',
  ],
  transparent: true,
  cycle: 4.4,
  posterTime: 1.1,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const words = phrases(ctx.text);
    const spikes = Math.round(num(ctx, 'spikes', 16));
    const jag = num(ctx, 'jag', 0.34);
    const hold = num(ctx, 'hold', 1.2);
    const shadow = bool(ctx, 'shadow', true);
    const R = minSide(ctx) * 0.42 * ctx.s.scale;
    const cx = w / 2;
    const cy = h / 2;
    // per-word seeded burst shapes (computed once; never re-randomised during render)
    const shapes = words.map(() => {
      const pts: string[] = [];
      for (let i = 0; i < spikes * 2; i++) {
        const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
        const outer = i % 2 === 0;
        const rr = outer ? 1 - ctx.rand() * 0.12 : 1 - jag - ctx.rand() * 0.08;
        const sx = w > h ? 1.25 : 1;
        pts.push(`${(Math.cos(a) * rr * sx).toFixed(4)},${(Math.sin(a) * rr).toFixed(4)}`);
      }
      return pts.join(' ');
    });
    const svg = stageSvg(ctx.root, w, h);
    const group = svgEl('g', {}, svg);
    const shadowPoly = svgEl('polygon', { fill: ctx.s.secondary }, group);
    const outerPoly = svgEl('polygon', { fill: ctx.s.primary, stroke: ctx.s.secondary, 'stroke-width': 0.025, 'stroke-linejoin': 'round' }, group);
    const innerPoly = svgEl('polygon', { fill: ctx.s.accent }, group);
    const text = svgEl(
      'text',
      { x: 0, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: ctx.s.secondary, 'font-family': ctx.family, 'font-weight': ctx.weight },
      svg,
    );
    const sizes = words.map((wd) => fitSize(wd, R * 1.15, R * 0.5, ctx.family, ctx.weight, ctx.s.tracking));
    const pop = ease('back.out(2.2)');
    const outE = ease('power3.in');
    const inE = ease('expo.out');
    const durs = words.flatMap(() => [0.5, hold, 0.35]);
    let lastWord = -1;
    return {
      svg,
      render(t) {
        const ph = phase(t, durs);
        const wi = Math.floor(ph.i / 3);
        const seg = ph.i % 3;
        if (wi !== lastWord) {
          lastWord = wi;
          [shadowPoly, outerPoly].forEach((p) => p.setAttribute('points', shapes[wi]));
          innerPoly.setAttribute('points', shapes[wi]);
          text.textContent = words[wi];
          text.setAttribute('font-size', String(sizes[wi]));
          text.setAttribute('letter-spacing', `${ctx.s.tracking}em`);
        }
        const local = seg === 0 ? ph.p * 0.5 : seg === 1 ? 0.5 + ph.p * hold : 0;
        let s = 1;
        if (seg === 0) s = pop(ph.p);
        else if (seg === 2) s = 1 - outE(ph.p);
        const rot = seg === 0 ? (1 - ph.p) * -14 : seg === 2 ? ph.p * 8 : 0;
        group.setAttribute('transform', `translate(${cx} ${cy}) rotate(${rot.toFixed(2)}) scale(${(s * R).toFixed(3)})`);
        shadowPoly.setAttribute('transform', shadow ? 'translate(0.05 0.06)' : 'scale(0)');
        innerPoly.setAttribute('transform', 'scale(0.78)');
        // text: delayed slam + decaying shake
        const tt = seg === 2 ? 1 : clamp((local - 0.12) / 0.28, 0, 1);
        const ts = seg === 2 ? s : tt <= 0 ? 0 : 1 + (1 - inE(tt)) * 0.8;
        const since = local - 0.4;
        const shake = since > 0 && seg !== 2 ? damp(since, 9, 9) * R * 0.04 * ctx.s.intensity : 0;
        text.setAttribute('transform', `translate(${(cx + shake).toFixed(2)} ${(cy - shake * 0.5).toFixed(2)}) scale(${ts.toFixed(3)})`);
        text.setAttribute('opacity', tt > 0 || seg === 2 ? '1' : '0');
      },
    };
  },
});
