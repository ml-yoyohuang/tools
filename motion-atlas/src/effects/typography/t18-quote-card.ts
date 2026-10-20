import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, ease, easeIn3, easeOut3, minSide, mod, num, rgba, str } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import { drawTracked, fitLine, font, maskSlide, preloadFonts, rrect, seg, strWidth, textParam } from './_t14kit';

// Canvas 2D, pure function of time. Reading order is built by staged masks:
// card wipe → quote mark rises in its own mask → every quote line rises inside its
// own line mask (staggered) → rule draws → author slides in from the side inside a
// mask. Exit reverses through the same masks (upwards), then the card wipes away.

const DEF_QUOTE = '好的動態，讓人在看懂之前就先感覺到。';
const DEF_AUTHOR = 'MOTION ATLAS';

export default defineEffect({
  id: 'quote-card',
  code: 'T18',
  nameZh: '引言卡',
  nameEn: 'Quote Card',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '卡片展開後，引號、引言逐行與署名依序從遮罩中滑入，建立清楚的閱讀順序。',
  tags: ['引言', '遮罩', '字卡', '署名', 'quote'],
  suitable: ['社群引言圖', '訪談金句', '簡報引用'],
  principle:
    'Canvas 2D：卡片以 clip 寬度由左向右展開（easeOut3）；引號、每一行引言、署名各自有一個 clip 矩形遮罩，內容在遮罩內由下往上位移 (1 − p)·h 進場（p 依 expo.out 補間，行與行錯開）；署名前的短線以 scaleX 畫出，署名由側面在遮罩內滑入。離場時內容在遮罩內往上移出，順序相同，最後卡片向右收合。',
  defaultText: '',
  palette: 'PASTEL',
  colors: { background: '#9A86DE', primary: '#141414', secondary: '#F2E8D5', accent: '#ED589A' },
  controls: ['font', 'weight', 'tracking', 'scale', 'secondary', 'accent'],
  loopable: true,
  params: [
    { key: 'quote', label: '引言（quote）', type: 'text', default: DEF_QUOTE, maxLength: 90 },
    { key: 'author', label: '署名（author）', type: 'text', default: DEF_AUTHOR, maxLength: 32 },
    { key: 'align', label: '對齊', type: 'select', default: 'left', options: [{ value: 'left', label: '靠左' }, { value: 'center', label: '置中' }] },
    { key: 'stagger', label: '行間隔', type: 'range', min: 0.05, max: 0.5, step: 0.01, default: 0.16, unit: 's' },
    { key: 'hold', label: '停留時間', type: 'range', min: 1, max: 6, step: 0.1, default: 2.8, unit: 's' },
  ],
  recipe: {
    enter: '卡片由左向右展開（0.55s, easeOut3）→ 引號在遮罩內上升並回正 → 引言逐行在各自遮罩內上升（expo.out，行間隔可調）。',
    motion: '署名前的短線由左畫出，署名再從側面於遮罩內滑入；每一段都等前一段大致就位才開始。',
    hold: '完整卡片靜止停留（預設 2.8s）。',
    exit: '引言各行與署名依序往上移出遮罩（easeIn3），引號縮回，卡片向右收合。',
    loop: '間隔 0.3s 後重新進場；關閉循環時停在完整卡片。',
  },
  accept: [
    '引號 → 引言各行 → 署名依序出現，順序清楚。',
    '每一行文字是從自己的遮罩邊緣滑出，不是整張一起淡入。',
    '修改 quote 與 author 欄位後卡片內容改變且不溢出。',
    '停留時所有文字完整可讀。',
  ],
  transparent: true,
  cycle: 7,
  posterTime: 3,
  async create(ctx) {
    const quote = textParam(ctx, 'quote', DEF_QUOTE);
    const author = textParam(ctx, 'author', DEF_AUTHOR);
    await preloadFonts(ctx, [quote, author, '“—'], ['serif']);
    const { width: W, height: H } = ctx;
    const center = str(ctx, 'align', 'left') === 'center';
    const stag = num(ctx, 'stagger', 0.16);
    const hold = num(ctx, 'hold', 2.8);
    const m = minSide(ctx);
    const portrait = H > W * 1.1;
    const cw = Math.min(W * (portrait ? 0.86 : 0.74), m * (portrait ? 1 : 1.5));
    const ch = Math.min(H * (portrait ? 0.62 : 0.78), cw * (portrait ? 1.25 : 0.72));
    const cx0 = (W - cw) / 2;
    const cy0 = (H - ch) / 2;
    const pad = cw * 0.1;
    const innerW = cw - pad * 2;
    const markSize = Math.min(ch * 0.3, cw * 0.2) * Math.min(1.3, ctx.s.scale);
    const markTop = cy0 + ch * 0.06;
    const authorH = Math.max(11, ch * 0.055);
    const qTop = markTop + markSize * 0.62;
    const qBottom = cy0 + ch - pad * 0.6 - authorH * 2.6;
    const L = layoutText(ctx, quote, {
      align: center ? 'center' : 'left',
      maxWidth: innerW,
      maxHeight: Math.max(20, qBottom - qTop),
      lineHeight: 1.32,
      fill: 0.92,
      maxSize: ch * 0.16,
      cx: W / 2,
      cy: (qTop + qBottom) / 2,
    });
    // flush the block to the card's left padding when left aligned
    const dx = center ? 0 : cx0 + pad - L.x;
    const fs = L.fontSize;
    const aSize = Math.min(authorH, fitLine('— ' + author, innerW * 0.8, authorH, ctx.font.sans, 700, 0.08));
    const aY = Math.min(cy0 + ch - pad * 0.55 - aSize, L.y + L.height + aSize * 2.2);
    const aW = strWidth(author, aSize, ctx.font.sans, 700, 0.08);
    const ruleW = Math.max(aSize * 2, fs * 1.4);
    const aX = center ? W / 2 - (ruleW + aSize * 0.6 + aW) / 2 : cx0 + pad;
    const expo = ease('expo.out');
    const radius = Math.min(cw, ch) * 0.035;

    // schedule
    const tCard = 0;
    const tMark = 0.35;
    const tLines = 0.7;
    const nL = L.lines.length;
    const tRule = tLines + (nL - 1) * stag + 0.45;
    const tAuthor = tRule + 0.25;
    const inEnd = tAuthor + 0.6;
    const tExit = inEnd + hold;
    const exitL = (i: number) => tExit + i * Math.min(0.08, stag);
    const tExitA = exitL(nL) + 0.02;
    const tCardOut = tExitA + 0.35;
    const cycle = tCardOut + 0.55 + 0.3;

    return canvasRuntime(
      ctx,
      (g, time) => {
        const t = mod(time, cycle);
        // card
        const open = easeOut3(seg(t, tCard, 0.55));
        const close = easeIn3(seg(t, tCardOut, 0.5));
        if (open <= 0 || close >= 1) return;
        const left = cx0 + cw * close;
        const right = cx0 + cw * open;
        g.save();
        g.beginPath();
        g.rect(left, cy0 - 20, right - left + radius, ch + 40);
        g.clip();
        g.fillStyle = rgba(ctx.s.primary, 0.9);
        rrect(g, cx0 + m * 0.018, cy0 + m * 0.018, cw, ch, radius);
        g.fill();
        g.fillStyle = ctx.s.secondary;
        rrect(g, cx0, cy0, cw, ch, radius);
        g.fill();
        g.restore();

        // quote mark (own mask; rises + settles its tilt)
        const pmo = easeIn3(seg(t, tExit, 0.4));
        const pm = pmo > 0 ? -pmo : expo(seg(t, tMark, 0.7));
        const markX = center ? W / 2 : cx0 + pad - markSize * 0.06;
        g.font = font(markSize * 1.5, ctx.font.serif, 900);
        g.fillStyle = ctx.s.accent;
        maskSlide(g, markX - markSize, markTop - markSize * 0.1, markSize * 2.2, markSize * 0.95, pm, (dy) => {
          g.save();
          g.translate(markX + (center ? 0 : markSize * 0.35), markTop + markSize * 0.62 + dy);
          g.rotate((-12 * (1 - clamp(pm, 0, 1)) * Math.PI) / 180);
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText('“', 0, 0);
          g.restore();
        });

        // quote lines, each in its own mask
        g.font = L.font;
        g.fillStyle = ctx.s.primary;
        L.lines.forEach((line, i) => {
          const pin = expo(seg(t, tLines + i * stag, 0.75));
          const pout = easeIn3(seg(t, exitL(i), 0.42));
          const p = pout > 0 ? -pout : pin;
          if (p === 0) return;
          const glyphs = line.glyphs;
          maskSlide(g, cx0, line.y - fs * 0.04, cw, L.lineHeight + fs * 0.08, p, (dy) => {
            g.textAlign = 'center';
            g.textBaseline = 'middle';
            for (const c of glyphs) if (!c.space) g.fillText(c.ch, c.cx + dx, c.cy + dy + fs * 0.02);
          });
        });

        // rule + author
        const pr = easeOut3(seg(t, tRule, 0.45)) * (1 - easeIn3(seg(t, tExitA, 0.3)));
        if (pr > 0) {
          g.fillStyle = ctx.s.accent;
          g.fillRect(aX, aY - Math.max(1, aSize * 0.06), ruleW * pr, Math.max(2, aSize * 0.12));
        }
        const pa = easeOut3(seg(t, tAuthor, 0.6));
        const pao = easeIn3(seg(t, tExitA, 0.35));
        if (pa > 0 && pao < 1) {
          const ax = aX + ruleW + aSize * 0.6;
          g.save();
          g.beginPath();
          g.rect(ax - 2, aY - aSize, aW + aSize, aSize * 2);
          g.clip();
          g.fillStyle = ctx.s.primary;
          g.font = font(aSize, ctx.font.sans, 700);
          drawTracked(g, author, ax - (1 - pa) * (aW + aSize), aY - pao * aSize * 1.6, aSize, ctx.font.sans, 700, 0.08, 'left');
          g.restore();
        }
      },
      { settle: inEnd + 0.4 },
    );
  },
});
