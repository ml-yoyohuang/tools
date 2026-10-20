import { defineEffect } from '../../engine/define';
import { drawLayout } from '../../engine/canvas';
import { canvasRuntime, clamp, easeInOut, lerp, minSide, mod, num, str } from '../../engine/helpers';
import type { Pt } from '../../engine/shapes';
import { layoutText } from '../../engine/text';
import { easeExpoOut, easeQuadInOut, easeSineInOut, hair, polyLengths, tracePartial } from './_util';

/** Sample an arc (unit coords) from a0 to a1. */
function arcPts(cx: number, cy: number, r: number, a0: number, a1: number, n = 28): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r] as Pt;
  });
}

// Original marks, each one closed polyline inside the unit box [-0.5, 0.5]².
const MARKS: Record<string, () => Pt[]> = {
  arch: () => [[-0.4, 0.5], [-0.4, -0.1], ...arcPts(0, -0.1, 0.4, Math.PI, Math.PI * 2), [0.4, 0.5], [-0.4, 0.5]],
  notch: () => [[-0.45, 0.45], [-0.45, -0.45], [0, -0.45], ...arcPts(0.45, -0.45, 0.45, Math.PI, Math.PI / 2), [0.45, 0.45], [-0.45, 0.45]],
  leaf: () => [
    ...arcPts(-0.45, -0.45, 0.9, Math.PI / 2, 0),
    ...arcPts(0.45, 0.45, 0.9, Math.PI * 1.5, Math.PI).slice(1),
  ],
};

