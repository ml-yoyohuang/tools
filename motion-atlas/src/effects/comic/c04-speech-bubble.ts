import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, easeIn3, easeInOut, minSide, num, phase } from '../../engine/helpers';
import { layoutText, phrases } from '../../engine/text';
import type { Pt } from '../../engine/shapes';
import { arcLengths, backOut, inkText, partialStroke, polyPath, superEllipse } from './_util';

const N = 160;

export default defineEffect({
  id: 'speech-bubble',
  code: 'C04',
  nameZh: '對話氣泡',
  nameEn: 'Speech Bubble',
  category: 'comic',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '氣泡輪廓先一筆畫出，填色後文字逐字跳出，最後尾角從氣泡邊緣長出指向說話者。',
  tags: ['漫畫', '對話框', '氣泡', '描線', 'speech bubble'],
  suitable: ['對話介紹', '客服提示', '社群貼文', '角色台詞'],
  principle:
    'Canvas 2D：氣泡為超橢圓 |x/a|^p + |y/b|^p = 1 取樣 160 點，依累計弧長只描出前 progress 比例完成「先畫輪廓」；尾角是把底部兩個取樣點之間插入一個尖點，尖點由兩點中點沿外法線移出（back.out），因此尾角與氣泡是同一條封閉路徑、沒有接縫。文字以 layoutText 排版後逐字縮放出現。',
  defaultText: '你聽到了嗎？／這裡有新消息！',
  palette: 'POP',
  colors: { background: '#3450FF', primary: '#141414', secondary: '#FFE35A', accent: '#FFFFFF' },
  controls: ['text', 'font', 'weight', 'tracking', 'scale', 'direction', 'secondary', 'accent'],
  directions: ['left', 'right'],
  textHint: '用「／」分隔多句台詞，每句一個氣泡，尾角左右交替。',
  maxChars: 60,
  params: [
    { key: 'round', label: '氣泡圓潤度', type: 'range', min: 2, max: 6, step: 0.2, default: 2.6, hint: '2 = 橢圓，越大越接近圓角矩形' },
    { key: 'tail', label: '尾角長度', type: 'range', min: 0.05, max: 0.3, step: 0.01, default: 0.16 },
    { key: 'hold', label: '停留時間', type: 'range', min: 0.6, max: 3, step: 0.1, default: 1.4, unit: 's' },
    { key: 'shadow', label: '偏移陰影', type: 'range', min: 0, max: 0.04, step: 0.002, default: 0.018 },
  ],
  recipe: {
    enter: '輪廓從頂端順時針一筆畫完（0.55 秒，easeInOut），描完後填色在 0.12 秒內鋪滿。',
    motion: '文字逐字以小過衝縮放跳出（每字間隔 ≤ 0.05 秒），文字完成後尾角以 back.out 從氣泡邊緣長出。',
    hold: '完整氣泡與台詞靜止停留。',
    exit: '整個氣泡朝尾角尖端縮小（easeIn³，0.3 秒）。',
    loop: '下一句台詞的氣泡尾角換到另一側，依序循環。',
  },
  accept: [
    '先只看到輪廓線在畫，輪廓完成前沒有文字與尾角。',
    '文字出現後尾角才從邊緣長出，且與氣泡是同一條外框。',
    '多句台詞時尾角左右交替。',
    '長文字自動換行並留在氣泡內。',
  ],
  transparent: true,
  cycle: 6,
  posterTime: 2.2,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const lines = phrases(ctx.text);
    const roundP = num(ctx, 'round', 2.6);
    const tailK = num(ctx, 'tail', 0.16);
    const hold = num(ctx, 'hold', 1.4);
    const shadowK = num(ctx, 'shadow', 0.018);
    const tailH = m * tailK;
    const bubbles = lines.map((line, li) => {
      const side = (li % 2 === 0 ? 1 : -1) * (ctx.dir === 'left' ? -1 : 1);
      const cy = h / 2 - tailH * 0.45;
      const layout = layoutText(ctx, line, { cx: w / 2, cy, maxWidth: w * 0.56, maxHeight: (h - tailH) * 0.42, fill: 0.92 });
      const a = Math.min(w * 0.46, layout.width / 2 / 0.78 + m * 0.06);
      const b = Math.min((h - tailH) * 0.4, layout.height / 2 / 0.72 + m * 0.05);
      const pts = superEllipse(w / 2, cy, a, b, roundP, N);
      // tail base: two samples on the lower half, on the speaker side
      const mid = Math.round(N / 2 - side * N * 0.1);
      const half = Math.max(3, Math.round(N * 0.035));
      const i1 = mid - half;
      const i2 = mid + half;
      const base: Pt = [(pts[i1][0] + pts[i2][0]) / 2, (pts[i1][1] + pts[i2][1]) / 2];
      const tip: Pt = [base[0] + side * tailH * 0.75, Math.min(h - m * 0.03, base[1] + tailH)];
      return { layout, pts, lens: arcLengths(pts), i1, i2, base, tip };
    });
    const D = { draw: 0.55, fill: 0.12, text: 0, tail: 0.3, hold, out: 0.3 };
    const segs = bubbles.map((b) => {
      const n = b.layout.chars.length;
      const stagger = Math.min(0.05, 0.6 / Math.max(1, n));
      return { stagger, text: n * stagger + 0.18 };
    });
    const durs = segs.flatMap((s) => [D.draw + D.fill, s.text, D.tail, D.hold, D.out]);
    const lw = Math.max(2, m * 0.009);
    return canvasRuntime(ctx, (g, t) => {
      const ph = phase(t, durs);
      const bi = Math.floor(ph.i / 5);
      const seg = ph.i % 5;
      const B = bubbles[bi];
      const S = segs[bi];
      const drawP = seg === 0 ? clamp((ph.p * (D.draw + D.fill)) / D.draw, 0, 1) : 1;
      const fillP = seg === 0 ? clamp((ph.p * (D.draw + D.fill) - D.draw) / D.fill, 0, 1) : 1;
      const textT = seg === 0 ? -1 : seg === 1 ? ph.p * S.text : 99;
      const tailP = seg < 2 ? 0 : seg === 2 ? backOut(ph.p, 2.4) : 1;
      const outS = seg === 4 ? 1 - easeIn3(ph.p) : 1;
      g.save();
      // exit: shrink toward the tail tip
      g.translate(B.tip[0], B.tip[1]);
      g.scale(outS, outS);
      g.translate(-B.tip[0], -B.tip[1]);
      g.lineJoin = 'round';
      g.lineCap = 'round';
      const shape: Pt[] =
        tailP > 0
          ? [
              ...B.pts.slice(0, B.i1 + 1),
              [B.base[0] + (B.tip[0] - B.base[0]) * tailP, B.base[1] + (B.tip[1] - B.base[1]) * tailP],
              ...B.pts.slice(B.i2),
            ]
          : B.pts;
      if (fillP > 0) {
        const sh = m * shadowK;
        if (sh > 0) {
          g.globalAlpha = fillP;
          g.fillStyle = ctx.s.secondary;
          g.save();
          g.translate(sh, sh);
          g.beginPath();
          polyPath(g, shape);
          g.fill();
          g.restore();
        }
        g.globalAlpha = fillP;
        g.fillStyle = ctx.s.accent;
        g.beginPath();
        polyPath(g, shape);
        g.fill();
        g.globalAlpha = 1;
      }
      g.strokeStyle = ctx.s.primary;
      g.lineWidth = lw;
      if (drawP < 1) partialStroke(g, B.pts, B.lens, easeInOut(drawP));
      else {
        g.beginPath();
        polyPath(g, shape);
        g.stroke();
      }
      if (textT >= 0) {
        const vis = B.layout.chars.filter((_, i) => textT > i * S.stagger);
        for (const c of vis) {
          const p = clamp((textT - c.vi * S.stagger) / 0.16, 0, 1);
          const k = backOut(p, 3);
          g.save();
          g.translate(c.cx, c.cy);
          g.scale(k, k);
          g.translate(-c.cx, -c.cy);
          inkText(g, B.layout, ctx.s.primary, null, 0, 0, 0, [c]);
          g.restore();
        }
      }
      g.restore();
    });
  },
});
