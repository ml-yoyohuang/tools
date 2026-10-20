import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, ease, minSide, num, phase, rgba } from '../../engine/helpers';
import { offscreen } from '../../engine/canvas';
import { phrases } from '../../engine/text';
import { drawTracked, fitLine, font } from './_t14kit';

// A drum that turns around a HORIZONTAL axis (unlike T03's vertical cylinder).
// Each face is a pre-rendered word texture. Every frame each visible face is cut
// into horizontal strips; strip edges at drum angle φ are projected with
// y = cy + R·sin φ·f, f = (D − R) / (D − R·cos φ), so faces foreshorten toward the
// top / bottom and the near face is widest. Strips are shaded by cos φ.

export default defineEffect({
  id: 'word-drum',
  code: 'T17',
  nameZh: '文字滾筒',
  nameEn: 'Word Drum',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '詞句排在橫放的滾筒表面，滾筒繞水平軸一格一格翻轉，正面的詞停住閱讀。',
  tags: ['滾筒', '水平軸', '翻轉', '3D', 'drum'],
  suitable: ['標語輪播', '數字／關鍵字切換', '節目片頭'],
  principle:
    'Canvas 2D 投影：N 個面繞水平軸排成多邊形滾筒，面 p 的中心角 θ = (p − r)·2π/N（r = 目前旋轉格數，以 back.inOut 分段補間）。每個可見面切成多條水平細條，細條邊緣角 φ 投影到 y = cy + R·sin φ·f，f = (D − R)/(D − R·cos φ)（透視），寬度乘上 f；以 drawImage 從預先繪好的文字貼圖取對應列，並依 1 − cos φ 疊上背景色做明暗。',
  defaultText: 'TURN／翻轉／EVERY／DAY',
  palette: 'STREET',
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'direction', 'secondary', 'accent'],
  directions: ['up', 'down'],
  textHint: '用「／」分隔多個詞，滾筒每翻一格換下一個詞。',
  params: [
    { key: 'faces', label: '滾筒面數', type: 'range', min: 6, max: 14, step: 1, default: 8 },
    { key: 'hold', label: '停留時間', type: 'range', min: 0.3, max: 3, step: 0.1, default: 1.1, unit: 's' },
    { key: 'turn', label: '翻轉時間', type: 'range', min: 0.3, max: 1.6, step: 0.05, default: 0.7, unit: 's' },
    { key: 'depth', label: '透視距離', type: 'range', min: 1.6, max: 8, step: 0.1, default: 3.2, hint: '越小透視越強' },
  ],
  recipe: {
    enter: '滾筒已就位，第一個詞正對鏡頭。',
    motion: '滾筒繞水平軸翻一格（back.inOut，強度控制過衝），下一個詞從下方（或上方）轉上來，上一面向後壓扁變暗。',
    hold: '每個詞正對鏡頭停留（預設 1.1s）。',
    exit: '無離場，持續翻轉。',
    loop: '詞序循環；面數與詞數不同時，詞依邏輯順序貼到下一面，永遠接續。',
  },
  accept: [
    '翻轉時面在上下方向被壓扁（繞水平軸），左右不轉動。',
    '靠近上下邊緣的面較暗、較窄，正面最寬最亮。',
    '方向改為向下後，新詞從上方翻下來。',
    '停留時正面的詞完整可讀。',
  ],
  cycle: 7.2,
  posterTime: 0.4,
  create(ctx) {
    const { width: W, height: H } = ctx;
    const N = Math.round(num(ctx, 'faces', 8));
    const hold = num(ctx, 'hold', 1.1);
    const turn = num(ctx, 'turn', 0.7);
    const D0 = num(ctx, 'depth', 3.2);
    const k = clamp(ctx.s.intensity, 0, 2);
    const words = phrases(ctx.text);
    const M = words.length;
    const m = minSide(ctx);
    const R = Math.min(H * 0.36, m * 0.5) * ctx.s.scale;
    const D = R * D0;
    const faceH = 2 * R * Math.sin(Math.PI / N);
    const DW = Math.min(W * 0.8, Math.max(m * 0.9, faceH * 5)) * Math.min(1, ctx.s.scale * 1.1);
    const cx = W / 2;
    const cy = H / 2;
    const dpr = Math.min(2, ctx.dpr);
    const texW = Math.ceil(DW * dpr);
    const texH = Math.ceil(faceH * dpr);
    const step = (Math.PI * 2) / N;
    const K = Math.max(10, Math.round(30 * ctx.q));
    const bands = [
      { bg: ctx.s.primary, fg: ctx.s.background },
      { bg: ctx.s.secondary, fg: ctx.s.primary },
    ];
    const cache = new Map<string, HTMLCanvasElement>();
    const tex = (wi: number, v: number) => {
      const key = wi + ':' + v;
      let c = cache.get(key);
      if (!c) {
        const o = offscreen(texW, texH);
        const b = bands[v];
        o.g.fillStyle = b.bg;
        o.g.fillRect(0, 0, texW, texH);
        const w = words[wi];
        const fs = fitLine(w, texW * 0.86, texH * 0.64, ctx.family, ctx.weight, ctx.s.tracking);
        o.g.fillStyle = b.fg;
        o.g.font = font(fs, ctx.family, ctx.weight);
        drawTracked(o.g, w, texW / 2, texH * 0.53, fs, ctx.family, ctx.weight, ctx.s.tracking, 'center');
        c = o.canvas;
        cache.set(key, c);
      }
      return c;
    };
    const ez = ease(`back.inOut(${(0.6 + 1.2 * k).toFixed(2)})`);
    const sgn = ctx.dir === 'down' ? -1 : 1;
    const proj = (phi: number) => {
      const f = (D - R) / (D - R * Math.cos(phi));
      return { y: cy + R * Math.sin(phi) * f, f };
    };

    // silhouette (same for every frame) + shading gradient by drum angle
    const SIL = 48;
    const lim = Math.PI / 2 - 0.001; // faces are visible up to ±90°
    const sil = Array.from({ length: SIL + 1 }, (_, i) => {
      const phi = -lim + (2 * lim * i) / SIL;
      const P = proj(phi);
      return { y: P.y, hw: (DW * P.f) / 2 };
    });
    const g0 = offscreen(2, 2).g;
    const shadeGrad = g0.createLinearGradient(0, sil[0].y, 0, sil[SIL].y);
    for (let i = 0; i <= 16; i++) {
      const phi = -lim + (2 * lim * i) / 16;
      const y = proj(phi).y;
      const off = clamp((y - sil[0].y) / Math.max(1, sil[SIL].y - sil[0].y), 0, 1);
      shadeGrad.addColorStop(off, rgba(ctx.s.background, Math.min(0.92, (1 - Math.cos(phi)) * 0.9)));
    }

    return canvasRuntime(ctx, (g, t) => {
      const ph = phase(t, [hold, turn]);
      const s = Math.floor(t / ph.total);
      const r = s + (ph.i === 1 ? ez(ph.p) : 0);
      // axle rod behind the drum (shows the horizontal axis)
      const rod = Math.max(3, R * 0.05);
      g.fillStyle = ctx.s.accent;
      g.fillRect(cx - DW / 2 - R * 0.28, cy - rod / 2, DW + R * 0.56, rod);
      for (const side of [-1, 1]) {
        g.beginPath();
        g.arc(cx + side * (DW / 2 + R * 0.28), cy, rod * 1.8, 0, Math.PI * 2);
        g.fill();
      }
      const lo = Math.floor(r - N / 4) - 1;
      const hi = Math.ceil(r + N / 4) + 1;
      g.imageSmoothingEnabled = true;
      for (let p = lo; p <= hi; p++) {
        const th = (p - r) * step * sgn;
        if (Math.cos(th) < -0.02) continue;
        const wi = ((p % M) + M) % M;
        const img = tex(wi, ((p % 2) + 2) % 2);
        const a0 = th - step / 2;
        for (let j = 0; j < K; j++) {
          const pa = a0 + (j / K) * step;
          const pb = a0 + ((j + 1) / K) * step;
          if (Math.cos((pa + pb) / 2) <= 0) continue;
          const A = proj(pa);
          const B = proj(pb);
          const hgt = B.y - A.y;
          if (hgt < 0.25) continue;
          const f = (A.f + B.f) / 2;
          const w = DW * f;
          const sy = (j / K) * texH;
          g.drawImage(img, 0, sy, texW, texH / K, cx - w / 2, A.y, w, hgt + 0.6);
        }
        // face edge line
        const E = proj(a0);
        if (Math.cos(a0) > 0) {
          g.fillStyle = rgba(ctx.s.background, 0.9);
          g.fillRect(cx - (DW * E.f) / 2, E.y - 0.75, DW * E.f, 1.5);
        }
      }
      // cylinder shading: one silhouette path filled with a vertical gradient (no strip seams)
      g.fillStyle = shadeGrad;
      g.beginPath();
      for (let i = 0; i <= SIL; i++) {
        const P = sil[i];
        if (i) g.lineTo(cx + P.hw, P.y);
        else g.moveTo(cx + P.hw, P.y);
      }
      for (let i = SIL; i >= 0; i--) g.lineTo(cx - sil[i].hw, sil[i].y);
      g.closePath();
      g.fill();
    });
  },
});
