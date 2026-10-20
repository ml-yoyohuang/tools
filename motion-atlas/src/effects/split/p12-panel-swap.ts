import { defineEffect } from '../../engine/define';
import { canvasRuntime, ease, lerp, mixHex, num, rgba } from '../../engine/helpers';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { AB_HINT } from './_util';

type Rect = [number, number, number, number];

export default defineEffect({
  id: 'panel-swap',
  code: 'P12',
  nameZh: '雙畫面交換',
  nameEn: 'Panel Swap',
  category: 'split',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '畫面分成一大一小兩個明確分區，兩個場景沿弧線互換位置與比例：主畫面縮成側欄、側欄放大成主畫面。',
  tags: ['分割畫面', '交換', '子母畫面', '版面', 'swap'],
  suitable: ['前後比較', '直播／訪談版面', '產品對照'],
  principle:
    'Canvas 2D：依比例 r 與間距算出主區、側區兩個矩形。轉場時舊主角的矩形由主區插值到側區（power3.inOut），並往一側下沉、縮小 0–8%；新主角由側區插值到主區、往另一側抬起並帶硬陰影，兩者交錯通過。每個場景以 contain 縮放畫進自己的矩形並 clip，分區空位以虛線框標示。',
  defaultText: 'MAIN／SIDE',
  palette: 'COOL',
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent'],
  directions: ['right', 'left', 'down', 'up'],
  textHint: AB_HINT,
  params: [
    ...TRANSITION_PARAMS,
    { key: 'ratio', label: '主區比例', type: 'range', min: 0.55, max: 0.8, step: 0.01, default: 0.68 },
    { key: 'gutter', label: '分區間距', type: 'range', min: 0, max: 0.08, step: 0.005, default: 0.03 },
    { key: 'arc', label: '交錯弧度', type: 'range', min: 0, max: 0.3, step: 0.01, default: 0.12 },
  ],
  recipe: {
    enter: 'A 在主區、B 在側區，兩區都清楚可見。',
    motion: '兩個矩形以 power3.inOut 交換位置與尺寸；舊主角下沉縮小、新主角抬起放大，沿相反弧線交錯通過。',
    hold: 'B 佔主區、A 退到側區停留。',
    exit: '再次交換，A 回到主區。',
    loop: 'A 主 → B 主 → A 主。',
  },
  accept: [
    '任何時刻都同時看得到 A 與 B 兩個畫面。',
    '交換時兩個畫面的大小與位置都在改變，並以相反弧線錯開而非直接重疊。',
    '分區以邊框／虛線框標示，間距可調。',
    '方向「向右／向左」左右排列，「向下／向上」上下排列，主區位置隨方向改變。',
  ],
  cycle: 4.4,
  posterTime: 1.6,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const r = num(ctx, 'ratio', 0.68);
    const m = num(ctx, 'gutter', 0.03) * Math.min(w, h);
    const arc = num(ctx, 'arc', 0.12);
    const horiz = ctx.dir === 'left' || ctx.dir === 'right';
    const bigFirst = ctx.dirSign > 0;
    let big: Rect;
    let small: Rect;
    if (horiz) {
      const bw = (w - 3 * m) * r;
      const sw = w - 3 * m - bw;
      big = [bigFirst ? m : 2 * m + sw, m, bw, h - 2 * m];
      small = [bigFirst ? 2 * m + bw : m, m, sw, h - 2 * m];
    } else {
      const bh = (h - 3 * m) * r;
      const sh = h - 3 * m - bh;
      big = [m, bigFirst ? m : 2 * m + sh, w - 2 * m, bh];
      small = [m, bigFirst ? 2 * m + bh : m, w - 2 * m, sh];
    }
    const mv = ease('power3.inOut');
    const lw = Math.max(1.5, Math.min(w, h) * 0.005);
    const stageBg = mixHex(ctx.s.background, '#000000', 0.45);
    const lerpRect = (a: Rect, b: Rect, e: number): Rect => [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e), lerp(a[3], b[3], e)];
    const xform = (rc: Rect, sc2: number, off: number): Rect => {
      const cxr = rc[0] + rc[2] / 2 + (horiz ? 0 : off);
      const cyr = rc[1] + rc[3] / 2 + (horiz ? off : 0);
      return [cxr - (rc[2] * sc2) / 2, cyr - (rc[3] * sc2) / 2, rc[2] * sc2, rc[3] * sc2];
    };
    const panel = (g: CanvasRenderingContext2D, which: 0 | 1, rc: Rect, shadow: number) => {
      const s = sc.scene(which);
      const [x, y, rw, rh] = rc;
      if (shadow > 0.5) {
        g.fillStyle = rgba('#000000', 0.35);
        g.fillRect(x + shadow * 0.6, y + shadow, rw, rh);
      }
      g.save();
      g.beginPath();
      g.rect(x, y, rw, rh);
      g.clip();
      g.fillStyle = s.bg;
      g.fillRect(x, y, rw, rh);
      const k = Math.min(rw / w, rh / h);
      g.drawImage(s.canvas, x + (rw - w * k) / 2, y + (rh - h * k) / 2, w * k, h * k);
      g.restore();
      g.strokeStyle = ctx.s.accent;
      g.lineWidth = lw;
      g.strokeRect(x, y, rw, rh);
    };
    return canvasRuntime(
      ctx,
      (g, t) => {
        const tr = transition(ctx, t, (x) => x);
        const e = mv(tr.p);
        const b = Math.sin(Math.PI * e);
        // zone slots
        g.strokeStyle = rgba(ctx.s.accent, 0.45);
        g.lineWidth = lw;
        g.setLineDash([lw * 4, lw * 3]);
        for (const z of [big, small]) g.strokeRect(z[0] - lw * 2, z[1] - lw * 2, z[2] + lw * 4, z[3] + lw * 4);
        g.setLineDash([]);
        const span = (horiz ? h : w) * arc;
        const rFrom = xform(lerpRect(big, small, e), 1 - 0.08 * b, span * b);
        const rTo = xform(lerpRect(small, big, e), 1 + 0.03 * b, -span * b);
        panel(g, tr.from, rFrom, 0);
        panel(g, tr.to, rTo, Math.min(w, h) * 0.03 * b);
      },
      { background: () => stageBg },
    );
  },
});
