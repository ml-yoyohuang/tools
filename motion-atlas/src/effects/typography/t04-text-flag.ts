import { defineEffect } from '../../engine/define';
import { drawLayout, offscreen } from '../../engine/canvas';
import { canvasRuntime, clamp, num, bool, rgba } from '../../engine/helpers';
import { fontString, layoutText, phrases, textWidth } from '../../engine/text';
import type { EffectContext } from '../../engine/types';

// Ported from kinetic-typography e51-text-flag (its Canvas "lite" path; no Three.js).
// The text is drawn once to an offscreen "fabric" texture. Every frame the flag is
// rebuilt from thin vertical strips: a wave field z(x, y, t) = A(u)·Σ sin(kx − ωt + φy)
// (three travelling waves, amplitude A ∝ u^1.1 so the hoist stays pinned) gives each
// strip a top / bottom displacement (perspective lift + scale), a foreshortened width
// from the local slope, a sag towards the fly end and a light / dark overlay from the
// slope-derived normal.
const ASPECT = 1.6;

function flagTexture(ctx: EffectContext, TW: number, TH: number, density: number, hoistLeft: boolean) {
  const o = offscreen(TW, TH);
  const g = o.g;
  const { primary: ink, secondary: fabric, accent } = ctx.s;
  g.fillStyle = fabric;
  g.fillRect(0, 0, TW, TH);
  g.fillStyle = rgba(ink, 0.035);
  for (let y = 0; y < TH; y += 6) g.fillRect(0, y, TW, 2);
  // hoist band + inset border
  const bandW = TW * 0.045;
  g.fillStyle = ink;
  g.fillRect(hoistLeft ? 0 : TW - bandW, 0, bandW, TH);
  g.strokeStyle = rgba(ink, 0.35);
  g.lineWidth = TH * 0.012;
  const x0 = hoistLeft ? TW * 0.08 : TW * 0.04;
  g.strokeRect(x0, TH * 0.07, TW * 0.88, TH * 0.86);
  const list = phrases(ctx.text);
  const cx = hoistLeft ? TW * 0.525 : TW * 0.475;
  if (density <= 1) {
    const L = layoutText({ ...ctx, width: TW, height: TH }, list.join('\n'), { maxWidth: TW * 0.74, maxHeight: TH * 0.66, cx, cy: TH * 0.5, lineHeight: 1.1 });
    drawLayout(g, L, { fill: ink });
  } else {
    // tiled rows of repeated text, alternating ink / accent and offset like brickwork
    g.save();
    g.beginPath();
    g.rect(x0 + TH * 0.02, TH * 0.09, TW * 0.88 - TH * 0.04, TH * 0.82);
    g.clip();
    const rows = Math.round(density);
    const rowH = (TH * 0.82) / rows;
    const fs = rowH * 0.7 * clamp(ctx.s.scale, 0.5, 1.6);
    g.font = fontString(fs, ctx.family, ctx.weight);
    g.letterSpacing = `${ctx.s.tracking * fs}px`;
    g.textBaseline = 'middle';
    for (let r = 0; r < rows; r++) {
      const word = list[r % list.length] + '  ·  ';
      const uw = Math.max(1, textWidth(word, fs, ctx.family, ctx.weight, ctx.s.tracking) + ctx.s.tracking * fs);
      g.fillStyle = r % 2 ? accent : ink;
      const y = TH * 0.09 + rowH * (r + 0.5);
      for (let x = x0 - (r % 2 ? uw * 0.5 : 0); x < TW; x += uw) g.fillText(word, x, y);
    }
    g.restore();
  }
  // grommets
  g.fillStyle = fabric;
  for (const y of [0.06, 0.94]) {
    g.beginPath();
    g.arc(hoistLeft ? TW * 0.0225 : TW * 0.9775, TH * y, TH * 0.018, 0, Math.PI * 2);
    g.fill();
  }
  return o.canvas;
}

