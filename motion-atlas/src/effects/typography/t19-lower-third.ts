import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, ease, easeIn3, easeOut3, mod, num, rgba, str } from '../../engine/helpers';
import { drawTracked, fitLine, font, preloadFonts, seg, strWidth, textParam } from './_t14kit';

// Broadcast lower third on canvas. Layout is anchored to a title-safe margin
// (fraction of each stage side). Order: accent bar grows → name bar extends out of it
// (width reveal, expo.out) with the name sliding in under the bar's clip → title bar
// does the same, smaller and later → hold → title retracts, then name, then the
// accent bar collapses (easeIn3). Works on a transparent background as an overlay.

const DEF_NAME = '王小明 Alex Wang';
const DEF_TITLE = '動態設計師 · Motion Designer';

export default defineEffect({
  id: 'lower-third',
  code: 'T19',
  nameZh: '下三分之一字幕',
  nameEn: 'Lower Third',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '色條先出現，姓名條與職稱條依序從側面伸出並滑入文字，停留後反向收回。',
  tags: ['字幕條', '姓名條', '直播', '影片字卡', 'lower third'],
  suitable: ['訪談影片', '直播主持人介紹', '活動講者字卡'],
  principle:
    'Canvas 2D：位置 = 安全邊距（舞台寬高的百分比）＋角落錨點。強調色條以 scaleY 生長；姓名條寬度 = 文字寬 + 內距，以 expo.out 從色條一側展開（clip 寬度），文字在條內延遲 0.08s 從同側滑入；職稱條相同但較小、晚 0.25s。離場時職稱先收、姓名後收（easeIn3），最後色條縮回。透明背景可直接疊在影片上。',
  defaultText: '',
  palette: 'POP',
  colors: { background: '#141414', primary: '#FFFFFF', secondary: '#3450FF', accent: '#FFE35A' },
  controls: ['font', 'weight', 'tracking', 'scale', 'secondary', 'accent'],
  loopable: true,
  params: [
    { key: 'name', label: '姓名', type: 'text', default: DEF_NAME, maxLength: 28 },
    { key: 'title', label: '職稱', type: 'text', default: DEF_TITLE, maxLength: 40 },
    {
      key: 'position',
      label: '位置',
      type: 'select',
      default: 'bl',
      options: [
        { value: 'bl', label: '左下' },
        { value: 'br', label: '右下' },
        { value: 'tl', label: '左上' },
        { value: 'tr', label: '右上' },
      ],
    },
    { key: 'margin', label: '安全邊距', type: 'range', min: 0.02, max: 0.15, step: 0.005, default: 0.06, hint: '舞台寬高的比例（播出安全框約 5–10%）' },
    { key: 'hold', label: '停留時間', type: 'range', min: 1, max: 6, step: 0.1, default: 2.6, unit: 's' },
    { key: 'guides', label: '顯示安全框', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '強調色條向上生長（0.35s, easeOut3）→ 姓名條從色條側面伸出（0.55s, expo.out），姓名在條內滑入 → 0.25s 後職稱條同樣伸出。',
    motion: '每一段由同一側展開，文字比底條晚 0.08s 抵達，形成拉出的層次。',
    hold: '完整字幕條靜止停留（預設 2.6s）。',
    exit: '職稱條先收回、姓名條再收回（easeIn3，向色條方向），最後色條縮掉。',
    loop: '間隔 0.6s 後重新進場；關閉循環時停在完整字幕條。',
  },
  accept: [
    '色條、姓名條、職稱條依序出現，離場順序相反。',
    '位置改為右下時，字幕條靠右並從右側伸出。',
    '加大安全邊距時字幕條往畫面內側移動，且永遠不貼齊邊緣。',
    '長姓名或職稱會縮小字級而不超出安全框。',
  ],
  transparent: true,
  cycle: 6,
  posterTime: 2.2,
  async create(ctx) {
    const name = textParam(ctx, 'name', DEF_NAME);
    const title = textParam(ctx, 'title', DEF_TITLE);
    await preloadFonts(ctx, [name, title]);
    const { width: W, height: H } = ctx;
    const pos = str(ctx, 'position', 'bl');
    const right = pos.endsWith('r');
    const top = pos.startsWith('t');
    const margin = num(ctx, 'margin', 0.06);
    const hold = num(ctx, 'hold', 2.6);
    const guides = bool(ctx, 'guides', true);
    const mx = W * margin;
    const my = H * margin;
    const safeW = W - mx * 2;
    const portrait = H > W;
    const tr = ctx.s.tracking;
    const nh0 = Math.min(H * 0.1, W * (portrait ? 0.13 : 0.075)) * ctx.s.scale;
    const accW = Math.max(4, nh0 * 0.16);
    const maxBar = safeW - accW - nh0 * 0.2;
    // name bar
    const nPad = nh0 * 0.42;
    const nFs = Math.min(nh0 * 0.56, fitLine(name, maxBar - nPad * 2, nh0 * 0.56, ctx.family, ctx.weight, tr));
    const nW = Math.min(maxBar, strWidth(name, nFs, ctx.family, ctx.weight, tr) + nPad * 2);
    const nh = nh0;
    // title bar
    const th = nh * 0.64;
    const tPad = th * 0.45;
    const tWeight = Math.min(600, ctx.weight);
    const tFs = Math.min(th * 0.5, fitLine(title, maxBar - tPad * 2, th * 0.5, ctx.family, tWeight, Math.max(0, tr) + 0.02));
    const tW = Math.min(maxBar, strWidth(title, tFs, ctx.family, tWeight, Math.max(0, tr) + 0.02) + tPad * 2);
    const totalH = nh + th;
    const y0 = top ? my : H - my - totalH;
    const accX = right ? W - mx - accW : mx;
    const barX = (w: number) => (right ? accX - w : accX + accW);
    const ex = ease('expo.out');

    // schedule
    const tAcc = 0.1;
    const tName = 0.3;
    const tTitle = 0.55;
    const inEnd = tTitle + 0.65;
    const tOut = inEnd + hold;
    const cycle = tOut + 0.4 + 0.25 + 0.45 + 0.6;

    /** draw a bar that grows out of the accent side; p = width reveal, q = text reveal */
    const bar = (g0: CanvasRenderingContext2D, y: number, h: number, w: number, fill: string, ink: string, text: string, fs: number, weight: number, track: number, pad: number, p: number, q: number) => {
      if (p <= 0) return;
      const vw = w * p;
      const x = right ? accX - vw : accX + accW;
      g0.fillStyle = fill;
      g0.fillRect(x, y, vw, h);
      if (q <= 0) return;
      g0.save();
      g0.beginPath();
      g0.rect(x, y, vw, h);
      g0.clip();
      g0.fillStyle = ink;
      g0.font = font(fs, ctx.family, weight);
      const fullX = barX(w) + pad;
      const slide = (1 - q) * (w * 0.6) * (right ? 1 : -1);
      drawTracked(g0, text, fullX + slide, y + h * 0.53, fs, ctx.family, weight, track, 'left');
      g0.restore();
    };

    return canvasRuntime(
      ctx,
      (g, time) => {
        const t = mod(time, cycle);
        if (guides) {
          g.strokeStyle = rgba(ctx.s.primary, 0.22);
          g.lineWidth = 1;
          g.setLineDash([6, 6]);
          g.strokeRect(mx + 0.5, my + 0.5, safeW - 1, H - my * 2 - 1);
          g.setLineDash([]);
          // corner ticks
          g.fillStyle = rgba(ctx.s.primary, 0.35);
          const tk = Math.max(8, Math.min(W, H) * 0.03);
          for (const [x, y, sx, sy] of [[mx, my, 1, 1], [W - mx, my, -1, 1], [mx, H - my, 1, -1], [W - mx, H - my, -1, -1]]) {
            g.fillRect(x, y, tk * sx, 2 * sy);
            g.fillRect(x, y, 2 * sx, tk * sy);
          }
        }
        // accent bar grows from the bar edge nearest the stage edge
        const pa = easeOut3(seg(t, tAcc, 0.35)) * (1 - easeIn3(seg(t, tOut + 0.6, 0.3)));
        if (pa > 0) {
          const h = totalH * pa;
          g.fillStyle = ctx.s.accent;
          g.fillRect(accX, top ? y0 : y0 + totalH - h, accW, h);
        }
        const pn = ex(seg(t, tName, 0.55)) * (1 - easeIn3(seg(t, tOut + 0.2, 0.45)));
        const qn = ex(seg(t, tName + 0.08, 0.6)) * (1 - easeIn3(seg(t, tOut + 0.15, 0.4)));
        bar(g, y0, nh, nW, ctx.s.primary, ctx.s.background, name, nFs, ctx.weight, tr, nPad, pn, qn);
        const pt = ex(seg(t, tTitle, 0.55)) * (1 - easeIn3(seg(t, tOut, 0.4)));
        const qt = ex(seg(t, tTitle + 0.08, 0.6)) * (1 - easeIn3(seg(t, tOut - 0.05, 0.35)));
        bar(g, y0 + nh, th, tW, ctx.s.secondary, ctx.s.primary, title, tFs, tWeight, Math.max(0, tr) + 0.02, tPad, pt, qt);
      },
      { settle: inEnd + 0.3 },
    );
  },
});
