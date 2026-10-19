import { layoutMask, rgba, stageCanvas } from '../../engine/canvas';
import { bool, clamp, ease, num, PALETTE, smoothstep } from '../../engine/helpers';
import { fontString, layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// A linear scan line travels down the text block. Every row it has passed shows
// the glyph mask as a thin horizontal stripe; the stripe thickens with the time
// since the scan passed it until neighbouring stripes merge into solid glyphs.
// The mask itself never moves: glyphs are revealed, never split or offset.
// Out-phase: stripes thin back to hairlines, then fade.

function plainCanvas(w: number, h: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w));
  canvas.height = Math.max(1, Math.ceil(h));
  return { canvas, g: canvas.getContext('2d')! };
}

const impl: EffectImpl = {
  id: 'scanline-reveal',
  defaults: { ...PALETTE.darkTeal },
  loopable: true,
  posterTime: 1.75,
  maxChars: 40,
  params: [
    { key: 'scan', label: '掃描秒數', type: 'range', min: 0.6, max: 4, step: 0.1, default: 1.8, unit: 's' },
    { key: 'lines', label: '每字線條數', type: 'range', min: 5, max: 24, step: 1, default: 11, hint: '掃描後顯示的水平線密度' },
    { key: 'hud', label: '顯示框線與讀數', type: 'toggle', default: true },
  ],
  create(ctx): EffectRuntime {
    const sc = stageCanvas(ctx);
    const { g, dpr } = sc;
    const W = ctx.width;
    const H = ctx.height;
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.54, maxWidth: W * 0.82 });
    const fs = L.fontSize;
    const mask = layoutMask(ctx, L, dpr, ctx.s.primary);
    const maskAcc = layoutMask(ctx, L, dpr, ctx.s.secondary);
    const work = plainCanvas(sc.canvas.width, sc.canvas.height);
    const wg = work.g;

    const scanD = num(ctx, 'scan', 1.8);
    const pitch = Math.max(2.5, fs / num(ctx, 'lines', 11));
    const hud = bool(ctx, 'hud', true);
    const k = clamp(ctx.s.intensity, 0, 2);
    const pad = fs * 0.28;
    const top = L.y - pad;
    const bottom = L.y + L.height + pad;
    const lead = 0.35;
    const lag = 0.75; // time for a row to go from hairline to solid
    const scanEnd = lead + scanD;
    const solidAt = scanEnd + lag;
    const hold = 1.7;
    const outD = 0.8;
    const outStart = solidAt + hold;
    const cycle = outStart + outD + 0.35;
    const fillEase = ease('power2.in');
    const outEase = ease('power2.inOut');
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const hudFont = fontString(Math.max(9, Math.min(13, H * 0.03)), ctx.font.mono, 500);
    const bx0 = L.x - pad * 1.2;
    const bx1 = L.x + L.width + pad * 1.2;

    const corner = (x: number, y: number, sx: number, sy: number, len: number) => {
      g.moveTo(x + sx * len, y);
      g.lineTo(x, y);
      g.lineTo(x, y + sy * len);
    };

    return {
      canvas: sc.canvas,
      settle: solidAt + 0.5,
      render(time) {
        const t = time % cycle;
        sc.clear(bg);
        // faint raster field
        g.fillStyle = rgba(fg, 0.035);
        for (let y = pitch * 0.5; y < H; y += pitch * 2) g.fillRect(0, y, W, 1);

        const scanY = top + (bottom - top) * clamp((t - lead) / scanD, 0, 1);
        const scanning = t > lead && t < scanEnd;
        const outP = outEase(clamp((t - outStart) / outD, 0, 1));
        const alpha = 1 - smoothstep(0.55, 1, outP);

        // --- stripes of the glyph mask -------------------------------------
        wg.setTransform(1, 0, 0, 1, 0, 0);
        wg.globalCompositeOperation = 'source-over';
        wg.clearRect(0, 0, work.canvas.width, work.canvas.height);
        wg.fillStyle = '#fff';
        let any = false;
        for (let y = top; y < bottom; y += pitch) {
          const tPass = lead + (scanD * (y - top)) / (bottom - top);
          if (t < tPass) break;
          const f = fillEase(clamp((t - tPass) / lag, 0, 1)) * (1 - outP);
          const th = 1 + (pitch + 0.6 - 1) * f;
          wg.fillRect(0, Math.floor((y - th / 2) * dpr), work.canvas.width, Math.max(1, Math.ceil(th * dpr)));
          any = true;
        }
        if (any) {
          wg.globalCompositeOperation = 'source-in';
          wg.drawImage(mask.canvas, 0, 0);
          g.save();
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.globalAlpha = alpha;
          g.drawImage(work.canvas, 0, 0);
          g.restore();
        }

        // --- freshly scanned rows glow in the accent colour -----------------
        if (scanning || t < scanEnd + 0.4) {
          wg.globalCompositeOperation = 'source-over';
          wg.clearRect(0, 0, work.canvas.width, work.canvas.height);
          let fresh = false;
          for (let y = top; y < bottom; y += pitch) {
            const tPass = lead + (scanD * (y - top)) / (bottom - top);
            if (t < tPass) break;
            const a = 1 - clamp((t - tPass) / 0.35, 0, 1);
            if (a <= 0) continue;
            wg.fillStyle = `rgba(255,255,255,${a})`;
            const th = 1.5;
            wg.fillRect(0, Math.floor((y - th / 2) * dpr), work.canvas.width, Math.ceil(th * dpr));
            fresh = true;
          }
          if (fresh) {
            wg.globalCompositeOperation = 'source-in';
            wg.drawImage(maskAcc.canvas, 0, 0);
            g.save();
            g.setTransform(1, 0, 0, 1, 0, 0);
            g.drawImage(work.canvas, 0, 0);
            g.restore();
          }
        }

        // --- scan line + trail ----------------------------------------------
        if (scanning) {
          const trail = Math.min(fs * 0.9, (bottom - top) * 0.5);
          const gr = g.createLinearGradient(0, scanY - trail, 0, scanY);
          gr.addColorStop(0, rgba(acc, 0));
          gr.addColorStop(1, rgba(acc, 0.16 * k));
          g.fillStyle = gr;
          g.fillRect(0, scanY - trail, W, trail);
          g.save();
          g.shadowColor = acc;
          g.shadowBlur = 14 * k;
          g.fillStyle = acc;
          g.fillRect(0, scanY - 1, W, 2);
          g.restore();
          g.fillStyle = rgba('#ffffff', 0.7);
          g.fillRect(bx0, scanY - 0.5, bx1 - bx0, 1);
        }

        // --- framing brackets + readout -------------------------------------
        if (hud) {
          const vis = smoothstep(0.05, lead + 0.2, t) * (1 - smoothstep(solidAt, solidAt + 0.6, t));
          if (vis > 0.01) {
            g.save();
            g.globalAlpha = vis * 0.85;
            g.strokeStyle = acc;
            g.lineWidth = 1.5;
            g.beginPath();
            const len = Math.min(fs * 0.35, 28);
            corner(bx0, top, 1, 1, len);
            corner(bx1, top, -1, 1, len);
            corner(bx0, bottom, 1, -1, len);
            corner(bx1, bottom, -1, -1, len);
            g.stroke();
            const p = clamp((t - lead) / scanD, 0, 1);
            g.font = hudFont;
            g.fillStyle = acc;
            g.textBaseline = 'bottom';
            g.textAlign = 'left';
            g.fillText(`SCAN ${String(Math.round(p * 100)).padStart(3, '0')}%`, bx0, top - 6);
            g.textAlign = 'right';
            g.fillText(p >= 1 ? 'OK' : `Y ${Math.round(scanY)}`, bx1, top - 6);
            g.restore();
          }
        }
      },
    };
  },
};
export default impl;
