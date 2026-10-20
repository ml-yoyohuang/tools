import { defineEffect } from '../../engine/define';
import { canvasRuntime, ease, easeIn3, easeOut3, mod, num, rgba } from '../../engine/helpers';
import { layoutText, type TextLayout } from '../../engine/text';
import { drawTracked, fitLine, font, maskSlide, preloadFonts, seg, strWidth, textParam } from './_t14kit';

// Editorial layout built in separate staged steps (never one global fade):
// 1 top rule draws → 2 issue number rises in its mask → 3 divider rule grows →
// 4 kicker is wiped in → 5 headline lines rise in their own masks → 6 subtitle
// fades up → 7 accent bar + bottom rule. The exit runs through the same pieces in
// reverse order. Landscape: number column + text column; portrait: stacked.

const DEF_NUM = '07';
const DEF_KICKER = 'MOTION ATLAS · ISSUE';
const DEF_SUB = '動態排版的十二個練習 — Twelve studies in kinetic layout';

export default defineEffect({
  id: 'editorial-title',
  code: 'T24',
  nameZh: '編輯式標題',
  nameEn: 'Editorial Title',
  category: 'typography',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '細線、期數編號、眉標、大標逐行、副標與色條依序排入，組成雜誌式的動態版面。',
  tags: ['編輯設計', '版面', '標題', '雜誌', 'editorial'],
  suitable: ['文章封面', '專題開場', '簡報章節頁'],
  principle:
    'Canvas 2D 版面網格：橫式為「編號欄 27% ＋ 內文欄」，直式為上下堆疊。七個元素各自有起始時間（間隔 = 節奏參數）與不同的進場機制：細線以 easeOut3 由左畫出、編號在 clip 遮罩內以 expo.out 上升、分隔線以 power2.inOut 生長、眉標以 clip 寬度由左擦出、大標每行在各自遮罩內以 power4.out 上升、副標以透明度＋位移淡入、色條由左伸出。離場依相反順序（easeIn3）。',
  defaultText: '慢下來的設計／THE SLOW MOTION',
  palette: 'MONO',
  colors: { background: '#F2E8D5', primary: '#141414', secondary: '#E63A2E', accent: '#8A8A8A' },
  controls: ['text', 'font', 'weight', 'tracking', 'scale', 'secondary', 'accent'],
  maxChars: 36,
  textHint: '大標：用「／」分行。編號、眉標、副標在專屬參數中設定。',
  loopable: true,
  params: [
    { key: 'number', label: '編號', type: 'text', default: DEF_NUM, maxLength: 4 },
    { key: 'kicker', label: '眉標', type: 'text', default: DEF_KICKER, maxLength: 28 },
    { key: 'subtitle', label: '副標', type: 'text', default: DEF_SUB, maxLength: 60 },
    { key: 'step', label: '分段節奏', type: 'range', min: 0.08, max: 0.6, step: 0.01, default: 0.22, unit: 's' },
    { key: 'hold', label: '停留時間', type: 'range', min: 1, max: 6, step: 0.1, default: 2.6, unit: 's' },
  ],
  recipe: {
    enter: '頂部細線由左畫出 → 編號從遮罩中上升 → 分隔線生長 → 眉標由左擦出 → 大標逐行上升 → 副標淡入 → 色條伸出；每段間隔 = 分段節奏（預設 0.22s）。',
    motion: '每個元素使用不同的進場機制與 easing（easeOut3 / expo.out / power2.inOut / power4.out），形成閱讀順序。',
    hold: '完整版面停留（預設 2.6s）。',
    exit: '副標淡出 → 大標逐行往上移出遮罩 → 眉標擦除 → 編號下沉 → 線條由右收回。',
    loop: '間隔 0.4s 後重新排版；關閉循環時停在完整版面。',
  },
  accept: [
    '元素依序分段出現，不是整張版面一起淡入。',
    '大標每一行從自己的遮罩邊緣上升，行與行錯開。',
    '直式比例改為上下堆疊，仍不超出畫面。',
    '修改編號、眉標、副標欄位後版面內容更新。',
  ],
  transparent: true,
  cycle: 8,
  posterTime: 3.6,
  async create(ctx) {
    const number = textParam(ctx, 'number', DEF_NUM);
    const kicker = textParam(ctx, 'kicker', DEF_KICKER);
    const subtitle = textParam(ctx, 'subtitle', DEF_SUB);
    await preloadFonts(ctx, [number, kicker, subtitle], ['serif', 'mono', 'sans']);
    const { width: W, height: H } = ctx;
    const st = num(ctx, 'step', 0.22);
    const hold = num(ctx, 'hold', 2.6);
    const land = W >= H * 1.15;
    const mx = W * 0.08;
    const top = H * (land ? 0.14 : 0.1);
    const bot = H * (land ? 0.86 : 0.9);
    const aw = W - mx * 2;
    const ah = bot - top;
    const serif = ctx.font.serif;
    const mono = ctx.font.mono;
    const sans = ctx.font.sans;

    // grid
    let colX: number;
    let textW: number;
    let numSize: number;
    let numCX: number;
    let numCY: number;
    let divider: { x0: number; y0: number; x1: number; y1: number };
    let textTop: number;
    if (land) {
      const numW = aw * 0.27;
      const gap = aw * 0.05;
      colX = mx + numW + gap;
      textW = aw - numW - gap;
      numSize = fitLine(number, numW * 0.92, ah * 0.55, serif, 300);
      numCX = mx + numW / 2;
      numCY = top + ah * 0.06 + numSize * 0.5;
      const dx = mx + numW + gap / 2;
      divider = { x0: dx, y0: top + ah * 0.05, x1: dx, y1: bot };
      textTop = top + ah * 0.06;
    } else {
      colX = mx;
      textW = aw;
      numSize = fitLine(number, aw * 0.5, ah * 0.18, serif, 300);
      numCX = mx + strWidth(number, numSize, serif, 300) / 2;
      numCY = top + numSize * 0.55;
      const dy = top + numSize * 1.15;
      divider = { x0: mx, y0: dy, x1: mx + aw, y1: dy };
      textTop = dy + ah * 0.05;
    }
    const kSize = Math.max(9, Math.min(ah * 0.042, fitLine(kicker, textW, ah * 0.042, mono, 700, 0.18)));
    const kY = textTop + kSize * 0.5;
    const headTop = kY + kSize * 1.6;
    const remain = bot - headTop - ah * 0.06;
    const head: TextLayout = layoutText(ctx, ctx.text, {
      align: 'left',
      maxWidth: textW,
      maxHeight: remain * 0.7,
      lineHeight: 1.08,
      fill: 0.95,
      cx: colX + textW / 2,
      cy: headTop + remain * 0.35,
    });
    const hdx = colX - head.x;
    const hdy = headTop - head.y;
    const subTop = headTop + head.height + ah * 0.05;
    const sub = layoutText(ctx, subtitle, {
      align: 'left',
      family: sans,
      weight: 400,
      tracking: 0,
      maxWidth: textW * 0.86,
      maxHeight: Math.max(12, bot - ah * 0.08 - subTop),
      maxSize: ah * 0.05,
      lineHeight: 1.45,
      fill: 1,
      noScale: true,
      cx: colX + textW / 2,
      cy: 0,
      slashBreak: false,
    });
    const sdx = colX - sub.x;
    const sdy = subTop - sub.y;
    const barW = Math.min(textW * 0.18, ah * 0.2);
    const barH = Math.max(3, ah * 0.012);

    // schedule
    const expo = ease('expo.out');
    const p4 = ease('power4.out');
    const p2io = ease('power2.inOut');
    const tTop = 0;
    const tNum = st;
    const tDiv = st * 2;
    const tKick = st * 3;
    const tHead = st * 4;
    const nH = head.lines.length;
    const lineGap = Math.min(0.12, 0.6 / nH);
    const tSub = tHead + (nH - 1) * lineGap + 0.35 + st;
    const tBar = tSub + st;
    const inEnd = tBar + 0.6;
    const o = inEnd + hold; // exit start
    const oSub = o;
    const oHead = o + 0.15;
    const oKick = oHead + (nH - 1) * 0.06 + 0.25;
    const oNum = oKick + 0.12;
    const oLines = oNum + 0.15;
    const cycle = oLines + 0.6 + 0.4;

    const hairline = Math.max(1, ah * 0.004);
    return canvasRuntime(
      ctx,
      (g, time) => {
        const t = mod(time, cycle);
        const lineOut = easeIn3(seg(t, oLines, 0.5));
        // 1 top rule (draws left → right, retracts right → left)
        const pt = easeOut3(seg(t, tTop, 0.7));
        if (pt > 0 && lineOut < 1) {
          g.fillStyle = ctx.s.primary;
          g.fillRect(mx, top - hairline, aw * pt * (1 - lineOut), hairline * 1.6);
        }
        // 2 number rises inside its mask
        const pnOut = easeIn3(seg(t, oNum, 0.4));
        const pn = pnOut > 0 ? -pnOut : expo(seg(t, tNum, 0.85));
        g.fillStyle = ctx.s.secondary;
        g.font = font(numSize, serif, 300);
        maskSlide(g, numCX - numSize * 2, numCY - numSize * 0.62, numSize * 4, numSize * 1.2, pn, (dy) => {
          drawTracked(g, number, numCX, numCY + (pn < 0 ? -dy : dy), numSize, serif, 300, 0, 'center');
        });
        // 3 divider grows
        const pd = p2io(seg(t, tDiv, 0.6)) * (1 - lineOut);
        if (pd > 0) {
          g.fillStyle = rgba(ctx.s.primary, 0.85);
          if (land) g.fillRect(divider.x0 - hairline / 2, divider.y0, hairline, (divider.y1 - divider.y0) * pd);
          else g.fillRect(divider.x0, divider.y0 - hairline / 2, (divider.x1 - divider.x0) * pd, hairline);
        }
        // 4 kicker wiped in
        const pk = seg(t, tKick, 0.45) * (1 - seg(t, oKick, 0.3));
        if (pk > 0) {
          g.save();
          g.beginPath();
          g.rect(colX - 2, kY - kSize, (textW + 4) * pk, kSize * 2);
          g.clip();
          g.fillStyle = ctx.s.accent;
          g.font = font(kSize, mono, 700);
          drawTracked(g, kicker, colX, kY, kSize, mono, 700, 0.18, 'left');
          g.restore();
        }
        // 5 headline lines, each in its own mask
        g.font = head.font;
        g.fillStyle = ctx.s.primary;
        head.lines.forEach((line, i) => {
          const out = easeIn3(seg(t, oHead + i * 0.06, 0.4));
          const p = out > 0 ? -out : p4(seg(t, tHead + i * lineGap, 0.8));
          if (p === 0) return;
          maskSlide(g, colX - head.fontSize * 0.2, line.y + hdy - head.fontSize * 0.04, textW + head.fontSize * 0.4, head.lineHeight + head.fontSize * 0.08, p, (dy) => {
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            for (const c of line.glyphs) if (!c.space) g.fillText(c.ch, c.cx + hdx, c.cy + hdy + dy);
          });
        });
        // 6 subtitle fades up
        const ps = easeOut3(seg(t, tSub, 0.6)) * (1 - seg(t, oSub, 0.3));
        if (ps > 0) {
          g.save();
          g.globalAlpha = ps;
          g.fillStyle = rgba(ctx.s.primary, 0.78);
          g.font = sub.font;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          const lift = (1 - ps) * sub.fontSize * 0.6;
          for (const c of sub.chars) g.fillText(c.ch, c.cx + sdx, c.cy + sdy + lift);
          g.restore();
        }
        // 7 accent bar + bottom rule
        const pb = easeOut3(seg(t, tBar, 0.55)) * (1 - lineOut);
        if (pb > 0) {
          g.fillStyle = rgba(ctx.s.primary, 0.85);
          g.fillRect(mx + aw * (1 - pb), bot, aw * pb, hairline);
          g.fillStyle = ctx.s.secondary;
          g.fillRect(colX, bot - barH * 3, barW * pb, barH);
        }
      },
      { settle: inEnd + 0.3 },
    );
  },
});
