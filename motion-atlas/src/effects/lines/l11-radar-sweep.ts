import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, minSide, mod, num, rgba, TAU } from '../../engine/helpers';

export default defineEffect({
  id: 'radar-sweep',
  code: 'L11',
  nameZh: '雷達掃描',
  nameEn: 'Radar Sweep',
  category: 'lines',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '掃描線帶著漸層扇形繞圓旋轉，固定位置的目標點被掃到時亮起、擴散一圈波紋後慢慢衰減。',
  tags: ['雷達', 'radar', '掃描', 'HUD', '科技介面'],
  suitable: ['科技／資安主題', '定位與地圖介面', 'HUD 背景'],
  principle:
    'Canvas 2D：掃描角 θ(t) = θ₀ + dir·2π·t/T。目標位置由 seed 產生且固定；每個目標「距上次被掃過的時間」= mod(dir·(θ(t) − θ目標), 2π) / (2π/T)，亮度 = exp(−經過時間 / 衰減)，波紋半徑隨經過時間增長、透明度同步衰減。扇形以 28 個透明度遞減的細楔形組成（不依賴 conic gradient）。',
  defaultText: '',
  palette: 'COOL',
  controls: ['scale', 'secondary', 'accent', 'direction', 'seed'],
  directions: ['cw', 'ccw'],
  params: [
    { key: 'period', label: '旋轉一圈', type: 'range', min: 1.5, max: 8, step: 0.1, default: 3.2, unit: 's' },
    { key: 'targets', label: '目標數量', type: 'range', min: 3, max: 30, step: 1, default: 12 },
    { key: 'decay', label: '衰減時間', type: 'range', min: 0.3, max: 4, step: 0.1, default: 1.6, unit: 's' },
    { key: 'sector', label: '扇形寬度', type: 'range', min: 10, max: 120, step: 5, default: 55, unit: '°' },
    { key: 'labels', label: '目標標籤', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '一開始即在掃描中，網格與刻度已就位。',
    motion: '掃描線等速旋轉（linear），後方扇形透明度遞減；目標被掃到瞬間亮起並放出一圈波紋。',
    hold: '連續掃描，無停頓。',
    exit: '目標亮度以指數衰減到暗點。',
    loop: '每轉一圈重複，目標位置固定，循環無接縫。',
  },
  accept: [
    '目標只有在掃描線經過時亮起，之後逐漸變暗。',
    '目標位置不會隨時間移動；換 seed 才改變。',
    '衰減時間調長時，扇形後方留下更多亮點。',
    '方向切換後掃描改為逆時針。',
  ],
  transparent: true,
  cycle: 6.4,
  posterTime: 2.2,
  create(ctx) {
    const T = num(ctx, 'period', 3.2);
    const nT = Math.round(num(ctx, 'targets', 12));
    const decay = num(ctx, 'decay', 1.6);
    const sector = (num(ctx, 'sector', 55) * Math.PI) / 180;
    const labels = bool(ctx, 'labels', true);
    const dir = ctx.dirSign;
    const m = minSide(ctx);
    const R = m * 0.42 * clamp(ctx.s.scale, 0.5, 1.15);
    const cx = ctx.width / 2;
    const cy = ctx.height / 2;
    const th0 = -Math.PI / 2;
    const omega = TAU / T;
    // seeded, fixed positions with a minimum spacing (fewer overlapping labels)
    const minGap = R * clamp(0.5 / Math.sqrt(nT), 0.09, 0.3);
    const targets: { a: number; r: number; x: number; y: number; id: string; big: boolean }[] = [];
    for (let i = 0; i < nT; i++) {
      let best = { a: 0, r: 0, x: 0, y: 0, d: -1 };
      for (let tries = 0; tries < 24; tries++) {
        const a = ctx.rand() * TAU;
        const r = R * (0.18 + 0.74 * Math.sqrt(ctx.rand()));
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        let d = Infinity;
        for (const o of targets) d = Math.min(d, Math.hypot(o.x - x, (o.y - y) * 2.2));
        if (d > best.d) best = { a, r, x, y, d };
        if (d >= minGap * 2.2) break;
      }
      targets.push({ a: best.a, r: best.r, x: best.x, y: best.y, id: `T-${String(i + 1).padStart(2, '0')}`, big: ctx.rand() < 0.3 });
    }
    const WEDGES = 28;
    const fs = clamp(m * 0.026, 8, 13);

    return canvasRuntime(ctx, (g, t) => {
      const th = th0 + dir * omega * t;
      // scope grid
      g.strokeStyle = rgba(ctx.s.accent, 0.28);
      g.lineWidth = 1;
      g.beginPath();
      for (let k = 1; k <= 4; k++) {
        g.moveTo(cx + (R * k) / 4, cy);
        g.arc(cx, cy, (R * k) / 4, 0, TAU);
      }
      g.moveTo(cx - R, cy);
      g.lineTo(cx + R, cy);
      g.moveTo(cx, cy - R);
      g.lineTo(cx, cy + R);
      g.stroke();
      // ticks
      g.beginPath();
      for (let k = 0; k < 72; k++) {
        const a = (k / 72) * TAU;
        const l = k % 6 === 0 ? R * 0.06 : R * 0.025;
        g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        g.lineTo(cx + Math.cos(a) * (R - l), cy + Math.sin(a) * (R - l));
      }
      g.stroke();
      // sweep sector: wedges fading behind the beam
      for (let k = 0; k < WEDGES; k++) {
        const a0 = th - dir * (sector * k) / WEDGES;
        const a1 = th - dir * (sector * (k + 1)) / WEDGES;
        g.fillStyle = rgba(ctx.s.primary, 0.32 * (1 - k / WEDGES) ** 1.6);
        g.beginPath();
        g.moveTo(cx, cy);
        g.arc(cx, cy, R, Math.min(a0, a1), Math.max(a0, a1) + 0.002);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = ctx.s.primary;
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(th) * R, cy + Math.sin(th) * R);
      g.stroke();
      // targets
      g.textBaseline = 'middle';
      g.font = `600 ${fs}px ${ctx.font.mono}`;
      for (const tg of targets) {
        const since = mod(dir * (th - tg.a), TAU) / omega;
        // before the first pass nothing has lit the target yet
        const lit = t - since >= -1e-6 ? Math.exp(-since / decay) : 0;
        const dotR = (tg.big ? 4.5 : 3) * (m < 300 ? 0.8 : 1);
        g.fillStyle = rgba(ctx.s.secondary, 0.3 + 0.7 * lit);
        g.beginPath();
        g.arc(tg.x, tg.y, dotR * (1 + 0.6 * lit), 0, TAU);
        g.fill();
        if (lit > 0.05) {
          g.fillStyle = rgba(ctx.s.primary, lit);
          g.beginPath();
          g.arc(tg.x, tg.y, dotR * 0.55 * (1 + 0.6 * lit), 0, TAU);
          g.fill();
        }
        if (lit > 0.02) {
          const ringT = since / Math.min(1.2, decay);
          if (ringT < 1) {
            g.strokeStyle = rgba(ctx.s.secondary, 0.8 * (1 - ringT));
            g.lineWidth = 1.5;
            g.beginPath();
            g.arc(tg.x, tg.y, dotR + ringT * R * 0.12, 0, TAU);
            g.stroke();
          }
          if (labels && lit > 0.25) {
            const deg = Math.round(((mod(tg.a + Math.PI / 2, TAU) * 180) / Math.PI)) % 360;
            g.fillStyle = rgba(ctx.s.accent, lit);
            // labels point inward so they never leave the stage
            g.textAlign = tg.x > cx ? 'right' : 'left';
            const ox = tg.x > cx ? -dotR * 2.4 : dotR * 2.4;
            g.fillText(`${tg.id} ${String(deg).padStart(3, '0')}°`, tg.x + ox, tg.y);
          }
        }
      }
      // outer ring
      g.strokeStyle = rgba(ctx.s.accent, 0.6);
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(cx, cy, R, 0, TAU);
      g.stroke();
    });
  },
});
