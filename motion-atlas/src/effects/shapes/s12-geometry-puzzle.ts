import { defineEffect } from '../../engine/define';
import { C } from '../../engine/palette';
import { bool, canvasRuntime, clamp, ease, minSide, mod, num, rgba, TAU } from '../../engine/helpers';
import type { Pt } from '../../engine/shapes';
import { polyCentroid } from './_util';

/** Classic tangram split of a 4×4 square (y down). Areas: 4+4+2+1+1+2+2 = 16 → exact tiling. */
const PIECES: { pts: Pt[]; col: 0 | 1 | 2 }[] = [
  { pts: [[0, 0], [4, 0], [2, 2]], col: 0 }, // large
  { pts: [[0, 0], [2, 2], [0, 4]], col: 1 }, // large
  { pts: [[4, 4], [2, 4], [4, 2]], col: 0 }, // medium
  { pts: [[4, 0], [4, 2], [3, 1]], col: 1 }, // small
  { pts: [[2, 2], [3, 3], [1, 3]], col: 0 }, // small
  { pts: [[2, 2], [3, 1], [4, 2], [3, 3]], col: 2 }, // square
  { pts: [[0, 4], [1, 3], [3, 3], [2, 4]], col: 2 }, // parallelogram
];

const LEAD = 0.4;
const TRAVEL = 1.1;
const HOLD = 1.7;
const BACK = 1.0;
const BACK_STAGGER = 0.08;
const TAIL = 0.4;

