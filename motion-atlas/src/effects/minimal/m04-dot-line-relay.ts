import { defineEffect } from '../../engine/define';
import { canvasRuntime, easeOutBack, lerp, minSide, num, phase, rgba, TAU } from '../../engine/helpers';
import { easeExpoInOut, easeQuartInOut, hair } from './_util';

export default defineEffect({
  id: 'dot-line-relay',
  code: 'M04',
  nameZh: '點線接力',
  nameEn: 'Dot Line Relay',
  category: 'minimal',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '小點一站一站前進，身後拉出一段短線；短線再被收回到點上，下一棒接著出發。',
  tags: ['極簡', '點', '線', '接力', 'relay'],
  suitable: ['步驟／進度指示', '載入畫面', '簡報轉場'],
  principle:
    'Canvas 2D：舞台中線上平均分佈 K 個站點。每一棒分四段：前進（點以 quart.inOut 從站 i 移到 i+1，線尾固定在站 i，所以線跟著點長出）、短停、收回（線尾以 expo.inOut 追上點，線長歸零）、停頓。收回完成時點以 back.out 微微放大當作交棒。最後一站點縮小消失，再從第一站長出。',
  defaultText: '',
  palette: 'MONO',
  colors: { background: '#FFFFFF', primary: '#141414', secondary: '#8A8A8A', accent: '#3450FF' },
  controls: ['scale', 'direction', 'secondary', 'accent'],
  directions: ['right', 'left'],
  params: [
    { key: 'stations', label: '站點數', type: 'range', min: 3, max: 9, step: 1, default: 6 },
    { key: 'advance', label: '前進時間', type: 'range', min: 0.4, max: 2, step: 0.05, default: 0.9, unit: 's' },
    { key: 'pause', label: '站間停頓', type: 'range', min: 0, max: 1.5, step: 0.05, default: 0.35, unit: 's' },
    { key: 'ticks', label: '站點刻度透明度', type: 'range', min: 0, max: 1, step: 0.05, default: 0.45 },
  ],
  recipe: {
    enter: '點在第一站以 back.out 長出。',
    motion: '點以 quart.inOut 前進一站，身後的線同步長出；短停後線尾以 expo.inOut 收回到點上。',
    hold: '每站停頓約 0.35 秒，收回瞬間點輕微放大。',
    exit: '到最後一站點縮小消失。',
    loop: '從第一站重新出發，無縫循環。',
  },
  accept: [
    '點前進時，身後的線從上一站延伸到點的位置。',
    '線之後被收回，線尾追上點，線消失。',
    '每一棒之間有停頓，最後一站之後從頭開始。',
    '方向改成 left 時從右往左前進。',
  ],
  transparent: true,
  cycle: 11,
  posterTime: 1.1,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const K = Math.round(num(ctx, 'stations', 6));
    const adv = num(ctx, 'advance', 0.9);
    const pause = num(ctx, 'pause', 0.35);
    const tickA = num(ctx, 'ticks', 0.45);
    const margin = Math.max(m * 0.12, w * 0.12);
    const xs = Array.from({ length: K }, (_, i) => {
      const f = i / (K - 1);
      return ctx.dirSign > 0 ? lerp(margin, w - margin, f) : lerp(w - margin, margin, f);
    });
    const y = h / 2;
    const dotR = Math.max(3, m * 0.02 * ctx.s.scale);
    const lw = hair(m, 0.006 * ctx.s.scale, 1.5);
    const holdA = 0.22;
    const ret = adv * 0.8;
    const leg = [adv, holdA, ret, pause];
    const legT = leg.reduce((a, b) => a + b, 0);
    const endT = 0.45;
    const startT = 0.45;
    const total = startT + legT * (K - 1) + endT;
    return canvasRuntime(ctx, (g, t) => {
      const u = ((t % total) + total) % total;
      // station ticks
      if (tickA > 0) {
        g.strokeStyle = rgba(ctx.s.secondary, tickA);
        g.lineWidth = Math.max(1, lw * 0.5);
        g.beginPath();
        for (const x of xs) {
          g.moveTo(x, y + dotR * 2.2);
          g.lineTo(x, y + dotR * 3.6);
        }
        g.stroke();
      }
      let dotX = xs[0];
      let tailX = xs[0];
      let rScale = 1;
      if (u < startT) {
        rScale = easeOutBack(u / startT, 2.2);
      } else if (u >= total - endT) {
        dotX = tailX = xs[K - 1];
        rScale = 1 - easeQuartInOut((u - (total - endT)) / endT);
      } else {
        const v = u - startT;
        const i = Math.min(K - 2, Math.floor(v / legT));
        const ph = phase(v - i * legT, leg);
        const a = xs[i];
        const b = xs[i + 1];
        if (ph.i === 0) {
          dotX = lerp(a, b, easeQuartInOut(ph.p));
          tailX = a;
        } else if (ph.i === 1) {
          dotX = b;
          tailX = a;
        } else if (ph.i === 2) {
          dotX = b;
          tailX = lerp(a, b, easeExpoInOut(ph.p));
        } else {
          dotX = tailX = b;
          // hand-over bump right after the tail arrives
          rScale = 1 + 0.28 * Math.sin(Math.PI * ph.p);
        }
      }
      if (Math.abs(dotX - tailX) > 0.5) {
        g.strokeStyle = ctx.s.primary;
        g.lineWidth = lw;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(tailX, y);
        g.lineTo(dotX, y);
        g.stroke();
      }
      if (rScale > 0.01) {
        g.fillStyle = ctx.s.accent;
        g.beginPath();
        g.arc(dotX, y, dotR * rScale, 0, TAU);
        g.fill();
      }
    });
  },
});
