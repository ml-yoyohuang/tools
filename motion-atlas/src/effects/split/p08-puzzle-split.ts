import { defineEffect } from '../../engine/define';
import { canvasRuntime, easeInOut, mixHex, num, rgba } from '../../engine/helpers';
import { C } from '../../engine/palette';
import { makeScenes, transition, TRANSITION_PARAMS } from '../../engine/scenes';
import { AB_HINT, centroid, drawPiece, local, polyPath, type Pts } from './_util';

export default defineEffect({
  id: 'puzzle-split',
  code: 'P08',
  nameZh: '拼圖分片',
  nameEn: 'Puzzle Split',
  category: 'split',
  sourceType: 'original',
  difficulty: 'advanced',
  renderer: 'canvas',
  description: '舊畫面碎成不規則多邊形，各片錯開漂離原位、翻面換成新內容，再精準拼回成新畫面。',
  tags: ['拼圖', '多邊形', '碎片', '重組', 'puzzle'],
  suitable: ['重組／合作主題', '品牌揭曉', '資訊圖換頁'],
  principle:
    'Canvas 2D：以 seed 抖動的格點網建立四邊形，部分沿隨機對角線再切成兩個三角形，所有片段共用頂點所以邊界完全吻合。每片有隨機延遲；局部進度 u 下位移 = 外推向量·sin(πu)、旋轉 = r·sin(πu)，u 在 0.38–0.62 之間沿片內軸做 cos 翻面並在中點把內容由 A 換成 B。底板畫出所有空位的外框。',
  defaultText: 'PIECE BY PIECE／完成',
  palette: 'STREET',
  colors: { background: C.cream, primary: C.red, secondary: C.black, accent: C.black },
  controls: ['text', 'font', 'weight', 'intensity', 'seed', 'secondary', 'accent'],
  textHint: AB_HINT,
  params: [
    ...TRANSITION_PARAMS,
    { key: 'cols', label: '欄數', type: 'range', min: 3, max: 10, step: 1, default: 6 },
    { key: 'jitter', label: '形狀不規則', type: 'range', min: 0, max: 0.45, step: 0.05, default: 0.3 },
    { key: 'scatter', label: '錯開距離', type: 'range', min: 0, max: 0.6, step: 0.05, default: 0.22 },
  ],
  recipe: {
    enter: '完整顯示 A 場景。',
    motion: '每片依隨機延遲（0–0.4 進度）以 sin 曲線漂離原位並旋轉，到最遠處翻面換成 B，再回到原位拼合；強度放大旋轉。',
    hold: 'B 完整停留，拼縫消失。',
    exit: 'B 碎裂、翻面換回 A。',
    loop: 'A → B → A；改 seed 會換一組碎片形狀。',
  },
  accept: [
    '轉場中碎片離開原位，底板露出空位外框（分割線）。',
    '碎片在漂離時翻面，同一時刻有 A 面與 B 面碎片。',
    '拼回後邊界完全吻合，沒有縫隙殘留。',
    '改變欄數／不規則度／seed，碎片形狀與數量改變。',
  ],
  cycle: 4.4,
  posterTime: 1.6,
  create(ctx) {
    const sc = makeScenes(ctx);
    const { width: w, height: h } = ctx;
    const cols = Math.max(2, Math.round(num(ctx, 'cols', 6) * (ctx.q < 0.6 ? 0.75 : 1)));
    const cw = w / cols;
    const rows = Math.max(2, Math.min(16, Math.round(h / cw)));
    const ch = h / rows;
    const jit = num(ctx, 'jitter', 0.3);
    const scatter = num(ctx, 'scatter', 0.22) * Math.min(w, h);
    const inten = ctx.s.intensity;
    // jittered lattice (edges stay on the frame)
    const P: number[][] = [];
    for (let j = 0; j <= rows; j++) {
      const row: number[] = [];
      for (let i = 0; i <= cols; i++) {
        const ex = i === 0 || i === cols;
        const ey = j === 0 || j === rows;
        const x = i * cw + (ex ? (i === 0 ? -2 : 2) : (ctx.rand() - 0.5) * 2 * jit * cw);
        const y = j * ch + (ey ? (j === 0 ? -2 : 2) : (ctx.rand() - 0.5) * 2 * jit * ch);
        row.push(x, y);
      }
      P.push(row);
    }
    const pt = (i: number, j: number) => [P[j][i * 2], P[j][i * 2 + 1]];
    const polys: Pts[] = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const a = pt(i, j);
        const b = pt(i + 1, j);
        const c = pt(i + 1, j + 1);
        const d = pt(i, j + 1);
        const r = ctx.rand();
        if (r < 0.3) polys.push([...a, ...b, ...c], [...a, ...c, ...d]);
        else if (r < 0.6) polys.push([...a, ...b, ...d], [...b, ...c, ...d]);
        else polys.push([...a, ...b, ...c, ...d]);
      }
    const pieces = polys.map((pts) => {
      const [x, y] = centroid(pts);
      const vx = x - w / 2;
      const vy = y - h / 2;
      const vl = Math.hypot(vx, vy) || 1;
      const ang = Math.atan2(vy, vx) + (ctx.rand() - 0.5) * 1.2;
      const dist = scatter * (0.55 + 0.45 * (vl / Math.hypot(w / 2, h / 2)) + ctx.rand() * 0.4);
      return {
        pts,
        dx: Math.cos(ang) * dist,
        dy: Math.sin(ang) * dist,
        rot: (ctx.rand() - 0.5) * 1.3 * inten,
        delay: ctx.rand() * 0.4,
        flipAxis: ctx.rand() * Math.PI,
      };
    });
    const lw = Math.max(1, Math.min(w, h) * 0.004);
    return canvasRuntime(ctx, (g, t) => {
      const tr = transition(ctx, t, (x) => x);
      const imgs = [sc.a.canvas, sc.b.canvas];
      if (tr.p <= 0) return sc.draw(g, tr.from);
      if (tr.p >= 1) return sc.draw(g, tr.to);
      const fromBg = sc.scene(tr.from).bg;
      const toBg = sc.scene(tr.to).bg;
      // board with empty slots
      g.fillStyle = mixHex(mixHex(fromBg, toBg, 0.5), '#000000', 0.45);
      g.fillRect(0, 0, w, h);
      g.strokeStyle = rgba('#ffffff', 0.4);
      g.lineWidth = lw;
      g.setLineDash([lw * 3, lw * 3]);
      for (const pc of pieces) {
        polyPath(g, pc.pts);
        g.stroke();
      }
      g.setLineDash([]);
      const items = pieces.map((pc) => ({ pc, u: local(tr.p, pc.delay, 0.6) }));
      items.sort((a, b) => Math.sin(Math.PI * a.u) - Math.sin(Math.PI * b.u));
      for (const { pc, u } of items) {
        const k = easeInOut(u);
        const off = Math.sin(Math.PI * k);
        const f = local(u, 0.38, 0.24);
        const flip = Math.cos(Math.PI * f);
        const img = imgs[f < 0.5 ? tr.from : tr.to];
        const [px, py] = centroid(pc.pts);
        g.save();
        // flip around a per-piece axis: rotate → squash x → unrotate
        g.translate(px + pc.dx * off, py + pc.dy * off);
        g.rotate(pc.rot * off + pc.flipAxis);
        g.scale(Math.max(0.02, Math.abs(flip)), 1);
        g.rotate(-pc.flipAxis);
        g.translate(-px, -py);
        drawPiece(g, img, w, h, pc.pts, { tx: 0, ty: 0, px, py }, {
          shadow: off > 0.02 ? Math.min(w, h) * 0.018 * off : 0,
          shadowAlpha: 0.35,
          edge: off > 0.02 ? ctx.s.accent : undefined,
          edgeWidth: lw * 1.5,
          shade: f > 0 && f < 1 ? 0.35 * (1 - Math.abs(flip)) : 0,
        });
        g.restore();
      }
    });
  },
});
