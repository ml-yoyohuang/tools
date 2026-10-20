import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, easeInOut, minSide, num, rgba, str } from '../../engine/helpers';

export default defineEffect({
  id: 'weave-grid',
  code: 'G05',
  nameZh: '編織網格',
  nameEn: 'Weave Grid',
  category: 'grid',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '橫向緯帶像梭子一樣左右來回穿過直向經帶，一上一下交錯編成布紋，再依序抽出。',
  tags: ['編織', 'weave', '交錯', '遮擋', '布紋'],
  suitable: ['品牌紋理', '手作／織品主題', '轉場底紋'],
  principle:
    'Canvas 2D：先畫全部直向經帶，再畫每條橫向緯帶已穿入的長度；接著在每個交叉點依編織規則（平紋 (i+j) 奇偶、斜紋 (j−i) mod 4、籃紋 2×2）決定「經帶在上」的格子，用 clip 把經帶在交叉方塊內重畫一次，並在被壓住的帶子兩側加窄陰影。帶子的擺動與紋路流動只改變位置不改變交叉配對，所以任何時刻遮擋規則都一致。',
  defaultText: '',
  palette: 'STREET',
  controls: ['intensity', 'scale', 'secondary', 'seed'],
  params: [
    {
      key: 'pattern',
      label: '編織規則',
      type: 'select',
      default: 'plain',
      options: [
        { value: 'plain', label: '平紋 1/1' },
        { value: 'twill', label: '斜紋 2/2' },
        { value: 'basket', label: '籃紋 2×2' },
      ],
    },
    { key: 'pitch', label: '帶距', type: 'range', min: 0.06, max: 0.2, step: 0.005, default: 0.11, hint: '相對舞台短邊' },
    { key: 'band', label: '帶寬比例', type: 'range', min: 0.4, max: 0.95, step: 0.05, default: 0.72 },
    { key: 'shuttle', label: '穿梭時間', type: 'range', min: 0.6, max: 3, step: 0.1, default: 1.4, unit: 's' },
  ],
  recipe: {
    enter: '只有直向經帶，橫向緯帶依序從左右交替穿入（ease-in-out），帶頭為尖端。',
    motion: '每條緯帶穿過經帶時在交叉點依規則一上一下；穿好後全體帶子緩慢擺動、帶內虛線紋路沿帶子流動。',
    hold: '布面完成後停留約 1.8 秒。',
    exit: '緯帶依同順序往前方抽出畫面。',
    loop: '抽出完成後重新穿入，循環播放。',
  },
  accept: [
    '平紋時相鄰交叉點一上一下呈棋盤狀；斜紋出現對角線、籃紋為 2×2 區塊。',
    '帶子擺動或穿入途中，遮擋關係不會翻轉。',
    '緯帶交替從左、右穿入，帶頭可見。',
    '調整帶寬比例時帶子之間的空隙改變。',
  ],
  transparent: true,
  posterTime: 4.1,
  cycle: 10,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const pattern = str(ctx, 'pattern', 'plain');
    const pitch = Math.max(14, num(ctx, 'pitch', 0.11) * minSide(ctx) * ctx.s.scale);
    const bw = pitch * num(ctx, 'band', 0.72);
    const D = num(ctx, 'shuttle', 1.4);
    const amp = 0.09 * pitch * ctx.s.intensity;
    const V = Math.ceil(w / pitch) + 1;
    const H = Math.ceil(h / pitch) + 1;
    const vx0 = (w - (V - 1) * pitch) / 2;
    const hy0 = (h - (H - 1) * pitch) / 2;
    const ph = ctx.rand() * 6;
    const stagger = Math.min(0.22, 2.4 / H);
    const inT = (H - 1) * stagger + D;
    const holdT = 1.8;
    const total = inT * 2 + holdT;
    const over = (i: number, j: number) => {
      // true → vertical (warp j) on top at crossing with weft i
      if (pattern === 'twill') return (((j - i) % 4) + 4) % 4 < 2;
      if (pattern === 'basket') return ((i >> 1) + (j >> 1)) % 2 === 1;
      return (i + j) % 2 === 1;
    };
    const warpCol = ctx.s.secondary;
    const weftCol = ctx.s.primary;
    const shade = rgba('#000000', 0.28);
    const lineA = rgba(ctx.s.background, 0.35);
    const sh = Math.max(1.5, bw * 0.09);

    return canvasRuntime(ctx, (g, t) => {
      const lt = t % total;
      const vX = (j: number) => vx0 + j * pitch + amp * Math.sin(t * 0.9 + j * 0.7 + ph);
      const hY = (i: number) => hy0 + i * pitch + amp * Math.sin(t * 0.7 + i * 0.9 + ph * 1.3);
      const dash = [bw * 0.5, bw * 0.4];
      const flow = t * pitch * 0.6;

      const drawWarp = (j: number) => {
        const x = vX(j);
        g.fillStyle = warpCol;
        g.fillRect(x - bw / 2, -2, bw, h + 4);
        g.strokeStyle = lineA;
        g.lineWidth = Math.max(1, bw * 0.06);
        g.setLineDash(dash);
        g.lineDashOffset = -flow;
        g.beginPath();
        g.moveTo(x, -2);
        g.lineTo(x, h + 2);
        g.stroke();
        g.setLineDash([]);
      };

      // 1. warps
      for (let j = 0; j < V; j++) drawWarp(j);

      // 2. wefts (partial lengths)
      const spans: [number, number][] = [];
      for (let i = 0; i < H; i++) {
        const fromLeft = i % 2 === 0;
        let a: number;
        let b: number;
        const pIn = easeInOut(clamp((lt - i * stagger) / D, 0, 1));
        const pOut = easeInOut(clamp((lt - inT - holdT - i * stagger) / D, 0, 1));
        const L = w + pitch * 2;
        if (fromLeft) {
          b = -pitch + L * pIn; // head
          a = -pitch + L * pOut; // tail
        } else {
          a = w + pitch - L * pIn;
          b = w + pitch - L * pOut;
        }
        spans.push([a, b]);
        if (b - a < 1) continue;
        const y = hY(i);
        g.fillStyle = weftCol;
        g.fillRect(a, y - bw / 2, b - a, bw);
        // pointed head while travelling
        const travelling = pIn > 0 && pIn < 1;
        if (travelling) {
          const tip = bw * 0.6;
          g.beginPath();
          if (fromLeft) {
            g.moveTo(b, y - bw / 2);
            g.lineTo(b + tip, y);
            g.lineTo(b, y + bw / 2);
          } else {
            g.moveTo(a, y - bw / 2);
            g.lineTo(a - tip, y);
            g.lineTo(a, y + bw / 2);
          }
          g.fill();
        }
        g.strokeStyle = lineA;
        g.lineWidth = Math.max(1, bw * 0.06);
        g.setLineDash(dash);
        g.lineDashOffset = fromLeft ? -flow : flow;
        g.beginPath();
        g.moveTo(a, y);
        g.lineTo(b, y);
        g.stroke();
        g.setLineDash([]);
      }

      // 3. crossings: re-draw warp on top where the rule says so, plus contact shadows
      for (let i = 0; i < H; i++) {
        const [a, b] = spans[i];
        if (b - a < 1) continue;
        const y = hY(i);
        for (let j = 0; j < V; j++) {
          const x = vX(j);
          if (x + bw / 2 < a || x - bw / 2 > b + bw * 0.6) continue;
          if (over(i, j)) {
            g.save();
            g.beginPath();
            g.rect(x - bw / 2, y - bw / 2 - 1, bw, bw + 2);
            g.clip();
            drawWarp(j);
            g.restore();
            // shadow on the weft beside the warp edges
            g.fillStyle = shade;
            const l = Math.max(a, x - bw / 2 - sh);
            const r = Math.min(b, x + bw / 2 + sh);
            if (x - bw / 2 > l) g.fillRect(l, y - bw / 2, x - bw / 2 - l, bw);
            if (r > x + bw / 2) g.fillRect(x + bw / 2, y - bw / 2, r - x - bw / 2, bw);
          } else {
            // shadow on the warp above / below the weft
            const l = Math.max(a, x - bw / 2);
            const r = Math.min(b, x + bw / 2);
            if (r <= l) continue;
            g.fillStyle = shade;
            g.fillRect(l, y - bw / 2 - sh, r - l, sh);
            g.fillRect(l, y + bw / 2, r - l, sh);
          }
        }
      }
    });
  },
});
