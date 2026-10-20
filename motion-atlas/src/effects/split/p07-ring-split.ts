import { defineEffect } from '../../engine/define';
import { canvasRuntime, ease, num, rgba, TAU } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { AB_HINT, local } from './_util';

export default defineEffect({
  id: 'ring-split',
  code: 'P07',
  nameZh: '圓環分裂',
  nameEn: 'Ring Split',
  category: 'split',
  sourceType: 'original',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '畫面拆成同心圓環，相鄰圓環以相反方向旋轉，像密碼鎖轉盤一樣把新場景從接縫轉進來。',
  tags: ['圓環', '同心圓', '旋轉', '轉場', 'ring'],
  suitable: ['解鎖／揭曉', '科技感轉場', '圓形品牌'],
  principle:
    'Canvas 2D：每個圓環是一條環形「膠捲」：A 佔一圈、B 接在後面。第 k 環轉角 φ = σₖ·2π·e(進度錯開)，σₖ 交替正負。環內從接縫角 θ₀ 起掃過 φ 的扇環 clip 後畫「旋轉 φ 的 B」，其餘扇環畫「旋轉 φ 的 A」；φ = 2π 時 B 剛好轉回原位。接縫與環邊畫切線色線。',
  defaultText: '轉一圈／ROTATE',
  palette: 'POP',
  colors: { background: C.pink, primary: C.blue, secondary: C.yellow, accent: C.white },
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent'],
  directions: ['cw', 'ccw'],
  textHint: AB_HINT,
  params: [
    ...TRANSITION_PARAMS,
    { key: 'rings', label: '圓環數', type: 'range', min: 2, max: 12, step: 1, default: 6 },
    { key: 'stagger', label: '由內而外錯開', type: 'range', min: 0, max: 0.6, step: 0.05, default: 0.3 },
    { key: 'alternate', label: '相鄰反向', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '各環以 power2.inOut 旋轉一整圈，由內而外錯開 0.3 進度、相鄰環方向相反；每環的 B 從各自接縫被「捲」進來。',
    hold: '所有環轉回原位，B 完整停留，環線消失。',
    exit: 'B 被拆成同心環反向旋轉，捲回 A。',
    loop: 'A → B → A。',
  },
  accept: [
    '轉場中可看到同心環彼此錯位，文字被不同角度切開。',
    '相鄰圓環旋轉方向相反（可關閉）。',
    '每環內同時有 A 與 B，以徑向接縫分界。',
    '改變圓環數，環的數量同步改變；方向切換順／逆時針。',
  ],
  cycle: 4.4,
  posterTime: 1.75,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.hypot(w, h) / 2 + 2;
    const n = Math.round(num(ctx, 'rings', 6));
    const stag = num(ctx, 'stagger', 0.3);
    const alt = ctx.s.params.alternate !== false;
    const turn = ease('power2.inOut');
    const rings = Array.from({ length: n }, (_, k) => ({
      r0: (R * k) / n,
      r1: (R * (k + 1)) / n,
      sig: ctx.dirSign * (alt && k % 2 ? -1 : 1),
      seam: -Math.PI / 2 + k * 0.7 + (ctx.rand() - 0.5) * 0.4,
    }));
    const lw = Math.max(1.5, Math.min(w, h) * 0.005);
    const sector = (g: CanvasRenderingContext2D, r0: number, r1: number, a0: number, a1: number) => {
      g.beginPath();
      if (Math.abs(a1 - a0) >= TAU - 1e-4) {
        g.arc(cx, cy, r1, 0, TAU);
        if (r0 > 0) {
          g.moveTo(cx + r0, cy);
          g.arc(cx, cy, r0, 0, TAU, true);
        }
      } else {
        const ccw = a1 < a0;
        g.arc(cx, cy, r1, a0, a1, ccw);
        if (r0 > 0) g.arc(cx, cy, r0, a1, a0, !ccw);
        else g.lineTo(cx, cy);
        g.closePath();
      }
    };
    const rotated = (g: CanvasRenderingContext2D, img: HTMLCanvasElement, ang: number) => {
      g.translate(cx, cy);
      g.rotate(ang);
      g.translate(-cx, -cy);
      g.drawImage(img, 0, 0, w, h);
    };
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, (x) => x);
      const imgs = [sc.a.canvas, sc.b.canvas];
      if (tr.p <= 0) return sc.draw(g, tr.from);
      if (tr.p >= 1) return sc.draw(g, tr.to);
      const span = 1 - stag;
      g.fillStyle = sc.scene(tr.to).bg;
      g.fillRect(0, 0, w, h);
      const seams: number[] = [];
      for (let k = 0; k < n; k++) {
        const r = rings[k];
        const u = TAU * turn(local(tr.p, (k / Math.max(1, n - 1)) * stag, span));
        const phi = r.sig * u;
        const a0 = r.seam;
        // B arc: from the seam, swept by phi
        if (u > 1e-4) {
          g.save();
          sector(g, r.r0, r.r1, a0, a0 + phi);
          g.clip();
          rotated(g, imgs[tr.to], phi);
          g.restore();
        }
        if (u < TAU - 1e-4) {
          g.save();
          sector(g, r.r0, r.r1, a0 + phi, a0 + r.sig * TAU);
          g.clip();
          rotated(g, imgs[tr.from], phi);
          g.restore();
        }
        if (u > 1e-4 && u < TAU - 1e-4) seams.push(r.r0, r.r1, a0, a0 + phi);
      }
      // ring boundaries + radial seams
      g.strokeStyle = rgba(ctx.s.accent, 0.85);
      g.lineWidth = lw;
      g.beginPath();
      for (let k = 1; k < n; k++) {
        g.moveTo(cx + rings[k].r0, cy);
        g.arc(cx, cy, rings[k].r0, 0, TAU);
      }
      g.stroke();
      g.lineWidth = lw * 1.6;
      g.strokeStyle = ctx.s.accent;
      g.beginPath();
      for (let i = 0; i < seams.length; i += 4) {
        for (const a of [seams[i + 2], seams[i + 3]]) {
          g.moveTo(cx + Math.cos(a) * seams[i], cy + Math.sin(a) * seams[i]);
          g.lineTo(cx + Math.cos(a) * seams[i + 1], cy + Math.sin(a) * seams[i + 1]);
        }
      }
      g.stroke();
    });
  },
});