export default defineEffect({
  id: 'text-flag',
  code: 'T04',
  nameZh: '文字旗幟',
  nameEn: 'Text Flag',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '印著文字的旗面在風中飄動：行進波讓布面彎曲、透視起伏並產生明暗。',
  tags: ['旗幟', '布料', '風', '波浪', 'flag'],
  suitable: ['應援視覺', '活動主視覺', '運動賽事'],
  principle:
    'Canvas 2D 切條變形：文字先畫進離屏「布料」貼圖；每幀把貼圖切成 40–110 條細直條，對每條取波場 z(x,y,t) = A·u^1.1·[sin(3.1x − 3.4t + 0.6y) + 0.45 sin(4.7x − 5.3t − 0.9y + 1.7) + 0.18 sin(9x − 7.7t + 2.1y)]（u = 離旗桿距離，旗桿端固定）。上下緣 z 值決定該條的上下位移與縮放（近大遠小），斜率決定條寬的透視壓縮與明暗疊色，尾端加上重力下垂。',
  defaultText: '迎風而動／MOTION',
  palette: 'POP',
  colors: { background: '#3450FF', primary: '#141414', secondary: '#FFE35A', accent: '#E63A2E' },
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'direction', 'secondary', 'accent'],
  directions: ['right', 'left'],
  maxChars: 30,
  textHint: '用「／」分行；文字密度 > 1 時會平鋪成多列重複文字。',
  params: [
    { key: 'wind', label: '振幅', type: 'range', min: 0.2, max: 2, step: 0.05, default: 1 },
    { key: 'speed', label: '風速', type: 'range', min: 0.3, max: 2.5, step: 0.05, default: 1 },
    { key: 'density', label: '文字密度（列）', type: 'range', min: 1, max: 7, step: 1, default: 1, hint: '1 = 單一標題，2 以上 = 平鋪重複文字' },
    { key: 'pole', label: '旗桿', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '旗面一開始就在風中，無入場。',
    motion: '三個不同波長與速度的行進波疊加，從旗桿往尾端傳遞；振幅隨離旗桿距離增加，尾端下垂。',
    hold: '連續飄動；文字隨布面彎曲但始終可辨識，波谷處較暗、波峰處較亮。',
    exit: '無離場。',
    loop: '波場為時間的連續函數，長時間播放保持流暢。',
  },
  accept: [
    '旗桿端固定不動，越往尾端擺動越大。',
    '布面有明暗變化，彎曲處上下緣有透視起伏。',
    '提高振幅或風速時波動明顯變大或變快。',
    '文字密度 > 1 時旗面平鋪多列重複文字。',
    '方向改為向左時旗桿在右側，文字仍為正向。',
  ],
  limits: ['以 2D 切條近似 3D 布料，沒有真正的自我遮擋；極大振幅時條與條之間可能出現細縫。'],
  cycle: 8,
  posterTime: 1.4,
  legacyIds: ['text-flag'],
  create(ctx) {
    const W = ctx.width;
    const H = ctx.height;
    const pole = bool(ctx, 'pole', true);
    const speed = num(ctx, 'speed', 1);
    const density = Math.round(num(ctx, 'density', 1));
    const hoistLeft = ctx.dirSign > 0;
    const FH = 2;
    const FW = FH * ASPECT;
    const amp = 0.42 * num(ctx, 'wind', 1) * Math.max(0.1, ctx.s.intensity);
    const wave = (x: number, y: number, t: number) => {
      const u = x / FW;
      const A = amp * Math.pow(Math.max(0, u), 1.1);
      return A * (Math.sin(3.1 * x - 3.4 * t + 0.6 * y) + 0.45 * Math.sin(4.7 * x - 5.3 * t - 0.9 * y + 1.7) + 0.18 * Math.sin(9.0 * x - 7.7 * t + 2.1 * y));
    };
    const flagW = Math.min(W * 0.7, H * 0.56 * ASPECT);
    const flagH = flagW / ASPECT;
    const px = flagW / FW;
    const TW = Math.min(1400, Math.ceil(flagW * ctx.dpr * 1.2));
    const TH = Math.round(TW / ASPECT);
    const tex = flagTexture(ctx, TW, TH, density, hoistLeft);
    const poleW = Math.max(3, flagH * 0.035);
    const hoistX = hoistLeft ? (W - flagW) / 2 + flagW * 0.03 : (W + flagW) / 2 - flagW * 0.03;
    const top = (H - flagH) / 2 - flagH * 0.04;
    const strips = Math.round(clamp(110 * ctx.q, 40, 110));
    const dxw = FW / strips;
    const ws = new Float32Array(strips);
    const yt = new Float32Array(strips);
    const yb = new Float32Array(strips);
    const sh = new Float32Array(strips);

    return canvasRuntime(
      ctx,
      (g, t0) => {
        const t = t0 * speed;
        if (pole) {
          g.fillStyle = ctx.s.primary;
          const pxl = hoistLeft ? hoistX - poleW : hoistX;
          g.fillRect(pxl, top - flagH * 0.1, poleW, H);
          g.beginPath();
          g.arc(pxl + poleW / 2, top - flagH * 0.1 - poleW * 0.9, poleW * 1.2, 0, Math.PI * 2);
          g.fill();
        }
        // i counts strips from the hoist outwards
        for (let i = 0; i < strips; i++) {
          const xm = i * dxw + dxw / 2;
          const zT = wave(xm, FH / 2, t);
          const zB = wave(xm, -FH / 2, t);
          const slope = (wave(xm + 0.01, 0, t) - wave(xm - 0.01, 0, t)) / 0.02;
          const u = xm / FW;
          ws[i] = (dxw * px) / Math.sqrt(1 + slope * slope * 0.5);
          const sT = 1 + zT * 0.16;
          const sB = 1 + zB * 0.16;
          const sag = 0.07 * u * u * px;
          yt[i] = top + flagH / 2 - (flagH / 2) * sT - zT * px * 0.22 + sag;
          yb[i] = top + flagH / 2 + (flagH / 2) * sB - zB * px * 0.22 + sag;
          // light from the upper hoist side: normal ≈ (−slope, 0, 1)
          // (mirrored flag: screen-space normal x flips sign)
          const nl = ((hoistLeft ? -slope : slope) * 0.45 + 1) / Math.sqrt(1 + slope * slope) / 1.1;
          sh[i] = 0.6 + 0.5 * nl - 1;
        }
        let x = hoistX;
        for (let i = 0; i < strips; i++) {
          const wpx = ws[i];
          const sx = hoistLeft ? (i / strips) * TW : TW - ((i + 1) / strips) * TW;
          const dx = hoistLeft ? x : x - wpx;
          g.drawImage(tex, sx, 0, TW / strips + 0.5, TH, dx, yt[i], wpx + 0.6, yb[i] - yt[i]);
          const s = sh[i];
          g.fillStyle = s < 0 ? `rgba(0,0,0,${clamp(-s, 0, 0.6)})` : `rgba(255,255,255,${clamp(s * 0.8, 0, 0.3)})`;
          g.fillRect(dx, yt[i], wpx + 0.6, yb[i] - yt[i]);
          x += hoistLeft ? wpx : -wpx;
        }
      },
      { dispose: () => (tex.width = tex.height = 0) },
    );
  },
});
