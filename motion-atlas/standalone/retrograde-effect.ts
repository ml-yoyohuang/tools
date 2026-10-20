import { defineEffect } from '../src/engine/define';
import { bool, canvasRuntime, mod, num, rgba, TAU } from '../src/engine/helpers';
import { C } from '../src/engine/palette';
import { MARS_RADIUS, OBSERVATION_DAYS, retrogradeState } from './_retrograde';

const CYCLE = 10;
const HALF = OBSERVATION_DAYS / 2;
const DEG = 180 / Math.PI;

export default defineEffect({
  id: 'planet-retrograde',
  code: 'S12',
  nameZh: '行星逆行',
  nameEn: 'Planet Retrograde',
  category: 'shapes',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '地球從內圈超過火星，視線在固定星空上暫時向西掃過；兩顆行星仍持續同向公轉。',
  tags: ['逆行', 'retrograde', '軌道', 'orbit', '天文', '火星'],
  suitable: ['天文教學', '科普動畫', '相對運動示範'],
  principle:
    '延伸 Orbit Shapes 的 Canvas 時間函數與軌道投影。地球半徑 1 AU、週期 365.25 日；火星半徑 1.524 AU、週期 686.98 日，以圓軌道近似。兩者皆以 θ = π/2 + 2π·日數/週期 同向公轉，火星軌道可繞 X 軸傾斜。以 r = 火星位置 − 地球位置求視線；視黃經 λ = atan2(ry, rx)，視黃緯 β = atan2(rz, hypot(rx, ry))。dλ/dt = (rx·vy − ry·vx)/(rx² + ry²) < 0 時標示逆行，接近 0 時為留。軌道圖、視線、星空圖與進度帶使用同一組位置計算。星空圖橫軸向右是東，縱軸為黃緯，固定背景星不隨觀測者旋轉。',
  defaultText: '',
  palette: 'COOL',
  colors: { background: C.black, primary: C.cream, secondary: '#3D7BFF', accent: C.red },
  controls: ['secondary', 'accent'],
  params: [
    { key: 'manual', label: '手動觀測', type: 'toggle', default: false, hint: '開啟後拖動觀測進度，可停在超車前、逆行中與超車後。' },
    { key: 'progress', label: '觀測進度', type: 'range', min: 0, max: 100, step: 0.1, default: 50, unit: '%', when: { key: 'manual', value: true } },
    { key: 'inclination', label: '火星軌道傾角', type: 'range', min: 0, max: 5, step: 0.05, default: 1.85, unit: '°', hint: '調到 0° 仍會逆行，但星空軌跡會變成一條來回的線。' },
    { key: 'sightline', label: '顯示地球視線', type: 'toggle', default: true },
    { key: 'guide', label: '顯示完整軌跡', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '從衝前 130 日開始，地球與火星已在軌道上。',
    motion: '地球較快，從內側超過火星。星空上的火星先向東、暫時向西逆行，再恢復向東；逆行段以 Accent 色標示。',
    hold: '可暫停，或開啟手動觀測，拖動進度檢查同一時刻的兩個視角。',
    exit: '到衝後 130 日，觀測片段結束。',
    loop: '10 秒重播 260 日觀測片段，接點會重設至片段起點，非完整公轉的無縫循環。',
  },
  accept: [
    '逆行期間，俯視圖中的地球與火星仍同向公轉；火星在星空圖中向左（西）移動。',
    '衝前、衝後皆為順行；衝附近為逆行，兩個轉折附近標示「留」。',
    '傾角設為 0° 時星空軌跡成為水平線，但逆行仍然存在。',
    '手動觀測到 50% 時地球在太陽與火星的投影之間，視線與星空位置同步。',
    '播放、暫停、速度、比例、PNG 與 WebM 使用圖鑑既有控制。',
  ],
  limits: [
    '圓軌道教學模型，未使用特定日期的星曆；軌道交點方向為示意設定，不能用於預測實際逆行日期。',
    '星空圖的縱橫軸比例不同，黃緯放大以看清回環；背景星為固定參考點，不代表真實星座。',
    '星空圖呈現跨日、相對恆星的位置變化，未包含地球自轉造成的每日東升西落；球體大小不按比例。',
  ],
  cycle: CYCLE,
  posterTime: 5,
  create(ctx) {
    const portrait = ctx.width / ctx.height < 1.25;
    const W = portrait ? 620 : 1000;
    const H = portrait ? 950 : 562;
    const scale = Math.min(ctx.width / W, ctx.height / H);
    const inclination = num(ctx, 'inclination', 1.85);
    const manual = bool(ctx, 'manual', false);
    const progress = num(ctx, 'progress', 50) / 100;
    const sightline = bool(ctx, 'sightline', true);
    const guide = bool(ctx, 'guide', true);
    const { primary: ink, secondary: earthColor, accent: marsColor, background } = ctx.s;
    const samples = Array.from({ length: 361 }, (_, k) => {
      const day = -HALF + OBSERVATION_DAYS * k / 360;
      return { day, ...retrogradeState(day, inclination) };
    });
    const lonMax = Math.max(...samples.map(p => Math.abs(p.longitude))) * 1.13;
    const latMax = Math.max(1 / DEG, ...samples.map(p => p.latitude)) * 1.2;
    const left = portrait ? { x: 24, y: 108, w: 572, h: 356 } : { x: 24, y: 104, w: 440, h: 328 };
    const right = portrait ? { x: 24, y: 480, w: 572, h: 300 } : { x: 480, y: 104, w: 496, h: 328 };
    const cx = left.x + left.w / 2;
    const cy = left.y + left.h / 2 + 12;
    const radius = Math.min(left.w * 0.30, left.h * 0.31);
    const au = radius / MARS_RADIUS;
    const orbitPoint = (p: { x: number; y: number }) => ({ x: cx + p.x * au, y: cy - p.y * au });
    const chart = { x: right.x + 42, y: right.y + 76, w: right.w - 68, h: right.h - 132 };
    const skyPoint = (p: { longitude: number; latitude: number }) => ({
      x: chart.x + (0.5 + p.longitude / (2 * lonMax)) * chart.w,
      y: chart.y + chart.h * (0.9 - p.latitude / latMax * 0.8),
    });
    const runtime = canvasRuntime(ctx, (g, t) => {
      g.translate((ctx.width - W * scale) / 2, (ctx.height - H * scale) / 2);
      g.scale(scale, scale);
      const u = manual ? progress : mod(t, CYCLE) / CYCLE;
      const day = -HALF + u * OBSERVATION_DAYS;
      const state = retrogradeState(day, inclination);
      const stationary = Math.abs(state.longitudeRate * DEG) < 0.012;
      const status = stationary ? '留 · 方向轉折' : state.retrograde ? '逆行 · 向西' : '順行 · 向東';
      const phaseColor = state.retrograde ? marsColor : ink;
      const text = (value: string, x: number, y: number, size = 14, color = ink, align: CanvasTextAlign = 'left') => {
        g.fillStyle = color;
        g.font = `500 ${size}px ${ctx.font.sans}`;
        g.textAlign = align;
        g.textBaseline = 'middle';
        g.fillText(value, x, y);
      };
      const line = (a: { x: number; y: number }, b: { x: number; y: number }, color: string, width = 1) => {
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y);
        g.strokeStyle = color; g.lineWidth = width; g.stroke();
      };
      const dot = (x: number, y: number, r: number, color: string) => {
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = color; g.fill();
      };
      const arrow = (x: number, y: number, angle: number, color: string, size = 7) => {
        g.save(); g.translate(x, y); g.rotate(angle);
        g.beginPath(); g.moveTo(0, 0); g.lineTo(-size, -size * 0.55); g.lineTo(-size, size * 0.55);
        g.closePath(); g.fillStyle = color; g.fill(); g.restore();
      };
      const panel = (p: typeof left) => {
        g.fillStyle = rgba(ink, 0.025); g.fillRect(p.x, p.y, p.w, p.h);
        g.strokeStyle = rgba(ink, 0.15); g.lineWidth = 1; g.strokeRect(p.x, p.y, p.w, p.h);
      };

      text('ORBIT STUDY / 012', 24, 28, 12, rgba(ink, 0.6));
      text('行星逆行', 24, 65, 32);
      text('PLANET RETROGRADE', portrait ? 184 : 190, 69, portrait ? 13 : 15, rgba(ink, 0.5));
      text(status, W - 24, 62, portrait ? 19 : 24, phaseColor, 'right');
      panel(left); panel(right);
      text('01 / 太陽系俯視', left.x + 18, left.y + 25, 16);
      text('兩顆行星始終同向公轉 ↺', left.x + 18, left.y + 49, 12, rgba(ink, 0.6));
      text('02 / 地球所見的星空', right.x + 18, right.y + 25, 16);
      text('固定恆星參考 · 黃緯放大 · 非真實星座', right.x + 18, right.y + 49, 12, rgba(ink, 0.6));

      // Both orbits use the physical XY coordinates; screen Y points downward.
      for (const [r, flatten, color] of [[au, 1, earthColor], [radius, Math.cos(inclination / DEG), marsColor]] as const) {
        g.beginPath(); g.ellipse(cx, cy, r, r * flatten, 0, 0, TAU);
        g.strokeStyle = rgba(color, 0.4); g.lineWidth = 1.3; g.stroke();
        arrow(cx + r, cy, -Math.PI / 2, color, 6);
      }
      const ep = orbitPoint(state.earth);
      const mp = orbitPoint(state.mars);
      if (sightline) {
        const dx = mp.x - ep.x; const dy = mp.y - ep.y;
        const len = Math.hypot(dx, dy);
        const nx = dx / len; const ny = dy / len;
        // Clip the infinite ray to the orbit panel's drawing area.
        const bounds = { x0: left.x + 16, x1: left.x + left.w - 16, y0: left.y + 68, y1: left.y + left.h - 36 };
        const tx = Math.abs(nx) < 1e-8 ? Infinity : ((nx > 0 ? bounds.x1 : bounds.x0) - ep.x) / nx;
        const ty = Math.abs(ny) < 1e-8 ? Infinity : ((ny > 0 ? bounds.y1 : bounds.y0) - ep.y) / ny;
        const distance = Math.min(tx, ty);
        const end = { x: ep.x + nx * distance, y: ep.y + ny * distance };
        g.setLineDash([4, 5]); line(mp, end, rgba(phaseColor, 0.65), 1.5); g.setLineDash([]);
        line(ep, mp, phaseColor, 2);
        arrow(end.x, end.y, Math.atan2(dy, dx), phaseColor);
      }
      dot(cx, cy, 13, ink);
      text('太陽', cx, cy + 27, 12, rgba(ink, 0.7), 'center');
      dot(ep.x, ep.y, 8, earthColor);
      dot(mp.x, mp.y, 7, marsColor);
      text('地球', ep.x + 12, ep.y + 13, 13, earthColor);
      text('火星', mp.x + 12, mp.y - 12, 13, marsColor);
      dot(left.x + 20, left.y + left.h - 18, 3, earthColor);
      text('地球 365 日 / 圈', left.x + 30, left.y + left.h - 18, 12, rgba(ink, 0.7));
      dot(left.x + left.w - 160, left.y + left.h - 18, 3, marsColor);
      text('火星 687 日 / 圈', left.x + left.w - 150, left.y + left.h - 18, 12, rgba(ink, 0.7));

      // Fixed grid and reference stars: never pan with Mars.
      for (let k = 0; k < 5; k++) {
        const x = chart.x + chart.w * k / 4;
        line({ x, y: chart.y }, { x, y: chart.y + chart.h }, rgba(ink, 0.09));
        text(`${Math.round((-lonMax + 2 * lonMax * k / 4) * DEG)}°`, x, chart.y + chart.h + 15, 11, rgba(ink, 0.5), 'center');
      }
      for (let k = 0; k < 3; k++) {
        const lat = latMax * k / 2;
        const y = skyPoint({ longitude: 0, latitude: lat }).y;
        line({ x: chart.x, y }, { x: chart.x + chart.w, y }, rgba(ink, 0.09));
        text(`${(lat * DEG).toFixed(1)}°`, chart.x - 7, y, 10, rgba(ink, 0.45), 'right');
      }
      for (let k = 0; k < 28; k++) {
        const x = chart.x + ((k * 0.6180339 + 0.17) % 1) * chart.w;
        const y = chart.y + ((k * 0.4142135 + 0.11) % 1) * chart.h;
        dot(x, y, k % 5 === 0 ? 1.6 : 0.8, rgba(ink, k % 5 === 0 ? 0.45 : 0.2));
      }
      if (guide) {
        g.beginPath();
        samples.forEach((p, k) => { const s = skyPoint(p); if (k) g.lineTo(s.x, s.y); else g.moveTo(s.x, s.y); });
        g.strokeStyle = rgba(ink, 0.23); g.lineWidth = 1.5; g.setLineDash([3, 5]); g.stroke(); g.setLineDash([]);
      }
      for (let k = 1; k < samples.length && samples[k - 1].day < day; k++) {
        const a = samples[k - 1];
        const b = samples[k].day <= day ? samples[k] : state;
        line(skyPoint(a), skyPoint(b), a.retrograde ? marsColor : rgba(ink, 0.8), 2.5);
      }
      const sp = skyPoint(state);
      dot(sp.x, sp.y, 13, rgba(marsColor, 0.12));
      dot(sp.x, sp.y, 5.5, marsColor);
      if (!stationary) {
        const next = skyPoint(retrogradeState(day + 0.1, inclination));
        const angle = Math.atan2(next.y - sp.y, next.x - sp.x);
        arrow(sp.x + Math.cos(angle) * 23, sp.y + Math.sin(angle) * 23, angle, phaseColor, 7);
      }
      text('西 ←', chart.x, right.y + right.h - 17, 12, rgba(ink, 0.7));
      text('相對衝位置的黃經', chart.x + chart.w / 2, right.y + right.h - 17, 11, rgba(ink, 0.5), 'center');
      text('→ 東', chart.x + chart.w, right.y + right.h - 17, 12, rgba(ink, 0.7), 'right');

      const ty = portrait ? 837 : 478;
      const tx = 30; const tw = W - 60;
      text('順行 →', tx, ty - 20, 12, rgba(ink, 0.6));
      text('← 逆行', W / 2, ty - 20, 12, marsColor, 'center');
      text('順行 →', W - tx, ty - 20, 12, rgba(ink, 0.6), 'right');
      line({ x: tx, y: ty }, { x: tx + tw, y: ty }, rgba(ink, 0.24), 4);
      for (let k = 1; k < samples.length; k++) {
        if (samples[k].retrograde) line({ x: tx + tw * (k - 1) / 360, y: ty }, { x: tx + tw * k / 360, y: ty }, marsColor, 4);
      }
      dot(tx + tw * u, ty, 7, ink);
      dot(tx + tw * u, ty, 3, background);
      text('衝前 130 日', tx, ty + 22, 11, rgba(ink, 0.5));
      text(day < -0.5 ? `衝前 ${Math.round(-day)} 日` : day > 0.5 ? `衝後 ${Math.round(day)} 日` : '衝 · 地球從內側超車', W / 2, ty + 22, 12, ink, 'center');
      text('衝後 130 日', W - tx, ty + 22, 11, rgba(ink, 0.5), 'right');
      text(state.retrograde ? '地球超車，視線向西掃過；火星仍向前公轉。' : '觀察背景恆星：火星正向東移動。', W / 2, ty + 52, portrait ? 16 : 17, phaseColor, 'center');
      if (portrait) text('圓軌道示意 · 260 日片段重播 · 球體大小不按比例', W / 2, H - 26, 12, rgba(ink, 0.45), 'center');
    });
    runtime.notice = '圓軌道教學模型，非即時星曆。星空圖黃緯放大；每 10 秒重播衝前後 260 日片段。開啟「手動觀測」可拖動進度。';
    return runtime;
  },
});
