import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, easeInOut, easeOut3, luminance, minSide, num, phase, rgba, str } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { graphemes } from '../../engine/text';

interface Series {
  name: string;
  v: number[];
}

const SAMPLE = '北區:12,18,15,22,30,28,35,41,39,48,55,62;中區:20,22,27,25,24,31,33,30,38,36,40,44;南區:8,10,16,21,19,26,34,38,45,47,52,50';
const MAX_SERIES = 5;
const MAX_POINTS = 40;

/** Parse "name:1,2,3;name2:4,5,6" (names optional). Returns null + reason when invalid. */
function parseData(raw: string): { series: Series[] } | { error: string } {
  const parts = raw
    .split(/[;；\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (!parts.length) return { error: '資料是空的' };
  if (parts.length > MAX_SERIES) return { error: `最多 ${MAX_SERIES} 條數據線` };
  const series: Series[] = [];
  for (let i = 0; i < parts.length; i++) {
    let name = String.fromCharCode(65 + i);
    let body = parts[i];
    const m = /^([^:：]*)[:：](.*)$/.exec(body);
    if (m) {
      if (m[1].trim()) name = graphemes(m[1].trim()).slice(0, 8).join('');
      body = m[2];
    }
    const nums = body
      .split(/[,，\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (nums.length < 2) return { error: `第 ${i + 1} 條至少需要 2 個數值` };
    if (nums.length > MAX_POINTS) return { error: `每條最多 ${MAX_POINTS} 個數值` };
    const v = nums.map(Number);
    if (v.some((x) => !Number.isFinite(x))) return { error: `第 ${i + 1} 條含有非數字` };
    series.push({ name, v });
  }
  return { series };
}

const fmt = (v: number, span: number) => (span >= 100 || Number.isInteger(v) ? Math.round(v).toString() : v.toFixed(1));

export default defineEffect({
  id: 'line-chart-race',
  code: 'L07',
  nameZh: '折線競賽',
  nameEn: 'Line Chart Race',
  category: 'lines',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '多條數據折線由左往右同步繪出，線頭的圓點與名稱、數值標籤一起前進並互相避讓。',
  tags: ['折線圖', 'line chart', '數據視覺化', '競賽', '資訊圖表'],
  suitable: ['簡報數據亮點', '社群數據貼文', '年度回顧'],
  principle:
    'Canvas 2D：資料點 i 的 x = 左邊界 + i/(n−1)·寬；進度 u ∈ [0, n−1] 以 ease-in-out 前進，每條線畫到 floor(u) 再線性內插出線頭位置與當下數值。Y 軸可隨「目前為止最大值」平滑擴張；標籤依線頭 y 排序後做一維推擠，保持最小間距。資料可由文字參數替換（名稱:數值,數值;…），格式錯誤時退回示例並顯示提示。',
  defaultText: '',
  palette: 'POP',
  colors: { background: C.cream, primary: C.blue, secondary: C.red, accent: C.pink },
  controls: ['scale', 'secondary', 'accent'],
  params: [
    {
      key: 'data',
      label: '資料（名稱:數值,數值;…）',
      type: 'text',
      default: SAMPLE,
      maxLength: 600,
      hint: '以分號分隔數據線、逗號分隔數值，名稱可省略。最多 5 條、每條 2–40 個數值。',
    },
    { key: 'draw', label: '繪製時間', type: 'range', min: 2, max: 12, step: 0.5, default: 5, unit: 's' },
    { key: 'hold', label: '結尾停留', type: 'range', min: 0.5, max: 5, step: 0.5, default: 1.8, unit: 's' },
    { key: 'autoscale', label: 'Y 軸隨數據擴張', type: 'toggle', default: true },
    { key: 'grid', label: '格線與刻度', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '座標軸先淡入，三條線從左側同一起點出發。',
    motion: '線頭以 ease-in-out 等距推進，端點圓點、名稱與即時數值跟隨線頭；標籤靠近時互相推開；Y 軸隨最大值平滑擴張。',
    hold: '全部畫完後停留 1.8 秒，可清楚讀取最終數值。',
    exit: '線條與標籤淡出 0.6 秒。',
    loop: '重新由左側繪製；關閉循環時停在完整圖表。',
  },
  accept: [
    '多條線同時由左往右繪製，線頭圓點與標籤同步前進。',
    '標籤數值即時跟著線頭變化，結尾顯示最後一筆數值。',
    '輸入「A:1,5,3;B:2,2,6」後圖表改為兩條線。',
    '輸入非數字資料時退回示例數據並顯示提示。',
  ],
  limits: ['資料以文字參數輸入，不支援匯入 CSV 檔；標籤避讓為一維推擠，數據線很多且數值接近時仍可能擁擠。'],
  transparent: true,
  loopable: true,
  cycle: 8,
  posterTime: 6.5,
  create(ctx) {
    const raw = str(ctx, 'data', SAMPLE);
    const parsed = parseData(raw);
    const fallback = 'error' in parsed;
    const series = 'error' in parsed ? (parseData(SAMPLE) as { series: Series[] }).series : parsed.series;
    const drawT = num(ctx, 'draw', 5);
    const holdT = num(ctx, 'hold', 1.8);
    const autoscale = bool(ctx, 'autoscale', true);
    const grid = bool(ctx, 'grid', true);
    const npts = Math.max(...series.map((s) => s.v.length));
    const all = series.flatMap((s) => s.v);
    const gMin = Math.min(0, ...all);
    const gMax = Math.max(...all);
    const span = Math.max(1e-6, gMax - gMin);
    const m = minSide(ctx);
    const sc = clamp(ctx.s.scale, 0.5, 1.6);
    const fs = clamp(m * 0.036 * sc, 10, 22);
    const ink = luminance(ctx.s.background) > 0.4 ? C.black : C.white;
    const colors = [ctx.s.primary, ctx.s.secondary, ctx.s.accent, ink, '#8A8A8A'];
    // reserve room for labels on the right
    const labelW = fs * 6.2;
    const padL = fs * 3.2;
    const plotW = Math.max(fs * 4, (ctx.width * 0.92 - padL - labelW) * Math.min(1, sc));
    const PH = Math.min(ctx.height * 0.62 * Math.min(1.25, sc), ctx.height * 0.78);
    const X0 = (ctx.width - (plotW + labelW + padL)) / 2 + padL;
    const Y1 = ctx.height / 2 + PH / 2;
    const xAt = (i: number) => X0 + (npts > 1 ? i / (npts - 1) : 0) * plotW;
    const valAt = (s: Series, u: number) => {
      const n = s.v.length;
      const uu = clamp((u * (n - 1)) / Math.max(1, npts - 1), 0, n - 1);
      const i = Math.min(n - 2, Math.floor(uu));
      return s.v[i] + (s.v[i + 1] - s.v[i]) * (uu - i);
    };
    // running max (for autoscale) sampled per point index
    const nice = (v: number) => {
      const p = 10 ** Math.floor(Math.log10(Math.max(1e-6, v)));
      const r = v / p;
      return (r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10) * p;
    };

    const rt = canvasRuntime(ctx, (g, t) => {
      const ph = phase(t, [drawT, holdT, 0.6]);
      // when loop is off the player holds at `settle` (end of draw + part of hold)
      const prog = ph.i === 0 ? easeInOut(ph.p) : 1;
      const fade = ph.i === 2 ? 1 - ph.p : 1;
      const axisIn = ph.i === 0 ? easeOut3(ph.p * 6) : 1;
      const u = prog * (npts - 1);
      // y-range
      let top = gMax;
      if (autoscale) {
        let mx = -Infinity;
        for (const s of series) {
          for (let k = 0; k <= Math.min(s.v.length - 1, Math.floor((u * (s.v.length - 1)) / Math.max(1, npts - 1))); k++) mx = Math.max(mx, s.v[k]);
          mx = Math.max(mx, valAt(s, u));
        }
        top = Math.max(gMin + span * 0.25, mx);
      }
      const yMax = gMin + (top - gMin) * 1.12;
      const yAt = (v: number) => Y1 - ((v - gMin) / Math.max(1e-6, yMax - gMin)) * PH;
      g.globalAlpha = fade;
      // axes + grid
      g.lineWidth = 1;
      g.strokeStyle = rgba(ink, 0.55 * axisIn);
      g.beginPath();
      g.moveTo(X0, Y1 - PH);
      g.lineTo(X0, Y1);
      g.lineTo(X0 + plotW, Y1);
      g.stroke();
      if (grid) {
        const step = nice((yMax - gMin) / 4);
        g.font = `500 ${fs * 0.72}px ${ctx.font.mono}`;
        g.textAlign = 'right';
        g.textBaseline = 'middle';
        for (let v = Math.ceil(gMin / step) * step; v <= yMax + 1e-9; v += step) {
          const y = yAt(v);
          if (y < Y1 - PH - 1) break;
          g.strokeStyle = rgba(ink, 0.12 * axisIn);
          g.beginPath();
          g.moveTo(X0, y);
          g.lineTo(X0 + plotW, y);
          g.stroke();
          g.fillStyle = rgba(ink, 0.6 * axisIn);
          g.fillText(fmt(v, span), X0 - fs * 0.4, y);
        }
        g.textAlign = 'center';
        g.textBaseline = 'top';
        const every = Math.max(1, Math.ceil(npts / 8));
        for (let i = 0; i < npts; i += every) g.fillText(String(i + 1), xAt(i), Y1 + fs * 0.4);
      }
      // lines
      g.lineJoin = 'round';
      g.lineCap = 'round';
      const heads: { x: number; y: number; ly: number; v: number; c: string; name: string }[] = [];
      series.forEach((s, si) => {
        const c = colors[si % colors.length];
        const n = s.v.length;
        const su = (u * (n - 1)) / Math.max(1, npts - 1);
        const xi = (k: number) => xAt((k * (npts - 1)) / Math.max(1, n - 1));
        g.strokeStyle = c;
        g.lineWidth = clamp(fs * 0.22, 2, 5);
        g.beginPath();
        g.moveTo(xi(0), yAt(s.v[0]));
        const fi = Math.floor(su);
        for (let k = 1; k <= fi && k < n; k++) g.lineTo(xi(k), yAt(s.v[k]));
        const v = valAt(s, u);
        const hx = xAt(u);
        const hy = yAt(v);
        g.lineTo(hx, hy);
        g.stroke();
        heads.push({ x: hx, y: hy, ly: hy, v, c, name: s.name });
      });
      // label repulsion (1D, keeps order by y)
      const gap = fs * 1.25;
      const order = heads.slice().sort((a, b) => a.y - b.y);
      for (let k = 1; k < order.length; k++) if (order[k].ly - order[k - 1].ly < gap) order[k].ly = order[k - 1].ly + gap;
      const overflow = order.length ? order[order.length - 1].ly - (Y1 + fs * 0.5) : 0;
      if (overflow > 0) for (const h of order) h.ly -= overflow;
      for (let k = order.length - 2; k >= 0; k--) if (order[k + 1].ly - order[k].ly < gap) order[k].ly = order[k + 1].ly - gap;
      g.textAlign = 'left';
      g.textBaseline = 'middle';
      for (const h of heads) {
        g.fillStyle = h.c;
        g.beginPath();
        g.arc(h.x, h.y, clamp(fs * 0.34, 3.5, 8), 0, Math.PI * 2);
        g.fill();
        const lx = h.x + fs * 0.8;
        if (Math.abs(h.ly - h.y) > 1) {
          g.strokeStyle = rgba(h.c, 0.5);
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(h.x + fs * 0.3, h.y);
          g.lineTo(lx - fs * 0.15, h.ly);
          g.stroke();
        }
        g.font = `700 ${fs * 0.85}px ${ctx.font.sans}`;
        g.fillText(h.name, lx, h.ly);
        const nw = g.measureText(h.name).width;
        g.font = `600 ${fs * 0.85}px ${ctx.font.mono}`;
        g.fillStyle = ink;
        g.fillText(fmt(h.v, span), lx + nw + fs * 0.4, h.ly);
      }
      g.globalAlpha = 1;
    }, { settle: drawT + Math.min(holdT, 1) });
    if (fallback) return Object.assign(rt, { notice: `資料格式無效（${(parsed as { error: string }).error}），已改用示例數據。格式：名稱:1,2,3;名稱:4,5,6` });
    return rt;
  },
});
