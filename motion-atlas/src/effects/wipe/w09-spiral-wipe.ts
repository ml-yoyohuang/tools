import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, ease, minSide, num, TAU } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';

export default defineEffect({
  id: 'spiral-wipe',
  code: 'W09',
  nameZh: '螺旋揭露',
  nameEn: 'Spiral Wipe',
  category: 'wipe',
  sourceType: 'original',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '一條寬螺旋臂從中心繞圈長出，臂與臂緊密相接，繞完最後一圈時新場景鋪滿畫面。',
  tags: ['螺旋', '旋轉', '遮罩', '擦拭', 'spiral'],
  suitable: ['催眠／迷幻主題', '倒數揭曉', '音樂視覺'],
  principle:
    'Canvas 2D clip：阿基米德螺線 r = b·φ，臂寬 = 螺距 2πb，所以第 k 圈的外緣正好等於第 k+1 圈的內緣、整個平面被無縫鋪滿。遮罩多邊形 = 外緣 r = bφ + πb（φ 由 0 到 φmax）＋ 反向的內緣 r = bφ − πb（第一圈內緣固定為 0，形成實心核心）。b = 半對角線 /(2πT − π)，T 圈後外緣超出四角；φmax = e·2πT，角度方向依 cw/ccw。',
  defaultText: '轉入／SPIRAL',
  palette: 'COOL',
  colors: { primary: C.yellow },
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent'],
  directions: ['cw', 'ccw'],
  textHint: '「／」前為 A 場景文字，後為 B 場景文字。',
  params: [
    ...TRANSITION_PARAMS,
    { key: 'turns', label: '圈數', type: 'range', min: 1.5, max: 6, step: 0.5, default: 3 },
    { key: 'edge', label: '螺旋描邊', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '螺旋臂以 sine.inOut 繞中心旋出，越外圈臂越長，因此面積揭露先慢後快；臂的外緣描一條 accent 線。',
    hold: 'B 完整停留，螺旋已鋪滿。',
    exit: '同方向再旋出一次換回 A。',
    loop: 'A → B → A。',
  },
  accept: [
    '轉場中可看到從中心向外繞圈的螺旋形遮罩，而非圓形擴張。',
    '圈數越多，臂越細、繞的圈越多。',
    '方向 cw / ccw 改變旋轉方向。',
    '轉場結束時沒有殘留舊場景縫隙。',
  ],
  cycle: 4.4,
  posterTime: 1.75,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const cx = w / 2;
    const cy = h / 2;
    const T = num(ctx, 'turns', 3);
    const edge = bool(ctx, 'edge', true);
    const half = Math.hypot(w, h) / 2;
    const b = (half * 1.04) / (TAU * T - Math.PI);
    const PHI = TAU * T;
    const dphi = Math.max(0.035, 0.06 / Math.max(0.5, ctx.q));
    const sgn = ctx.dirSign;
    const a0 = -Math.PI / 2;
    const easing = ease('sine.inOut');
    const m = minSide(ctx);
    const pt = (phi: number, r: number): [number, number] => {
      const a = a0 + sgn * phi;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, easing);
      sc.draw(g, tr.from);
      if (tr.p <= 0) return;
      const pmax = tr.e * PHI;
      if (pmax <= 0.001) return;
      const n = Math.max(2, Math.ceil(pmax / dphi));
      const outer: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const phi = (pmax * i) / n;
        outer.push(pt(phi, b * phi + Math.PI * b + 1.5)); // +1.5px overlap hides anti-aliased seams between turns
      }
      g.save();
      g.beginPath();
      g.moveTo(outer[0][0], outer[0][1]);
      for (const p of outer) g.lineTo(p[0], p[1]);
      // inner edge back to the centre
      for (let i = n; i >= 0; i--) {
        const phi = (pmax * i) / n;
        const r = phi < TAU ? 0 : b * phi - Math.PI * b;
        const p = pt(phi, r);
        g.lineTo(p[0], p[1]);
      }
      g.closePath();
      g.clip();
      sc.draw(g, tr.to);
      g.restore();
      if (edge && tr.p < 1) {
        g.strokeStyle = ctx.s.accent;
        g.lineWidth = Math.max(1.5, m * 0.007);
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(outer[0][0], outer[0][1]);
        for (const p of outer) g.lineTo(p[0], p[1]);
        // radial cut at the head of the arm
        const inner = pt(pmax, pmax < TAU ? 0 : b * pmax - Math.PI * b);
        g.lineTo(inner[0], inner[1]);
        g.stroke();
      }
    });
  },
});
