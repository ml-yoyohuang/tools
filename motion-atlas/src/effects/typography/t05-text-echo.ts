import { defineEffect } from '../../engine/define';
import { drawLayout } from '../../engine/canvas';
import { canvasRuntime, clamp, easeIn3, easeInOut, easeOut3, mod, num, TAU } from '../../engine/helpers';
import { layoutText, phrases } from '../../engine/text';

// Pure function of time. The main word follows a scripted path pos(t) per phrase:
// enter (sweep in from one side on a curved arc) → wander (figure-8 loop around the
// centre) → hold (still in the centre) → exit (accelerate out the far side).
// Echo i is drawn at pos(t − i·lag): a real time delay, so the copies trail along the
// path, bunch up when the word decelerates and collapse into it during the hold.
// Each echo shrinks / fades in proportion to how far it lags behind the main word.
export default defineEffect({
  id: 'text-echo',
  code: 'T05',
  nameZh: '文字回聲',
  nameEn: 'Text Echo',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '主文字沿弧線移動，後方拖著一串時間延遲的描邊副本，越後面越小越淡，停下時副本收回主體。',
  tags: ['回聲', '殘影', '描邊', '延遲', 'echo'],
  suitable: ['標題進場', '音樂視覺', '節奏強調'],
  principle:
    'Canvas 2D：主文字位置是時間的純函數 pos(t)（進場弧線 easeOut → 8 字形繞行 → 中央停留 → easeIn 離場）。第 i 個副本畫在 pos(t − i·lag)，所以是真正的時間延遲而非固定陰影；副本以描邊繪製，縮放 = 1 − shrink·i·clamp(距離/字級)，透明度隨 i 與距離遞減，主文字停下時距離歸零、副本完全收回。',
  defaultText: 'ECHO／回聲／ECHO',
  palette: 'PASTEL',
  colors: { background: '#F2E8D5', primary: '#141414', secondary: '#9A86DE', accent: '#ED589A' },
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'direction', 'secondary', 'accent'],
  directions: ['right', 'left', 'up', 'down'],
  maxChars: 30,
  loopable: true,
  textHint: '用「／」分隔多個詞，每個詞依序穿過畫面。',
  params: [
    { key: 'echoes', label: '副本數量', type: 'range', min: 2, max: 16, step: 1, default: 9 },
    { key: 'lag', label: '延遲間隔', type: 'range', min: 0.02, max: 0.2, step: 0.01, default: 0.06, unit: 's' },
    { key: 'shrink', label: '縮小幅度', type: 'range', min: 0, max: 0.12, step: 0.005, default: 0.05 },
    { key: 'hold', label: '停留時間', type: 'range', min: 0.4, max: 3, step: 0.1, default: 1.2, unit: 's' },
  ],
  recipe: {
    enter: '主文字從方向起點外沿弧線以 power3.out 滑入中央，副本依延遲拉成一串。',
    motion: '在中央附近繞 8 字形一圈（1.6s，sin 包絡起止速度為零），副本沿同一路徑延遲跟隨、縮小淡出。',
    hold: '主文字停在中央 hold 秒，副本在約 lag×數量 秒內收回主體，畫面只剩清楚的文字。',
    exit: '以 power3.in 加速朝方向終點離場，副本拖出一串描邊。',
    loop: '依序換下一個詞；離場中的副本與下一個詞的進場自然銜接。',
  },
  accept: [
    '移動中主文字後方有多個描邊副本，沿走過的路徑排列而非固定偏移。',
    '越後面的副本越小越淡。',
    '主文字停下時副本在短時間內收回，文字清楚可讀。',
    '改變方向時進場與離場方向跟著改變。',
  ],
  transparent: true,
  cycle: 9.4,
  posterTime: 1.55,
  create(ctx) {
    const W = ctx.width;
    const H = ctx.height;
    const list = phrases(ctx.text);
    const N = Math.max(1, Math.round(num(ctx, 'echoes', 9) * (0.5 + 0.5 * ctx.q)));
    const lag = num(ctx, 'lag', 0.06);
    const shrink = num(ctx, 'shrink', 0.05);
    const hold = num(ctx, 'hold', 1.2);
    const k = ctx.s.intensity;
    const words = list.map((p) => layoutText(ctx, p, { maxWidth: W * 0.62, maxHeight: H * 0.34 }));
    const ENTER = 0.9;
    const WANDER = 1.6;
    const EXIT = 0.75;
    const D = ENTER + WANDER + hold + EXIT;
    const total = D * words.length;
    const horizontal = ctx.dir === 'left' || ctx.dir === 'right';
    const dv = { x: horizontal ? ctx.dirSign : 0, y: horizontal ? 0 : ctx.dirSign };
    const pv = { x: -dv.y, y: dv.x };
    const A = Math.min(W, H) * 0.2 * k;
    const cx = W / 2;
    const cy = H / 2;

    interface Pose {
      w: number;
      x: number;
      y: number;
      s: number;
      r: number;
    }
    const pose = (time: number): Pose => {
      const tt = mod(time, total);
      const w = Math.floor(tt / D);
      let u = tt - w * D;
      const L = words[w];
      const off = (horizontal ? W / 2 + L.width * 0.62 : H / 2 + L.height * 0.8) + 4;
      if (u < ENTER) {
        const p = u / ENTER;
        const e = easeOut3(p);
        const arc = Math.sin(Math.PI * e) * A * 0.9;
        return { w, x: cx - dv.x * off * (1 - e) + pv.x * arc, y: cy - dv.y * off * (1 - e) + pv.y * arc, s: 0.8 + 0.2 * e, r: (1 - e) * -0.12 * k * ctx.dirSign };
      }
      u -= ENTER;
      if (u < WANDER) {
        const p = easeInOut(u / WANDER);
        const env = Math.sin(Math.PI * p);
        const a = Math.sin(TAU * p) * env * A;
        const b = Math.sin(2 * TAU * p) * env * A * 0.45;
        return { w, x: cx + dv.x * a + pv.x * b, y: cy + dv.y * a + pv.y * b, s: 1 - 0.12 * env * k, r: Math.sin(TAU * p) * env * 0.1 * k * ctx.dirSign };
      }
      u -= WANDER;
      if (u < hold) return { w, x: cx, y: cy, s: 1, r: 0 };
      u -= hold;
      const e = easeIn3(u / EXIT);
      return { w, x: cx + dv.x * off * e, y: cy + dv.y * off * e, s: 1 + 0.15 * e, r: e * 0.08 * k * ctx.dirSign };
    };

    const draw = (g: CanvasRenderingContext2D, p: Pose, fill: string | null, stroke: string | null, sc: number, alpha: number) => {
      const L = words[p.w];
      g.save();
      g.globalAlpha = alpha;
      g.translate(p.x, p.y);
      g.rotate(p.r);
      g.scale(p.s * sc, p.s * sc);
      g.translate(-cx, -cy);
      if (stroke) drawLayout(g, L, { stroke, lineWidth: Math.max(1, L.fontSize * 0.028) / (p.s * sc) });
      if (fill) drawLayout(g, L, { fill });
      g.restore();
    };

    const settle = ENTER + WANDER + Math.min(hold, lag * N + 0.4);
    return canvasRuntime(
      ctx,
      (g, t) => {
        const main = pose(t);
        const fs = words[main.w].fontSize;
        for (let i = N; i >= 1; i--) {
          const e = pose(t - i * lag);
          const dist = Math.hypot(e.x - main.x, e.y - main.y) + Math.abs(e.s - main.s) * fs * 2;
          const near = clamp(dist / (fs * 0.35), 0, 1);
          if (near <= 0.01 && e.w === main.w) continue;
          const far = clamp(dist / (fs * 1.5), 0, 1);
          const sc = Math.max(0.2, 1 - shrink * i * (e.w === main.w ? far : 1));
          const a = (1 - i / (N + 1)) * 0.9 * (e.w === main.w ? near : 1);
          draw(g, e, null, i % 3 === 0 ? ctx.s.accent : ctx.s.secondary, sc, a);
        }
        draw(g, main, ctx.s.primary, null, 1, 1);
      },
      { settle },
    );
  },
});
