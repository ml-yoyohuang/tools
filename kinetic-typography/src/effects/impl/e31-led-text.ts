import { rgba, stageCanvas, textMatrix } from '../../engine/canvas';
import { bool, mod, num, PALETTE } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { asLines } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// The text is rasterised into an N-row off-screen canvas, thresholded into a
// boolean matrix and redrawn as round LEDs on a dot-pitch grid. Unlit LEDs stay
// visible; lit ones get a soft halo and gentle (never full-screen) flicker.
const impl: EffectImpl = {
  id: 'led-text',
  defaults: { ...PALETTE.darkCoral, primary: '#FF7153', secondary: '#D7FF00' },
  posterTime: 1.6,
  maxChars: 40,
  hide: ['fontScale', 'tracking'],
  params: [
    { key: 'rows', label: '點陣列數', type: 'range', min: 12, max: 40, step: 1, default: 22, hint: '列數越多越清晰，點也越小。' },
    { key: 'scroll', label: '水平捲動', type: 'toggle', default: true },
    { key: 'flicker', label: '亮度閃爍', type: 'range', min: 0, max: 1, step: 0.05, default: 0.35 },
  ],
  create(ctx): EffectRuntime {
    const rows = Math.round(num(ctx, 'rows', 22) * (ctx.mode === 'card' ? 0.85 : 1));
    const scroll = bool(ctx, 'scroll', true);
    const flicker = num(ctx, 'flicker', 0.35) * Math.min(1, ctx.s.intensity);
    const text = asLines(ctx.text).replace(/\n/g, '  ');
    const m = textMatrix(text, rows, ctx.font.sans, 900);
    const sc = stageCanvas(ctx);
    const g = sc.g;
    const boardH = ctx.height * 0.72;
    const pitch = boardH / rows;
    const boardCols = Math.floor((ctx.width * 0.92) / pitch);
    const ox = (ctx.width - boardCols * pitch) / 2 + pitch / 2;
    const oy = (ctx.height - rows * pitch) / 2 + pitch / 2;
    const rDot = pitch * 0.36;
    const fits = m.cols <= boardCols;
    const doScroll = scroll || !fits;
    const span = m.cols + boardCols * 0.35; // gap between repeats
    const speed = (boardCols / 4.5) * Math.max(0.2, ctx.s.intensity); // columns per second
    const on = ctx.s.primary;
    const off = rgba(ctx.s.primary, 0.1);
    const halo = rgba(ctx.s.primary, 0.18);

    return {
      canvas: sc.canvas,
      render(t) {
        sc.clear(ctx.s.background);
        // frame
        g.fillStyle = rgba('#000000', 0.25);
        g.fillRect(ox - pitch, oy - pitch, boardCols * pitch + pitch, rows * pitch + pitch);
        const shift = doScroll ? mod(t * speed, span) : -(boardCols - m.cols) / 2;
        const shiftI = Math.floor(shift);
        const pulse = 1 - flicker * 0.25 * (0.5 + 0.5 * Math.sin(t * 7.3));
        const offPath = new Path2D();
        const onPaths: Path2D[] = [new Path2D(), new Path2D(), new Path2D()];
        const haloPath = new Path2D();
        for (let c = 0; c < boardCols; c++) {
          let mc = c + shiftI;
          if (doScroll) mc = mod(mc - boardCols, span);
          const x = ox + c * pitch;
          for (let r = 0; r < rows; r++) {
            const y = oy + r * pitch;
            const lit = mc >= 0 && mc < m.cols && m.cells[r * m.cols + Math.floor(mc)] === 1;
            if (lit) {
              // per-LED brightness bucket changes ~6x per second (seeded)
              const b = Math.floor(hash2(c * 97 + r, Math.floor(t * 6), ctx.seed) * 3 * (flicker > 0 ? 1 : 0));
              onPaths[b].moveTo(x + rDot, y);
              onPaths[b].arc(x, y, rDot, 0, Math.PI * 2);
              haloPath.moveTo(x + rDot * 1.9, y);
              haloPath.arc(x, y, rDot * 1.9, 0, Math.PI * 2);
            } else {
              offPath.moveTo(x + rDot, y);
              offPath.arc(x, y, rDot, 0, Math.PI * 2);
            }
          }
        }
        g.fillStyle = off;
        g.fill(offPath);
        g.fillStyle = halo;
        g.globalAlpha = pulse;
        g.fill(haloPath);
        [1, 0.86, 0.72].forEach((a, i) => {
          g.globalAlpha = pulse * (flicker > 0 ? a : 1);
          g.fillStyle = on;
          g.fill(onPaths[i]);
        });
        g.globalAlpha = 1;
        // specular dot on lit LEDs is skipped for perf; instead a tiny secondary status light
        g.fillStyle = ctx.s.secondary;
        g.beginPath();
        g.arc(ox - pitch * 0.5 + 4, oy - pitch * 0.5 - pitch * 0.7, Math.max(2, pitch * 0.18), 0, Math.PI * 2);
        g.globalAlpha = (Math.floor(t * 1.5) % 2) * 0.8 + 0.2;
        g.fill();
        g.globalAlpha = 1;
      },
    };
  },
};
export default impl;
