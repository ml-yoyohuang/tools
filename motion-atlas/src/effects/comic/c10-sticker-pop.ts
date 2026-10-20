import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, easeIn3, minSide, num, phase, str, TAU } from '../../engine/helpers';
import { layoutText, phrases, type TextLayout } from '../../engine/text';
import { roundRectPath, starPts } from '../../engine/shapes';
import { inkText, polyPath, popScale } from './_util';

type Kind = 'label' | 'star' | 'heart' | 'bolt' | 'badge';

export default defineEffect({
  id: 'sticker-pop',
  code: 'C10',
  nameZh: '貼紙彈出',
  nameEn: 'Sticker Pop',
  category: 'comic',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '白色厚邊的字卡與圖形貼紙以錯開的節奏一張張啪地貼上，帶彈性過衝與歪斜角度。',
  tags: ['漫畫', '貼紙', '彈出', '節奏', 'sticker'],
  suitable: ['促銷標籤', '社群限動', '活動主視覺', '產品特點'],
  principle:
    'Canvas 2D：每張貼紙 = 外黑框（lineWidth 2·(b+o)）→ 白色 die-cut 厚邊（lineWidth 2·b）→ 色塊填色 → 內容，並有偏移陰影。版面以列×欄格子加 seed 抖動擺放；第 i 張的出場時間由節奏模式決定（均勻 / 漸快 / 兩拍分組），scale 使用 1 − e^(−6p)·cos(9p) 的彈簧曲線（約 112% 過衝再回穩），旋轉從 ±25° 回到各自的歪斜角。',
  defaultText: 'NEW／爆款／HOT／GO!',
  palette: 'POP',
  colors: { background: '#3450FF', primary: '#FFE35A', secondary: '#ED589A', accent: '#FFFFFF' },
  controls: ['text', 'font', 'weight', 'scale', 'secondary', 'accent', 'seed'],
  textHint: '用「／」分隔，每個詞變成一張字卡貼紙，其餘位置放圖形貼紙。',
  maxChars: 40,
  params: [
    {
      key: 'rhythm',
      label: '彈出節奏',
      type: 'select',
      options: [
        { value: 'even', label: '均勻' },
        { value: 'accel', label: '漸快' },
        { value: 'beat', label: '兩拍分組' },
      ],
      default: 'beat',
    },
    { key: 'count', label: '貼紙數量', type: 'range', min: 3, max: 12, step: 1, default: 7 },
    { key: 'border', label: '白邊厚度', type: 'range', min: 0.004, max: 0.03, step: 0.001, default: 0.014 },
    { key: 'tilt', label: '歪斜角度', type: 'range', min: 0, max: 25, step: 1, default: 12, unit: '°' },
  ],
  recipe: {
    enter: '貼紙依節奏模式錯開出場；每張以彈簧曲線從 0 彈到約 112% 再回穩（0.45 秒），旋轉同時回正到各自的歪斜角。',
    motion: '全部貼上後，貼紙保持靜止。',
    hold: '整組停留 1.4 秒，文字可清楚閱讀。',
    exit: '貼紙以出場的反向順序快速縮小（easeIn³）。',
    loop: '回到空白背景後重新貼上。',
  },
  accept: [
    '每張貼紙都有黑色外框與白色厚邊，像 die-cut 貼紙。',
    '貼紙不是同時出現，而是依選擇的節奏錯開。',
    '彈出時有明顯的過衝回彈與旋轉回正。',
    '文字詞語會變成字卡貼紙，空字串時仍有圖形貼紙。',
  ],
  transparent: true,
  cycle: 4.4,
  posterTime: 2.6,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const words = phrases(ctx.text).filter((x) => x.trim());
    const rhythm = str(ctx, 'rhythm', 'beat');
    const count = Math.max(Math.round(num(ctx, 'count', 7)), Math.min(words.length, 12));
    const border = num(ctx, 'border', 0.014) * m;
    const tiltMax = (num(ctx, 'tilt', 12) * Math.PI) / 180;
    const outline = Math.max(2, m * 0.006);
    // grid of cells, jittered
    const aspect = w / h;
    let cols = Math.max(1, Math.round(Math.sqrt(count * aspect)));
    let rows = Math.ceil(count / cols);
    while ((cols - 1) * rows >= count && cols > 1) cols--;
    rows = Math.ceil(count / cols);
    const cw = (w * 0.9) / cols;
    const ch = (h * 0.86) / rows;
    const cell = Math.min(cw, ch);
    const shapes: Kind[] = ['star', 'heart', 'bolt', 'badge'];
    const fills = [ctx.s.primary, ctx.s.secondary, ctx.s.accent];
    const order = Array.from({ length: count }, (_, i) => i);
    // shuffle placement order so words are spread across the grid
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(ctx.rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    let wi = 0;
    let si = Math.floor(ctx.rand() * shapes.length);
    const stickers = order.map((slot, i) => {
      const r = Math.floor(slot / cols);
      const c = slot % cols;
      const inRow = r === rows - 1 ? count - cols * (rows - 1) : cols;
      const rowOff = ((cols - inRow) * cw) / 2;
      const x = w * 0.05 + rowOff + cw * (c + 0.5) + (ctx.rand() - 0.5) * cw * 0.18;
      const y = h * 0.07 + ch * (r + 0.5) + (ctx.rand() - 0.5) * ch * 0.18;
      const kind: Kind = wi < words.length && (i % 2 === 0 || count - i <= words.length - wi) ? 'label' : shapes[si++ % shapes.length];
      let layout: TextLayout | undefined;
      let size = cell * (0.36 + ctx.rand() * 0.08) * ctx.s.scale;
      if (kind === 'label') {
        layout = layoutText(ctx, words[wi++], { cx: 0, cy: 0, maxWidth: cw * 0.66, maxHeight: ch * 0.4, fill: 0.95, lineHeight: 1.05 });
        size = 0;
      }
      return { x, y, kind, layout, size, rot: (ctx.rand() * 2 - 1) * tiltMax, fill: fills[(i + (kind === 'label' ? 0 : 1)) % fills.length], from: ctx.rand() < 0.5 ? -1 : 1 };
    });
    // labels get a bright fill, never the same as their text colour
    stickers.forEach((s) => s.kind === 'label' && s.fill === ctx.s.accent && (s.fill = ctx.s.primary));
    // rhythm → start times
    const starts = stickers.map((_, i) => {
      if (rhythm === 'even') return i * 0.22;
      if (rhythm === 'accel') {
        let acc = 0;
        for (let k = 0; k < i; k++) acc += 0.34 * 0.82 ** k + 0.05;
        return acc;
      }
      const group = Math.floor(i / 3);
      return group * 0.62 + (i % 3) * 0.11;
    });
    const POP = 0.45;
    const inDur = starts[starts.length - 1] + POP;
    const n = stickers.length;
    const durs = [0.25, inDur, 1.4, 0.3 + n * 0.04];
    const path = (g: CanvasRenderingContext2D, s: (typeof stickers)[number]) => {
      g.beginPath();
      const z = s.size;
      if (s.kind === 'label' && s.layout) {
        const L = s.layout;
        const pw = L.width / 2 + L.fontSize * 0.42;
        const phh = L.height / 2 + L.fontSize * 0.22;
        roundRectPath(g, -pw, -phh, pw * 2, phh * 2, L.fontSize * 0.35);
      } else if (s.kind === 'star') polyPath(g, starPts(0, 0, z, 0.5, 5));
      else if (s.kind === 'badge') {
        for (let i = 0; i < 24; i++) {
          const a = (i / 24) * TAU;
          const r = i % 2 ? z * 0.86 : z;
          if (i) g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
          else g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.closePath();
      } else if (s.kind === 'heart') {
        g.moveTo(0, z * 0.85);
        g.bezierCurveTo(-z * 1.25, z * 0.05, -z * 0.75, -z * 0.95, 0, -z * 0.38);
        g.bezierCurveTo(z * 0.75, -z * 0.95, z * 1.25, z * 0.05, 0, z * 0.85);
        g.closePath();
      } else {
        polyPath(g, [
          [z * 0.15, -z],
          [-z * 0.6, z * 0.12],
          [-z * 0.05, z * 0.12],
          [-z * 0.2, z],
          [z * 0.6, -z * 0.2],
          [z * 0.05, -z * 0.2],
        ]);
      }
    };
    return canvasRuntime(ctx, (g, t) => {
      const ph = phase(t, durs);
      const local = ph.p * durs[ph.i];
      stickers.forEach((s, i) => {
        let k = 0;
        let spin = 0;
        if (ph.i === 1) {
          const p = clamp((local - starts[i]) / POP, 0, 1);
          k = popScale(p);
          spin = s.from * (1 - clamp(p * 1.4, 0, 1)) ** 2 * 0.45;
        } else if (ph.i === 2) k = 1;
        else if (ph.i === 3) k = 1 - easeIn3(clamp((local - (n - 1 - i) * 0.04) / 0.3, 0, 1));
        if (k <= 0.01) return;
        g.save();
        g.translate(s.x, s.y);
        g.rotate(s.rot + spin);
        g.scale(k, k);
        g.lineJoin = 'round';
        // drop shadow
        g.save();
        g.translate(border * 0.9, border * 1.2);
        path(g, s);
        g.lineWidth = (border + outline) * 2;
        g.strokeStyle = 'rgba(20,20,20,0.35)';
        g.stroke();
        g.fillStyle = 'rgba(20,20,20,0.35)';
        g.fill();
        g.restore();
        path(g, s);
        g.lineWidth = (border + outline) * 2;
        g.strokeStyle = '#141414';
        g.stroke();
        g.lineWidth = border * 2;
        g.strokeStyle = '#FFFFFF';
        g.stroke();
        g.fillStyle = s.fill;
        g.fill();
        g.lineWidth = outline;
        g.strokeStyle = '#141414';
        g.stroke();
        if (s.layout) inkText(g, s.layout, '#141414', null, 0);
        else if (s.kind === 'badge') {
          g.beginPath();
          g.arc(0, 0, s.size * 0.42, 0, TAU);
          g.fillStyle = '#FFFFFF';
          g.fill();
          g.stroke();
        }
        g.restore();
      });
    });
  },
});
