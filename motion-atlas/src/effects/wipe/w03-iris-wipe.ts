import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, easeInOut, ease, minSide, mixHex, num, rgba, str, TAU } from '../../engine/helpers';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { decoFade, poly, type Pt } from './_util';

export default defineEffect({
  id: 'iris-wipe',
  code: 'W03',
  nameZh: '虹膜開合',
  nameEn: 'Iris Wipe',
  category: 'wipe',
  sourceType: 'original',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '多片葉片圍成多邊形光圈，邊旋轉邊張開露出新場景；也可先閉合再打開，像相機快門。',
  tags: ['光圈', '虹膜', '葉片', '快門', 'iris', 'aperture'],
  suitable: ['相機／攝影主題', '鏡頭切換', '產品揭曉'],
  principle:
    'Canvas 2D：光圈是 N 邊正多邊形，頂點 V_k = c + r·(cos a_k, sin a_k)，a_k = θ + k·2π/N，θ 隨開口旋轉（θ = θ0 ± twist·(1 − r/R)）。第 k 片葉片 = 由 V_k、V_k+1、兩條相鄰邊的延長射線 V_k + L·d_k−1、V_k+1 + L·d_k 與遠端點圍成的多邊形，所有葉片剛好鋪滿光圈外側。光圈內 clip 畫新場景；葉片在「展開」模式顯示舊場景（加明暗區分），在「快門」模式為實色葉片（先閉合遮住 A，再打開露出 B）。R = 半對角線 / cos(π/N)，確保全開時葉片完全離開畫面。',
  defaultText: 'CLOSE／OPEN',
  palette: 'STREET',
  controls: ['text', 'font', 'weight', 'direction', 'secondary', 'accent'],
  directions: ['cw', 'ccw'],
  textHint: '「／」前為 A 場景文字，後為 B 場景文字。',
  params: [
    ...TRANSITION_PARAMS,
    { key: 'blades', label: '葉片數', type: 'range', min: 5, max: 12, step: 1, default: 7 },
    { key: 'twist', label: '旋轉量', type: 'range', min: 0, max: 1.6, step: 0.05, default: 0.8, unit: 'rad' },
    {
      key: 'mode',
      label: '開合模式',
      type: 'select',
      options: [
        { value: 'open', label: '展開（A 在葉片上）' },
        { value: 'shutter', label: '快門（先閉合再打開）' },
      ],
      default: 'shutter',
    },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '快門模式：實色葉片自畫面外旋入並閉合（power2.in），在中心收成一點後立即反向旋開（power2.out）露出 B；展開模式：A 被切成葉片，光圈自中心旋轉張開（cubic inOut）。',
    hold: 'B 完整停留，葉片全部退出畫面。',
    exit: '同樣的開合由 B 換回 A。',
    loop: 'A → B → A。',
  },
  accept: [
    '轉場中可看到 N 片葉片圍成的多邊形開口，開口邊為直線且隨開合旋轉。',
    '改變葉片數，開口的邊數同步改變。',
    '快門模式在中段畫面完全被葉片遮住，再打開時已是 B。',
    '方向 cw / ccw 改變葉片旋轉方向。',
  ],
  cycle: 4.4,
  posterTime: 1.55,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const N = Math.round(num(ctx, 'blades', 7));
    const twist = num(ctx, 'twist', 0.8) * ctx.dirSign;
    const shutter = str(ctx, 'mode', 'shutter') === 'shutter';
    const cx = w / 2;
    const cy = h / 2;
    const alpha = TAU / N;
    const Rfull = (Math.hypot(w, h) / 2 / Math.cos(Math.PI / N)) * 1.04;
    const L = Math.hypot(w, h) * 3;
    const m = minSide(ctx);
    const closeEase = ease('power2.in');
    const openEase = ease('power2.out');
    const theta0 = -Math.PI / 2;

    // blade colours for the shutter mode: two close shades derived from the palette
    const bladeA = mixHex(ctx.s.secondary, '#000000', 0.25);
    const bladeB = mixHex(ctx.s.secondary, '#000000', 0.42);

    const blades = (r: number): Pt[][] => {
      const th = theta0 + twist * (1 - r / Rfull);
      const V: Pt[] = [];
      const D: Pt[] = [];
      for (let k = 0; k < N; k++) {
        const a = th + k * alpha;
        V.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        const mid = th + (k + 0.5) * alpha;
        D.push([-Math.sin(mid), Math.cos(mid)]); // direction of edge V_k → V_k+1
      }
      const out: Pt[][] = [];
      for (let k = 0; k < N; k++) {
        const v0 = V[k];
        const v1 = V[(k + 1) % N];
        const dp = D[(k - 1 + N) % N];
        const dk = D[k];
        out.push([
          [v0[0] + dp[0] * L, v0[1] + dp[1] * L],
          v0,
          v1,
          [v1[0] + dk[0] * L, v1[1] + dk[1] * L],
          [v0[0] + (dp[0] + dk[0]) * L, v0[1] + (dp[1] + dk[1]) * L],
        ]);
      }
      return out;
    };

    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, shutter ? (x) => x : easeInOut);
      if (tr.p <= 0) {
        sc.draw(g, tr.from);
        return;
      }
      let r: number;
      let inside: 0 | 1;
      if (shutter) {
        if (tr.p < 0.5) {
          r = (1 - closeEase(tr.p * 2)) * Rfull;
          inside = tr.from;
        } else {
          r = openEase((tr.p - 0.5) * 2) * Rfull;
          inside = tr.to;
        }
      } else {
        r = tr.e * Rfull;
        inside = tr.to;
      }
      const fade = decoFade(tr.p);
      const bl = blades(r);
      // aperture content
      sc.draw(g, inside);
      // blades
      for (let k = 0; k < N; k++) {
        g.save();
        g.beginPath();
        poly(g, bl[k]);
        if (shutter) {
          g.fillStyle = k % 2 ? bladeA : bladeB;
          g.fill();
        } else {
          g.clip();
          sc.draw(g, tr.from);
          g.fillStyle = rgba('#000000', (0.06 + 0.12 * (k % 3)) * fade / 2);
          g.fillRect(0, 0, w, h);
        }
        g.restore();
      }
      // blade seams + aperture rim
      g.lineJoin = 'round';
      g.strokeStyle = rgba(ctx.s.accent, 0.75 * clamp(fade * 1.5, 0, 1));
      g.lineWidth = Math.max(1, m * 0.004);
      g.beginPath();
      for (let k = 0; k < N; k++) {
        const b = bl[k];
        g.moveTo(b[1][0], b[1][1]);
        g.lineTo(b[0][0], b[0][1]);
      }
      g.stroke();
      if (r > 0.5) {
        g.lineWidth = Math.max(1.5, m * 0.008);
        g.beginPath();
        poly(
          g,
          bl.map((b) => b[1]),
        );
        g.stroke();
      }
    });
  },
});
