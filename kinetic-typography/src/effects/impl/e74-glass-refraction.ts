import { drawLayout, hexToRgb, rgba, stageCanvas } from '../../engine/canvas';
import { clamp, lerp, num, PALETTE, pointerOrAuto, str, TAU } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import type { EffectImpl, EffectRuntime } from '../../engine/types';

// The scene (text + dot grid) is rendered once into an offscreen canvas and its
// pixels cached. Each frame the scene is blitted, then only the glass bounding box
// is recomputed per pixel: inside the shape every channel samples the scene at
// p + D·k_c, where D = magnification toward the centre + a bevel term along the
// edge normal, and k_R > k_G > k_B gives chromatic dispersion. Pixels outside the
// shape are copied unchanged. The glass area is capped so the loop stays cheap.

const MAX_PX = 230_000;

const impl: EffectImpl = {
  id: 'glass-refraction',
  defaults: { ...PALETTE.darkViolet },
  interactive: true,
  posterTime: 1.7,
  maxChars: 32,
  params: [
    {
      key: 'shape',
      label: '玻璃形狀',
      type: 'select',
      default: 'pane',
      options: [
        { value: 'pane', label: '圓角玻璃片' },
        { value: 'lens', label: '圓形透鏡' },
      ],
    },
    { key: 'refract', label: '折射強度', type: 'range', min: 0, max: 2, step: 0.05, default: 1, unit: '×' },
    { key: 'disperse', label: '色散', type: 'range', min: 0, max: 2, step: 0.05, default: 1, unit: '×' },
  ],
  create(ctx): EffectRuntime {
    const W = ctx.width;
    const H = ctx.height;
    const dpr = Math.min(ctx.dpr, ctx.mode === 'card' ? 1 : 1.5);
    const sc = stageCanvas(ctx, ctx.root, dpr);
    const { g } = sc;
    const CW = sc.canvas.width;
    const CH = sc.canvas.height;
    const { primary: fg, secondary: acc, background: bg } = ctx.s;
    const lens = str(ctx, 'shape', 'pane') === 'lens';
    const refract = num(ctx, 'refract', 1) * clamp(ctx.s.intensity, 0, 2);
    const disperse = num(ctx, 'disperse', 1);

    // --- scene -------------------------------------------------------------
    const L = layoutText(ctx, ctx.text, { maxHeight: H * 0.52, maxWidth: W * 0.84 });
    const scene = document.createElement('canvas');
    scene.width = CW;
    scene.height = CH;
    const sg = scene.getContext('2d', { willReadFrequently: true })!;
    sg.setTransform(dpr, 0, 0, dpr, 0, 0);
    sg.fillStyle = bg;
    sg.fillRect(0, 0, W, H);
    const step = Math.max(10, Math.min(W, H) / 16);
    sg.fillStyle = rgba(acc, 0.32);
    for (let y = step / 2; y < H; y += step)
      for (let x = step / 2; x < W; x += step) {
        sg.beginPath();
        sg.arc(x, y, Math.max(0.8, step * 0.06), 0, TAU);
        sg.fill();
      }
    sg.fillStyle = rgba(fg, 0.07);
    for (let y = step / 2; y < H; y += step * 2) sg.fillRect(0, y - 0.5, W, 1);
    drawLayout(sg, L, { fill: fg });
    const src = sg.getImageData(0, 0, CW, CH).data;

    // --- glass geometry (css px) --------------------------------------------
    let hw: number;
    let hh: number;
    if (lens) hw = hh = Math.min(W, H) * 0.25;
    else {
      hw = Math.min(W * 0.17, H * 0.27);
      hh = Math.min(H * 0.34, hw * 1.55);
    }
    const area = 4 * hw * hh * dpr * dpr;
    if (area > MAX_PX) {
      const f = Math.sqrt(MAX_PX / area);
      hw *= f;
      hh *= f;
    }
    const rr = lens ? hw : Math.min(hw, hh) * 0.28;
    const bevel = Math.min(hw, hh) * 0.32;
    const zoom = 1 + 0.16 * refract;
    const bevelPush = bevel * 1.25 * refract;
    const kR = 1 + 0.07 * disperse;
    const kB = 1 - 0.07 * disperse;
    const bw = Math.ceil(hw * 2 * dpr) + 2;
    const bh = Math.ceil(hh * 2 * dpr) + 2;
    const out = g.createImageData(bw, bh);
    const od = out.data;
    const [tr, tg, tb] = hexToRgb(acc);
    const tint = 0.07;

    const shapePath = (cx: number, cy: number, grow = 0) => {
      g.beginPath();
      if (lens) g.arc(cx, cy, hw + grow, 0, TAU);
      else g.roundRect(cx - hw - grow, cy - hh - grow, (hw + grow) * 2, (hh + grow) * 2, rr + grow);
    };

    const refractInto = (cx: number, cy: number) => {
      const bx = Math.round((cx - hw) * dpr) - 1;
      const by = Math.round((cy - hh) * dpr) - 1;
      const ihw = hw - rr;
      const ihh = hh - rr;
      for (let py = 0; py < bh; py++) {
        const Y = by + py;
        const y = (Y + 0.5) / dpr - cy;
        for (let px = 0; px < bw; px++) {
          const X = bx + px;
          const o = (py * bw + px) * 4;
          const sx0 = clamp(X, 0, CW - 1);
          const sy0 = clamp(Y, 0, CH - 1);
          const si0 = (sy0 * CW + sx0) * 4;
          const x = (X + 0.5) / dpr - cx;
          // signed distance (inside > 0) + outward normal
          let e: number;
          let nx: number;
          let ny: number;
          if (lens) {
            const r = Math.hypot(x, y) || 1e-4;
            e = hw - r;
            nx = x / r;
            ny = y / r;
          } else {
            const qx = Math.abs(x) - ihw;
            const qy = Math.abs(y) - ihh;
            if (qx > 0 && qy > 0) {
              const q = Math.hypot(qx, qy);
              e = rr - q;
              nx = (qx / q) * Math.sign(x);
              ny = (qy / q) * Math.sign(y);
            } else if (qx > qy) {
              e = rr - qx;
              nx = Math.sign(x);
              ny = 0;
            } else {
              e = rr - qy;
              nx = 0;
              ny = Math.sign(y);
            }
          }
          const cov = clamp(e * dpr + 0.5, 0, 1);
          if (cov <= 0) {
            od[o] = src[si0];
            od[o + 1] = src[si0 + 1];
            od[o + 2] = src[si0 + 2];
            od[o + 3] = 255;
            continue;
          }
          const f0 = e < bevel ? 1 - e / bevel : 0;
          const f = f0 * f0;
          // displacement in css px (sample offset relative to p)
          const dx = x / zoom - x + nx * f * bevelPush;
          const dy = y / zoom - y + ny * f * bevelPush;
          const sample = (k: number, ch: number) => {
            const sx = clamp(Math.round((cx + x + dx * k) * dpr - 0.5), 0, CW - 1);
            const sy = clamp(Math.round((cy + y + dy * k) * dpr - 0.5), 0, CH - 1);
            return src[(sy * CW + sx) * 4 + ch];
          };
          const r = sample(kR, 0) * (1 - tint) + tr * tint;
          const gg = sample(1, 1) * (1 - tint) + tg * tint;
          const b = sample(kB, 2) * (1 - tint) + tb * tint;
          // brighten the bevel slightly (light caught by the edge)
          const lift = 1 + 0.18 * f;
          od[o] = src[si0] + (Math.min(255, r * lift) - src[si0]) * cov;
          od[o + 1] = src[si0 + 1] + (Math.min(255, gg * lift) - src[si0 + 1]) * cov;
          od[o + 2] = src[si0 + 2] + (Math.min(255, b * lift) - src[si0 + 2]) * cov;
          od[o + 3] = 255;
        }
      }
      g.putImageData(out, bx, by);
    };

    // sweep across the text block (not the whole stage), with a gentle vertical drift
    const ampX = Math.max(W * 0.08, Math.min(W / 2 - hw * 0.85, L.width / 2 + hw * 0.35));
    const ampY = Math.min(H * 0.18, Math.max(H * 0.05, L.height / 2 - hh * 0.4));
    const auto = (t: number) => ({
      x: L.x + L.width / 2 + ampX * Math.sin((t * TAU) / 7.5),
      y: L.y + L.height / 2 + ampY * Math.sin((t * TAU) / 3.75 + 0.8),
    });
    let px = auto(0).x;
    let py = auto(0).y;

    return {
      canvas: sc.canvas,
      reset() {
        const p = auto(0);
        px = p.x;
        py = p.y;
      },
      render(t, dt) {
        const target = pointerOrAuto(ctx, t, auto);
        if (dt === 0 || !target.real) {
          px = target.x;
          py = target.y;
        } else {
          const k = 1 - Math.exp(-dt * 10);
          px = lerp(px, target.x, k);
          py = lerp(py, target.y, k);
        }
        const cx = clamp(px, -hw * 0.5, W + hw * 0.5);
        const cy = clamp(py, -hh * 0.5, H + hh * 0.5);
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.drawImage(scene, 0, 0);
        refractInto(cx, cy);
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        // soft shadow outside the glass only
        g.save();
        g.beginPath();
        g.rect(0, 0, W, H);
        if (lens) {
          g.moveTo(cx + hw, cy);
          g.arc(cx, cy, hw, 0, TAU, true);
        } else g.roundRect(cx - hw, cy - hh, hw * 2, hh * 2, rr);
        g.clip('evenodd');
        g.shadowColor = 'rgba(0,0,0,0.38)';
        g.shadowBlur = Math.min(hw, hh) * 0.25;
        g.shadowOffsetY = Math.min(hw, hh) * 0.08;
        shapePath(cx, cy);
        g.fillStyle = '#000';
        g.fill();
        g.restore();
        // rim + specular
        g.save();
        shapePath(cx, cy);
        g.clip();
        const spec = g.createLinearGradient(cx - hw, cy - hh, cx + hw, cy + hh);
        spec.addColorStop(0, 'rgba(255,255,255,0.20)');
        spec.addColorStop(0.32, 'rgba(255,255,255,0.03)');
        spec.addColorStop(0.36, 'rgba(255,255,255,0.10)');
        spec.addColorStop(0.42, 'rgba(255,255,255,0)');
        spec.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = spec;
        g.fillRect(cx - hw, cy - hh, hw * 2, hh * 2);
        g.restore();
        shapePath(cx, cy, -0.75);
        const rim = g.createLinearGradient(cx - hw, cy - hh, cx + hw, cy + hh);
        rim.addColorStop(0, 'rgba(255,255,255,0.75)');
        rim.addColorStop(0.5, 'rgba(255,255,255,0.12)');
        rim.addColorStop(1, rgba(acc, 0.65));
        g.strokeStyle = rim;
        g.lineWidth = 1.5;
        g.stroke();
      },
    };
  },
};
export default impl;
