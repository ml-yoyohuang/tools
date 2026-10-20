import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, lerp, minSide, mod, num } from '../../engine/helpers';
import { easeExpoInOut, easeSineInOut, hair } from './_util';

export default defineEffect({
  id: 'negative-space-slider',
  code: 'M09',
  nameZh: '留白滑塊',
  nameEn: 'Negative Space Slider',
  category: 'minimal',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '一個小方塊在大片留白中以不等距的跳步滑動，距離越遠停得越久，間距與停頓本身就是節奏。',
  tags: ['極簡', '留白', '節奏', '滑塊', 'negative space'],
  suitable: ['品牌背景', '作品集首頁', '音樂／節奏視覺'],
  principle:
    'Canvas 2D：以 seed 產生 N 個間距（1–3 單位），單位 = 可用寬度 / 間距總和。每一步滑動時間 = 0.32 + 0.16·間距，用 expo.inOut 讓起停俐落；落點後停頓 = (0.25 + 0.35·間距)·停頓倍率，所以大跳之後停得較久。落點留下淡出的刻度記錄剛才的間距；到底後以 sine.inOut 緩慢滑回起點。',
  defaultText: '',
  palette: 'MONO',
  colors: { background: '#FFFFFF', primary: '#141414', secondary: '#3450FF', accent: '#D4D4D4' },
  controls: ['scale', 'direction', 'secondary', 'seed'],
  directions: ['right', 'left'],
  params: [
    { key: 'steps', label: '步數', type: 'range', min: 3, max: 8, step: 1, default: 5 },
    { key: 'rest', label: '停頓倍率', type: 'range', min: 0.3, max: 3, step: 0.1, default: 1 },
    { key: 'size', label: '方塊大小', type: 'range', min: 0.02, max: 0.12, step: 0.005, default: 0.05 },
    { key: 'height', label: '水平線位置', type: 'range', min: 0.2, max: 0.8, step: 0.02, default: 0.62 },
  ],
  recipe: {
    enter: '方塊停在左側起點。',
    motion: '依不等距間距以 expo.inOut 跳步滑動，每步 0.3–0.8 秒。',
    hold: '落點後停頓，間距越大停越久（0.6–1.3 秒），落點刻度慢慢淡出。',
    exit: '到右端停留後以 sine.inOut 緩慢滑回起點。',
    loop: '同一 seed 的節奏重複；換 seed 換節奏。',
  },
  accept: [
    '畫面大部分是留白，只有一個小方塊與淡淡的刻度。',
    '方塊每步移動距離不同，大跳後停頓較長。',
    '方塊滑動起停俐落，回程則慢而平順。',
    '換 seed 後間距節奏改變；停頓倍率調大時停更久。',
  ],
  transparent: true,
  cycle: 9,
  posterTime: 0.2,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const N = Math.round(num(ctx, 'steps', 5));
    const rest = num(ctx, 'rest', 1);
    const size = m * num(ctx, 'size', 0.05) * ctx.s.scale;
    const y = h * num(ctx, 'height', 0.62);
    const bag = [1, 1, 1, 2, 2, 3];
    const gaps = Array.from({ length: N }, () => bag[Math.floor(ctx.rand() * bag.length)]);
    const units = gaps.reduce((a, b) => a + b, 0);
    const margin = Math.max(m * 0.1, w * 0.1);
    const span = Math.max(10, w - margin * 2 - size);
    const unit = span / units;
    const sx = (d: number) => (ctx.dirSign > 0 ? margin + d : w - margin - size - d);
    // build the schedule: [move, rest] per step, then a long return
    interface Seg {
      t0: number;
      dur: number;
      from: number;
      to: number;
      kind: 'move' | 'rest' | 'back';
    }
    const segs: Seg[] = [];
    let tt = 0;
    let pos = 0;
    segs.push({ t0: 0, dur: 0.7 * rest, from: 0, to: 0, kind: 'rest' });
    tt += 0.7 * rest;
    const stops = [0];
    for (const gp of gaps) {
      const md = 0.32 + 0.16 * gp;
      segs.push({ t0: tt, dur: md, from: pos, to: pos + gp * unit, kind: 'move' });
      tt += md;
      pos += gp * unit;
      stops.push(pos);
      const rd = (0.25 + 0.35 * gp) * rest;
      segs.push({ t0: tt, dur: rd, from: pos, to: pos, kind: 'rest' });
      tt += rd;
    }
    segs.push({ t0: tt, dur: 1.8, from: pos, to: 0, kind: 'back' });
    tt += 1.8;
    const total = tt;
    const tickH = Math.max(4, m * 0.018);
    const lw = hair(m, 0.003);
    return canvasRuntime(ctx, (g, t) => {
      const u = mod(t, total);
      let x = 0;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        if (u >= s.t0 && u < s.t0 + s.dur) {
          const p = (u - s.t0) / s.dur;
          x = s.kind === 'move' ? lerp(s.from, s.to, easeExpoInOut(p)) : s.kind === 'back' ? lerp(s.from, s.to, easeSineInOut(p)) : s.from;
          break;
        }
      }
      // landing ticks: each stop marks the spacing, fading over ~2.4 s after landing
      g.strokeStyle = ctx.s.secondary;
      g.lineWidth = lw;
      for (let k = 0; k < stops.length; k++) {
        // time the block landed on stop k
        const landT = k === 0 ? 0 : segs[2 * k - 1 + 1].t0;
        const age = u - landT;
        if (age < 0) continue;
        const a = clamp(1 - age / 2.6, 0, 1) * 0.9;
        if (a <= 0.01) continue;
        const tx = sx(stops[k]) + size / 2;
        g.globalAlpha = a;
        g.beginPath();
        g.moveTo(tx, y + size * 0.5 + tickH * 0.8);
        g.lineTo(tx, y + size * 0.5 + tickH * 1.8);
        g.stroke();
      }
      g.globalAlpha = 1;
      g.fillStyle = ctx.s.primary;
      g.fillRect(sx(x), y - size / 2, size, size);
    });
  },
});
