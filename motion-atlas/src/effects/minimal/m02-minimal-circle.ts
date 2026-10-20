import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, lerp, minSide, mod, num, rgba, TAU } from '../../engine/helpers';
import { easeSineInOut, hair } from './_util';

interface Key {
  x: number;
  y: number;
  r: number;
}

export default defineEffect({
  id: 'minimal-circle',
  code: 'M02',
  nameZh: '極簡圓',
  nameEn: 'Minimal Circle',
  category: 'minimal',
  sourceType: 'partial-reference',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '單一實心主圓在幾個構圖位置間緩慢縮放與位移，一圈延遲的輪廓跟隨它，另有少量細輪廓點綴。',
  tags: ['極簡', '圓', '構圖', '留白', 'circle'],
  suitable: ['品牌背景', '簡報封面', '等待畫面'],
  principle:
    'Canvas 2D：以 seed 產生 4 個構圖關鍵格（圓心、半徑），每格先停留再以 sine.inOut 補間到下一格；圓心可移動範圍 = 舞台半寬／半高 − 半徑 − 邊距，確保不出界。跟隨輪廓取 t − lag 的同一函數（延遲取樣），停留時自然與主圓同心；小輪廓固定在 seeded 錨點，半徑與主圓反向微調；大輪廓以舞台角落為圓心只露出一段弧。',
  defaultText: '',
  palette: 'MONO',
  colors: { background: '#F2E8D5', primary: '#3450FF', secondary: '#141414', accent: '#3450FF' },
  controls: ['intensity', 'scale', 'secondary', 'accent', 'seed'],
  params: [
    { key: 'outlines', label: '輪廓數量', type: 'range', min: 0, max: 3, step: 1, default: 2 },
    { key: 'drift', label: '移動時間', type: 'range', min: 1.2, max: 5, step: 0.1, default: 2.6, unit: 's' },
    { key: 'hold', label: '停留時間', type: 'range', min: 0.2, max: 3, step: 0.1, default: 1.1, unit: 's' },
    { key: 'lag', label: '輪廓延遲', type: 'range', min: 0, max: 1.2, step: 0.05, default: 0.45, unit: 's' },
  ],
  recipe: {
    enter: '主圓已在第一個構圖位置，輪廓與它同心。',
    motion: '主圓以 sine.inOut 緩慢移到下一個位置並改變大小；延遲輪廓晚一步跟上，形成短暫偏移。',
    hold: '每個構圖停留約 1 秒，輪廓回到同心。',
    exit: '第四個構圖後回到第一個。',
    loop: '4 個構圖無縫循環。',
  },
  accept: [
    '畫面只有一個實心圓與最多三個細輪廓。',
    '主圓移動時大小也改變，停留時輪廓與主圓同心。',
    '強度 0 時主圓只在中心縮放，不位移。',
    '輪廓數量 0 時只剩實心圓；換 seed 構圖位置改變。',
  ],
  transparent: true,
  cycle: 14.8,
  posterTime: 0.5,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const outlines = Math.round(num(ctx, 'outlines', 2));
    const drift = num(ctx, 'drift', 2.6);
    const hold = num(ctx, 'hold', 1.1);
    const lag = num(ctx, 'lag', 0.45);
    const reach = clamp(0.75 * ctx.s.intensity, 0, 1);
    const pad = m * 0.08;
    const sizes = [0.27, 0.14, 0.21, 0.11];
    // seeded shuffle of the three non-first sizes
    for (let i = sizes.length - 1; i > 1; i--) {
      const j = 1 + Math.floor(ctx.rand() * i);
      [sizes[i], sizes[j]] = [sizes[j], sizes[i]];
    }
    let qx = ctx.rand() < 0.5 ? -1 : 1;
    const keys: Key[] = sizes.map((s, i) => {
      const r = m * s * ctx.s.scale;
      const rx = Math.max(0, w / 2 - r - pad);
      const ry = Math.max(0, h / 2 - r - pad);
      // alternate sides so consecutive keys travel across the stage
      const ox = i === 0 ? (ctx.rand() - 0.5) * 0.3 : qx * (0.45 + ctx.rand() * 0.55);
      const oy = (ctx.rand() * 2 - 1) * (i === 0 ? 0.2 : 0.8);
      if (i > 0) qx = -qx;
      return { x: w / 2 + ox * rx * reach, y: h / 2 + oy * ry * reach, r };
    });
    const seg = hold + drift;
    const total = seg * keys.length;
    const at = (t: number): Key => {
      const u = mod(t, total);
      const k = Math.floor(u / seg);
      const local = u - k * seg;
      const a = keys[k];
      const b = keys[(k + 1) % keys.length];
      const p = local < hold ? 0 : easeSineInOut((local - hold) / drift);
      return { x: lerp(a.x, b.x, p), y: lerp(a.y, b.y, p), r: lerp(a.r, b.r, p) };
    };
    const anchor = { x: w * (0.18 + ctx.rand() * 0.64), y: h * (ctx.rand() < 0.5 ? 0.2 : 0.8) };
    const corner = { x: ctx.rand() < 0.5 ? 0 : w, y: ctx.rand() < 0.5 ? 0 : h };
    const lw = hair(m, 0.0035);
    return canvasRuntime(ctx, (g, t) => {
      const c = at(t);
      g.lineWidth = lw;
      // 3: large arc from a stage corner (compositional line)
      if (outlines >= 3) {
        g.strokeStyle = rgba(ctx.s.accent, 0.45);
        g.beginPath();
        g.arc(corner.x, corner.y, m * (0.62 + 0.04 * Math.sin((t / total) * TAU)), 0, TAU);
        g.stroke();
      }
      // main filled circle
      g.fillStyle = ctx.s.primary;
      g.beginPath();
      g.arc(c.x, c.y, c.r, 0, TAU);
      g.fill();
      // 1: delayed echo outline
      if (outlines >= 1) {
        const e = at(t - lag);
        g.strokeStyle = ctx.s.secondary;
        g.beginPath();
        g.arc(e.x, e.y, e.r * 1.3 + m * 0.012, 0, TAU);
        g.stroke();
      }
      // 2: small static outline, radius breathes against the main circle
      if (outlines >= 2) {
        const k = c.r / (m * 0.27 * ctx.s.scale);
        g.strokeStyle = ctx.s.accent;
        g.beginPath();
        g.arc(anchor.x, anchor.y, m * (0.05 - 0.02 * k + 0.01) * ctx.s.scale + 2, 0, TAU);
        g.stroke();
      }
    });
  },
});
