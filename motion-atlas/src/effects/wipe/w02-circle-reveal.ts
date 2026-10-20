import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, ease, minSide, num, TAU } from '../../engine/helpers';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { farCorner } from './_util';

export default defineEffect({
  id: 'circle-reveal',
  code: 'W02',
  nameZh: '圓形揭露',
  nameEn: 'Circle Reveal',
  category: 'wipe',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '圓形遮罩從指定中心擴大，圓內就是新場景；可反轉為舊場景縮成圓點消失。',
  tags: ['擦拭', '圓形', '遮罩', '聚焦', 'iris'],
  suitable: ['焦點揭露', '角色登場', '章節開場'],
  principle:
    'Canvas 2D clip：中心 c = (cx%, cy%)，最大半徑 R = 中心到最遠角點的距離 + 環線寬。半徑 r = e·R（expo.inOut），以 arc(c, r) 為 clip 畫新場景；反轉模式先畫新場景，再以 r = (1 − e)·R 的圓 clip 畫舊場景，讓舊場景縮成圓點消失。邊緣描 accent 環。',
  defaultText: 'FOCUS／聚焦',
  palette: 'POP',
  controls: ['text', 'font', 'weight', 'secondary', 'accent'],
  textHint: '「／」前為 A 場景文字，後為 B 場景文字。',
  params: [
    ...TRANSITION_PARAMS,
    { key: 'cx', label: '中心 X', type: 'range', min: 0, max: 100, step: 1, default: 66, unit: '%' },
    { key: 'cy', label: '中心 Y', type: 'range', min: 0, max: 100, step: 1, default: 40, unit: '%' },
    { key: 'ring', label: '環線粗細', type: 'range', min: 0, max: 14, step: 1, default: 5, unit: 'px' },
    { key: 'inverse', label: '反轉（舊場景縮小）', type: 'toggle', default: false },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '圓形遮罩自中心以 expo.inOut 擴大（起步極慢、中段快速、收尾放緩），環線跟著邊緣走。',
    hold: 'B 完整停留，圓已超出畫面四角。',
    exit: '同一中心再擴大一次，換回 A。',
    loop: 'A → B → A。',
  },
  accept: [
    '轉場中可看到一個以指定中心擴大的正圓，圓內為新場景、圓外為舊場景。',
    '調整中心 X／Y，圓的起點跟著移動；中心放在角落時仍能完整覆蓋畫面。',
    '開啟反轉時改為舊場景收縮成圓並消失。',
    '環線粗細為 0 時沒有描邊。',
  ],
  cycle: 4.4,
  posterTime: 1.75,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const cx = (num(ctx, 'cx', 66) / 100) * w;
    const cy = (num(ctx, 'cy', 40) / 100) * h;
    const rw = num(ctx, 'ring', 5) * Math.max(0.5, minSide(ctx) / 500);
    const inverse = bool(ctx, 'inverse', false);
    const R = farCorner(cx, cy, w, h) + rw + 2;
    const easing = ease('expo.inOut');
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, easing);
      if (tr.p <= 0) {
        sc.draw(g, tr.from);
        return;
      }
      // normal: B inside a growing circle; inverse: A inside a shrinking circle, B outside
      const r = inverse ? (1 - tr.e) * R : tr.e * R;
      const outside = inverse ? tr.to : tr.from;
      const inside = inverse ? tr.from : tr.to;
      sc.draw(g, outside);
      if (r > 0.5) {
        g.save();
        g.beginPath();
        g.arc(cx, cy, r, 0, TAU);
        g.clip();
        sc.draw(g, inside);
        g.restore();
      }
      if (rw > 0 && tr.p < 1 && r > 0.5) {
        g.strokeStyle = ctx.s.accent;
        g.lineWidth = rw;
        g.beginPath();
        g.arc(cx, cy, r, 0, TAU);
        g.stroke();
        // thin echo ring trailing inside the edge
        g.globalAlpha = 0.45;
        g.lineWidth = Math.max(1, rw * 0.4);
        g.beginPath();
        g.arc(cx, cy, Math.max(0, r - rw * 3.2), 0, TAU);
        g.stroke();
        g.globalAlpha = 1;
      }
    });
  },
});
