import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, ease, minSide, mixHex, num, rgba, smoothstep } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { hash2, noise1 } from '../../engine/random';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { decoFade, poly, travel, type Pt } from './_util';

export default defineEffect({
  id: 'paper-tear',
  code: 'W11',
  nameZh: '紙張撕開',
  nameEn: 'Paper Tear',
  category: 'wipe',
  sourceType: 'original',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '舊畫面像一張紙沿鋸齒裂口從一端撕開，兩半帶著白色紙纖維與淡陰影向外分離，露出下方的新場景。',
  tags: ['撕紙', '紙張', '裂口', '手作', 'tear'],
  suitable: ['拼貼／手作風', '揭曉新品', '雜誌風轉場'],
  principle:
    'Canvas 2D：裂口線 u = 中線 + A·(0.6·noise1(v·2.5) + 0.28·noise1(v·9)) + 微小雜湊抖動，以種子決定。舊場景被裂口切成兩個遮罩多邊形（各自往畫面外延伸很遠），每一片先以紙芯色填滿外輪廓，再以「裂口內縮 fw(v) 的鋸齒線」為 clip 畫舊場景，留出一條參差的白色纖維邊。兩片以裂口終點為樞紐反向旋轉 θ（power2.out，先在起點撕開成 V 形），再沿橫向加速（power3.in）退出畫面；下方先畫新場景與兩片的位移陰影（半透明多邊形，不用 blur）。',
  defaultText: '撕開／TEAR',
  palette: 'PASTEL',
  colors: { background: C.cream, primary: C.blue, secondary: C.red, accent: C.yellow },
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent', 'seed'],
  directions: ['down', 'up', 'right', 'left'],
  textHint: '「／」前為 A 場景文字，後為 B 場景文字。',
  params: [
    ...TRANSITION_PARAMS,
    { key: 'rough', label: '裂口起伏', type: 'range', min: 0, max: 1, step: 0.05, default: 0.55 },
    { key: 'fibre', label: '紙纖維寬度', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'angle', label: '撕開角度', type: 'range', min: 0, max: 0.3, step: 0.01, default: 0.14, unit: 'rad' },
  ],
  recipe: {
    enter: '完整顯示 A 場景（完整的一張紙）。',
    motion: '前 45%：裂口從起點撕開，兩半以終點為樞紐轉開成 V 形（power2.out）；30% 之後兩半沿橫向加速分離（power3.in）並略再旋轉，帶著白色纖維邊與淡陰影離開畫面。',
    hold: 'B 完整停留，紙片已完全離開。',
    exit: '新的一張紙（B）再被撕開，露出 A。',
    loop: 'A → B → A；種子改變裂口形狀。',
  },
  accept: [
    '轉場中可看到一條不規則鋸齒裂口，兩側邊緣帶白色紙纖維。',
    '裂口先從起點張開成 V 形，再整片分離，下方新場景逐步露出。',
    '紙片下方有淡陰影，不使用模糊濾鏡。',
    '裂口起伏設為 0 時裂口近乎直線；改變種子裂口形狀改變。',
  ],
  limits: ['紙片為平面剛體旋轉＋位移，不模擬紙張捲曲。'],
  cycle: 4.4,
  posterTime: 1.75,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const { len, span, map } = travel(ctx.dir, w, h);
    const det = ctx.dir === 'down' || ctx.dir === 'left' ? 1 : -1; // handedness of the uv → xy map
    const o = map(0, 0);
    const vec = (du: number, dv: number): Pt => {
      const p = map(du, dv);
      return [p[0] - o[0], p[1] - o[1]];
    };
    const rough = num(ctx, 'rough', 0.55);
    const fibre = num(ctx, 'fibre', 0.6);
    const thMax = num(ctx, 'angle', 0.14);
    const A = rough * span * 0.11;
    const jit = rough * m * 0.01;
    const fwBase = fibre * m * 0.014;
    const pad = Math.max(len, span) * 0.8;
    const ext = len * 0.08;
    const step = Math.max(3, len / (170 * Math.max(0.5, ctx.q)));
    const seed = ctx.seed;
    const mid = span * (0.47 + ctx.rand() * 0.06);
    // tear samples along v
    const tv: number[] = [];
    const tu: number[] = [];
    const fw: number[] = [];
    let k = 0;
    for (let v = -ext; v <= len + ext + step; v += step, k++) {
      const s = v / len;
      tv.push(v);
      tu.push(mid + A * (0.6 * noise1(s * 2.5, seed) + 0.28 * noise1(s * 9, seed + 3)) + jit * (hash2(k, 1, seed) - 0.5) * 2);
      fw.push(fwBase * (0.35 + 1.1 * hash2(k, 2, seed)));
    }
    const nT = tv.length;
    const pivotUV: Pt = [tu[nT - 1] + 0, len];
    // piece outlines in uv (outer = torn line, inner = torn line inset by fibre width)
    const pieceUV = (side: -1 | 1, inset: number): Pt[] => {
      const far = side < 0 ? -pad : span + pad;
      const pts: Pt[] = [[far, -pad], [tu[0] + side * fw[0] * inset, -pad]];
      for (let i = 0; i < nT; i++) pts.push([tu[i] + side * fw[i] * inset, tv[i]]);
      pts.push([tu[nT - 1] + side * fw[nT - 1] * inset, len + pad], [far, len + pad]);
      return pts;
    };
    const toXY = (pts: Pt[]) => pts.map(([u, v]) => map(u, v));
    const outer = { L: toXY(pieceUV(-1, 0)), R: toXY(pieceUV(1, 0)) };
    const inner = { L: toXY(pieceUV(-1, 1)), R: toXY(pieceUV(1, 1)) };
    const pivot = map(pivotUV[0], pivotUV[1]);
    const openE = ease('power2.out');
    const awayE = ease('power3.in');
    const shadowOff = vec(m * 0.006, m * 0.012);

    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, (x) => x);
      if (tr.p <= 0) {
        sc.draw(g, tr.from);
        return;
      }
      const p = tr.p;
      const open = openE(clamp(p / 0.45, 0, 1));
      const away = awayE(clamp((p - 0.3) / 0.7, 0, 1));
      const th = thMax * open + 0.12 * away;
      const tx = away * span * 0.85;
      const fade = decoFade(p);
      const fibreOn = smoothstep(0, 0.08, p);
      const paper = mixHex(sc.scene(tr.from).bg, '#ffffff', 0.72);
      const apply = (side: -1 | 1, dx = 0, dy = 0) => {
        const T = vec(side * tx, 0);
        g.translate(pivot[0] + T[0] + dx, pivot[1] + T[1] + dy);
        g.rotate(det * side * th);
        g.translate(-pivot[0], -pivot[1]);
      };
      sc.draw(g, tr.to);
      // soft offset shadows of both pieces
      g.fillStyle = rgba('#000000', 0.24 * fade);
      for (const side of [-1, 1] as const) {
        g.save();
        apply(side, shadowOff[0], shadowOff[1]);
        g.beginPath();
        poly(g, side < 0 ? outer.L : outer.R);
        g.fill();
        g.restore();
      }
      const fromBg = sc.scene(tr.from).bg;
      const big = pad * 3;
      for (const side of [-1, 1] as const) {
        g.save();
        apply(side);
        const out = side < 0 ? outer.L : outer.R;
        const inn = side < 0 ? inner.L : inner.R;
        const withFibre = fwBase > 0;
        g.beginPath();
        poly(g, out);
        g.fillStyle = fromBg;
        g.fill();
        if (withFibre) {
          g.globalAlpha = fibreOn;
          g.fillStyle = paper;
          g.fill();
          g.globalAlpha = 1;
        }
        g.beginPath();
        poly(g, withFibre ? inn : out);
        g.clip();
        // the piece extends past the stage: keep its scene colour there
        g.fillStyle = fromBg;
        g.fillRect(-big, -big, w + big * 2, h + big * 2);
        sc.draw(g, tr.from);
        g.restore();
      }
    });
  },
});
