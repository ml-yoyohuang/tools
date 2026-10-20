import { defineEffect } from '../../engine/define';
import { C } from '../../engine/palette';
import { bool, canvasRuntime, clamp, easeInOut, easeOut3, minSide, mix, mod, num, rgba, TAU } from '../../engine/helpers';
import { bottomExtent, shapePath, type Kind } from './_util';

const KINDS: Kind[] = ['square', 'triangle', 'circle', 'square', 'hexagon', 'triangle', 'square', 'circle', 'triangle', 'square'];
const D = 0.5; // duration of one shape's action (s)
const LEAD = 0.25;
const REST = 0.7;

export default defineEffect({
  id: 'shape-relay',
  code: 'S05',
  nameZh: '圖形接力',
  nameEn: 'Shape Relay',
  category: 'shapes',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '一排圖形依序被觸發：跳起、朝傳遞方向翻滾並換色，再把一顆訊號點拋給下一個，下方時間軸標出每一棒的延遲。',
  tags: ['接力', 'relay', '連鎖', 'stagger', '時間差'],
  suitable: ['流程／步驟說明', '載入指示', '資訊圖表動態'],
  principle:
    'Canvas 2D 純時間函數：第 k 棒的觸發時間 τk = 起點 + k·間隔。每個圖形在 [τk, τk+0.5s] 內做跳躍（−sin(πp) 位移）、沿傳遞方向旋轉 90°／120°（ease-in-out）並由主色換成次色；訊號點沿拋物線在 τk→τk+1 從第 k 個飛到第 k+1 個，抵達瞬間正好觸發下一棒。去程結束後反向回傳，旋轉與顏色還原，形成無縫來回。',
  defaultText: '',
  palette: 'MONO',
  colors: { secondary: C.red, accent: '#8A8A8A' },
  controls: ['scale', 'direction', 'secondary', 'accent'],
  directions: ['right', 'left'],
  params: [
    { key: 'count', label: '圖形數量', type: 'range', min: 4, max: 10, step: 1, default: 7 },
    { key: 'gap', label: '接力間隔', type: 'range', min: 0.06, max: 0.5, step: 0.02, default: 0.2, unit: 's' },
    { key: 'hop', label: '跳躍高度', type: 'range', min: 0, max: 1.5, step: 0.05, default: 0.7 },
    { key: 'timeline', label: '顯示時間軸', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '一排靜止的主色圖形。',
    motion: '第一棒跳起翻滾並換色，訊號點以拋物線飛向下一棒；每一棒延遲固定間隔觸發，形成清楚的連鎖節奏。',
    hold: '去程完成後全部換成次色停留約 0.7 秒。',
    exit: '反向接力，旋轉與顏色逐一還原。',
    loop: '去程＋回程為一個循環，無縫重複。',
  },
  accept: [
    '同一時間只有相鄰的少數圖形在動，觸發順序清楚。',
    '訊號點落到下一個圖形的瞬間，該圖形開始跳起。',
    '接力間隔調大時連鎖變慢，時間軸上的標籤數值同步改變。',
    '方向改為左時從最右邊開始傳遞。',
  ],
  transparent: true,
  cycle: 2 * (LEAD + 6 * 0.2 + D + REST),
  posterTime: 1.2,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const n = Math.round(num(ctx, 'count', 7));
    const gap = num(ctx, 'gap', 0.2);
    const hopAmt = num(ctx, 'hop', 0.7);
    const showTl = bool(ctx, 'timeline', true);
    const span = w * 0.8;
    const spacing = span / Math.max(1, n - 1);
    const r = Math.min(spacing * 0.3, m * 0.085) * ctx.s.scale;
    const cy = h * (showTl ? 0.44 : 0.5);
    const x0 = (w - span) / 2;
    const half = LEAD + (n - 1) * gap + D + REST;
    const fontPx = clamp(m * 0.03, 9, 15);
    const shapes = Array.from({ length: n }, (_, i) => {
      const kind = KINDS[i % KINDS.length];
      return { kind, x: x0 + i * spacing, bot: bottomExtent(kind, r), quarter: kind === 'triangle' ? TAU / 3 : kind === 'hexagon' ? TAU / 6 : Math.PI / 2 };
    });
    const tlY = cy + r * 1.5 + m * 0.12;
    return canvasRuntime(ctx, (g, t) => {
      const lt = mod(t, half * 2);
      const pass = lt < half ? 0 : 1;
      const pt = lt - pass * half;
      // travel direction for this pass (+1 = towards the right)
      const dir = (pass === 0 ? 1 : -1) * ctx.dirSign;
      // order index k of shape i in this pass
      const kOf = (i: number) => (dir > 0 ? i : n - 1 - i);
      const tau = (k: number) => LEAD + k * gap;
      // timeline
      if (showTl) {
        const first = shapes[kOf(0) === 0 ? 0 : n - 1].x;
        const prog = clamp((pt - LEAD) / Math.max(1e-3, (n - 1) * gap), 0, 1);
        g.lineWidth = Math.max(1, m * 0.003);
        g.strokeStyle = rgba(ctx.s.accent, 0.5);
        g.beginPath();
        g.moveTo(x0, tlY);
        g.lineTo(x0 + span, tlY);
        g.stroke();
        g.strokeStyle = ctx.s.secondary;
        g.lineWidth = Math.max(2, m * 0.006);
        g.beginPath();
        g.moveTo(first, tlY);
        g.lineTo(first + dir * span * prog, tlY);
        g.stroke();
        g.font = `600 ${fontPx}px ${ctx.font.mono}`;
        g.textAlign = 'center';
        g.textBaseline = 'top';
        shapes.forEach((s, i) => {
          const k = kOf(i);
          const fired = pt >= tau(k);
          g.fillStyle = fired ? ctx.s.secondary : ctx.s.accent;
          g.beginPath();
          g.arc(s.x, tlY, Math.max(3, m * 0.008) * (fired ? 1.25 : 1), 0, TAU);
          g.fill();
          if (spacing > fontPx * 3.2 || k % 2 === 0) {
            g.fillStyle = fired ? ctx.s.primary : ctx.s.accent;
            g.fillText(`+${(k * gap).toFixed(2)}s`, s.x, tlY + fontPx * 0.8);
          }
        });
      }
      // shapes
      shapes.forEach((s, i) => {
        const k = kOf(i);
        const p = clamp((pt - tau(k)) / D, 0, 1);
        const e = easeInOut(p);
        // forward pass: primary → secondary and +quarter; backward pass: undo
        const done = pass === 0 ? e : 1 - e;
        const col = mix(ctx.s.primary, ctx.s.secondary, clamp(pass === 0 ? p * 2.2 : 1 - p * 2.2, 0, 1));
        const ang = done * s.quarter * ctx.dirSign;
        const hop = Math.sin(Math.PI * p) * r * 1.6 * hopAmt;
        // landing squash right after the hop
        const land = p >= 1 ? Math.max(0, 1 - (pt - tau(k) - D) / 0.18) : 0;
        const sq = Math.sin(land * Math.PI) * 0.16 * Math.min(1, hopAmt * 1.5);
        g.save();
        g.translate(s.x, cy + s.bot);
        g.scale(1 + sq, 1 - sq);
        g.translate(0, -s.bot - hop);
        g.rotate(ang);
        g.beginPath();
        shapePath(g, s.kind, r);
        g.fillStyle = col;
        g.fill();
        g.restore();
      });
      // baton: travels on a parabola from shape k to k+1 during [τk, τk+1]
      for (let k = 0; k < n - 1; k++) {
        const p = (pt - tau(k)) / gap;
        if (p < 0 || p >= 1) continue;
        const a = shapes[dir > 0 ? k : n - 1 - k];
        const b = shapes[dir > 0 ? k + 1 : n - 2 - k];
        const u = easeOut3(p) * 0.35 + p * 0.65;
        const x = a.x + (b.x - a.x) * u;
        const y = cy - r * 1.25 - Math.sin(Math.PI * u) * (r * 0.9 + spacing * 0.25);
        g.fillStyle = ctx.s.secondary;
        g.beginPath();
        g.arc(x, y, Math.max(3, r * 0.17), 0, TAU);
        g.fill();
      }
    });
  },
});
