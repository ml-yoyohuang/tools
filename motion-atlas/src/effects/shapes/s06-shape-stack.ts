import { defineEffect } from '../../engine/define';
import { bool, canvasRuntime, clamp, damp, easeIn3, minSide, num, rgba, TAU } from '../../engine/helpers';

type PieceType = 'block' | 'slab' | 'pair' | 'trap' | 'arch' | 'ball' | 'tri' | 'dome';

interface Piece {
  type: PieceType;
  w: number;
  h: number;
  /** top width (for the trapezoid) */
  tw: number;
  dx: number;
  col: string;
  rot0: number;
}

const FALL = 0.5;
const HOLD = 1.8;
const EXIT_STAGGER = 0.08;
const EXIT = 0.45;

function piecePath(g: CanvasRenderingContext2D, p: Piece) {
  const { w, h } = p;
  switch (p.type) {
    case 'pair': {
      const cw = w * 0.3;
      g.rect(-w / 2, -h, cw, h);
      g.rect(w / 2 - cw, -h, cw, h);
      // lintel-free columns: a thin cap keeps the next layer visibly supported
      g.rect(-w / 2, -h, w, h * 0.16);
      break;
    }
    case 'trap':
      g.moveTo(-w / 2, 0);
      g.lineTo(w / 2, 0);
      g.lineTo(p.tw / 2, -h);
      g.lineTo(-p.tw / 2, -h);
      g.closePath();
      break;
    case 'arch': {
      const hr = Math.min(w * 0.3, h * 0.62);
      g.moveTo(-w / 2, 0);
      g.lineTo(-hr, 0);
      g.arc(0, 0, hr, Math.PI, 0, false);
      g.lineTo(w / 2, 0);
      g.lineTo(w / 2, -h);
      g.lineTo(-w / 2, -h);
      g.closePath();
      break;
    }
    case 'ball':
      g.moveTo(w / 2, -h / 2);
      g.arc(0, -h / 2, w / 2, 0, TAU);
      break;
    case 'tri':
      g.moveTo(-w / 2, 0);
      g.lineTo(w / 2, 0);
      g.lineTo(0, -h);
      g.closePath();
      break;
    case 'dome':
      g.moveTo(w / 2, 0);
      g.arc(0, 0, w / 2, 0, Math.PI, true);
      g.closePath();
      break;
    default:
      g.rect(-w / 2, -h, w, h);
  }
}