export default defineEffect({
  id: 'geometry-puzzle',
  code: 'S12',
  nameZh: '幾何拼圖',
  nameEn: 'Geometry Puzzle',
  category: 'shapes',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '七巧板的七個多邊形從四周旋轉飛入，邊與邊精確密合成一個正方形，停留後再拆散回原位。',
  tags: ['七巧板', 'tangram', '拼圖', '組合', '多邊形'],
  suitable: ['團隊／合作主題', 'Logo 組合', '步驟完成提示'],
  principle:
    'Canvas 2D 純時間函數：七巧板以 4×4 正方形的精確座標定義（面積 4+4+2+1+1+2+2 = 16，無縫拼滿）。每片以自身形心為樞軸，從 seed 決定的散落位置／旋轉角插值到組合位置／0°，使用 power3.inOut；進度 = 1 時頂點與原始座標完全相同，因此邊界精確吻合。片與片之間以背景色細線描邊，拼好時顯示一致的接縫與外框脈衝。',
  defaultText: '',
  palette: 'POP',
  colors: { background: C.black, primary: C.yellow, secondary: C.blue, accent: C.pink },
  controls: ['scale', 'secondary', 'accent', 'seed'],
  params: [
    { key: 'spread', label: '散開距離', type: 'range', min: 0.3, max: 1, step: 0.05, default: 0.95 },
    { key: 'spin', label: '散落旋轉', type: 'range', min: 0, max: 1, step: 0.05, default: 0.7 },
    { key: 'stagger', label: '飛入間隔', type: 'range', min: 0, max: 0.4, step: 0.02, default: 0.16, unit: 's' },
    { key: 'ghost', label: '顯示目標輪廓', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '七片散落在舞台四周，中央以虛線標出目標正方形。',
    motion: '各片依序以 power3.inOut 旋轉並飛入，最後一刻精準落位。',
    hold: '拼成完整正方形，外框脈衝一次後靜止約 1.7 秒。',
    exit: '以小間隔同時拆開，旋轉回到散落位置。',
    loop: '回到散落狀態後重新拼合。',
  },
  accept: [
    '拼好時七片組成完整正方形，片與片之間沒有空隙或重疊。',
    '每片都繞自己的形心旋轉並到達 0°。',
    '散開距離調小時各片離中心更近。',
    '飛入間隔為 0 時七片同時抵達。',
  ],
  transparent: true,
  loopable: true,
  cycle: LEAD + 6 * 0.16 + TRAVEL + HOLD + 6 * BACK_STAGGER + BACK + TAIL,
  posterTime: LEAD + 6 * 0.16 + TRAVEL + 0.6,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const spread = num(ctx, 'spread', 0.95);
    const spin = num(ctx, 'spin', 0.7);
    const stagger = num(ctx, 'stagger', 0.16);
    const ghost = bool(ctx, 'ghost', true);
    const S = m * 0.44 * ctx.s.scale;
    const u = S / 4;
    const cx = w / 2;
    const cy = h / 2;
    const cols = [ctx.s.primary, ctx.s.secondary, ctx.s.accent];
    const io = ease('power3.inOut');
    const back = ease('power2.inOut');
    const n = PIECES.length;
    // order of arrival: seeded
    const order = PIECES.map((_, i) => ({ i, k: ctx.rand() })).sort((a, b) => a.k - b.k);
    const rank = new Array(n).fill(0);
    order.forEach((o, k) => (rank[o.i] = k));
    const base = PIECES.map((p) => {
      const pts = p.pts.map(([x, y]) => [cx + (x - 2) * u, cy + (y - 2) * u] as Pt);
      const c = polyCentroid(pts);
      const local = pts.map(([x, y]) => [x - c[0], y - c[1]] as Pt);
      let ext = 0;
      for (const q of local) ext = Math.max(ext, Math.hypot(q[0], q[1]));
      return { c, local, ext, ang: Math.atan2(c[1] - cy, c[0] - cx) };
    });
    // scatter slots: evenly spaced around an ellipse fitted to the stage, assigned in the
    // pieces' own angular order so every piece moves roughly straight in
    const byAng = base.map((b, i) => ({ i, a: b.ang })).sort((a, b) => a.a - b.a);
    const slot = new Array(n).fill(0);
    const a0 = byAng[0].a + (ctx.rand() - 0.5) * 0.4;
    byAng.forEach((o, k) => (slot[o.i] = a0 + (k / n) * TAU));
    const pieces = base.map((b, i) => {
      const dir = slot[i];
      const rx = Math.max(0, w / 2 - b.ext - m * 0.03);
      const ry = Math.max(0, h / 2 - b.ext - m * 0.03);
      const k = spread * (0.85 + ctx.rand() * 0.15);
      const sx = cx + Math.cos(dir) * rx * k;
      const sy = cy + Math.sin(dir) * ry * k;
      const rot = (ctx.rand() < 0.5 ? -1 : 1) * spin * (Math.PI / 4) * (1 + Math.floor(ctx.rand() * 4));
      return { c: b.c, local: b.local, sx, sy, rot, col: cols[PIECES[i].col], start: LEAD + rank[i] * stagger };
    });
    const assembled = LEAD + (n - 1) * stagger + TRAVEL;
    const backAt = assembled + HOLD;
    const total = backAt + (n - 1) * BACK_STAGGER + BACK + TAIL;
    return canvasRuntime(ctx, (g, t) => {
      const lt = mod(t, total);
      const lw = Math.max(1.5, m * 0.004);
      if (ghost && lt < assembled + 0.05) {
        g.save();
        g.setLineDash([lw * 4, lw * 3]);
        g.strokeStyle = rgba(ctx.s.secondary, 0.6);
        g.lineWidth = lw;
        g.strokeRect(cx - S / 2, cy - S / 2, S, S);
        g.restore();
      }
      g.lineJoin = 'miter';
      for (let i = 0; i < n; i++) {
        const p = pieces[i];
        let e: number;
        if (lt < backAt) e = io(clamp((lt - p.start) / TRAVEL, 0, 1));
        else e = 1 - back(clamp((lt - backAt - (n - 1 - rank[i]) * BACK_STAGGER) / BACK, 0, 1));
        const x = p.sx + (p.c[0] - p.sx) * e;
        const y = p.sy + (p.c[1] - p.sy) * e;
        const a = p.rot * (1 - e);
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        g.beginPath();
        p.local.forEach(([lx, ly], j) => {
          const px = x + lx * ca - ly * sa;
          const py = y + lx * sa + ly * ca;
          if (j === 0) g.moveTo(px, py);
          else g.lineTo(px, py);
        });
        g.closePath();
        g.fillStyle = p.col;
        g.fill();
        g.strokeStyle = ctx.s.background;
        g.lineWidth = lw * 0.8;
        g.stroke();
      }
      // completion pulse around the exact square
      const s = lt - assembled;
      if (s >= 0 && s < 0.6) {
        const q = s / 0.6;
        const grow = S * 0.06 * q;
        g.strokeStyle = rgba(ctx.s.accent, 1 - q);
        g.lineWidth = lw * 1.6;
        g.strokeRect(cx - S / 2 - grow, cy - S / 2 - grow, S + grow * 2, S + grow * 2);
      }
    });
  },
});
