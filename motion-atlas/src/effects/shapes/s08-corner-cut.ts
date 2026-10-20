import { defineEffect } from '../../engine/define';
import { C } from '../../engine/palette';
import { bool, canvasRuntime, clamp, ease, easeInOut, easeOut3, minSide, mix, mod, num, rgba, str, TAU } from '../../engine/helpers';
import { pathPts, type Pt } from '../../engine/shapes';

const LEAD = 0.5;
const CUT = 0.72; // per corner: blade 0.32 + separation 0.4
const BLADE = 0.32;
const HOLD = 1.1;
const BACK = 0.5;
const BACK_STAGGER = 0.28;
const TAIL = 0.5;
const TOTAL = LEAD + 4 * CUT + HOLD + 3 * BACK_STAGGER + BACK + TAIL;

export default defineEffect({
  id: 'corner-cut',
  code: 'S08',
  nameZh: '切角圖形',
  nameEn: 'Corner Cut',
  category: 'shapes',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '一把刀線依序切過方形的四個角，切下的角片飛離，輪廓從 4 邊變成 8 邊（或 12 邊），再一片片飛回還原。',
  tags: ['切角', 'chamfer', '多邊形', '輪廓', '幾何'],
  suitable: ['產品特色說明', 'Logo 變化', '介面狀態切換'],
  principle:
    'Canvas 2D 純時間函數：方形以四個角點描述，每個角有「已切」狀態。切角時在兩條相鄰邊上距角點 d 的位置取兩點取代原角點（倒角＝三角片；凹口＝方片），多邊形頂點數由 4 逐步增加到 8／12。刀線沿兩點間逐步畫出，切斷瞬間角片成為獨立多邊形，沿對角線方向以 ease-out 飛離並旋轉；還原時依相反順序以 back.out 飛回並重新併入輪廓。中央數字即為當下的頂點數。',
  defaultText: '',
  palette: 'POP',
  colors: { background: C.white, primary: C.blue, secondary: C.pink, accent: C.black },
  controls: ['scale', 'direction', 'secondary', 'accent'],
  directions: ['cw', 'ccw'],
  params: [
    { key: 'depth', label: '切削深度', type: 'range', min: 0.1, max: 0.45, step: 0.01, default: 0.26 },
    {
      key: 'cut',
      label: '切法',
      type: 'select',
      default: 'chamfer',
      options: [
        { value: 'chamfer', label: '倒角（斜切）' },
        { value: 'notch', label: '凹口（方形缺角）' },
      ],
    },
    { key: 'count', label: '顯示頂點數', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '完整方形靜止 0.5 秒。',
    motion: '刀線以 ease-in-out 劃過第一個角，切斷後角片沿對角線飛離並旋轉；四個角依方向順序每 0.72 秒切一個，中央頂點數 4→5→…→8。',
    hold: '切完的多邊形停留約 1.1 秒，四塊角片停在外側。',
    exit: '角片依相反順序以 back.out 飛回，輪廓逐一恢復成方形。',
    loop: '回到完整方形後重新開始。',
  },
  accept: [
    '每次只切一個角，切斷瞬間輪廓的頂點數加一（倒角）或加二（凹口）。',
    '角片與切口形狀完全吻合，飛回後輪廓恢復成完整方形。',
    '切削深度調大時切掉的角明顯變大。',
    '方向切換為逆時針時切角順序相反。',
  ],
  transparent: true,
  loopable: true,
  cycle: TOTAL,
  posterTime: LEAD + 4 * CUT + 0.4,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const S = m * 0.5 * ctx.s.scale;
    const d = S * num(ctx, 'depth', 0.26);
    const notch = str(ctx, 'cut', 'chamfer') === 'notch';
    const showCount = bool(ctx, 'count', true);
    const cx = w / 2;
    const cy = h / 2;
    // corners clockwise from top-left
    const corners: Pt[] = [
      [cx - S / 2, cy - S / 2],
      [cx + S / 2, cy - S / 2],
      [cx + S / 2, cy + S / 2],
      [cx - S / 2, cy + S / 2],
    ];
    const order = ctx.dirSign > 0 ? [0, 1, 2, 3] : [0, 3, 2, 1];
    const rank = [0, 0, 0, 0];
    order.forEach((c, k) => (rank[c] = k));
    const unit = (a: Pt, b: Pt): Pt => {
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return [(b[0] - a[0]) / l, (b[1] - a[1]) / l];
    };
    const geo = corners.map((c, i) => {
      const prev = unit(c, corners[(i + 3) % 4]);
      const next = unit(c, corners[(i + 1) % 4]);
      const a: Pt = [c[0] + prev[0] * d, c[1] + prev[1] * d];
      const b: Pt = [c[0] + next[0] * d, c[1] + next[1] * d];
      const inner: Pt = [c[0] + (prev[0] + next[0]) * d, c[1] + (prev[1] + next[1]) * d];
      const out = unit([cx, cy], c);
      // chip polygon: the exact piece removed from the square
      const chip: Pt[] = notch ? [a, c, b, inner] : [a, c, b];
      // outline replacement points for this corner
      const cut: Pt[] = notch ? [a, inner, b] : [a, b];
      const centroid: Pt = [chip.reduce((s, p) => s + p[0], 0) / chip.length, chip.reduce((s, p) => s + p[1], 0) / chip.length];
      return { c, a, b, inner, out, chip, cut, centroid, spin: (i % 2 ? 1 : -1) * 0.9 };
    });
    const backOut = ease('back.out(2.2)');
    const park = S * 0.24 + d * 0.3;
    return canvasRuntime(ctx, (g, t) => {
      const lt = mod(t, TOTAL);
      const restoreStart = LEAD + 4 * CUT + HOLD;
      const lw = Math.max(2, m * 0.007);
      // per-corner state: cutP (blade 0..1), sep (0..1 separated distance), attached
      const st = geo.map((_, i) => {
        const k = rank[i];
        const t0 = LEAD + k * CUT;
        const blade = clamp((lt - t0) / BLADE, 0, 1);
        const flyOut = easeOut3(clamp((lt - t0 - BLADE) / (CUT - BLADE), 0, 1));
        const r0 = restoreStart + (3 - k) * BACK_STAGGER;
        const back = clamp((lt - r0) / BACK, 0, 1);
        const severed = lt >= t0 + BLADE && back < 1;
        const sep = back > 0 ? 1 - backOut(back) : flyOut;
        return { blade: lt < t0 + BLADE ? blade : back > 0 ? 0 : 1, severed, sep };
      });
      // outline polygon
      const poly: Pt[] = [];
      geo.forEach((q, i) => {
        if (st[i].severed) poly.push(...q.cut);
        else poly.push(q.c);
      });
      // chips (behind the body so the joint looks clean while docking)
      geo.forEach((q, i) => {
        const s = st[i];
        if (!s.severed) return;
        const off = s.sep * park;
        g.save();
        g.translate(q.centroid[0] + q.out[0] * off, q.centroid[1] + q.out[1] * off);
        g.rotate(q.spin * s.sep);
        g.translate(-q.centroid[0], -q.centroid[1]);
        g.beginPath();
        pathPts(g, q.chip);
        g.fillStyle = mix(ctx.s.primary, ctx.s.secondary, clamp(s.sep * 2.5, 0, 1));
        g.fill();
        g.restore();
      });
      // body
      g.beginPath();
      pathPts(g, poly);
      g.fillStyle = ctx.s.primary;
      g.fill();
      g.lineJoin = 'miter';
      g.lineWidth = lw;
      g.strokeStyle = ctx.s.accent;
      g.stroke();
      // vertices
      g.fillStyle = ctx.s.accent;
      const vr = Math.max(3, m * 0.009);
      for (const p of poly) {
        g.beginPath();
        g.arc(p[0], p[1], vr, 0, TAU);
        g.fill();
      }
      // blade lines (drawn across the corner while cutting)
      geo.forEach((q, i) => {
        const p = st[i].blade;
        if (p <= 0 || p >= 1 || st[i].severed) return;
        const e = easeInOut(p);
        const ext = d * 0.35;
        const pts: Pt[] = notch ? [q.a, q.inner, q.b] : [q.a, q.b];
        const ux = unit(pts[0], pts[1]);
        const start: Pt = [pts[0][0] - ux[0] * ext, pts[0][1] - ux[1] * ext];
        const uy = unit(pts[pts.length - 2], pts[pts.length - 1]);
        const end: Pt = [pts[pts.length - 1][0] + uy[0] * ext, pts[pts.length - 1][1] + uy[1] * ext];
        const path: Pt[] = [start, ...pts.slice(1, -1), end];
        // partial polyline by length
        const lens = path.slice(1).map((pp, k) => Math.hypot(pp[0] - path[k][0], pp[1] - path[k][1]));
        let rem = lens.reduce((a, b) => a + b, 0) * e;
        g.beginPath();
        g.moveTo(start[0], start[1]);
        for (let k = 0; k < lens.length && rem > 0; k++) {
          const f = Math.min(1, rem / lens[k]);
          g.lineTo(path[k][0] + (path[k + 1][0] - path[k][0]) * f, path[k][1] + (path[k + 1][1] - path[k][1]) * f);
          rem -= lens[k];
        }
        g.strokeStyle = ctx.s.secondary;
        g.lineWidth = lw * 1.4;
        g.lineCap = 'round';
        g.stroke();
      });
      if (showCount) {
        const fs = S * 0.36;
        g.font = `700 ${fs}px ${ctx.font.mono}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillStyle = rgba(ctx.s.background, 0.92);
        g.fillText(String(poly.length), cx, cy + fs * 0.04);
      }
    });
  },
});
