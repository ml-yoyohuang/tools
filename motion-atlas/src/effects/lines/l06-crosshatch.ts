import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, num, rgba, TAU } from '../../engine/helpers';

export default defineEffect({
  id: 'crosshatch',
  code: 'L06',
  nameZh: '交叉線網',
  nameEn: 'Crosshatch',
  category: 'lines',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '兩組斜向平行線朝相反方向平移，重疊處產生緩慢流動的干涉摩爾紋。',
  tags: ['摩爾紋', 'moiré', '交叉線', '干涉', 'op art'],
  suitable: ['歐普藝術海報', '音樂視覺背景', '錯視主題'],
  principle:
    'Canvas 2D：兩組間距 d 的平行線，角度 45° ± α/2，各自沿法線方向以 ±v 平移（偏移量 = mod(v·t, d)）。兩光柵疊加的摩爾條紋間距 ≈ d / (2·sin(α/2))，條紋隨兩組反向平移而滑動；α 以慢速正弦呼吸讓條紋粗細改變。兩組線先畫在私有圖層並以 XOR 合成：線條重合處互相抵消露出背景，未重合處兩色並存，條紋對比因此清楚。線距下限 4 px；任一像素的明暗重複頻率 2v/d 上限 2.4 Hz，交叉角永不歸零，避免全畫面閃爍。',
  defaultText: '',
  palette: 'COOL',
  controls: ['intensity', 'scale', 'secondary'],
  params: [
    { key: 'angle', label: '交叉角度', type: 'range', min: 4, max: 90, step: 1, default: 9, unit: '°' },
    { key: 'spacing', label: '線距', type: 'range', min: 4, max: 20, step: 0.5, default: 6, unit: 'px' },
    { key: 'lineWidth', label: '線寬比例', type: 'range', min: 0.15, max: 0.6, step: 0.05, default: 0.45 },
    { key: 'speed', label: '平移速度', type: 'range', min: 0, max: 8, step: 0.25, default: 2.5, unit: 'px/s' },
    { key: 'xor', label: '重疊處互相抵消（XOR）', type: 'toggle', default: true },
    { key: 'breathe', label: '角度呼吸', type: 'range', min: 0, max: 8, step: 0.5, default: 4, unit: '°' },
  ],
  recipe: {
    enter: '一開始兩組線已重疊。',
    motion: '兩組線以每秒數像素的等速反向平移（linear），放大後的摩爾條紋以較快速度滑過畫面；交叉角度以 14 秒週期呼吸，條紋隨之變寬變窄。',
    hold: '連續運動，無停頓。',
    exit: '無離場。',
    loop: '平移為週期函數，循環無接縫。',
  },
  accept: [
    '可以看到比線距大很多倍的明暗條紋（摩爾紋）在移動。',
    '交叉角度變小時摩爾條紋變寬，90° 時成為格狀交叉線。',
    '兩組線顏色不同，移動方向相反。',
    '線距最小 4 px，畫面不出現高頻閃爍。',
  ],
  limits: ['摩爾紋依賴實際像素密度，不同螢幕縮放下條紋大小略有差異。'],
  transparent: true,
  cycle: 14,
  posterTime: 2,
  create(ctx) {
    const cross = (num(ctx, 'angle', 9) * Math.PI) / 180;
    const d = Math.max(4, num(ctx, 'spacing', 6) * ctx.s.scale);
    const lwr = num(ctx, 'lineWidth', 0.45);
    // the overlap pattern repeats every d / (2v) s at any fixed pixel → cap 2v/d ≤ 2.4 Hz (no >3 Hz flicker)
    const v = Math.min(num(ctx, 'speed', 2.5) * ctx.s.intensity, d * 1.2);
    // never let the two gratings become parallel (full-screen beating)
    const breathe = Math.min((num(ctx, 'breathe', 4) * Math.PI) / 180, Math.max(0, cross / 2 - (1.5 * Math.PI) / 180));
    const xor = bool(ctx, 'xor', true);
    const W = ctx.width;
    const H = ctx.height;
    const cx = W / 2;
    const cy = H / 2;
    const R = Math.hypot(W, H) / 2 + d * 2;

    const family = (g: CanvasRenderingContext2D, ang: number, off: number, color: string) => {
      // lines are perpendicular to the normal n = (cos ang, sin ang)
      const nx = Math.cos(ang);
      const ny = Math.sin(ang);
      const tx = -ny;
      const ty = nx;
      const n = Math.ceil(R / d) + 1;
      g.strokeStyle = color;
      g.lineWidth = Math.max(0.75, d * lwr);
      g.beginPath();
      for (let i = -n; i <= n; i++) {
        const o = i * d + off;
        const px = cx + nx * o;
        const py = cy + ny * o;
        g.moveTo(px - tx * R, py - ty * R);
        g.lineTo(px + tx * R, py + ty * R);
      }
      g.stroke();
    };

    // the two gratings are combined with XOR on a private layer: where lines coincide they cancel,
    // so the moiré fringes read as clear empty / dense bands instead of a uniform texture
    const layerCv = document.createElement('canvas');
    layerCv.width = Math.max(1, Math.round(W * ctx.dpr));
    layerCv.height = Math.max(1, Math.round(H * ctx.dpr));
    const lg = layerCv.getContext('2d')!;
    return canvasRuntime(
      ctx,
      (g, t) => {
        const a = cross / 2 + breathe * Math.sin((t / 14) * TAU);
        const base = Math.PI / 4;
        const off = (v * t) % d;
        lg.setTransform(1, 0, 0, 1, 0, 0);
        lg.clearRect(0, 0, layerCv.width, layerCv.height);
        lg.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
        lg.globalCompositeOperation = 'source-over';
        family(lg, base + a, off, ctx.s.primary);
        lg.globalCompositeOperation = xor ? 'xor' : 'source-over';
        family(lg, base - a, -off, xor ? ctx.s.secondary : rgba(ctx.s.secondary, 0.85));
        g.drawImage(layerCv, 0, 0, W, H);
      },
      { dispose: () => (layerCv.width = layerCv.height = 0) },
    );
  },
});
