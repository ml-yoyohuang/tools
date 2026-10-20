import { defineEffect } from '../../engine/define';
import { layoutMask } from '../../engine/canvas';
import { C } from '../../engine/palette';
import { canvasRuntime, clamp, damp, easeIn3, luminance, minSide, num, phase, smoothstep, TAU } from '../../engine/helpers';
import { layoutText } from '../../engine/text';
import { coverageSampler, DotBatch } from './_util';

const DRIFT = 1.5;
const SNAP = 1.0;
const HOLD = 1.7;
const SPLIT = 0.9;

interface Plate {
  x: Float32Array;
  y: Float32Array;
  r: Float32Array;
  n: number;
  color: 'primary' | 'secondary' | 'accent';
  /** misregistration direction (unit vector) and weight */
  dx: number;
  dy: number;
  w: number;
}

export default defineEffect({
  id: 'print-misregister',
  code: 'H11',
  nameZh: '印刷套色偏移',
  nameEn: 'Print Misregister',
  category: 'halftone',
  sourceType: 'original',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '兩到三塊不同網角的半色調色版先微幅錯位、晃動，再「喀」地對準成清晰的疊印文字，停留後又漸漸偏開。',
  tags: ['印刷', '套色', 'misregister', 'CMY', '半色調'],
  suitable: ['復古印刷風海報', 'Risograph 風格標題', '雜誌封面動態'],
  principle:
    'Canvas 2D：建立時以實際字形遮罩（layoutText + layoutMask，只讀一次 getImageData）求覆蓋率，與每塊色版自己的底圖（色版 1 斜向漸層帶、色版 2 圓盤、色版 3 淡底 + 圓盤）合成調子，再於各自網角（15° / 75° / 0°）的旋轉網格上換成網點半徑，預先存成陣列。每幀只平移色版：偏移 = 方向向量·M·m(t)，m(t) 在漂移段緩慢擺動、在對準段以阻尼振盪 damp() 收斂到 0、停留後以 easeIn 再分開；色版以 globalCompositeOperation multiply 疊印（深色背景改用 screen），疊合處自然變深，文字對準時最清楚。',
  defaultText: 'PRINT',
  palette: 'POP',
  colors: { background: '#FFFFFF', primary: C.blue, secondary: C.pink, accent: C.yellow },
  controls: ['text', 'font', 'weight', 'scale', 'secondary', 'accent', 'seed'],
  maxChars: 20,
  textHint: '短字最清楚；長字串會縮小。',
  params: [
    { key: 'plates', label: '色版數', type: 'range', min: 2, max: 3, step: 1, default: 3 },
    { key: 'offset', label: '最大錯位', type: 'range', min: 0.004, max: 0.05, step: 0.002, default: 0.02, hint: '相對舞台短邊' },
    { key: 'screen', label: '網點間距', type: 'range', min: 5, max: 20, step: 1, default: 8, unit: 'px' },
  ],
  recipe: {
    enter: '色版已錯位疊在一起，文字周圍有明顯彩色重影。',
    motion: '錯位的色版緩慢晃動 1.5 秒，接著在 1 秒內以阻尼振盪對準（輕微過衝後停住）。',
    hold: '完全對準的疊印停留 1.7 秒，文字最清楚。',
    exit: '色版以 ease-in 再次偏開。',
    loop: '回到錯位晃動，無限循環。',
  },
  accept: [
    '可看到 2–3 塊不同顏色、不同網角的網點色版疊印，重疊處顏色變深。',
    '錯位時文字有彩色重影，但仍可辨識；對準後重影消失。',
    '「最大錯位」控制重影距離；「色版數」切換 2 或 3 版。',
    '對準時有輕微過衝後停住，而不是線性移動。',
  ],
  transparent: true,
  posterTime: DRIFT + SNAP + 0.6,
  cycle: DRIFT + SNAP + HOLD + SPLIT,
  create(ctx) {
    const W = ctx.width;
    const H = ctx.height;
    const ms = minSide(ctx);
    const np = Math.round(clamp(num(ctx, 'plates', 3), 2, 3));
    const M = num(ctx, 'offset', 0.02) * ms;
    const layout = layoutText(ctx, ctx.text, { maxHeight: H * 0.5, maxWidth: W * 0.84, lineHeight: 1.05 });
    const mask = layoutMask(ctx, layout);
    const cover = coverageSampler(mask);
    mask.canvas.width = mask.canvas.height = 0;
    const discX = W * 0.66;
    const discY = H * 0.4;
    const discR = ms * 0.34;
    const disc = (x: number, y: number) => 1 - smoothstep(discR * 0.8, discR, Math.hypot(x - discX, y - discY));
    const tones: ((x: number, y: number) => number)[] = [
      // plate 1: diagonal gradient band
      (x, y) => {
        const s = (x / W - y / H * 0.6 + 0.2) * 2.2;
        return 0.42 * smoothstep(0, 0.3, s) * (1 - smoothstep(0.55, 1.1, s));
      },
      // plate 2: disc
      (x, y) => 0.5 * disc(x, y),
      // plate 3: light flat tint + stronger disc
      (x, y) => 0.16 + 0.3 * disc(x, y),
    ];
    const angles = np === 2 ? [15, 75] : [15, 75, 0];
    const colors: Plate['color'][] = ['primary', 'secondary', 'accent'];
    const budget = 1900 * ctx.q;
    const buildPlate = (pi: number, pitch: number) => {
      const a = (angles[pi] * Math.PI) / 180;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const half = Math.hypot(W, H) / 2 + pitch;
      const n = Math.ceil(half / pitch);
      const xs: number[] = [];
      const ys: number[] = [];
      const rs: number[] = [];
      const cx = W / 2;
      const cy = H / 2;
      for (let j = -n; j <= n; j++)
        for (let i = -n; i <= n; i++) {
          const x = cx + i * pitch * ca - j * pitch * sa;
          const y = cy + i * pitch * sa + j * pitch * ca;
          if (x < -pitch || y < -pitch || x > W + pitch || y > H + pitch) continue;
          const tone = Math.max(cover(x, y, pitch / 2) * 0.92, tones[pi](x, y));
          if (tone < 0.03) continue;
          // area ∝ tone
          xs.push(x);
          ys.push(y);
          rs.push(pitch * 0.62 * Math.sqrt(tone));
        }
      return { xs, ys, rs };
    };
    // grow the pitch until every plate fits the dot budget
    let pitch = Math.max(4, num(ctx, 'screen', 8) * (ctx.mode === 'card' ? 1.2 : 1));
    let built = angles.map((_, i) => buildPlate(i, pitch));
    for (let guard = 0; guard < 12 && built.some((p) => p.xs.length > budget); guard++) {
      pitch *= 1.15;
      built = angles.map((_, i) => buildPlate(i, pitch));
    }
    const plates: Plate[] = built.map((p, i) => {
      const ang = ctx.rand() * TAU;
      return {
        x: Float32Array.from(p.xs),
        y: Float32Array.from(p.ys),
        r: Float32Array.from(p.rs),
        n: p.xs.length,
        color: colors[i],
        dx: Math.cos(ang),
        dy: Math.sin(ang),
        // the first (key) plate moves least
        w: i === 0 ? 0.35 : 1,
      };
    });
    const wobble = plates.map(() => ({ f: 0.6 + ctx.rand() * 0.6, p: ctx.rand() * TAU }));
    const darkBg = luminance(ctx.s.background) < 0.35;
    return canvasRuntime(ctx, (g, t) => {
      const ph = phase(t, [DRIFT, SNAP, HOLD, SPLIT]);
      g.globalCompositeOperation = darkBg ? 'screen' : 'multiply';
      const b = new DotBatch(g);
      plates.forEach((P, i) => {
        let m: number;
        let wob = Math.sin(t * TAU * wobble[i].f * 0.5 + wobble[i].p);
        if (ph.i === 0) m = 1;
        else if (ph.i === 1) {
          // damped settle onto register (slight overshoot)
          m = damp(ph.p * SNAP, 1.1, 4.2);
          wob *= 1 - ph.p;
        } else if (ph.i === 2) {
          m = 0;
          wob = 0;
        } else {
          m = easeIn3(ph.p);
          wob *= ph.p;
        }
        const mag = M * P.w * m;
        const ox = P.dx * mag + -P.dy * wob * M * 0.35 * P.w * Math.abs(m);
        const oy = P.dy * mag + P.dx * wob * M * 0.35 * P.w * Math.abs(m);
        b.begin();
        for (let k = 0; k < P.n; k++) b.dot(P.x[k] + ox, P.y[k] + oy, P.r[k]);
        b.fill(ctx.s[P.color]);
      });
      g.globalCompositeOperation = 'source-over';
    });
  },
});