export default defineEffect({
  id: 'shape-stack',
  code: 'S06',
  nameZh: '幾何堆疊',
  nameEn: 'Shape Stack',
  category: 'shapes',
  sourceType: 'original',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '幾何積木依序從上方落入預先排好的位置，落定時微壓與震動，疊成一座平衡的構圖後再依序撤離。',
  tags: ['堆疊', 'stack', '編排', '積木', '構圖'],
  suitable: ['品牌組合 Logo', '步驟累積', '海報動態'],
  principle:
    'Canvas 2D 編排動畫（非物理模擬）：create 時依 seed 產生一組由下而上的積木（板、塊、雙柱、梯形、拱、頂端球／三角／半圓），每層寬度受下層頂寬限制、左右偏移交替以維持視覺平衡，整體縮放到舞台內。第 k 塊在 0.3 + k·間隔 秒以 ease-in（重力感）落下 0.5 秒並由微傾轉正；落地時自身與下方各層套用衰減震盪的壓縮量，各層底部位置由下往上累加，因此整座堆疊一起被壓一下。',
  defaultText: '',
  palette: 'PASTEL',
  controls: ['scale', 'secondary', 'accent', 'seed'],
  params: [
    { key: 'count', label: '積木數量', type: 'range', min: 4, max: 9, step: 1, default: 6 },
    { key: 'interval', label: '落下間隔', type: 'range', min: 0.2, max: 1, step: 0.05, default: 0.45, unit: 's' },
    { key: 'squash', label: '落地壓縮', type: 'range', min: 0, max: 1, step: 0.05, default: 0.6 },
    { key: 'guides', label: '顯示目標位置虛線', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '地面線上方出現下一塊的虛線目標框。',
    motion: '積木以 ease-in 加速落下並轉正，落地瞬間壓扁、下方各層一起微壓後以衰減震盪回彈。',
    hold: '整座堆疊完成後靜止約 1.8 秒。',
    exit: '由上而下依序向上抽離並淡出。',
    loop: '依同一 seed 重新堆疊，構圖相同。',
  },
  accept: [
    '每塊積木都落在虛線目標框的位置，不會互相穿插。',
    '落地時可見壓縮與衰減回彈，下方積木一起被壓。',
    '完成的構圖左右平衡、整體位於舞台內。',
    '更換 seed 後構圖改變。',
  ],
  transparent: true,
  cycle: 0.3 + 6 * 0.45 + FALL + HOLD + 6 * EXIT_STAGGER + EXIT + 0.2,
  posterTime: 5,
  loopable: true,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const n = Math.round(num(ctx, 'count', 6));
    const di = num(ctx, 'interval', 0.45);
    const sqAmt = num(ctx, 'squash', 0.6);
    const guides = bool(ctx, 'guides', true);
    const U = m * 0.06;
    const cols = [ctx.s.primary, ctx.s.secondary, ctx.s.accent];
    const rnd = (a: number, b: number) => a + ctx.rand() * (b - a);
    const pieces: Piece[] = [];
    let supportTop = 0;
    let prev: PieceType | '' = '';
    let side = ctx.rand() < 0.5 ? -1 : 1;
    for (let k = 0; k < n; k++) {
      let p: Piece;
      if (k === 0) {
        const pw = rnd(5.8, 7.2) * U;
        p = { type: 'slab', w: pw, h: rnd(0.55, 0.8) * U, tw: pw, dx: 0, col: '', rot0: 0 };
      } else if (k === n - 1) {
        const opts: PieceType[] = supportTop < 2.4 * U ? ['ball', 'tri'] : ['ball', 'tri', 'dome'];
        const type = opts[Math.floor(ctx.rand() * opts.length)];
        const pw = clamp(rnd(1.6, 2.8) * U, 1.2 * U, Math.max(1.2 * U, supportTop * 1.05));
        p = { type, w: pw, h: type === 'ball' ? pw : type === 'tri' ? pw * rnd(0.8, 1.1) : pw / 2, tw: 0, dx: 0, col: '', rot0: 0 };
      } else {
        const opts = (['block', 'pair', 'trap', 'arch', 'slab'] as PieceType[]).filter((x) => x !== prev);
        const type = opts[Math.floor(ctx.rand() * opts.length)];
        const pw = clamp(rnd(0.62, 1.05) * supportTop, 1.8 * U, Math.max(1.8 * U, supportTop * 1.12));
        const ph = type === 'slab' ? rnd(0.5, 0.75) * U : type === 'pair' ? rnd(1.6, 2.2) * U : rnd(1.1, 1.8) * U;
        p = { type, w: pw, h: ph, tw: type === 'trap' ? pw * rnd(0.55, 0.75) : pw, dx: 0, col: '', rot0: 0 };
      }
      if (k > 0) {
        // alternate small offsets around the axis → visually balanced
        const room = Math.max(0, (supportTop - p.w * 0.6) / 2);
        p.dx = side * Math.min(room, U * rnd(0.15, 0.7));
        side = -side;
        p.rot0 = (ctx.rand() < 0.5 ? -1 : 1) * rnd(0.15, 0.35);
      }
      p.col = cols[k % 3];
      supportTop = p.tw;
      prev = p.type;
      pieces.push(p);
    }
    // accumulate x offsets (each layer is centred on the one below) and fit the stage
    const xs: number[] = [];
    let acc = 0;
    let totalH = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    pieces.forEach((p, k) => {
      acc = k === 0 ? 0 : acc + p.dx;
      xs.push(acc);
      totalH += p.h;
      minX = Math.min(minX, acc - p.w / 2);
      maxX = Math.max(maxX, acc + p.w / 2);
    });
    const midX = (minX + maxX) / 2;
    // fit the finished stack into the stage; scale > 1 may grow it but never past 80 % / 90 %
    const fitC = Math.min(
      Math.min((h * 0.7) / totalH, (w * 0.78) / (maxX - minX), 1.6) * ctx.s.scale,
      (h * 0.8) / totalH,
      (w * 0.9) / (maxX - minX),
    );
    const ground = h * 0.88;
    const gx = w / 2;
    const land = pieces.map((_, k) => 0.3 + k * di + FALL);
    const doneT = land[n - 1];
    const exitStart = doneT + HOLD;
    const total = exitStart + n * EXIT_STAGGER + EXIT + 0.2;
    return canvasRuntime(
      ctx,
      (g, t) => {
        const lt = t % total;
        g.save();
        g.translate(gx, ground);
        g.scale(fitC, fitC);
        g.translate(-midX, 0);
        // ground line
        g.strokeStyle = rgba(ctx.s.primary, 0.55);
        g.lineWidth = Math.max(1.5, m * 0.005) / fitC;
        g.beginPath();
        g.moveTo(minX - U * 1.2, 0);
        g.lineTo(maxX + U * 1.2, 0);
        g.stroke();
        // compression of each layer: own landing + smaller share of every later landing
        const sq = pieces.map((_, k) => {
          let s = 0;
          for (let j = k; j < n; j++) {
            const dt = lt - land[j];
            if (dt < 0 || dt > 1.5) continue;
            s += (j === k ? 0.2 : 0.05) * sqAmt * Math.max(0, damp(dt, 2.4, 7));
          }
          return clamp(s, -0.15, 0.3);
        });
        let base = 0;
        pieces.forEach((p, k) => {
          const bottom = -base; // y of this layer's bottom in stack space
          const dropStart = land[k] - FALL;
          // guide outline for the upcoming slot
          if (guides && lt > dropStart - 0.35 && lt < land[k]) {
            const a = clamp((lt - dropStart + 0.35) / 0.3, 0, 1);
            g.save();
            g.translate(xs[k], bottom);
            g.setLineDash([U * 0.18, U * 0.14]);
            g.strokeStyle = rgba(p.col, 0.85 * a);
            g.lineWidth = Math.max(1, m * 0.003) / fitC;
            g.beginPath();
            piecePath(g, p);
            g.stroke();
            g.restore();
          }
          const s = sq[k];
          if (lt >= dropStart) {
            const fp = clamp((lt - dropStart) / FALL, 0, 1);
            const fall = (1 - fp * fp) * (ground + totalH * 0.2 + p.h * 2) / fitC;
            let lift = 0;
            let alpha = 1;
            const ex = lt - (exitStart + (n - 1 - k) * EXIT_STAGGER);
            if (ex > 0) {
              const e = easeIn3(clamp(ex / EXIT, 0, 1));
              lift = e * (ground + totalH) / fitC;
              alpha = 1 - e;
            }
            if (alpha > 0.002) {
              g.save();
              g.globalAlpha = alpha;
              g.translate(xs[k], bottom - fall - lift);
              g.scale(1 + s * 0.6, 1 - s);
              g.rotate(p.rot0 * (1 - easeIn3(fp)) * (fp < 1 ? 1 : 0));
              g.beginPath();
              piecePath(g, p);
              g.fillStyle = p.col;
              g.fill();
              g.restore();
            }
          }
          base += p.h * (1 - s);
        });
        g.restore();
      },
      { settle: exitStart - 0.2 },
    );
  },
});
