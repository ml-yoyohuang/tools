import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, minSide, mod, num, smoothstep, str, TAU } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import { inkText } from './_util';

export default defineEffect({
  id: 'speed-lines',
  code: 'C02',
  nameZh: '集中速度線',
  nameEn: 'Speed Lines',
  category: 'comic',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '漫畫集中線由畫面邊緣向中心（或由中心向外）持續流動，中央橢圓留白給文字閱讀。',
  tags: ['漫畫', '集中線', '速度線', '放射', 'speed lines'],
  suitable: ['重點標語', '揭曉畫面', '遊戲提示', '直播標題'],
  principle:
    'Canvas 2D：以 seed 產生 N 條放射線（角度、粗細、長度、相位）。每條線是外粗內尖的楔形三角形，沿半徑 r 方向移動：r_tip = R + L − frac(t·v + φ)·(R + 2L − r_c(θ))；r_c(θ) 為橢圓留白邊界 1/√(cos²θ/a² + sin²θ/b²)，線段被夾在留白邊界與畫面外緣之間，因此中心永遠乾淨。方向「向外」時把進度反轉。',
  defaultText: '集中！',
  palette: 'MONO',
  colors: { background: '#FFFFFF', primary: '#141414', secondary: '#E63A2E', accent: '#FFFFFF' },
  controls: ['text', 'font', 'weight', 'intensity', 'scale', 'secondary', 'seed'],
  textHint: '置中短句，建議 2～8 個字。',
  maxChars: 24,
  params: [
    {
      key: 'flow',
      label: '流動方向',
      type: 'select',
      options: [
        { value: 'in', label: '向中心集中' },
        { value: 'out', label: '向外擴散' },
      ],
      default: 'in',
    },
    { key: 'density', label: '線條數量', type: 'range', min: 40, max: 260, step: 10, default: 150 },
    { key: 'clear', label: '中央留白', type: 'range', min: 0.15, max: 0.6, step: 0.01, default: 0.3 },
    { key: 'speed', label: '流速', type: 'range', min: 0.2, max: 2.5, step: 0.1, default: 0.9 },
  ],
  recipe: {
    enter: '一開始即佈滿集中線，中央文字已在定位。',
    motion: '每條楔形線以各自速度沿半徑流動（線性速度，無 easing），抵達留白邊界時被吃進邊界而消失，從外緣重新出現。',
    hold: '文字完全靜止，只有線條流動，閱讀不受干擾。',
    exit: '無離場，連續流動。',
    loop: '相位為 frac(t·v + φ)，長時間播放連續不跳動。',
  },
  accept: [
    '線條從邊緣指向中心，外粗內尖，呈漫畫集中線。',
    '中央橢圓區域永遠沒有線條，文字清楚可讀。',
    '切換「向外擴散」時線條改為由中心往外流。',
    '「線條數量」與「中央留白」改變時可明顯看出密度與留白大小變化。',
  ],
  transparent: true,
  cycle: 6,
  posterTime: 1,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const cx = w / 2;
    const cy = h / 2;
    const out = str(ctx, 'flow', 'in') === 'out';
    const n = Math.round(num(ctx, 'density', 150) * (0.55 + 0.45 * ctx.q));
    const clear = num(ctx, 'clear', 0.3);
    const speed = num(ctx, 'speed', 0.9);
    const m = minSide(ctx);
    const layout = layoutText(ctx, ctx.text, {
      maxWidth: w * clear * 1.9,
      maxHeight: h * clear * 1.1,
      fill: 0.9,
    });
    // clear ellipse: at least the text box + padding, at least `clear` of the stage
    const ex = Math.max(layout.width / 2 + m * 0.07, w * clear);
    const ey = Math.max(layout.height / 2 + m * 0.07, h * clear * 0.9);
    const R = Math.hypot(w, h) / 2 + 4;
    const lines = Array.from({ length: n }, (_, i) => {
      const a = ((i + (ctx.rand() - 0.5) * 0.9) / n) * TAU;
      const c = Math.cos(a);
      const s = Math.sin(a);
      const rc = 1 / Math.sqrt((c * c) / (ex * ex) + (s * s) / (ey * ey));
      return {
        c,
        s,
        rc,
        len: (0.35 + ctx.rand() * 0.65) * (R - rc),
        wid: (0.4 + ctx.rand() ** 2 * 1.6) * m * 0.012,
        v: (0.6 + ctx.rand() * 0.8) * speed,
        ph: ctx.rand(),
        hot: ctx.rand() < 0.08,
      };
    });
    const ink = ctx.s.primary;
    const lw = layout.fontSize * 0.14;
    return canvasRuntime(ctx, (g, t) => {
      const thick = 0.5 + ctx.s.intensity * 0.75;
      for (const L of lines) {
        const u = mod(L.ph + t * L.v * 0.45, 1);
        const span = R + 2 * L.len - L.rc;
        // tip runs from the outer rim to (rc - len); "out" reverses the progress
        const tip = R + L.len - (out ? 1 - u : u) * span;
        const r0 = Math.max(L.rc, tip);
        const r1 = Math.min(R, tip + L.len);
        if (r1 - r0 < 2) continue;
        // fade near the clear boundary so lines are swallowed, not clipped hard
        const fade = smoothstep(L.rc, L.rc + m * 0.08, r0 + (r1 - r0) * 0.25);
        const half = L.wid * thick * clamp((r1 - L.rc) / (R - L.rc), 0.25, 1);
        const px = -L.s;
        const py = L.c;
        g.globalAlpha = 0.35 + 0.65 * fade;
        g.fillStyle = L.hot ? ctx.s.secondary : ink;
        g.beginPath();
        g.moveTo(cx + L.c * r0, cy + L.s * r0);
        g.lineTo(cx + L.c * r1 + px * half, cy + L.s * r1 + py * half);
        g.lineTo(cx + L.c * r1 - px * half, cy + L.s * r1 - py * half);
        g.closePath();
        g.fill();
      }
      g.globalAlpha = 1;
      inkText(g, layout, ink, ctx.capture.transparent ? null : ctx.s.background, lw);
    });
  },
});
