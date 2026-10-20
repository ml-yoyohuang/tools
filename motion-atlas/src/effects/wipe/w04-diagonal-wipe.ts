import { defineEffect } from '../../engine/define';
import { canvasRuntime, ease, minSide, num, rgba } from '../../engine/helpers';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { dirVec, extent, frontLine, halfPlane } from './_util';

export default defineEffect({
  id: 'diagonal-wipe',
  code: 'W04',
  nameZh: '斜角擦拭',
  nameEn: 'Diagonal Wipe',
  category: 'wipe',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '一道傾斜的邊界帶著數條平行細線斜掃過畫面，斜線後方換成新場景。',
  tags: ['擦拭', '斜角', '遮罩', '速度感', 'diagonal'],
  suitable: ['運動／速度主題', '促銷切換', '片頭轉場'],
  principle:
    'Canvas 2D clip：把方向向量旋轉角度 α 得到邊界法向量 n = R(α)·dir，邊界為直線 {p·n = front}，front 在四角投影範圍外側之間以 power4.inOut 推進，半平面 {p·n < front} 內畫新場景。邊界前方畫 k 條平行導引細線（間距固定、線寬與透明度遞減），與邊界一起移動。',
  defaultText: '斜切／SLASH',
  palette: 'PASTEL',
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent'],
  directions: ['right', 'left', 'down', 'up'],
  textHint: '「／」前為 A 場景文字，後為 B 場景文字。',
  params: [
    ...TRANSITION_PARAMS,
    { key: 'angle', label: '傾斜角度', type: 'range', min: 10, max: 70, step: 1, default: 32, unit: '°' },
    { key: 'lead', label: '導引細線', type: 'range', min: 0, max: 4, step: 1, default: 3 },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '斜向邊界以 power4.inOut（起步慢、中段衝刺）掃過，前方的平行細線像速度線一樣領先。',
    hold: 'B 完整停留，細線全部掃出畫面。',
    exit: '同方向再斜掃一次換回 A。',
    loop: 'A → B → A。',
  },
  accept: [
    '轉場中的邊界為斜線，不與畫面邊緣平行。',
    '調整傾斜角度，斜線斜率明顯改變。',
    '導引細線數量可設 0–4，並與邊界平行同速移動。',
    '轉場開始與結束時不殘留細線或另一場景。',
  ],
  cycle: 4.4,
  posterTime: 1.7,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const [dx, dy] = dirVec(ctx.dir);
    const a = (num(ctx, 'angle', 32) * Math.PI) / 180;
    const nx = dx * Math.cos(a) - dy * Math.sin(a);
    const ny = dx * Math.sin(a) + dy * Math.cos(a);
    const [lo, hi] = extent(w, h, nx, ny);
    const lead = Math.round(num(ctx, 'lead', 3));
    const m = minSide(ctx);
    const gap = m * 0.055;
    const ew = Math.max(2, m * 0.012);
    const extra = (lead + 1) * gap + ew;
    const L = (w + h) * 2;
    const easing = ease('power4.inOut');
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, easing);
      sc.draw(g, tr.from);
      if (tr.p <= 0) return;
      const front = lo - extra + tr.e * (hi - lo + extra * 2);
      g.save();
      g.beginPath();
      halfPlane(g, nx, ny, front, L);
      g.clip();
      sc.draw(g, tr.to);
      g.restore();
      if (tr.p >= 1) return;
      g.lineCap = 'butt';
      g.strokeStyle = ctx.s.accent;
      g.lineWidth = ew;
      g.beginPath();
      frontLine(g, nx, ny, front, L);
      g.stroke();
      for (let k = 1; k <= lead; k++) {
        g.strokeStyle = rgba(ctx.s.accent, 0.85 - k * 0.17);
        g.lineWidth = Math.max(1, ew * (1 - k * 0.2));
        g.beginPath();
        frontLine(g, nx, ny, front + gap * k, L);
        g.stroke();
      }
    });
  },
});
