import { defineEffect } from '../../engine/define';
import { offscreen } from '../../engine/canvas';
import { canvasRuntime, mod, num } from '../../engine/helpers';
import { fontString, phrases } from '../../engine/text';

// Ported from kinetic-typography e12-diagonal-bands (DOM tracks → Canvas 2D).
// A rotated stack of bands with gaps. Bands alternate between solid colour blocks
// (text knocked out in the background colour) and hollow outlined text on the bare
// background; every 4th band (i % 4 = 2) uses the secondary colour. Adjacent bands run
// in opposite directions. The repeat unit "phrase  →  " is measured once with the
// same font / letter-spacing that draws it, and each offset is (t·v + φ) mod unitW,
// so the seams are invisible and every band loops seamlessly.
const HEIGHTS = [1, 0.62, 1.25, 0.7, 0.9, 0.55, 1.1, 0.8, 0.66];

export default defineEffect({
  id: 'diagonal-bands',
  code: 'T13',
  nameZh: '斜向文字帶',
  nameEn: 'Diagonal Text Bands',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '多條斜向文字帶交錯反向滑動，實心色帶與鏤空描邊字交替，像街頭海報的封條。',
  tags: ['斜向', '色帶', '跑馬燈', '無縫', 'bands'],
  suitable: ['活動轉場', '街頭感海報', '促銷封條'],
  principle:
    'Canvas 2D：整組色帶以固定角度旋轉並大到覆蓋舞台（所需高度 = W·sin|θ| + H·cos|θ|）。每條帶裁切在自己的矩形內，重複單位「詞＋箭頭」以相同字型與字距量測一次寬度 unitW，偏移 = (t·v + φ) mod unitW，所以接縫無痕；相鄰帶反向，實心帶以背景色鏤空文字、空心帶以描邊文字，速度隨帶高變化。',
  defaultText: '天亮以前／MOTION ATLAS',
  palette: 'POP',
  colors: { background: '#ED589A', primary: '#FFFFFF', secondary: '#FFE35A', accent: '#3450FF' },
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'direction', 'secondary'],
  directions: ['left', 'right'],
  maxChars: 40,
  textHint: '用「／」分隔多個詞，色帶輪流使用。',
  params: [
    { key: 'bands', label: '色帶數', type: 'range', min: 2, max: 9, step: 1, default: 5 },
    { key: 'angle', label: '傾斜角度', type: 'range', min: -45, max: 45, step: 1, default: -22, unit: '°' },
    { key: 'gap', label: '色帶間距', type: 'range', min: 0, max: 0.6, step: 0.05, default: 0.18 },
  ],
  recipe: {
    enter: '色帶一開始就鋪滿畫面並在移動中。',
    motion: '每條帶等速水平滑動（沿帶方向），相鄰帶方向相反，速度依帶高略有差異。',
    hold: '連續滑動；文字夠大、速度適中，任何時刻都能讀出至少一條帶的完整詞。',
    exit: '無離場。',
    loop: '偏移以 mod 單位寬度計算，接縫無縫循環。',
  },
  accept: [
    '至少 3 條斜向色帶，相鄰帶滑動方向相反。',
    '實心帶與鏤空描邊帶交替出現。',
    '長時間觀察看不到文字接縫跳動。',
    '改變角度時整組色帶的斜度改變，仍覆蓋整個畫面。',
  ],
  cycle: 10,
  posterTime: 1,
  legacyIds: ['diagonal-bands'],
  create(ctx) {
    const W = ctx.width;
    const H = ctx.height;
    const nb = Math.round(num(ctx, 'bands', 5));
    const angle = num(ctx, 'angle', -22);
    const gapK = num(ctx, 'gap', 0.18);
    const list = phrases(ctx.text);
    const diag = Math.hypot(W, H);
    const rad = (Math.abs(angle) * Math.PI) / 180;
    const cover = W * Math.sin(rad) + H * Math.cos(rad);
    const hs = Array.from({ length: nb }, (_, i) => HEIGHTS[i % HEIGHTS.length]);
    const unitSum = hs.reduce((a, b) => a + b, 0) + gapK * (nb - 1);
    const u = (cover * 1.06) / unitSum;
    const groupW = diag * 1.1;
    const groupH = u * unitSum;
    const { primary: fg, secondary: sec, background: bg } = ctx.s;
    const measure = offscreen(4, 4).g;

    let y = -groupH / 2;
    const bands = hs.map((h, i) => {
      const bh = u * h;
      const solid = i % 2 === 0;
      const fill = solid ? (i % 4 === 2 ? sec : fg) : null;
      const dir = (i % 2 === 0 ? -1 : 1) * ctx.dirSign * -1;
      const size = bh * (solid ? 0.66 : 0.76) * Math.min(1.3, ctx.s.scale);
      const font = fontString(size, ctx.family, ctx.weight, i % 3 === 1 ? 'italic' : '');
      const spacing = `${ctx.s.tracking * size}px`;
      const arrow = dir < 0 ? '←' : '→';
      const unit = `${list[i % list.length]}   ${arrow}   `;
      measure.font = font;
      measure.letterSpacing = spacing;
      const unitW = Math.max(8, measure.measureText(unit).width);
      const v = (W * 0.1 + size * 0.6) * (1 + (i % 3) * 0.25) * Math.max(0.05, ctx.s.intensity);
      const band = { y, bh, solid, fill, dir, size, font, spacing, unit, unitW, v, phase: ((i * 0.37) % 1) * unitW, copies: Math.ceil(groupW / unitW) + 2 };
      y += bh + u * gapK;
      return band;
    });

    return canvasRuntime(ctx, (g, t) => {
      g.translate(W / 2, H / 2);
      g.rotate((angle * Math.PI) / 180);
      g.textBaseline = 'middle';
      g.textAlign = 'left';
      for (const b of bands) {
        g.save();
        g.beginPath();
        g.rect(-groupW / 2, b.y, groupW, b.bh);
        if (b.fill) {
          g.fillStyle = b.fill;
          g.fill();
        }
        g.clip();
        g.font = b.font;
        g.letterSpacing = b.spacing;
        const off = mod(t * b.v + b.phase, b.unitW);
        const x0 = -groupW / 2 + (b.dir < 0 ? -off : off - b.unitW);
        const cy = b.y + b.bh / 2 + b.size * 0.04;
        if (b.solid) g.fillStyle = bg;
        else {
          g.strokeStyle = fg;
          g.lineWidth = Math.max(1.2, b.size * 0.03);
          g.lineJoin = 'round';
        }
        for (let c = 0; c < b.copies; c++) {
          const x = x0 + c * b.unitW;
          if (b.solid) g.fillText(b.unit, x, cy);
          else g.strokeText(b.unit, x, cy);
        }
        g.restore();
      }
    });
  },
});
