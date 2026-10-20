import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, mix, minSide, num, str, TAU } from '../../engine/helpers';

const SQ3 = Math.sqrt(3);

export default defineEffect({
  id: 'hex-grid',
  code: 'G04',
  nameZh: '六角網格',
  nameEn: 'Hex Grid',
  category: 'grid',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '六角形蜂巢網格從一個格子開始，依鄰近關係一圈一圈傳播亮色與尺度波。',
  tags: ['六角', 'hexagon', '蜂巢', '波紋', '傳播'],
  suitable: ['科技背景', '資料節點視覺', '遊戲介面'],
  principle:
    'Canvas 2D：尖頂六角格使用 axial 座標 (q, r)，中心 x = √3·R·(q + r/2)、y = 1.5·R·r；兩格的步數距離 d = (|Δq| + |Δr| + |Δq+Δr|)/2（等於在六角鄰接圖上做 BFS 的層數），因此波前是一圈圈的六角環。每個脈衝從 seeded 來源格在 t₀ 出發，波前 = (t − t₀)·速度，格子的啟動值 a = 前緣平滑上升、後方指數衰減；a 驅動顏色插值與六角縮放，中心點固定所以格距不變。',
  defaultText: '',
  palette: 'PASTEL',
  controls: ['intensity', 'scale', 'secondary', 'accent', 'seed'],
  params: [
    { key: 'size', label: '六角大小', type: 'range', min: 0.03, max: 0.12, step: 0.005, default: 0.055, hint: '相對舞台短邊' },
    { key: 'speed', label: '傳播速度', type: 'range', min: 2, max: 16, step: 0.5, default: 7, unit: '格/s' },
    { key: 'tail', label: '波尾長度', type: 'range', min: 0.5, max: 6, step: 0.25, default: 2.5, unit: '格' },
    { key: 'every', label: '脈衝間隔', type: 'range', min: 0.8, max: 5, step: 0.1, default: 2.2, unit: 's' },
    {
      key: 'mode',
      label: '傳播內容',
      type: 'select',
      default: 'both',
      options: [
        { value: 'both', label: '顏色＋尺度' },
        { value: 'color', label: '只有顏色' },
        { value: 'scale', label: '只有尺度' },
      ],
    },
  ],
  recipe: {
    enter: '靜止的淡色六角網格。',
    motion: '來源格先點亮，波前以固定速度一圈圈向外擴散（六角環形），前緣快速升起，後方在數格內衰減；尺度波讓六角先放大再縮回。',
    hold: '脈衝之間網格回到靜止狀態。',
    exit: '波前離開舞台後消失。',
    loop: '來源格依 seed 輪替，每個間隔發出新的脈衝，重疊的波取最大值。',
  },
  accept: [
    '波前輪廓是六角形環而不是圓形。',
    '六角形中心位置固定，任何時候格距都保持一致、不重疊。',
    '切換「只有尺度」時顏色不變、只有大小起伏；「只有顏色」時大小不變。',
    '提高傳播速度時環擴散更快；改 seed 來源格改變。',
  ],
  transparent: true,
  cycle: 8.8,
  posterTime: 1.3,
  create(ctx) {
    const m = minSide(ctx);
    const R = Math.max(5, m * num(ctx, 'size', 0.055) * ctx.s.scale * (ctx.mode === 'card' ? 1.35 : 1));
    const speed = num(ctx, 'speed', 7);
    const tail = num(ctx, 'tail', 2.5);
    const every = num(ctx, 'every', 2.2);
    const mode = str(ctx, 'mode', 'both');
    const doColor = mode !== 'scale';
    const doScale = mode !== 'color';
    const amp = ctx.s.intensity;
    const { width: w, height: h } = ctx;
    const dx = SQ3 * R;
    const dy = 1.5 * R;
    const rows = Math.ceil(h / dy) + 2;
    const cols = Math.ceil(w / dx) + 2;
    const cells: { x: number; y: number; q: number; r: number }[] = [];
    const ox = (w - (cols - 1) * dx) / 2;
    const oy = (h - (rows - 1) * dy) / 2;
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        const x = ox + dx * (col + 0.5 * (row & 1)) - dx * 0.25;
        const y = oy + dy * row;
        cells.push({ x, y, q: col - (row - (row & 1)) / 2, r: row });
      }
    // seeded sources, preferring cells inside the central 70 % of the stage
    const inner = cells.filter((c) => Math.abs(c.x - w / 2) < w * 0.35 && Math.abs(c.y - h / 2) < h * 0.35);
    const pool = inner.length ? inner : cells;
    const sources = Array.from({ length: 5 }, () => pool[Math.floor(ctx.rand() * pool.length)]);
    let maxD = 0;
    for (const s of sources)
      for (const c of cells) maxD = Math.max(maxD, (Math.abs(c.q - s.q) + Math.abs(c.r - s.r) + Math.abs(c.q - s.q + c.r - s.r)) / 2);
    const life = (maxD + tail * 4) / speed;
    const hexD = (a: number, b: { q: number; r: number }) => {
      const s = sources[a];
      const qq = b.q - s.q;
      const rr = b.r - s.r;
      return (Math.abs(qq) + Math.abs(rr) + Math.abs(qq + rr)) / 2;
    };
    const corners: number[] = [];
    for (let i = 0; i < 6; i++) {
      const a = (TAU * i) / 6 - Math.PI / 2;
      corners.push(Math.cos(a), Math.sin(a));
    }
    const base = mix(ctx.s.accent, ctx.s.background, 0.15);

    return canvasRuntime(ctx, (g, t) => {
      const j1 = Math.floor(t / every);
      const j0 = Math.max(0, Math.floor((t - life) / every));
      const pulses: { si: number; front: number }[] = [];
      for (let j = j0; j <= j1; j++) {
        const age = t - j * every;
        if (age < 0) continue;
        pulses.push({ si: j % sources.length, front: age * speed });
      }
      for (const c of cells) {
        let a = 0;
        for (const p of pulses) {
          const x = p.front - hexD(p.si, c);
          let v = 0;
          if (x < 0) v = clamp(1 + x / 0.7, 0, 1) ** 2;
          else v = Math.exp(-x / tail);
          if (v > a) a = v;
        }
        const k = doScale ? clamp(0.62 + 0.34 * a * amp, 0.3, 0.97) : 0.88;
        const rr = R * k;
        g.fillStyle = doColor ? (a > 0.55 ? mix(ctx.s.primary, ctx.s.secondary, clamp((a - 0.55) / 0.45, 0, 1) ** 2) : mix(base, ctx.s.primary, a / 0.55)) : ctx.s.primary;
        g.beginPath();
        g.moveTo(c.x + corners[0] * rr, c.y + corners[1] * rr);
        for (let i = 2; i < 12; i += 2) g.lineTo(c.x + corners[i] * rr, c.y + corners[i + 1] * rr);
        g.closePath();
        g.fill();
      }
      // mark the active source cells
      g.strokeStyle = ctx.s.secondary;
      g.lineWidth = Math.max(1.5, R * 0.12);
      for (const p of pulses) {
        if (p.front > 3) continue;
        const sc = sources[p.si];
        g.beginPath();
        g.arc(sc.x, sc.y, R * 0.42, 0, TAU);
        g.stroke();
      }
    });
  },
});
