import { defineEffect } from '../../engine/define';
import { canvasRuntime, ease, minSide, mix, num, phase, TAU } from '../../engine/helpers';
import { drawLayout } from '../../engine/canvas';
import { layoutText } from '../../engine/text';

export default defineEffect({
  id: 'shape-shutter',
  code: 'S09',
  nameZh: '圖形快門',
  nameEn: 'Shape Shutter',
  category: 'shapes',
  sourceType: 'original',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '相機光圈般的幾何扇葉由中心旋開，露出後方的色塊與文字，停留後再旋轉閉合成完整遮罩。',
  tags: ['光圈', 'iris', '快門', '遮罩', 'reveal'],
  suitable: ['標題揭示', '攝影／影像品牌', '轉場開場'],
  principle:
    'Canvas 2D：光圈開口是半徑 a 的正 N 邊形（頂點 Vk 角度 θk = rot + k·2π/N）。從每個頂點沿「前一條邊的延長方向」射出一條射線到外殼圓 (半徑 Rh)，相鄰兩條射線、外殼圓弧與開口邊圍成第 k 片扇葉。N 片扇葉加上開口剛好分割整個圓，因此 a → 0 時扇葉在中心會合成完整遮罩、沒有縫隙。開合時 rot 同步扭轉，看起來像扇葉繞外圈樞軸旋入。',
  defaultText: 'OPEN／開門見山',
  palette: 'STREET',
  controls: ['text', 'font', 'weight', 'tracking', 'scale', 'direction', 'secondary', 'accent'],
  directions: ['cw', 'ccw'],
  textHint: '顯示在光圈後方，用「／」換行。',
  maxChars: 30,
  params: [
    { key: 'blades', label: '扇葉數', type: 'range', min: 5, max: 12, step: 1, default: 8 },
    { key: 'twist', label: '開合扭轉角', type: 'range', min: 0, max: 120, step: 5, default: 60, unit: '°' },
    { key: 'open', label: '最大開口', type: 'range', min: 0.4, max: 1, step: 0.02, default: 0.94 },
    { key: 'hold', label: '開啟停留', type: 'range', min: 0.6, max: 4, step: 0.1, default: 2, unit: 's' },
  ],
  recipe: {
    enter: '光圈完全閉合 0.5 秒（扇葉在中心會合）。',
    motion: '開口以 expo.out 在 0.9 秒內放大，同時扇葉扭轉，後方色塊與文字從中心擴大顯露。',
    hold: '開啟後停留（預設 2 秒），文字完整可讀。',
    exit: '以 power3.inOut 在 0.75 秒內扭轉閉合，直到扇葉重新形成完整遮罩。',
    loop: '閉合停留後重複。',
  },
  accept: [
    '完全閉合時圓形區域內看不到任何後方顏色或文字（完整遮罩）。',
    '開合時扇葉同時旋轉，開口為正多邊形。',
    '扇葉數改變後開口邊數與扇葉片數同步改變。',
    '開啟停留時文字完整位於開口內、清楚可讀。',
  ],
  transparent: false,
  cycle: 0.5 + 0.9 + 2 + 0.75 + 0.45,
  posterTime: 2,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const N = Math.round(num(ctx, 'blades', 8));
    const twist = (num(ctx, 'twist', 60) * Math.PI) / 180;
    const openMax = num(ctx, 'open', 0.94);
    const hold = num(ctx, 'hold', 2);
    const cx = w / 2;
    const cy = h / 2;
    const Rh = m * 0.44 * Math.min(1.12, ctx.s.scale);
    const amax = Rh * openMax * 0.999;
    // text sits inside the inscribed circle of the fully open aperture
    const inner = amax * Math.cos(Math.PI / N);
    const layout = layoutText(ctx, ctx.text, { maxWidth: inner * 1.6, maxHeight: inner * 1.1, fill: 0.9 });
    const eOpen = ease('expo.out');
    const eClose = ease('power3.inOut');
    const bladeA = ctx.s.primary;
    const bladeB = mix(ctx.s.primary, ctx.s.background, 0.14);
    const edge = mix(ctx.s.primary, ctx.s.background, 0.55);
    const ring = mix(ctx.s.primary, ctx.s.background, 0.7);
    const durs = [0.5, 0.9, hold, 0.75, 0.45];
    const VX = new Float64Array(N);
    const VY = new Float64Array(N);
    const PA = new Float64Array(N);
    return canvasRuntime(ctx, (g, t) => {
      const ph = phase(t, durs);
      let k = 0;
      if (ph.i === 1) k = eOpen(ph.p);
      else if (ph.i === 2) k = 1;
      else if (ph.i === 3) k = 1 - eClose(ph.p);
      const a = amax * k;
      const rot = -Math.PI / 2 + ctx.dirSign * (1 - k) * twist;
      // revealed scene
      g.save();
      g.beginPath();
      g.arc(cx, cy, Rh, 0, TAU);
      g.fillStyle = ctx.s.secondary;
      g.fill();
      g.clip();
      if (k > 0.02) {
        const sc = 0.82 + 0.18 * k;
        g.translate(cx, cy);
        g.scale(sc, sc);
        g.translate(-cx, -cy);
        drawLayout(g, layout, { fill: ctx.s.accent });
      }
      g.restore();
      // blades
      for (let i = 0; i < N; i++) {
        const th = rot + (i * TAU) / N;
        VX[i] = Math.cos(th) * a;
        VY[i] = Math.sin(th) * a;
        // ray continues the previous aperture edge beyond Vi
        const da = th - Math.PI / N + Math.PI / 2;
        const dx = Math.cos(da);
        const dy = Math.sin(da);
        const vd = VX[i] * dx + VY[i] * dy;
        const s = -vd + Math.sqrt(Math.max(0, vd * vd - (a * a - Rh * Rh)));
        PA[i] = Math.atan2(VY[i] + dy * s, VX[i] + dx * s);
      }
      g.save();
      g.translate(cx, cy);
      g.lineJoin = 'round';
      g.lineWidth = Math.max(1, m * 0.0035);
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        let a1 = PA[j];
        while (a1 < PA[i]) a1 += TAU;
        g.beginPath();
        g.moveTo(VX[i], VY[i]);
        g.lineTo(Math.cos(PA[i]) * Rh, Math.sin(PA[i]) * Rh);
        g.arc(0, 0, Rh, PA[i], a1, false);
        g.lineTo(VX[j], VY[j]);
        g.closePath();
        g.fillStyle = i % 2 ? bladeB : bladeA;
        g.fill();
        g.strokeStyle = edge;
        g.stroke();
      }
      // housing ring
      g.beginPath();
      g.arc(0, 0, Rh, 0, TAU);
      g.lineWidth = Math.max(3, m * 0.022);
      g.strokeStyle = ring;
      g.stroke();
      g.restore();
    });
  },
});
