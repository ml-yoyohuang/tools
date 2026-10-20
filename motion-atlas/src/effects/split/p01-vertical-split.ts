import { defineEffect } from '../../engine/define';
import { canvasRuntime, ease, num, rgba } from '../../engine/helpers';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { AB_HINT, drawPiece, drawScaled, line, local } from './_util';

export default defineEffect({
  id: 'vertical-split',
  code: 'P01',
  nameZh: '左右分割',
  nameEn: 'Vertical Split',
  category: 'split',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '一道切線先劃過中線，舊畫面沿線裂成左右兩半向外滑開，露出後方逐漸推近的新場景。',
  tags: ['分割', '左右', '開門', '轉場', 'split'],
  suitable: ['開場揭幕', '前後對照', '章節轉場'],
  principle:
    'Canvas 2D：A、B 預繪於離屏畫布。切線 x(y) = cut·W + tan(傾角)·(y − H/2)。前 20% 進度在 A 上畫出切線；之後左半多邊形以 power3.inOut 位移 −(max(x)+pad)，右半位移 +(W − min(x)+pad)，各自 clip 後 drawImage 同一張 A。後方 B 由 0.92 縮放到 1，兩片內緣畫硬陰影與切線色邊。',
  defaultText: '開門見山／OPEN UP',
  palette: 'STREET',
  controls: ['text', 'font', 'weight', 'secondary', 'accent'],
  textHint: AB_HINT,
  params: [
    ...TRANSITION_PARAMS,
    { key: 'cut', label: '切線位置', type: 'range', min: 0.2, max: 0.8, step: 0.01, default: 0.5 },
    { key: 'tilt', label: '切線傾角', type: 'range', min: -25, max: 25, step: 1, default: 0, unit: '°' },
    { key: 'depth', label: '後景推近', type: 'range', min: 0, max: 0.2, step: 0.01, default: 0.08 },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '0–0.25 秒內一條強調色切線由上而下劃過；隨後左右兩半以 power3.inOut 向兩側滑出，B 從 0.92 推近到 1。',
    hold: 'B 完整停留，沒有切線殘留。',
    exit: '同樣機制把 B 從中線裂開，露出 A。',
    loop: 'A → B → A，停留與轉場時間可調。',
  },
  accept: [
    '轉場中可同時看到左右兩半的 A 與中間露出的 B。',
    '兩半內緣有清楚的切線色邊與陰影。',
    '調整切線位置／傾角，裂縫位置與角度同步改變。',
    '開啟手動進度時，畫面停在滑桿指定的分開程度。',
  ],
  cycle: 4.4,
  posterTime: 1.75,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const k = Math.tan((num(ctx, 'tilt', 0) * Math.PI) / 180);
    const cut = num(ctx, 'cut', 0.5) * w;
    const depth = num(ctx, 'depth', 0.08);
    const xt = cut - (k * h) / 2;
    const xb = cut + (k * h) / 2;
    const left = [-2, -2, xt, -2, xb, h + 2, -2, h + 2];
    const right = [xt, -2, w + 2, -2, w + 2, h + 2, xb, h + 2];
    const pad = Math.min(w, h) * 0.06;
    const travelL = Math.max(xt, xb) + pad;
    const travelR = w - Math.min(xt, xb) + pad;
    const mv = ease('power3.inOut');
    const lw = Math.max(2, Math.min(w, h) * 0.008);
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, (x) => x);
      const imgs = [sc.a.canvas, sc.b.canvas];
      if (tr.p <= 0) return sc.draw(g, tr.from);
      if (tr.p >= 1) return sc.draw(g, tr.to);
      const cutP = local(tr.p, 0, 0.22);
      const e = mv(local(tr.p, 0.14, 0.86));
      // new scene behind, pushed in
      drawScaled(g, imgs[tr.to], w, h, 1 - depth * (1 - e));
      const dl = -travelL * e;
      const dr = travelR * e;
      // hard occlusion shadows cast on B by the two halves
      const sw = Math.min(w, h) * 0.035 * Math.min(1, e * 6);
      g.fillStyle = rgba('#000000', 0.32);
      g.beginPath();
      g.moveTo(xt + dl, 0);
      g.lineTo(xt + dl + sw, 0);
      g.lineTo(xb + dl + sw, h);
      g.lineTo(xb + dl, h);
      g.moveTo(xt + dr - sw, 0);
      g.lineTo(xt + dr, 0);
      g.lineTo(xb + dr, h);
      g.lineTo(xb + dr - sw, h);
      g.fill();
      drawPiece(g, imgs[tr.from], w, h, left, { tx: dl });
      drawPiece(g, imgs[tr.from], w, h, right, { tx: dr });
      // split line: drawn across A first, then rides on both inner edges
      if (e <= 0) {
        line(g, [xt, 0, xt + (xb - xt) * cutP, h * cutP], ctx.s.accent, lw);
      } else {
        line(g, [xt + dl, 0, xb + dl, h], ctx.s.accent, lw);
        line(g, [xt + dr, 0, xb + dr, h], ctx.s.accent, lw);
      }
    });
  },
});
