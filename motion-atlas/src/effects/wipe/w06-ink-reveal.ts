import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, ease, minSide, mixHex, num, smoothstep, TAU } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { noise2 } from '../../engine/random';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { farCorner } from './_util';

interface Blob {
  x: number;
  y: number;
  delay: number;
  rf: number;
  ox: number;
  oy: number;
  drops: { a: number; d: number; s: number; at: number }[];
}

export default defineEffect({
  id: 'ink-reveal',
  code: 'W06',
  nameZh: '墨跡揭露',
  nameEn: 'Ink Reveal',
  category: 'wipe',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '幾團邊緣不規則的墨跡在畫面上暈開、合併，墨跡內逐步露出新場景，邊緣帶一圈濕墨色。',
  tags: ['墨跡', '暈染', '不規則', '擦拭', 'ink'],
  suitable: ['東方／書法主題', '藝術展覽', '品牌故事'],
  principle:
    'Canvas 2D clip：每團墨跡是極座標多邊形 r(θ) = R(t)·(1 + amp·n(θ))，n 為以 (cos θ, sin θ) 取樣的 2D 值雜訊（兩個頻率疊加，高頻層隨時間緩慢流動，且首尾相接無接縫）。各墨跡依種子延遲出現、以 power2.inOut 擴張到 R_final = 到最遠角點距離 /(1 − amp)，保證最後完全覆蓋。所有墨跡（與邊緣的小墨點）同向繞行組成一條路徑，nonzero 填色＝聯集：外圈填濕墨色，內縮一圈後 clip 畫新場景。',
  defaultText: '墨／INK',
  palette: 'PASTEL',
  colors: { primary: C.black, accent: C.red },
  controls: ['text', 'font', 'weight', 'secondary', 'accent', 'seed'],
  textHint: '「／」前為 A 場景文字，後為 B 場景文字。',
  params: [
    ...TRANSITION_PARAMS,
    { key: 'blobs', label: '墨跡數', type: 'range', min: 1, max: 6, step: 1, default: 3 },
    { key: 'rough', label: '邊緣不規則度', type: 'range', min: 0, max: 0.6, step: 0.02, default: 0.32 },
    { key: 'wet', label: '濕墨邊', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '第一團墨跡先落下，其餘依種子延遲 0–35% 陸續出現；每團以 power2.inOut 暈開，邊緣持續緩慢蠕動，前緣有小墨點先濺出再被吞沒。',
    hold: 'B 完整停留，墨跡已覆蓋全畫面。',
    exit: '新的墨跡再暈開一次換回 A。',
    loop: 'A → B → A；種子改變墨跡位置與邊緣形狀。',
  },
  accept: [
    '轉場中可看到多團不規則邊緣的區域擴張並互相合併。',
    '邊緣不規則度設為 0 時墨跡變成正圓。',
    '改變種子，墨跡位置與輪廓改變；改變墨跡數，同時出現的團數改變。',
    '轉場結束時新場景完整、沒有殘留的舊場景碎片。',
  ],
  cycle: 4.4,
  posterTime: 1.75,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const nB = Math.round(num(ctx, 'blobs', 3));
    const amp = num(ctx, 'rough', 0.32);
    const wet = bool(ctx, 'wet', true);
    const steps = Math.max(40, Math.round(110 * ctx.q));
    const r = ctx.rand;
    const blobs: Blob[] = [];
    for (let i = 0; i < nB; i++) {
      const x = w * (0.15 + 0.7 * r());
      const y = h * (0.15 + 0.7 * r());
      const drops: Blob['drops'] = [];
      const nd = 5 + Math.floor(r() * 5);
      for (let j = 0; j < nd; j++) drops.push({ a: r() * TAU, d: 1.06 + r() * 0.22, s: 0.4 + r(), at: 0.08 + r() * 0.45 });
      blobs.push({
        x,
        y,
        delay: i === 0 ? 0 : 0.05 + r() * 0.3,
        rf: (farCorner(x, y, w, h) * 1.03) / Math.max(0.2, 1 - amp),
        ox: r() * 50,
        oy: r() * 50,
        drops,
      });
    }
    const spread = ease('power2.inOut');
    const band = m * 0.022;

    /** Adds the union of all blobs (inset by `inset` px) to the current path. */
    const addBlobs = (g: CanvasRenderingContext2D, p: number, t: number, inset: number) => {
      for (const b of blobs) {
        const local = clamp((p - b.delay) / (1 - b.delay), 0, 1);
        if (local <= 0) continue;
        const R = spread(local) * b.rf;
        const Ri = R - inset;
        if (Ri > 0.5) {
          for (let k = 0; k < steps; k++) {
            const th = (k / steps) * TAU;
            const c = Math.cos(th);
            const s = Math.sin(th);
            const n =
              0.65 * noise2(c * 1.5 + b.ox, s * 1.5 + b.oy, ctx.seed) +
              0.35 * noise2(c * 4.2 + b.ox + t * 0.18, s * 4.2 + b.oy, ctx.seed + 7);
            const rr = Math.max(0, Ri * (1 + amp * n));
            if (k === 0) g.moveTo(b.x + c * rr, b.y + s * rr);
            else g.lineTo(b.x + c * rr, b.y + s * rr);
          }
          g.closePath();
        }
        // satellite droplets just ahead of the edge, swallowed as the blob grows
        const life = smoothstep(0.02, 0.12, local) * (1 - smoothstep(0.55, 0.8, local));
        if (life > 0 && amp > 0) {
          for (const d of b.drops) {
            if (local < d.at * 0.2) continue;
            const rd = m * 0.014 * d.s * life - inset * 0.35;
            if (rd <= 0.3) continue;
            const dist = R * d.d;
            const x = b.x + Math.cos(d.a) * dist;
            const y = b.y + Math.sin(d.a) * dist;
            g.moveTo(x + rd, y);
            g.arc(x, y, rd, 0, TAU);
          }
        }
      }
    };

    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, (x) => x);
      sc.draw(g, tr.from);
      if (tr.p <= 0) return;
      const toBg = sc.scene(tr.to).bg;
      const wetBand = wet ? band * (1 - smoothstep(0.85, 1, tr.p)) : 0;
      if (wetBand > 0) {
        g.fillStyle = mixHex(toBg, ctx.s.secondary, 0.4);
        g.beginPath();
        addBlobs(g, tr.p, t, 0);
        g.fill();
      }
      g.save();
      g.beginPath();
      addBlobs(g, tr.p, t, wetBand);
      g.clip();
      sc.draw(g, tr.to);
      g.restore();
    });
  },
});