export default defineEffect({
  id: 'minimal-mark-reveal',
  code: 'M12',
  nameZh: '極簡標記揭露',
  nameEn: 'Minimal Mark Reveal',
  category: 'minimal',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '一個原創幾何標記分三段出現：先描出輪廓、再由下而上填色、最後縮小移到定位並帶出字標。',
  tags: ['極簡', '標誌', 'logo reveal', '描線', '填色'],
  suitable: ['品牌開場', '影片片頭／片尾', '簡報封面'],
  principle:
    'Canvas 2D：標記是單位方框內的一條封閉折線（拱門／缺角方／葉形，由直線與取樣圓弧組成）。① 描線：依累積長度畫出 0–p 段（quad.inOut）。② 填色：以標記路徑填色，再用由下往上升起的矩形 clip（expo.out），描線同時淡出。③ 定位：整個標記以 cubic.inOut 縮小到 0.55 倍並移到字標左側（直式畫面移到上方），字標以 sine.inOut 淡入滑入。停留後淡出循環。',
  defaultText: 'ATLAS',
  palette: 'MONO',
  colors: { background: '#FFFFFF', primary: '#141414', secondary: '#3450FF', accent: '#8A8A8A' },
  controls: ['text', 'font', 'weight', 'tracking', 'scale', 'secondary'],
  params: [
    {
      key: 'mark',
      label: '標記形狀',
      type: 'select',
      options: [
        { value: 'arch', label: '拱門' },
        { value: 'notch', label: '缺角方' },
        { value: 'leaf', label: '葉形' },
      ],
      default: 'arch',
    },
    { key: 'stroke', label: '描線時間', type: 'range', min: 0.6, max: 3, step: 0.1, default: 1.5, unit: 's' },
    { key: 'hold', label: '停留時間', type: 'range', min: 0.5, max: 4, step: 0.1, default: 1.8, unit: 's' },
  ],
  recipe: {
    enter: '空白畫面，0.3 秒後開始描線。',
    motion: '描線（quad.inOut 1.5 秒）→ 由下而上填色（expo.out 0.9 秒）→ 縮小定位（cubic.inOut 1.1 秒），字標淡入滑入。',
    hold: '完整的標記＋字標停留約 1.8 秒。',
    exit: '整體淡出 0.7 秒。',
    loop: '淡出後重新描線；關閉循環時停在完整組合。',
  },
  accept: [
    '三段清楚分開：只有輪廓 → 填色 → 移位。',
    '填色由下往上升起，輪廓同時淡掉。',
    '定位後標記與字標並排（直式畫面上下排），不超出舞台。',
    '切換標記形狀後描線路徑不同；長文字會縮小或換行。',
  ],
  transparent: true,
  loopable: true,
  maxChars: 24,
  textHint: '字標文字（單行為佳）',
  cycle: 6.6,
  posterTime: 4.4,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const markPts = (MARKS[str(ctx, 'mark', 'arch')] ?? MARKS.arch)();
    const lens = polyLengths(markPts);
    const strokeT = num(ctx, 'stroke', 1.5);
    const hold = num(ctx, 'hold', 1.8);
    const S = m * 0.36 * Math.min(ctx.s.scale, 1.4);
    const Sf = S * 0.55;
    const portrait = w < h * 0.95;
    const gap = Sf * 0.38;
    const word = ctx.text.replace(/\s*[\n／/]+\s*/g, ' ').trim() || ' ';
    // final lockup layout
    let L = layoutText(ctx, word, {
      maxWidth: portrait ? w * 0.82 : Math.max(40, w * 0.84 - Sf - gap),
      maxHeight: portrait ? Math.max(20, h * 0.5 - Sf * 0.7 - gap) : Sf * 1.05,
      maxSize: Sf * 0.62,
      fill: 1,
      noScale: true,
      slashBreak: false,
      align: portrait ? 'center' : 'left',
      lineHeight: 1.12,
    });
    let markX: number;
    let markY: number;
    let textCx: number;
    let textCy: number;
    if (portrait) {
      const groupH = Sf + gap + L.height;
      markX = w / 2;
      markY = h / 2 - groupH / 2 + Sf / 2;
      textCx = w / 2;
      textCy = markY + Sf / 2 + gap + L.height / 2;
    } else {
      const groupW = Sf + gap + L.width;
      markX = w / 2 - groupW / 2 + Sf / 2;
      markY = h / 2;
      textCx = markX + Sf / 2 + gap + L.width / 2;
      textCy = h / 2;
    }
    L = layoutText(ctx, word, {
      maxWidth: portrait ? w * 0.82 : Math.max(40, w * 0.84 - Sf - gap),
      maxHeight: portrait ? Math.max(20, h * 0.5 - Sf * 0.7 - gap) : Sf * 1.05,
      maxSize: Sf * 0.62,
      fill: 1,
      noScale: true,
      slashBreak: false,
      align: portrait ? 'center' : 'left',
      lineHeight: 1.12,
      cx: textCx,
      cy: textCy,
    });
    const fillT = 0.9;
    const posT = 1.1;
    const exitT = 0.7;
    const t0 = 0.3;
    const tFill = t0 + strokeT;
    const tPos = tFill + fillT;
    const tHold = tPos + posT;
    const tExit = tHold + hold;
    const total = tExit + exitT + 0.3;
    const lwScreen = hair(m, 0.006, 1.5);
    return canvasRuntime(
      ctx,
      (g, t) => {
        const u = mod(t, total);
        const strokeP = easeQuadInOut((u - t0) / strokeT);
        const fillP = easeExpoOut((u - tFill) / fillT);
        const posP = easeInOut(clamp((u - tPos) / posT, 0, 1));
        const textP = easeSineInOut((u - tPos - posT * 0.45) / (posT * 0.9));
        const out = 1 - clamp((u - tExit) / exitT, 0, 1);
        if (u < t0 || out <= 0) return;
        const sc = lerp(S, Sf, posP);
        const mx = lerp(w / 2, markX, posP);
        const my = lerp(h / 2, markY, posP);
        g.globalAlpha = out;
        g.save();
        g.translate(mx, my);
        g.scale(sc, sc);
        // ② fill rising from the bottom
        if (fillP > 0) {
          g.save();
          g.beginPath();
          g.rect(-0.6, 0.6 - 1.2 * fillP, 1.2, 1.2 * fillP + 0.01);
          g.clip();
          g.fillStyle = ctx.s.secondary;
          g.beginPath();
          markPts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
          g.closePath();
          g.fill();
          g.restore();
        }
        // ① stroke, fading out while the fill rises
        const sAlpha = 1 - clamp((u - tFill) / fillT, 0, 1);
        if (strokeP > 0 && sAlpha > 0) {
          g.globalAlpha = out * sAlpha;
          g.strokeStyle = ctx.s.primary;
          g.lineWidth = lwScreen / sc;
          g.lineJoin = 'round';
          g.lineCap = 'round';
          g.beginPath();
          tracePartial(g, markPts, 0, strokeP, lens);
          g.stroke();
        }
        g.restore();
        // ③ wordmark slides in beside the placed mark
        if (textP > 0) {
          g.globalAlpha = out * textP;
          const slide = (1 - textP) * Sf * 0.3;
          drawLayout(g, L, { fill: ctx.s.primary, dx: portrait ? 0 : -slide, dy: portrait ? -slide : 0 });
        }
        g.globalAlpha = 1;
      },
      { settle: tHold + Math.min(0.8, hold / 2) },
    );
  },
});
