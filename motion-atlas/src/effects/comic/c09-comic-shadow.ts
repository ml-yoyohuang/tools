import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, easeInOut, minSide, num, phase, str, TAU } from '../../engine/helpers';
import { offscreen } from '../../engine/canvas';
import { layoutText } from '../../engine/text';
import { inkText } from './_util';

export default defineEffect({
  id: 'comic-shadow',
  code: 'C09',
  nameZh: '漫畫陰影掃過',
  nameEn: 'Comic Shadow',
  category: 'comic',
  sourceType: 'original',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '一道斜向的漫畫陰影帶（排線或網點）掃過文字或人物佔位圖形，只在主體內部上網，邊緣由細到粗。',
  tags: ['漫畫', '陰影', '排線', '網點', 'screentone'],
  suitable: ['標題強調', '角色登場', '海報動態', '懸疑氣氛'],
  principle:
    'Canvas 2D：陰影帶沿掃描軸 u（與水平夾「角度」）移動，帶內的色調 tone(s) = clamp((b₁−s)/G)·clamp((s−b₀)/G)，s 為像素在 u 上的投影。排線模式畫與帶邊平行的直線，線寬 ∝ tone；網點模式在 u 對齊的網格上畫圓，半徑 ∝ tone。陰影層畫在離屏畫布：先畫主體剪影，再以 source-in 合成排線，因此陰影只落在字形或人物內部；背景上另有低透明度的同一道陰影帶讓掃描方向可讀。',
  defaultText: '陰影',
  palette: 'STREET',
  colors: { background: '#F2E8D5', primary: '#E63A2E', secondary: '#141414', accent: '#FFFFFF' },
  controls: ['text', 'font', 'weight', 'scale', 'direction', 'secondary'],
  directions: ['right', 'left'],
  textHint: '粗短的字最能看出陰影，建議 1～6 個字。',
  maxChars: 20,
  params: [
    {
      key: 'style',
      label: '陰影樣式',
      type: 'select',
      options: [
        { value: 'hatch', label: '斜排線' },
        { value: 'dots', label: '半色調網點' },
      ],
      default: 'hatch',
    },
    {
      key: 'subject',
      label: '主體',
      type: 'select',
      options: [
        { value: 'text', label: '文字' },
        { value: 'figure', label: '人物佔位圖形' },
      ],
      default: 'text',
    },
    { key: 'angle', label: '陰影角度', type: 'range', min: 0, max: 60, step: 1, default: 28, unit: '°' },
    { key: 'density', label: '線／點密度', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1 },
  ],
  recipe: {
    enter: '主體乾淨地停在畫面中央 0.4 秒。',
    motion: '陰影帶前緣以 easeInOut 在 1.4 秒內斜向掃過主體，邊緣排線細、內部排線粗，形成由淺到深的過渡。',
    hold: '整個主體籠罩在陰影中停留 1 秒，主體輪廓仍清楚。',
    exit: '陰影帶後緣同方向掃出，主體恢復乾淨。',
    loop: '乾淨停留 0.5 秒後下一次掃過。',
  },
  accept: [
    '陰影只出現在文字（或人物佔位圖形）內部，背景只有淡淡的帶狀痕跡。',
    '可以看出陰影帶以斜向從一側移到另一側，方向可切換。',
    '陰影邊緣的線或點較細小，深處較粗大。',
    '切換「半色調網點」後改為圓點陰影。',
  ],
  transparent: true,
  cycle: 4.7,
  posterTime: 2.2,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const cx = w / 2;
    const cy = h / 2;
    const style = str(ctx, 'style', 'hatch');
    const figure = str(ctx, 'subject', 'text') === 'figure';
    const ang = (num(ctx, 'angle', 28) * Math.PI) / 180;
    const density = num(ctx, 'density', 1);
    const sgn = ctx.dirSign;
    const ux = Math.cos(ang) * sgn;
    const uy = Math.sin(ang);
    const layout = layoutText(ctx, ctx.text, { maxWidth: w * 0.84, maxHeight: h * 0.6, fill: 0.92 });
    const lw = figure ? Math.max(2, m * 0.008) : layout.fontSize * 0.05;
    // figure placeholder (abstract: head, torso, raised arm, legs) in a unit box of height FH
    const FH = h * 0.78 * Math.min(1.15, ctx.s.scale);
    const fig = (g: CanvasRenderingContext2D) => {
      const u = FH / 10;
      const ox = cx;
      const oy = cy - FH / 2;
      g.beginPath();
      g.moveTo(ox + u * 1.1, oy + u * 1.4);
      g.arc(ox, oy + u * 1.4, u * 1.1, 0, TAU);
      // torso
      g.moveTo(ox - u * 1.5, oy + u * 3);
      g.lineTo(ox + u * 1.5, oy + u * 3);
      g.lineTo(ox + u * 1.15, oy + u * 6.2);
      g.lineTo(ox - u * 1.15, oy + u * 6.2);
      g.closePath();
      // raised arm (right) and lowered arm (left)
      g.moveTo(ox + u * 1.2, oy + u * 3.1);
      g.lineTo(ox + u * 3.4, oy + u * 0.6);
      g.lineTo(ox + u * 4.1, oy + u * 1.1);
      g.lineTo(ox + u * 1.6, oy + u * 4.2);
      g.closePath();
      g.moveTo(ox - u * 1.2, oy + u * 3.1);
      g.lineTo(ox - u * 2.6, oy + u * 5.6);
      g.lineTo(ox - u * 1.9, oy + u * 5.9);
      g.lineTo(ox - u * 0.9, oy + u * 4.2);
      g.closePath();
      // legs
      g.moveTo(ox - u * 1.1, oy + u * 6);
      g.lineTo(ox - u * 0.15, oy + u * 6);
      g.lineTo(ox - u * 0.7, oy + u * 10);
      g.lineTo(ox - u * 1.7, oy + u * 10);
      g.closePath();
      g.moveTo(ox + u * 0.15, oy + u * 6);
      g.lineTo(ox + u * 1.1, oy + u * 6);
      g.lineTo(ox + u * 2.2, oy + u * 9.8);
      g.lineTo(ox + u * 1.2, oy + u * 10);
      g.closePath();
    };
    const bx0 = figure ? cx - FH * 0.3 : layout.x;
    const bx1 = figure ? cx + FH * 0.45 : layout.x + layout.width;
    const by0 = figure ? cy - FH / 2 : layout.y;
    const by1 = figure ? cy + FH / 2 : layout.y + layout.height;
    const proj = (x: number, y: number) => (x - cx) * ux + (y - cy) * uy;
    const corners = [proj(bx0, by0), proj(bx1, by0), proj(bx0, by1), proj(bx1, by1)];
    const pad = m * 0.08;
    const smin = Math.min(...corners) - pad;
    const smax = Math.max(...corners) + pad;
    const G = (smax - smin) * 0.28;
    const sp = (m * 0.02) / density;
    const reach = Math.hypot(w, h);
    const dpr = ctx.dpr;
    const o = offscreen(w * dpr, h * dpr);
    const silhouette = (g: CanvasRenderingContext2D, fill: string, stroke: string | null) => {
      if (figure) {
        fig(g);
        g.fillStyle = fill;
        g.fill();
        if (stroke) {
          g.lineWidth = lw;
          g.lineJoin = 'round';
          g.strokeStyle = stroke;
          g.stroke();
        }
      } else inkText(g, layout, fill, stroke, lw * 2);
    };
    // pattern of the band [b0, b1] (in s units), drawn into g
    const pattern = (g: CanvasRenderingContext2D, b0: number, b1: number, color: string, fade: number) => {
      const tone = (s: number) => clamp((b1 - s) / G, 0, 1) * clamp((s - b0) / G, 0, 1);
      g.fillStyle = color;
      g.strokeStyle = color;
      const lo = Math.max(b0, -reach);
      const hi = Math.min(b1, reach);
      if (hi <= lo) return;
      if (style === 'dots') {
        // grid aligned to u, only over the subject box
        const vx = -uy;
        const vy = ux;
        const vr = Math.max(bx1 - bx0, by1 - by0) * 0.8 + sp;
        g.beginPath();
        for (let s = Math.ceil(lo / sp) * sp; s <= hi; s += sp) {
          const k = tone(s);
          const r = sp * 0.62 * k * fade;
          if (r < 0.35) continue;
          const odd = Math.round(s / sp) % 2 ? sp / 2 : 0;
          for (let v = -vr + odd; v <= vr; v += sp) {
            const x = cx + ux * s + vx * v;
            const y = cy + uy * s + vy * v;
            g.moveTo(x + r, y);
            g.arc(x, y, r, 0, TAU);
          }
        }
        g.fill();
      } else {
        for (let s = Math.ceil(lo / sp) * sp; s <= hi; s += sp) {
          const k = tone(s);
          const lwid = sp * (0.08 + 0.7 * k) * fade;
          if (lwid < 0.3) continue;
          const x = cx + ux * s;
          const y = cy + uy * s;
          g.lineWidth = lwid;
          g.beginPath();
          g.moveTo(x + uy * reach, y - ux * reach);
          g.lineTo(x - uy * reach, y + ux * reach);
          g.stroke();
        }
      }
    };
    const durs = [0.4, 1.4, 1.0, 1.4, 0.5];
    return canvasRuntime(
      ctx,
      (g, t) => {
        const ph = phase(t, durs);
        let b0 = -Infinity;
        let b1 = -Infinity;
        if (ph.i === 1) b1 = smin + (smax - smin + G) * easeInOut(ph.p);
        else if (ph.i === 2) b1 = smax + G;
        else if (ph.i === 3) {
          b1 = smax + G;
          b0 = smin - G + (smax - smin + G) * easeInOut(ph.p);
        }
        const active = b1 > smin - G && b0 < smax;
        // faint band on the background so the sweep direction reads
        if (active && !ctx.capture.transparent) {
          g.save();
          g.globalAlpha = 0.13;
          pattern(g, b0, b1, ctx.s.secondary, 0.6);
          g.restore();
        }
        silhouette(g, ctx.s.primary, ctx.s.secondary);
        if (!active) return;
        const og = o.g;
        og.setTransform(1, 0, 0, 1, 0, 0);
        og.globalCompositeOperation = 'source-over';
        og.clearRect(0, 0, o.canvas.width, o.canvas.height);
        og.setTransform(dpr, 0, 0, dpr, 0, 0);
        silhouette(og, '#fff', null);
        og.globalCompositeOperation = 'source-in';
        pattern(og, b0, b1, ctx.s.secondary, 1);
        og.globalCompositeOperation = 'source-over';
        g.drawImage(o.canvas, 0, 0, w, h);
      },
      { dispose: () => (o.canvas.width = o.canvas.height = 0) },
    );
  },
});
