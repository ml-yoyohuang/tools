import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, ease, easeInOut, lerp, minSide, mix, mod, num, rgba, TAU } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import { seg } from './_t14kit';

// Pure function of time on canvas. Each glyph has a slot (its place in the word,
// from layoutText) and a seat on a ring: angle_i(t) = −90° + s·(i·360°/n + ω·t).
// Phases: word hold → glyphs peel off one by one onto the turning ring (position
// lerps from slot to the MOVING seat) → all orbit, tangent-oriented → glyphs leave
// the ring one by one in reading order along an outward arc back to their slots.

const wrapPi = (a: number) => mod(a + Math.PI, TAU) - Math.PI;

export default defineEffect({
  id: 'letter-orbit',
  code: 'T22',
  nameZh: '字元軌道',
  nameEn: 'Letter Orbit',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '詞句中的字元一個個脫離、排上圓形軌道繞行，再依閱讀順序逐一飛回原本的位置。',
  tags: ['軌道', '逐字', '環繞', '圓形', 'orbit'],
  suitable: ['Logo 演繹', '品牌標語', '載入畫面'],
  principle:
    'Canvas 2D：每個字有「詞內位置」（layoutText）與「軌道座位」角度 θi(t) = −π/2 + s·(i·2π/n + ω·t)（s = 方向，ω 隨強度）。脫離時位置 = lerp(詞內位置, 目前座位, easeInOut(u))，座位本身持續轉動；繞行時字元旋轉到切線方向 θ + π/2；返回時以 power3.inOut 由座位插值回詞內位置，並加上 sin(πu)·0.18R 的向外弧線，旋轉角取最短路徑回到 0，落定時小幅彈跳。空位以淡色字形標示。',
  defaultText: 'ORBIT／軌道',
  palette: 'COOL',
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'direction', 'secondary', 'accent'],
  directions: ['cw', 'ccw'],
  maxChars: 24,
  textHint: '字數越多軌道上的字越小；建議 3–14 個字。',
  loopable: true,
  params: [
    { key: 'orbit', label: '繞行時間', type: 'range', min: 0.4, max: 5, step: 0.1, default: 1.6, unit: 's' },
    { key: 'stagger', label: '返回間隔', type: 'range', min: 0.04, max: 0.4, step: 0.01, default: 0.14, unit: 's' },
    { key: 'hold', label: '停留時間', type: 'range', min: 0.5, max: 4, step: 0.1, default: 1.6, unit: 's' },
    { key: 'radius', label: '軌道半徑', type: 'range', min: 0.6, max: 1.2, step: 0.05, default: 1 },
  ],
  recipe: {
    enter: '完整詞句停留 0.9s。',
    motion: '字元依序（間隔 ≤0.08s）以 easeInOut 飛上正在轉動的圓形軌道，所有字沿軌道繞行並朝向切線；之後依閱讀順序逐一（返回間隔可調）沿向外弧線飛回原位。',
    hold: '全部回位後停留（預設 1.6s），完整可讀。',
    exit: '再次脫離上軌道。',
    loop: '週期循環；關閉循環時停在回位後的完整詞句。',
  },
  accept: [
    '可看到個別字元（不是整個詞）沿圓形軌道繞行。',
    '返回時字元一個一個依閱讀順序回到原本位置，未回位的位置留有淡色空位。',
    '方向改為逆時針後繞行方向相反。',
    '停留時詞句完整、字距正確。',
  ],
  transparent: true,
  cycle: 7,
  posterTime: 2.6,
  create(ctx) {
    const { width: W, height: H } = ctx;
    const k = clamp(ctx.s.intensity, 0, 2);
    const orbitT = num(ctx, 'orbit', 1.6);
    const hold = num(ctx, 'hold', 1.6);
    const R = minSide(ctx) * 0.4 * num(ctx, 'radius', 1);
    const cx = W / 2;
    const cy = H / 2;
    const probe = layoutText(ctx, ctx.text, { maxWidth: R * 1.5, maxHeight: R * 0.9 });
    const n0 = Math.max(1, probe.chars.length);
    const L = layoutText(ctx, ctx.text, { maxWidth: R * 1.5, maxHeight: R * 0.9, maxSize: Math.min(R * 0.34, (TAU * R) / (n0 * 1.15)) });
    const chars = L.chars;
    const n = chars.length;
    const fs = L.fontSize;
    const rs = Math.min(num(ctx, 'stagger', 0.14), 3 / Math.max(1, n));
    const ps = Math.min(0.08, 1 / Math.max(1, n));
    const omega = 0.9 * (0.3 + 0.7 * k);
    const sgn = ctx.dirSign;
    const hold0 = 0.9;
    const PEEL = 0.75;
    const BACK = 0.8;
    const tA = (i: number) => hold0 + i * ps;
    const tOrbitEnd = tA(n - 1) + PEEL + orbitT;
    const tB = (i: number) => tOrbitEnd + i * rs;
    const settle = tB(n - 1) + BACK + 0.2;
    const cycle = tB(n - 1) + BACK + hold;
    const p3 = ease('power3.inOut');
    const seat = (i: number, t: number) => {
      const a = -Math.PI / 2 + sgn * ((i * TAU) / Math.max(1, n) + omega * t);
      return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, a };
    };

    return canvasRuntime(
      ctx,
      (g, time) => {
        const t = mod(time, cycle);
        // ring
        const ringA = 0.25 + 0.4 * (seg(t, tA(0), PEEL) - seg(t, tB(n - 1), BACK));
        g.strokeStyle = rgba(ctx.s.accent, ringA);
        g.lineWidth = Math.max(1, fs * 0.03);
        g.setLineDash([fs * 0.08, fs * 0.16]);
        g.lineDashOffset = -t * fs * 0.6 * sgn;
        g.beginPath();
        g.arc(cx, cy, R, 0, TAU);
        g.stroke();
        g.setLineDash([]);
        g.font = L.font;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        chars.forEach((c, i) => {
          let x = c.cx;
          let y = c.cy;
          let rot = 0;
          let sc = 1;
          let away = 0; // 0 = in slot, 1 = on ring
          const a0 = tA(i);
          const b0 = tB(i);
          if (t >= a0 && t < b0 + BACK) {
            const s = seat(i, t);
            const tan = wrapPi(s.a + Math.PI / 2);
            if (t < a0 + PEEL) {
              const u = easeInOut((t - a0) / PEEL);
              x = lerp(c.cx, s.x, u);
              y = lerp(c.cy, s.y, u);
              rot = tan * u;
              away = u;
            } else if (t < b0) {
              x = s.x;
              y = s.y;
              rot = tan;
              away = 1;
            } else {
              const u = p3((t - b0) / BACK);
              const bulge = Math.sin(Math.PI * u) * R * 0.18;
              x = lerp(s.x, c.cx, u) + Math.cos(s.a) * bulge;
              y = lerp(s.y, c.cy, u) + Math.sin(s.a) * bulge;
              rot = tan * (1 - u);
              away = 1 - u;
            }
          }
          const land = t - (b0 + BACK);
          if (land > 0 && land < 0.3) sc = 1 + 0.2 * k * Math.sin((Math.PI * land) / 0.3);
          if (away > 0.02) {
            // ghost slot
            g.fillStyle = rgba(ctx.s.primary, 0.14 * Math.min(1, away * 2));
            g.fillText(c.ch, c.cx, c.cy);
          }
          g.save();
          g.translate(x, y);
          g.rotate(rot);
          g.scale(sc, sc);
          g.fillStyle = away > 0 ? mix(ctx.s.primary, ctx.s.secondary, away) : ctx.s.primary;
          g.fillText(c.ch, 0, 0);
          g.restore();
        });
      },
      { settle },
    );
  },
});
