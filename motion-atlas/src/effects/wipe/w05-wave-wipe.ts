import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, ease, num, TAU } from '../../engine/helpers';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';

export default defineEffect({
  id: 'wave-wipe',
  code: 'W05',
  nameZh: '波浪擦拭',
  nameEn: 'Wave Wipe',
  category: 'wipe',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '一道連續的正弦波邊界推過畫面，波後方已是新場景，波形同時流動。',
  tags: ['擦拭', '遮罩', '波浪', '轉場', 'wipe'],
  suitable: ['輕快轉場', '夏日／海洋主題', '社群短片'],
  principle:
    'Canvas 2D clip：每幀以「推進位置 + 振幅·sin(座標·頻率 + 時間)」建立波浪多邊形，先畫舊場景，再於 clip 內畫新場景。推進範圍包含振幅，確保起點與終點完全是 A 或 B。',
  defaultText: '浪來了／WAVE',
  palette: 'COOL',
  controls: ['text', 'font', 'weight', 'direction', 'intensity', 'secondary', 'accent'],
  directions: ['right', 'left', 'down', 'up'],
  textHint: '「／」前為 A 場景文字，後為 B 場景文字。',
  params: [
    ...TRANSITION_PARAMS,
    { key: 'amp', label: '波幅', type: 'range', min: 0, max: 0.2, step: 0.01, default: 0.07 },
    { key: 'waves', label: '波數', type: 'range', min: 0.5, max: 6, step: 0.5, default: 2.5 },
    { key: 'edge', label: '邊界線', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '波浪邊界以 power2.inOut 推進，邊界本身持續流動；強度放大波幅。',
    hold: 'B 場景完整停留，沒有殘留波紋。',
    exit: '波浪反向推回 A。',
    loop: 'A → B → A。',
  },
  accept: [
    '轉場中邊界為連續波形，不是直線。',
    '波幅設為 0 時退化成直線擦拭。',
    '方向「向上」時波浪由下往上推進。',
    '轉場起點與終點不殘留另一場景。',
  ],
  cycle: 4.4,
  posterTime: 1.7,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const horizontal = ctx.dir === 'left' || ctx.dir === 'right';
    const len = horizontal ? w : h; // travel axis
    const span = horizontal ? h : w; // across axis
    const amp = num(ctx, 'amp', 0.07) * Math.min(w, h) * ctx.s.intensity;
    const waves = num(ctx, 'waves', 2.5);
    const edge = bool(ctx, 'edge', true);
    const easing = ease('power2.inOut');
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, easing);
      sc.draw(g, tr.from);
      if (tr.e <= 0) return;
      // front position along travel axis (in "forward" coordinates)
      const front = -amp * 1.2 + tr.e * (len + amp * 2.4);
      const pts: [number, number][] = [];
      const steps = 48;
      for (let i = 0; i <= steps; i++) {
        const u = (i / steps) * span;
        const off = Math.sin((u / span) * waves * TAU + t * 3) * amp;
        pts.push([u, front + off]);
      }
      const map = (u: number, v: number): [number, number] => {
        // v = distance travelled from the start edge
        if (ctx.dir === 'right') return [v, u];
        if (ctx.dir === 'left') return [w - v, u];
        if (ctx.dir === 'down') return [u, v];
        return [u, h - v];
      };
      g.save();
      g.beginPath();
      const s0 = map(0, -amp * 3);
      g.moveTo(s0[0], s0[1]);
      for (const [u, v] of pts) {
        const p = map(u, v);
        g.lineTo(p[0], p[1]);
      }
      const e1 = map(span, -amp * 3);
      g.lineTo(e1[0], e1[1]);
      g.closePath();
      g.clip();
      sc.draw(g, tr.to);
      g.restore();
      if (edge && tr.e < 1) {
        g.strokeStyle = ctx.s.accent;
        g.lineWidth = Math.max(2, Math.min(w, h) * 0.008);
        g.beginPath();
        pts.forEach(([u, v], i) => {
          const p = map(u, v);
          if (i === 0) g.moveTo(p[0], p[1]);
          else g.lineTo(p[0], p[1]);
        });
        g.stroke();
      }
    });
  },
});
