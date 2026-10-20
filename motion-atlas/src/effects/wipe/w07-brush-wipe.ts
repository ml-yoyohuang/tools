import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, ease, num } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { noise1 } from '../../engine/random';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { poly, travel, type Pt } from './_util';

interface Stroke {
  /** across-axis centre and half width */
  uc: number;
  hw: number;
  delay: number;
  tilt: number;
  /** bristle tip offsets (0–1) */
  tips: number[];
  seed: number;
}

export default defineEffect({
  id: 'brush-wipe',
  code: 'W07',
  nameZh: '刷痕擦拭',
  nameEn: 'Brush Wipe',
  category: 'wipe',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '數道寬刷痕先後掃過畫面，刷頭前緣是參差的刷毛，沾著顏料的刷頭後方露出新場景。',
  tags: ['刷痕', '筆刷', '手作', '擦拭', 'brush'],
  suitable: ['手作／塗鴉主題', '活動海報', '社群短片'],
  principle:
    'Canvas 2D clip：沿前進方向切成 n 條互相重疊 35% 的刷帶，每條刷帶依種子延遲出發，前緣位置 F = lerp(起點外, 終點外, power2.inOut(local))。刷帶多邊形 = 上下緣（1D 雜訊輕微抖動、帶微小傾斜）+ 前緣由 K 根刷毛組成的鋸齒（每根長度偏移 = ragged·hash^1.5）。先以 F 的多邊形填顏料色（刷頭），再以 F − 刷頭長度的同形多邊形 clip 畫新場景；所有刷帶最後都走完全程，因此一定完全覆蓋。',
  defaultText: 'PAINT／刷新',
  palette: 'STREET',
  colors: { background: C.red, primary: C.cream, secondary: C.black, accent: C.yellow },
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent', 'seed'],
  directions: ['right', 'left', 'down', 'up'],
  textHint: '「／」前為 A 場景文字，後為 B 場景文字。',
  params: [
    ...TRANSITION_PARAMS,
    { key: 'strokes', label: '刷痕數', type: 'range', min: 2, max: 8, step: 1, default: 4 },
    { key: 'ragged', label: '刷毛參差', type: 'range', min: 0, max: 0.3, step: 0.01, default: 0.14 },
    { key: 'paint', label: '顏料刷頭', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '各刷痕依種子錯開 0–30% 出發，以 power2.inOut 橫掃；前緣是長短不一的刷毛，刷頭先塗上一段顏料色，後方才是新場景。',
    hold: 'B 完整停留，刷痕全部掃出畫面。',
    exit: '同方向再刷一次換回 A。',
    loop: 'A → B → A；種子改變刷毛長短與出發順序。',
  },
  accept: [
    '轉場中可分辨出多條寬刷帶，彼此出發時間不同。',
    '每條刷帶前緣為參差的刷毛鋸齒而非直線；參差設為 0 時前緣變平整。',
    '開啟顏料刷頭時，刷頭前段是一段純色、後方才露出新場景。',
    '轉場結束時新場景完整，沒有殘留的舊場景縫隙。',
  ],
  cycle: 4.4,
  posterTime: 1.7,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const { len, span, map } = travel(ctx.dir, w, h);
    const n = Math.round(num(ctx, 'strokes', 4));
    const ragged = num(ctx, 'ragged', 0.14) * len;
    const paint = bool(ctx, 'paint', true);
    const head = paint ? len * 0.07 : 0;
    const r = ctx.rand;
    const bandW = span / n;
    const K = Math.max(8, Math.round(22 * ctx.q));
    const strokes: Stroke[] = [];
    for (let i = 0; i < n; i++) {
      const tips: number[] = [];
      for (let k = 0; k < K; k++) tips.push(r() ** 1.5);
      strokes.push({
        uc: (i + 0.5) * bandW,
        hw: bandW * 0.5 * 1.35,
        delay: i === 0 ? 0 : r() * 0.3,
        tilt: (r() - 0.5) * 0.1,
        tips,
        seed: Math.floor(r() * 1000),
      });
    }
    const maxDelay = 0.3;
    const brush = ease('power2.inOut');
    const tiltReach = span * 0.06;
    const notch = ((bandW * 1.35) / K) * 0.9 * clamp(ragged / (len * 0.05), 0, 1);
    const startV = -(ragged + head + tiltReach + 4);
    const endV = len + ragged + notch + head + tiltReach + 4;
    const back = -len * 0.5;
    const edgeSteps = 14;
    const wob = bandW * 0.06;

    /** Polygon of stroke s with its leading edge at F (travel coords → stage). */
    const shape = (s: Stroke, F: number): Pt[] => {
      const top = s.uc - s.hw;
      const bot = s.uc + s.hw;
      const pts: Pt[] = [];
      const lead = (u: number) => F + s.tilt * (u - s.uc);
      // top edge (back → front)
      const topEnd = lead(top) - ragged;
      for (let i = 0; i <= edgeSteps; i++) {
        const v = back + ((topEnd - back) * i) / edgeSteps;
        pts.push(map(top + wob * noise1(v / (len * 0.18), s.seed), v));
      }
      // bristle comb across the leading edge
      for (let k = 0; k < K; k++) {
        const u0 = top + ((bot - top) * k) / K;
        const u1 = top + ((bot - top) * (k + 1)) / K;
        const um = (u0 + u1) / 2;
        const tipV = lead(um) - ragged * s.tips[k];
        pts.push(map(u0, tipV - notch));
        pts.push(map(um, tipV));
        pts.push(map(u1, tipV - notch));
      }
      // bottom edge (front → back)
      const botEnd = lead(bot) - ragged;
      for (let i = edgeSteps; i >= 0; i--) {
        const v = back + ((botEnd - back) * i) / edgeSteps;
        pts.push(map(bot + wob * noise1(v / (len * 0.18), s.seed + 31), v));
      }
      return pts;
    };

    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, (x) => x);
      sc.draw(g, tr.from);
      if (tr.p <= 0) return;
      for (const s of strokes) {
        const local = clamp((tr.p - s.delay) / (1 - maxDelay), 0, 1);
        if (local <= 0) continue;
        const F = startV + brush(local) * (endV - startV);
        if (head > 0) {
          g.fillStyle = ctx.s.accent;
          g.beginPath();
          poly(g, shape(s, F));
          g.fill();
        }
        g.save();
        g.beginPath();
        poly(g, shape(s, F - head));
        g.clip();
        sc.draw(g, tr.to);
        g.restore();
      }
    });
  },
});
