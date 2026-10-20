import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, damp, easeIn3, minSide, num, phase, TAU } from '../../engine/helpers';
import { layoutText, phrases } from '../../engine/text';
import { inkText } from './_util';

export default defineEffect({
  id: 'onomatopoeia-slam',
  code: 'C03',
  nameZh: '擬聲字重擊',
  nameEn: 'Onomatopoeia Slam',
  category: 'comic',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '擬聲字從鏡頭前加速砸向畫面，著地瞬間擠壓、短促過衝並只在字的位置局部震動。',
  tags: ['漫畫', '擬聲字', '重擊', '震動', 'SFX'],
  suitable: ['遊戲音效字', '短影音字卡', '活動倒數', '貼文重點'],
  principle:
    'Canvas 2D：每個詞有 seed 決定的落點與傾角。入場 0.22 秒以 easeIn³ 由 260% 縮到 100%（像從鏡頭前砸下）；著地後 scaleX = 1 + k·damp(t)、scaleY = 1 − k·damp(t) 做擠壓回彈，位移 = A·e^(−10t)·cos(11·2πt) 只套用在該詞的局部座標；字身用 N 層偏移複製做立體厚度，周圍短衝擊線從字框外緣向外彈出。',
  defaultText: '砰！／啪！／BOOM',
  palette: 'STREET',
  colors: { background: '#141414', primary: '#F2E8D5', secondary: '#E63A2E', accent: '#FFFFFF' },
  controls: ['text', 'font', 'weight', 'intensity', 'scale', 'secondary', 'accent', 'seed'],
  textHint: '用「／」分隔多個擬聲字，依序重擊。建議 1～5 個字。',
  maxChars: 30,
  params: [
    { key: 'tilt', label: '最大傾角', type: 'range', min: 0, max: 24, step: 1, default: 10, unit: '°' },
    { key: 'depth', label: '立體厚度', type: 'range', min: 0, max: 16, step: 1, default: 8 },
    { key: 'hold', label: '停留時間', type: 'range', min: 0.4, max: 2.5, step: 0.1, default: 1, unit: 's' },
    { key: 'ticks', label: '衝擊線', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '字從 260% 大小以 easeIn³ 加速砸下（0.22 秒），透明度在前 30% 內出現。',
    motion: '著地瞬間橫向拉寬、縱向壓扁，再以衰減振盪回到原形；同時只有這個字做 0.4 秒內衰減完的局部震動，衝擊線向外彈出後消失。',
    hold: '震動結束後字完全靜止，可清楚閱讀。',
    exit: '0.25 秒內向上縮小並淡出。',
    loop: '下一個擬聲字落在另一個 seed 位置與傾角，循環所有詞。',
  },
  accept: [
    '字是由大到小加速砸入，而不是由小放大彈出。',
    '著地時能看到擠壓變形與短暫震動，震動只在字本身，背景不動。',
    '每個詞的位置與傾角不同，且字身有立體厚度。',
    '強度為 0 時沒有震動與擠壓。',
  ],
  transparent: true,
  cycle: 4.5,
  posterTime: 1.2,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const words = phrases(ctx.text);
    const maxTilt = (num(ctx, 'tilt', 10) * Math.PI) / 180;
    const depth = Math.round(num(ctx, 'depth', 8));
    const hold = num(ctx, 'hold', 1);
    const ticks = bool(ctx, 'ticks', true);
    const m = minSide(ctx);
    const items = words.map((wd) => {
      const layout = layoutText(ctx, wd, { cx: 0, cy: 0, maxWidth: w * 0.7, maxHeight: h * 0.46, fill: 0.95, lineHeight: 1.05 });
      const slackX = Math.max(0, (w - layout.width * 1.15) / 2);
      const slackY = Math.max(0, (h - layout.height * 1.2) / 2);
      const nt = 9;
      return {
        layout,
        x: w / 2 + (ctx.rand() - 0.5) * slackX * 0.9,
        y: h / 2 + (ctx.rand() - 0.5) * slackY * 0.8,
        rot: (ctx.rand() * 2 - 1) * maxTilt,
        ticks: Array.from({ length: nt }, (_, i) => ({ a: ((i + ctx.rand() * 0.6) / nt) * TAU, l: 0.6 + ctx.rand() * 0.6 })),
      };
    });
    const SLAM = 0.22;
    const OUT = 0.25;
    const durs = words.flatMap(() => [SLAM, hold + 0.3, OUT]);
    return canvasRuntime(ctx, (g, t) => {
      const ph = phase(t, durs);
      const it = items[Math.floor(ph.i / 3)];
      const seg = ph.i % 3;
      const L = it.layout;
      const I = ctx.s.intensity;
      let s = 1;
      let sx = 1;
      let sy = 1;
      let alpha = 1;
      let ox = 0;
      let oy = 0;
      let since = -1;
      if (seg === 0) {
        s = 2.6 - 1.6 * easeIn3(ph.p);
        alpha = clamp(ph.p / 0.3, 0, 1);
      } else if (seg === 1) {
        since = ph.p * (hold + 0.3);
        const sq = damp(since, 2.6, 7) * 0.2 * I;
        sx = 1 + sq;
        sy = 1 - sq;
        const sh = damp(since, 11, 10) * m * 0.025 * I;
        ox = sh;
        oy = damp(since + 0.03, 9, 10) * m * 0.018 * I;
      } else {
        s = 1 - 0.4 * easeIn3(ph.p);
        alpha = 1 - ph.p;
        oy = -ph.p * m * 0.06;
      }
      // impact ticks — local to this word, before the word transform's squash
      if (ticks && seg === 1 && since < 0.45) {
        const k = since / 0.45;
        const rx = L.width / 2 + m * 0.05;
        const ry = L.height / 2 + m * 0.04;
        g.save();
        g.translate(it.x + ox, it.y + oy);
        g.rotate(it.rot);
        g.strokeStyle = ctx.s.accent;
        g.lineCap = 'round';
        g.lineWidth = Math.max(2, m * 0.012) * (1 - k);
        g.beginPath();
        for (const tk of it.ticks) {
          const c = Math.cos(tk.a);
          const sn = Math.sin(tk.a);
          const r0 = 1 + k * 0.25;
          const r1 = r0 + tk.l * 0.35 * (1 - k * 0.6);
          g.moveTo(c * rx * r0, sn * ry * r0);
          g.lineTo(c * rx * r1, sn * ry * r1);
        }
        g.stroke();
        g.restore();
      }
      g.save();
      g.globalAlpha = alpha;
      g.translate(it.x + ox, it.y + oy);
      g.rotate(it.rot);
      g.scale(s * sx, s * sy);
      const step = Math.max(1, L.fontSize * 0.012);
      const outline = L.fontSize * 0.1;
      const edge = ctx.capture.transparent ? '#141414' : ctx.s.background;
      // extrusion: stacked offset copies toward bottom-right
      for (let d = depth; d >= 1; d--) inkText(g, L, ctx.s.secondary, d === depth ? edge : null, outline, d * step, d * step);
      inkText(g, L, ctx.s.primary, edge, outline);
      g.restore();
    });
  },
});
