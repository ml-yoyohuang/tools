import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, ease, lerp, mod, num, rgba, smoothstep, TAU } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { fitSize, fontString, graphemes, isSpace, layoutText, phrases, textWidth, type TextLayout } from '../../engine/text';

// Ported from kinetic-typography e01-word-burst (GSAP DOM → pure-time Canvas 2D) and
// extended to the atlas spec: the main word still bursts in (glyphs blast outwards
// with expo.out, then snap home with back.out(2.8); flash disc, ring, radial rays,
// stage jolt) and then HOLDS in the centre, while a crowd of small satellite words
// shoots out radially from behind it, spinning (expo.out), drifts, and is recalled
// with back.in (a short wind-up away from the centre, then a pull back in) and
// absorbed by the main word, which answers with a small pulse.
interface Sat {
  word: string;
  size: number;
  a: number;
  r0: number;
  r1: number;
  rot0: number;
  rot1: number;
  spin: number;
  delay: number;
  col: string;
}
interface Ray {
  a: number;
  len: number;
  r0: number;
  th: number;
  st: number;
  col: string;
}

const tw = (t: number, start: number, dur: number) => clamp((t - start) / dur, 0, 1);

export default defineEffect({
  id: 'word-burst',
  code: 'T08',
  nameZh: '單字爆發',
  nameEn: 'Word Burst',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '主詞爆開後停在中央，周圍一群小詞沿放射方向旋轉飛散，停留後再被吸回主詞。',
  tags: ['爆發', '放射', '過衝', '回收', 'burst'],
  suitable: ['開場重點詞', '活動宣傳', '關鍵字強調'],
  principle:
    'Canvas 2D 純時間函數（移植自 GSAP 版本）：主詞每個字先從中心以 expo.out 衝過頭再以 back.out(2.8) 回到排版位置，搭配閃光圓盤、外擴圓環、放射線與畫面短震。爆點同時，N 個小詞從主詞後方沿各自角度以 expo.out 飛到主詞外橢圓與舞台邊界之間的半徑，邊飛邊旋轉，停留時緩慢漂移；回收段以 back.in(1.6) 先向外蓄力再吸回中心並淡出，主詞以衰減脈衝吸收。多個詞時每輪輪替主詞，其餘詞成為周邊小詞。',
  defaultText: 'BOOM／爆發／POP／WOW',
  palette: 'POP',
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'secondary', 'accent', 'seed'],
  maxChars: 40,
  loopable: true,
  textHint: '用「／」分隔多個詞：第一個是主詞，其他是周邊小詞（每輪輪替）；只有一個詞時小詞取自它的字。',
  params: [
    { key: 'count', label: '周邊小詞數', type: 'range', min: 4, max: 32, step: 1, default: 14 },
    { key: 'spread', label: '飛散距離', type: 'range', min: 0.2, max: 1, step: 0.05, default: 0.75 },
    { key: 'rays', label: '放射線數', type: 'range', min: 0, max: 36, step: 2, default: 18 },
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.4, max: 3, step: 0.1, default: 1.5, unit: 's' },
  ],
  recipe: {
    enter: '主詞的字從中心以 expo.out（0.2s）衝出並過衝放大，再以 back.out(2.8)（0.62s）回到排版位置；閃光圓盤、圓環與放射線同時炸開，畫面短震 0.15s。',
    motion: '爆點時周邊小詞從主詞後方沿放射方向 expo.out（0.75s）飛出並旋轉，之後緩慢漂移旋轉。',
    hold: '主詞在中央停留；小詞散在四周停留 hold 秒（預設 1.5s）。',
    exit: '小詞以 back.in(1.6) 先外推再吸回中心淡出，主詞以衰減脈衝吸收後向中心縮小消失（power3.in）。',
    loop: '下一輪換下一個詞當主詞，重新爆發。',
  },
  accept: [
    '主詞爆開後停在中央可讀。',
    '小詞從主詞後方沿放射方向飛出、邊飛邊旋轉，分布在主詞四周。',
    '停留後小詞被吸回中心，主詞有吸收的脈衝。',
    '多個詞時下一輪換主詞。',
  ],
  transparent: true,
  cycle: 5,
  posterTime: 1.3,
  legacyIds: ['word-burst'],
  create(ctx) {
    const W = ctx.width;
    const H = ctx.height;
    const k = ctx.s.intensity;
    const list = phrases(ctx.text);
    const nSat = Math.round(num(ctx, 'count', 14) * (0.55 + 0.45 * ctx.q));
    const spread = num(ctx, 'spread', 0.75);
    const nRays = Math.round(num(ctx, 'rays', 18) * (0.4 + 0.6 * ctx.q));
    const hold = num(ctx, 'hold', 1.5);
    const reach = Math.hypot(W, H) / 2;
    const bx = W / 2;
    const by = H / 2;
    const { primary: fg, secondary: sec, accent: acc } = ctx.s;
    const expoOut = ease('expo.out');
    const backOut = ease('back.out(2.8)');
    const backIn = ease('back.in(1.6)');
    const p3in = ease('power3.in');
    const p4out = ease('power4.out');
    const p2out = ease('power2.out');
    const p2in = ease('power2.in');
    const p3out = ease('power3.out');

    const T0 = 0.12;
    const HIT = T0 + 0.2;
    const OUT = 0.75;
    const RECALL = HIT + OUT + 0.25 + hold;
    const RDUR = 0.55;
    const EXIT = RECALL + RDUR + 0.45;
    const CYCLE = EXIT + 0.75;

    interface Scene {
      L: TextLayout;
      sats: Sat[];
      rays: Ray[];
      radius: number;
      maxOff: number;
      glyph: { dx: number; dy: number; m: number; rot: number }[];
    }
    const scenes: Scene[] = list.map((mainWord, si) => {
      const L = layoutText(ctx, mainWord, { maxWidth: W * 0.56, maxHeight: H * 0.32 });
      const fs = L.fontSize;
      const others = list.filter((_, i) => i !== si);
      const pool = others.length ? others : [...graphemes(mainWord).filter((g) => !isSpace(g)), mainWord];
      const sats: Sat[] = [];
      for (let i = 0; i < nSat; i++) {
        const word = pool[i % pool.length];
        const a = (i / nSat) * TAU + (hash2(i, 31 + si, ctx.seed) - 0.5) * (TAU / nSat) * 0.8;
        const size = Math.max(8, Math.min(fs * (0.22 + 0.16 * hash2(i, 32 + si, ctx.seed)), fitSize(word, W * 0.24, H * 0.1, ctx.family, ctx.weight, ctx.s.tracking)));
        const hw = textWidth(word, size, ctx.family, ctx.weight, ctx.s.tracking) / 2;
        const cos = Math.cos(a);
        const sin = Math.sin(a);
        const rIn = Math.hypot((cos * L.width) / 2, (sin * L.height) / 2) + fs * 0.35 + size * 0.5;
        const edge = Math.min((W / 2 - hw - size * 0.3) / Math.max(0.01, Math.abs(cos)), (H / 2 - size * 0.8) / Math.max(0.01, Math.abs(sin)));
        const r1 = Math.max(rIn, lerp(rIn, Math.max(rIn, edge), spread * (0.35 + 0.65 * hash2(i, 33 + si, ctx.seed))));
        sats.push({
          word,
          size,
          a,
          r0: fs * 0.2,
          r1,
          rot0: (hash2(i, 34 + si, ctx.seed) - 0.5) * TAU * 0.9 * k,
          rot1: (hash2(i, 35 + si, ctx.seed) - 0.5) * 0.7,
          spin: (hash2(i, 36 + si, ctx.seed) - 0.5) * 0.5,
          delay: hash2(i, 37 + si, ctx.seed) * 0.08,
          col: i % 3 === 2 ? acc : sec,
        });
      }
      const rays: Ray[] = Array.from({ length: nRays }, (_, i) => {
        const a = (i / Math.max(1, nRays)) * TAU + (hash2(i, 1, ctx.seed) - 0.5) * (5 / Math.max(1, nRays));
        return {
          a,
          len: reach * (0.18 + hash2(i, 2, ctx.seed) * 0.22),
          th: Math.max(2, fs * (0.03 + hash2(i, 3, ctx.seed) * 0.05)),
          r0: Math.hypot((Math.cos(a) * L.width) / 2, (Math.sin(a) * L.height) / 2) + fs * 0.25,
          st: T0 + 0.03 + hash2(i, 5, ctx.seed) * 0.06,
          col: i % 3 === 0 ? fg : sec,
        };
      });
      let maxOff = 1;
      for (const g of L.chars) maxOff = Math.max(maxOff, Math.hypot(g.cx - bx, g.cy - by));
      const glyph = L.chars.map((g, i) => {
        let dx = g.cx - bx;
        let dy = g.cy - by;
        const d = Math.hypot(dx, dy);
        if (d < 1) {
          const a = hash2(i, 7, ctx.seed) * TAU;
          dx = Math.cos(a);
          dy = Math.sin(a);
        } else {
          dx /= d;
          dy /= d;
        }
        dy += (hash2(i, 9, ctx.seed) - 0.5) * 0.9;
        return { dx, dy, m: 0.6 * k * fs * (0.35 + 0.65 * clamp(d / maxOff, 0, 1)), rot: (hash2(i, 11, ctx.seed) - 0.5) * 0.42 * k };
      });
      return { L, sats, rays, radius: Math.max(L.width, L.height) / 2, maxOff, glyph };
    });

    return canvasRuntime(
      ctx,
      (g, t) => {
        const S = scenes[Math.floor(t / CYCLE) % scenes.length];
        const tl = mod(t, CYCLE);
        const L = S.L;
        const fs = L.fontSize;
        // stage jolt
        const j = Math.max(2, fs * 0.04) * k;
        const jt = tl - HIT;
        if (jt > 0 && jt < 0.155) {
          const f = jt < 0.035 ? [j, -j * 0.6] : jt < 0.07 ? [-j * 0.7, j * 0.5] : jt < 0.105 ? [j * 0.3, -j * 0.2] : [0, 0];
          g.translate(f[0], f[1]);
        }
        // flash disc + ring
        const d1 = p4out(tw(tl, T0, 0.1));
        const d2 = p2out(tw(tl, T0 + 0.1, 0.35));
        const discS = tl < T0 + 0.1 ? lerp(0.2, 1.15, d1) : lerp(1.15, 1.5, d2);
        const discA = tl < T0 + 0.1 ? 0.9 * d1 : 0.9 * (1 - d2);
        if (discA > 0.01) {
          g.fillStyle = rgba(sec, discA);
          g.beginPath();
          g.arc(bx, by, S.radius * 0.75 * discS, 0, TAU);
          g.fill();
        }
        const r1 = p3out(tw(tl, T0 + 0.04, 0.12));
        const r2 = expoOut(tw(tl, T0 + 0.16, 0.6));
        const ringS = tl < T0 + 0.16 ? lerp(0.2, 0.9, r1) : lerp(0.9, 2.6, r2);
        const ringA = tl < T0 + 0.16 ? r1 : 1 - r2;
        if (ringA > 0.01) {
          g.strokeStyle = rgba(sec, ringA);
          g.lineWidth = Math.max(2, fs * 0.05);
          g.beginPath();
          g.arc(bx, by, S.radius * ringS, 0, TAU);
          g.stroke();
        }
        // rays
        g.lineCap = 'round';
        for (const r of S.rays) {
          let a0: number;
          let a1: number;
          if (tl < r.st) continue;
          if (tl < r.st + 0.16) {
            a0 = r.r0;
            a1 = r.r0 + r.len * expoOut(tw(tl, r.st, 0.16));
          } else {
            const e = p2in(tw(tl, r.st + 0.16, 0.34));
            if (e >= 1) continue;
            a1 = r.r0 + r.len + r.len * 0.9 * e;
            a0 = a1 - r.len * (1 - e);
          }
          g.strokeStyle = r.col;
          g.lineWidth = r.th;
          g.beginPath();
          g.moveTo(bx + Math.cos(r.a) * a0, by + Math.sin(r.a) * a0);
          g.lineTo(bx + Math.cos(r.a) * a1, by + Math.sin(r.a) * a1);
          g.stroke();
        }
        // satellites (behind the main word)
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        for (const s of S.sats) {
          const launch = HIT + s.delay;
          if (tl < launch) continue;
          const pOut = expoOut(tw(tl, launch, OUT));
          const age = tl - launch;
          const pr = tw(tl, RECALL + s.delay * 0.6, RDUR);
          const pIn = backIn(pr);
          let r = lerp(s.r0, s.r1, pOut) * (1 + 0.03 * Math.sin(age * 2.1 + s.a * 3));
          const ang = s.a + age * 0.05 * Math.sign(s.spin || 1);
          r = lerp(r, s.r0 * 0.5, pIn);
          const rot = lerp(s.rot0, s.rot1, pOut) + age * s.spin + pIn * s.rot0 * 0.5;
          const sc = lerp(0.3, 1, pOut) * lerp(1, 0.25, pIn);
          const al = clamp(pOut * 4, 0, 1) * (1 - smoothstep(0.75, 1, pr));
          if (al <= 0.01) continue;
          g.save();
          g.globalAlpha = al;
          g.translate(bx + Math.cos(ang) * r, by + Math.sin(ang) * r);
          g.rotate(rot);
          g.scale(sc, sc);
          g.font = fontString(s.size, ctx.family, ctx.weight);
          g.fillStyle = s.col;
          g.fillText(s.word, 0, 0);
          g.restore();
        }
        // main word glyphs
        const absorb = tl > RECALL + RDUR ? Math.exp(-(tl - RECALL - RDUR) * 7) * Math.sin((tl - RECALL - RDUR) * 26) * 0.08 * k : 0;
        g.font = L.font;
        g.fillStyle = fg;
        const n = L.chars.length;
        L.chars.forEach((c, i) => {
          const gl = S.glyph[i];
          const st = T0 + i * Math.min(0.012, 0.15 / n);
          if (tl < st) return;
          const fromX = (bx - c.cx) * 0.92;
          const fromY = (by - c.cy) * 0.92;
          let x: number;
          let y: number;
          let sc: number;
          let rot: number;
          let al = 1;
          if (tl < st + 0.2) {
            const e = expoOut(tw(tl, st, 0.2));
            x = lerp(fromX, gl.dx * gl.m, e);
            y = lerp(fromY, gl.dy * gl.m, e);
            sc = lerp(0.15, 1 + 0.32 * k, e);
            rot = lerp(-gl.rot, gl.rot, e);
            al = e;
          } else {
            const e = backOut(tw(tl, st + 0.2, 0.62));
            x = lerp(gl.dx * gl.m, 0, e);
            y = lerp(gl.dy * gl.m, 0, e);
            sc = lerp(1 + 0.32 * k, 1, e);
            rot = lerp(gl.rot, 0, e);
          }
          sc *= 1 + absorb;
          const ex = p3in(tw(tl, EXIT + i * Math.min(0.015, 0.12 / n), 0.26));
          if (ex > 0) {
            x = lerp(x, (bx - c.cx) * 0.6, ex);
            y = lerp(y, (by - c.cy) * 0.6, ex);
            sc *= 1 - ex;
            al *= 1 - ex;
          }
          if (al <= 0.01 || sc <= 0.01) return;
          g.save();
          g.globalAlpha = al;
          g.translate(c.cx + x + (c.cx - bx) * absorb, c.cy + y + (c.cy - by) * absorb);
          g.rotate(rot);
          g.scale(sc, sc);
          g.fillText(c.ch, 0, 0);
          g.restore();
        });
      },
      { settle: HIT + OUT + 0.25 },
    );
  },
});
