import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, minSide, mod, num, rgba, smoothstep, TAU } from '../../engine/helpers';
import type { Pt } from '../../engine/shapes';
import { easeExpoOut, easeQuadIn, hair, polyLengths, tracePartial } from './_util';

export default defineEffect({
  id: 'corner-frame',
  code: 'M07',
  nameZh: '邊角框線',
  nameEn: 'Corner Frame',
  category: 'minimal',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: '四個 L 形邊角依序畫入，框出一塊留白；停留後以相反順序收回。',
  tags: ['極簡', '邊框', '邊角', '描線', 'frame'],
  suitable: ['影片開場／字卡框', '相片／作品展示', '對焦／取景提示'],
  principle:
    'Canvas 2D：每個角是三點折線（臂端 → 角點 → 另一臂端），以累積長度畫出 0–p 的部分。四個角依 cw／ccw 順序錯開 0.35 秒，每角以 expo.out 畫入；停留後以相反順序、quad.in 讓 p 由 1 回到 0，線沿原路收回。框為舞台內縮後的矩形，所以 16:9／1:1／9:16 都貼合比例。',
  defaultText: '',
  palette: 'MONO',
  colors: { background: '#F2E8D5', primary: '#141414', secondary: '#8A8A8A', accent: '#3450FF' },
  controls: ['scale', 'direction', 'accent'],
  directions: ['cw', 'ccw'],
  params: [
    { key: 'arm', label: '邊角長度', type: 'range', min: 0.08, max: 0.5, step: 0.01, default: 0.2 },
    { key: 'inset', label: '內縮', type: 'range', min: 0.06, max: 0.3, step: 0.01, default: 0.14 },
    { key: 'hold', label: '停留時間', type: 'range', min: 0.3, max: 4, step: 0.1, default: 1.6, unit: 's' },
    { key: 'mark', label: '中心標記', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '空白畫面，0.3 秒後第一個角開始。',
    motion: '四個角依序以 expo.out 畫入（每角 0.7 秒，錯開 0.35 秒）。',
    hold: '完整的四角停留約 1.6 秒，中心小點淡入。',
    exit: '以相反順序 quad.in 收回，最後畫的角最先收。',
    loop: '收完後短暫空白再重畫；關閉循環時停在完整四角。',
  },
  accept: [
    '四個角一個接一個出現，不是同時出現。',
    '停留後收回順序與畫入相反。',
    '線條沿原路收回，不是淡出。',
    '方向 ccw 時畫入順序反過來。',
  ],
  transparent: true,
  loopable: true,
  cycle: 6,
  posterTime: 2.6,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const armF = num(ctx, 'arm', 0.2);
    const inset = num(ctx, 'inset', 0.14);
    const hold = num(ctx, 'hold', 1.6);
    const mark = bool(ctx, 'mark', true);
    const ins = m * inset / Math.max(0.5, ctx.s.scale);
    const x0 = clamp(ins, 4, w / 2 - 8);
    const y0 = clamp(ins, 4, h / 2 - 8);
    const x1 = w - x0;
    const y1 = h - y0;
    const arm = Math.min(x1 - x0, y1 - y0) * armF;
    const cw: Pt[][] = [
      [[x0, y0 + arm], [x0, y0], [x0 + arm, y0]],
      [[x1 - arm, y0], [x1, y0], [x1, y0 + arm]],
      [[x1, y1 - arm], [x1, y1], [x1 - arm, y1]],
      [[x0 + arm, y1], [x0, y1], [x0, y1 - arm]],
    ];
    const corners = ctx.dirSign > 0 ? cw : [cw[0], cw[3], cw[2], cw[1]].map((c) => [...c].reverse());
    const lens = corners.map((c) => polyLengths(c));
    const lw = hair(m, 0.006 * ctx.s.scale, 1.5);
    const D = 0.7;
    const st = 0.35;
    const R = 0.55;
    const rst = 0.28;
    const t0 = 0.3;
    const drawEnd = t0 + st * 3 + D;
    const retractStart = drawEnd + hold;
    const retractEnd = retractStart + rst * 3 + R;
    const total = retractEnd + 0.45;
    const rt = canvasRuntime(
      ctx,
      (g, t) => {
        const u = mod(t, total);
        g.strokeStyle = ctx.s.primary;
        g.lineWidth = lw;
        g.lineCap = 'square';
        g.lineJoin = 'miter';
        g.beginPath();
        for (let i = 0; i < 4; i++) {
          let p: number;
          if (u < retractStart) p = easeExpoOut((u - t0 - i * st) / D);
          else p = 1 - easeQuadIn((u - retractStart - (3 - i) * rst) / R);
          p = clamp(p, 0, 1);
          if (p > 0.002) tracePartial(g, corners[i], 0, p, lens[i]);
        }
        g.stroke();
        if (mark) {
          const a = smoothstep(drawEnd - 0.2, drawEnd + 0.3, u) * (1 - smoothstep(retractStart - 0.3, retractStart + 0.1, u));
          if (a > 0.01) {
            g.fillStyle = rgba(ctx.s.accent, a);
            g.beginPath();
            g.arc(w / 2, h / 2, Math.max(2.5, m * 0.012) * (0.6 + 0.4 * a), 0, TAU);
            g.fill();
          }
        }
      },
      { settle: drawEnd + Math.min(0.6, hold / 2) },
    );
    return rt;
  },
});
