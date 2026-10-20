import { defineEffect } from '../../engine/define';
import { canvasRuntime, clamp, easeInOut, easeOut3, minSide, num, rgba, str } from '../../engine/helpers';
import { rng } from '../../engine/random';
import { fitGrid } from './_util';

interface Tile {
  i: number;
  j: number;
  batch: number;
  dx: number;
  dy: number;
  rot: number;
  col: string;
}

export default defineEffect({
  id: 'grid-break',
  code: 'G10',
  nameZh: '網格瓦解',
  nameEn: 'Grid Break',
  category: 'grid',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '完整的方塊網格分批脫落、旋轉飄散，再依序飛回並精準卡回原位。',
  tags: ['瓦解', '重組', '方塊', '旋轉', 'break'],
  suitable: ['品牌重組意象', '轉場', '載入／完成動畫'],
  principle:
    'Canvas 2D：每格依瓦解順序（隨機 / 由中心 / 逐列 / 逐行）分到第 b 批，第 b 批在 b × 批次間隔脫離。位移向量 = 由中心向外的方向 + seeded 擾動，長度 = 散開距離 × 格寬；角度 = seeded ±旋轉量。脫離用 ease-out，漂浮時緩慢續轉，回程用 ease-in-out，進度在終點 clamp 到 1，所以回到的座標與角度與原位完全相同；落位時槽位外框閃一下作為對位提示。',
  defaultText: '',
  palette: 'PASTEL',
  controls: ['intensity', 'scale', 'secondary', 'accent', 'seed'],
  params: [
    {
      key: 'order',
      label: '瓦解順序',
      type: 'select',
      default: 'radial',
      options: [
        { value: 'random', label: '隨機' },
        { value: 'radial', label: '由中心向外' },
        { value: 'rows', label: '逐列（上→下）' },
        { value: 'cols', label: '逐行（左→右）' },
      ],
    },
    { key: 'scatter', label: '散開距離', type: 'range', min: 0.3, max: 5, step: 0.1, default: 1.8, unit: '格' },
    { key: 'batches', label: '批次數', type: 'range', min: 2, max: 8, step: 1, default: 4 },
    { key: 'gap', label: '批次間隔', type: 'range', min: 0.1, max: 0.8, step: 0.05, default: 0.3, unit: 's' },
    { key: 'cell', label: '格子大小', type: 'range', min: 0.07, max: 0.2, step: 0.01, default: 0.11, hint: '相對舞台短邊' },
  ],
  recipe: {
    enter: '完整、對齊的方塊網格。',
    motion: '第一批方塊以 ease-out 向外彈出並旋轉，之後每 0.3 s 一批；離開的位置留下淡色槽位外框。漂浮時緩慢續轉。',
    hold: '每批漂浮約 1 秒；全部歸位後整面停留 1.2 秒。',
    exit: '各批依相同順序以 ease-in-out 飛回，角度歸零、精準卡回，槽位外框閃一下。',
    loop: '歸位停留後再次瓦解。',
  },
  accept: [
    '方塊以明顯的批次脫離，而不是同時散開。',
    '回到原位後與網格完全對齊（無殘留角度或偏移）。',
    '「由中心向外」時中心先瓦解；「逐列」時從上方開始。',
    '加大散開距離時方塊飛得更遠。',
  ],
  transparent: true,
  posterTime: 1.3,
  cycle: 6,
  create(ctx) {
    const order = str(ctx, 'order', 'radial');
    const scatter = num(ctx, 'scatter', 1.8);
    const B = Math.round(num(ctx, 'batches', 4));
    const gapT = num(ctx, 'gap', 0.3);
    const target = num(ctx, 'cell', 0.11) * minSide(ctx) * ctx.s.scale;
    const { cols, rows, cell, ox, oy } = fitGrid(ctx.width * 0.86, ctx.height * 0.8, target, 3, 3);
    const gx = ox + ctx.width * 0.07;
    const gy = oy + ctx.height * 0.1;
    const R = rng(ctx.rand);
    const cxm = (cols - 1) / 2;
    const cym = (rows - 1) / 2;
    const maxD = Math.hypot(cxm, cym) || 1;
    const shuffled = R.shuffle(Array.from({ length: cols * rows }, (_, k) => k));
    const rankOf = new Map(shuffled.map((k, r) => [k, r]));
    const tiles: Tile[] = [];
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const k = j * cols + i;
        let f: number;
        if (order === 'random') f = rankOf.get(k)! / (cols * rows);
        else if (order === 'rows') f = j / rows;
        else if (order === 'cols') f = i / cols;
        else f = Math.hypot(i - cxm, j - cym) / (maxD + 1e-6);
        const batch = Math.min(B - 1, Math.floor(f * B));
        let vx = i - cxm;
        let vy = j - cym;
        const len = Math.hypot(vx, vy);
        const ang = (len < 1e-3 ? R.range(0, Math.PI * 2) : Math.atan2(vy, vx)) + R.range(-0.6, 0.6);
        const dist = scatter * cell * R.range(0.6, 1.4);
        vx = Math.cos(ang) * dist;
        vy = Math.sin(ang) * dist;
        // keep the scattered tile inside the stage
        const px0 = gx + i * cell + cell / 2;
        const py0 = gy + j * cell + cell / 2;
        const mg = cell * 0.75;
        // shrink the vector (keeping its direction) so the tile stays inside the stage
        let sc = 1;
        if (px0 + vx > ctx.width - mg) sc = Math.min(sc, (ctx.width - mg - px0) / vx);
        if (px0 + vx < mg) sc = Math.min(sc, (mg - px0) / vx);
        if (py0 + vy > ctx.height - mg) sc = Math.min(sc, (ctx.height - mg - py0) / vy);
        if (py0 + vy < mg) sc = Math.min(sc, (mg - py0) / vy);
        sc = Math.max(0.15, sc);
        vx *= sc;
        vy *= sc;
        tiles.push({
          i,
          j,
          batch,
          dx: vx,
          dy: vy,
          rot: R.sign() * R.range(0.4, 1.6) * Math.PI * 0.5 * ctx.s.intensity,
          col: R.range(0, 1) < 0.2 ? ctx.s.secondary : ctx.s.primary,
        });
      }
    const outD = 0.7;
    const hang = 1;
    const backD = 0.8;
    const holdD = 1.2;
    const total = (B - 1) * gapT + outD + hang + backD + holdD;
    const pad = Math.max(1, cell * 0.07);
    const size = cell - pad * 2;
    const ghost = rgba(ctx.s.primary, 0.28);

    return canvasRuntime(ctx, (g, t) => {
      const lt = t % total;
      const moving: { tile: Tile; p: number; x: number; y: number; a: number; s: number }[] = [];
      for (const tile of tiles) {
        const s0 = tile.batch * gapT;
        const x0 = gx + tile.i * cell + cell / 2;
        const y0 = gy + tile.j * cell + cell / 2;
        const po = easeOut3(clamp((lt - s0) / outD, 0, 1));
        const pb = easeInOut(clamp((lt - s0 - outD - hang) / backD, 0, 1));
        const away = po * (1 - pb);
        // landing flash on the slot
        const since = lt - (s0 + outD + hang + backD);
        if (away <= 0) {
          g.fillStyle = tile.col;
          g.fillRect(x0 - size / 2, y0 - size / 2, size, size);
          if (since >= 0 && since < 0.45) {
            g.strokeStyle = rgba(ctx.s.accent, 1 - since / 0.45);
            g.lineWidth = 2;
            g.strokeRect(x0 - size / 2 - pad, y0 - size / 2 - pad, size + pad * 2, size + pad * 2);
          }
          continue;
        }
        // slot ghost
        g.strokeStyle = ghost;
        g.lineWidth = 1;
        g.strokeRect(x0 - size / 2 + 0.5, y0 - size / 2 + 0.5, size - 1, size - 1);
        // floating drift: keep rotating slightly while out, zero when back
        const drift = clamp((lt - s0 - outD) / hang, 0, 1) * (1 - pb) * 0.25;
        moving.push({
          tile,
          p: away,
          x: x0 + tile.dx * away,
          y: y0 + tile.dy * away,
          a: tile.rot * (away + drift),
          s: 1 - 0.12 * away,
        });
      }
      moving.sort((A, Bm) => A.p - Bm.p);
      for (const m of moving) {
        g.save();
        g.translate(m.x, m.y);
        g.rotate(m.a);
        g.fillStyle = m.tile.col;
        const sz = size * m.s;
        g.fillRect(-sz / 2, -sz / 2, sz, sz);
        g.restore();
      }
    });
  },
});
