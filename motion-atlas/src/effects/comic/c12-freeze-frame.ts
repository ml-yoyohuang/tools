import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, easeOut3, minSide, num, str, TAU } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import { roundRectPath } from '../../engine/shapes';
import { backOut, inkText } from './_util';

export default defineEffect({
  id: 'freeze-frame',
  code: 'C12',
  nameZh: '漫畫暫停格',
  nameEn: 'Freeze Frame',
  category: 'comic',
  sourceType: 'original',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '跳躍中的球在半空突然定格：底色轉成色調，接著框線、速度線、標籤分三段出現，之後解凍繼續飛出。',
  tags: ['漫畫', '定格', '暫停', '速度線', 'freeze frame'],
  suitable: ['精彩瞬間', '遊戲慢動作', '產品特寫', '社群梗圖'],
  principle:
    'Canvas 2D：球的動作以「動作時間」τ 驅動（拋物線軌跡 + 旋轉 + 沿速度方向的拉伸，加 3 個殘影）；定格時 τ 停在 τ_f 不再增加，殘影與拉伸也凍結。定格後依序觸發四段：底色以 0.15 秒轉為色調、四邊框線依周長描入、與定格瞬間速度方向平行（或集中於球）的速度線由球向後長出、標籤以 back.out 從 160% 落定；解凍時各層反向收回，τ 繼續前進讓球飛出畫面。',
  defaultText: 'FREEZE!',
  palette: 'POP',
  colors: { background: '#FFFFFF', primary: '#3450FF', secondary: '#141414', accent: '#FFE35A' },
  controls: ['text', 'font', 'weight', 'scale', 'direction', 'secondary', 'accent'],
  directions: ['right', 'left'],
  textHint: '定格標籤，建議 2～10 個字。',
  maxChars: 20,
  params: [
    { key: 'freezeAt', label: '定格位置', type: 'range', min: 0.25, max: 0.75, step: 0.01, default: 0.45 },
    {
      key: 'lines',
      label: '速度線樣式',
      type: 'select',
      options: [
        { value: 'parallel', label: '平行（沿運動方向）' },
        { value: 'focus', label: '集中於球' },
      ],
      default: 'parallel',
    },
    { key: 'hold', label: '定格停留', type: 'range', min: 0.6, max: 3, step: 0.1, default: 1.6, unit: 's' },
    { key: 'ghosts', label: '殘影', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '球從畫面外沿拋物線跳入，邊旋轉邊沿速度方向拉伸，身後有殘影。',
    motion: '到達定格位置時動作瞬間停住；0.15 秒內底色轉成色調 → 0.35 秒框線描入 → 0.3 秒速度線長出 → 0.3 秒標籤落定，四段清楚分開。',
    hold: '定格畫面完全靜止，標籤可讀。',
    exit: '標籤、速度線、框線依反向順序 0.3 秒內收回，底色回復，球恢復動作並飛出畫面。',
    loop: '空白 0.3 秒後球再次跳入。',
  },
  accept: [
    '球在半空中明確停住，停住期間球、殘影都不動。',
    '底色、框線、速度線、標籤依序分段出現，而不是同時出現。',
    '解凍後球沿原軌跡繼續飛出。',
    '「速度線樣式」切換時速度線由平行變為集中於球。',
  ],
  transparent: true,
  cycle: 5.4,
  posterTime: 2.6,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const uf = num(ctx, 'freezeAt', 0.45);
    const focus = str(ctx, 'lines', 'parallel') === 'focus';
    const hold = num(ctx, 'hold', 1.6);
    const ghosts = bool(ctx, 'ghosts', true);
    const sgn = ctx.dirSign;
    const R = m * 0.095 * ctx.s.scale;
    const baseY = h * 0.74;
    const jump = h * 0.5;
    const pos = (u: number) => {
      const x = w / 2 + sgn * (u - 0.5) * (w + R * 4);
      const y = baseY - jump * 4 * u * (1 - u) * 1.05;
      return { x, y };
    };
    const vel = (u: number) => {
      const a = pos(u - 0.002);
      const b = pos(u + 0.002);
      const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
    };
    // timeline (s)
    const ACT = 1.4; // seconds to cross the full path
    const tF = uf * ACT;
    const T1 = tF; // freeze moment
    const steps = [0.15, 0.35, 0.3, 0.3];
    const tHoldEnd = T1 + steps.reduce((a, b) => a + b, 0) + hold;
    const REL = 0.3;
    const tRun = tHoldEnd + REL;
    const tEnd = tRun + (1 - uf) * ACT + 0.3;
    const cycle = tEnd + 0.3;
    // label
    const lx = w / 2 - sgn * w * 0.24;
    const ly = h * 0.8;
    const layout = layoutText(ctx, ctx.text, { cx: 0, cy: 0, maxWidth: w * 0.36, maxHeight: h * 0.14, fill: 0.95, noScale: true });
    const fz = pos(uf);
    const fv = vel(uf);
    const nl = Math.round(18 * (0.6 + 0.4 * ctx.q));
    const lines = Array.from({ length: nl }, (_, i) => ({
      off: ((i + 0.5) / nl - 0.5) * 2.4,
      len: 0.4 + ctx.rand() * 0.6,
      ang: (i / nl) * TAU + ctx.rand() * 0.15,
      wid: 0.5 + ctx.rand(),
    }));
    const inset = m * 0.045;
    const frameLW = Math.max(3, m * 0.014);
    const perim = 2 * (w - inset * 2 + h - inset * 2);
    const ball = (g: CanvasRenderingContext2D, x: number, y: number, rot: number, stretch: number, v: { x: number; y: number }, alpha: number) => {
      g.save();
      g.globalAlpha = alpha;
      g.translate(x, y);
      const va = Math.atan2(v.y, v.x);
      g.rotate(va);
      g.scale(1 + stretch, 1 - stretch * 0.6);
      g.rotate(rot - va);
      g.beginPath();
      g.arc(0, 0, R, 0, TAU);
      g.fillStyle = ctx.s.primary;
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = '#FFFFFF';
      g.fillRect(-R, -R * 0.18, R * 2, R * 0.36);
      g.restore();
      g.lineWidth = Math.max(2, R * 0.08);
      g.strokeStyle = ctx.s.secondary;
      g.stroke();
      g.restore();
    };
    return canvasRuntime(ctx, (g, tt) => {
      const t = ((tt % cycle) + cycle) % cycle;
      // action time τ: frozen between T1 and tRun
      const tau = t < T1 ? t : t < tRun ? T1 : T1 + (t - tRun);
      const frozen = t >= T1 && t < tRun;
      const ft = t - T1; // time since freeze
      const k = (i: number) => {
        // progress of freeze step i (0..1), retracting during release
        let s0 = 0;
        for (let j = 0; j < i; j++) s0 += steps[j];
        const p = clamp((ft - s0) / steps[i], 0, 1);
        if (t >= tHoldEnd) {
          const r = clamp((t - tHoldEnd - (3 - i) * 0.06) / (REL - 0.12), 0, 1);
          return p * (1 - r);
        }
        return t < T1 ? 0 : p;
      };
      const tint = k(0);
      const frame = k(1);
      const speed = k(2);
      const label = k(3);
      if (tint > 0) {
        g.fillStyle = ctx.s.accent;
        g.globalAlpha = easeOut3(tint);
        g.fillRect(0, 0, w, h);
        g.globalAlpha = 1;
      }
      // speed lines behind the frozen ball
      if (speed > 0) {
        const e = easeOut3(speed);
        g.fillStyle = ctx.s.secondary;
        g.beginPath();
        for (const L of lines) {
          if (focus) {
            const ca = Math.cos(L.ang);
            const sa = Math.sin(L.ang);
            const far = Math.hypot(w, h);
            const r0 = R * 1.9 + (1 - e) * far * 0.5;
            const half = m * 0.006 * L.wid;
            g.moveTo(fz.x + ca * r0, fz.y + sa * r0);
            g.lineTo(fz.x + ca * far - sa * half, fz.y + sa * far + ca * half);
            g.lineTo(fz.x + ca * far + sa * half, fz.y + sa * far - ca * half);
            g.closePath();
          } else {
            const px = -fv.y;
            const py = fv.x;
            const sx = fz.x - fv.x * R * 1.3 + px * L.off * R;
            const sy = fz.y - fv.y * R * 1.3 + py * L.off * R;
            const len = m * (0.25 + 0.45 * L.len) * e * (1 - Math.abs(L.off) * 0.25);
            const half = R * 0.035 * L.wid;
            g.moveTo(sx + px * half, sy + py * half);
            g.lineTo(sx - fv.x * len, sy - fv.y * len);
            g.lineTo(sx - px * half, sy - py * half);
            g.closePath();
          }
        }
        g.fill();
      }
      // ghosts + ball (driven by τ)
      const u = tau / ACT;
      const v = vel(clamp(u, 0.01, 0.99));
      const rot = tau * 7 * sgn;
      if (ghosts && u > 0.04 && u < 1.1) {
        for (let i = 3; i >= 1; i--) {
          const ug = u - i * 0.045;
          const p = pos(ug);
          ball(g, p.x, p.y, rot - i * 0.3 * sgn, 0.12, v, 0.14 * (4 - i) * (frozen ? 1 : 0.8));
        }
      }
      const p = pos(u);
      ball(g, p.x, p.y, rot, frozen ? 0.16 : 0.16 * Math.min(1, Math.abs(v.y) + 0.4), v, 1);
      // frame lines drawn along the perimeter from the top-left corner
      if (frame > 0) {
        const e = easeOut3(frame);
        g.save();
        g.lineWidth = frameLW;
        g.strokeStyle = ctx.s.secondary;
        g.lineCap = 'square';
        g.setLineDash([perim * e, perim]);
        g.beginPath();
        g.rect(inset, inset, w - inset * 2, h - inset * 2);
        g.stroke();
        // corner ticks
        g.setLineDash([]);
        g.lineWidth = frameLW * 0.5;
        g.globalAlpha = e;
        const c = inset * 0.5;
        g.beginPath();
        for (const [x, y, dx, dy] of [
          [inset, inset, -1, -1],
          [w - inset, inset, 1, -1],
          [w - inset, h - inset, 1, 1],
          [inset, h - inset, -1, 1],
        ]) {
          g.moveTo(x + dx * c * 0.2, y + dy * c);
          g.lineTo(x + dx * c, y + dy * c);
          g.lineTo(x + dx * c, y + dy * c * 0.2);
        }
        g.stroke();
        g.restore();
      }
      // label
      if (label > 0) {
        const s = label < 1 && t < tHoldEnd ? 1.6 - 0.6 * backOut(label, 2.4) : label;
        const pw = layout.width / 2 + layout.fontSize * 0.5;
        const phh = layout.height / 2 + layout.fontSize * 0.25;
        g.save();
        g.translate(lx, ly);
        g.rotate(-0.07 * sgn);
        g.scale(s, s);
        g.globalAlpha = clamp(label * 3, 0, 1);
        g.beginPath();
        roundRectPath(g, -pw + layout.fontSize * 0.12, -phh + layout.fontSize * 0.15, pw * 2, phh * 2, layout.fontSize * 0.1);
        g.fillStyle = ctx.s.secondary;
        g.fill();
        g.beginPath();
        roundRectPath(g, -pw, -phh, pw * 2, phh * 2, layout.fontSize * 0.1);
        g.fillStyle = '#FFFFFF';
        g.fill();
        g.lineWidth = Math.max(2, layout.fontSize * 0.08);
        g.strokeStyle = ctx.s.secondary;
        g.stroke();
        inkText(g, layout, ctx.s.secondary, null, 0);
        g.restore();
      }
    });
  },
});
