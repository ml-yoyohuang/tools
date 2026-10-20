import { defineEffect } from '../../engine/define';
import { roundRectPath } from '../../engine/shapes';
import { bool, canvasRuntime, clamp, num, rgba } from '../../engine/helpers';
import { hash2 } from '../../engine/random';
import { graphemes, isLatin, isSpace, phrases } from '../../engine/text';
import { cellLayout, fontOf, loadGlyphs } from './_util';

// Ported from kinetic-typography e28-slot-text (DOM reels + SVG blur → Canvas 2D).
// Each cell is a clipped window over a vertical reel [target, r_k … r_1, start]. The
// reel position (in cells) is y(p) = (k+1)·(1 − (1−p)^4) + 0.2·sin(π·clamp((p−0.7)/0.3))
// — a power4 stop with a small late overshoot that returns to exactly k+1, so the final
// glyph is always the target. Later cells spin longer and land in sequence. Velocity
// drives a vertical motion blur (several offset copies). Every cycle starts from the
// previous result, so looping through the phrases is seamless.
const POOL_CJK = '福祿壽喜財吉利大發旺金星運樂安康順好富貴春滿';
const POOL_LAT = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';

export default defineEffect({
  id: 'slot-text',
  code: 'T11',
  nameZh: '拉霸文字',
  nameEn: 'Slot Text',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '每個字格裡的字像拉霸機一樣垂直高速滾動，逐格減速停靠，最後停在正確的字上。',
  tags: ['拉霸', '滾動', '減速', '揭曉', 'slot'],
  suitable: ['抽獎揭曉', '數字公布', '遊戲化標語'],
  principle:
    'Canvas 2D：每格以 clip 只露出一格高的視窗，視窗內是一條字帶 [目標字, 隨機字…, 起始字]。字帶位置 y(p) = (k+1)(1 − (1−p)^4) + 0.2·sin(π·clamp((p−0.7)/0.3))：power4 減速並在尾端小幅過衝後回到 k+1，所以停下的一定是目標字。第 i 格轉動時間 = spin + i·stagger，依序停靠；速度越快，同一格疊畫越多條垂直偏移的半透明副本（動態模糊）。隨機字以 seed 雜湊，中文格用中文字池、英數格用英數字池。',
  defaultText: '大吉利／WIN 777',
  palette: 'STREET',
  controls: ['text', 'font', 'weight', 'intensity', 'scale', 'secondary', 'accent', 'seed'],
  maxChars: 24,
  loopable: true,
  textHint: '用「／」分隔多組字，每次拉霸停在下一組。',
  params: [
    { key: 'spin', label: '轉動秒數', type: 'range', min: 0.8, max: 4, step: 0.1, default: 1.6, unit: 's' },
    { key: 'stagger', label: '依序停止間隔', type: 'range', min: 0, max: 0.8, step: 0.02, default: 0.28, unit: 's' },
    { key: 'hold', label: '停留秒數', type: 'range', min: 0.5, max: 4, step: 0.1, default: 1.8, unit: 's' },
    { key: 'blur', label: '動態模糊', type: 'toggle', default: true },
  ],
  recipe: {
    enter: '開始前字帶先向上微頂 0.35s（預備動作）。',
    motion: '每格字帶以約 16 格／秒的速度滾動，依 power4.out 減速，各格停止時間依序錯開 stagger 秒；滾動中有垂直動態模糊。',
    hold: '每格停靠時視窗彈一下、上方指示燈亮起；全部停好後停留 hold 秒（預設 1.8s）。',
    exit: '下一輪從目前的字開始滾動。',
    loop: '每輪停在下一組字，最後一組後回到第一組。',
  },
  accept: [
    '每格的字垂直滾動並逐格減速停下。',
    '最終顯示的文字與輸入完全一致（含 emoji）。',
    '各格依序停靠，停靠時指示燈亮起。',
    '多組字時每輪停在下一組。',
  ],
  transparent: true,
  cycle: 5.6,
  posterTime: 4.2,
  legacyIds: ['slot-text'],
  async create(ctx) {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: paper, secondary: cab, accent: lampC, background: ink } = ctx.s;
    const spin = num(ctx, 'spin', 1.6);
    const blurOn = bool(ctx, 'blur', true);
    const holdT = num(ctx, 'hold', 1.8);
    const k = clamp(ctx.s.intensity, 0.2, 2);
    const states = phrases(ctx.text).map((p) => graphemes(p));
    const n = Math.max(...states.map((s) => s.length));
    const S = states.length;
    const at = (s: number, i: number) => states[((s % S) + S) % S][i] ?? ' ';
    const empty = Array.from({ length: n }, (_, i) => states.every((s) => isSpace(s[i] ?? ' ')));
    const latinCell = Array.from({ length: n }, (_, i) => states.some((s) => isLatin(s[i] ?? '')));

    const aspect = 1.28;
    const G = cellLayout(empty, W, H, { aspect, gap: 0.14, rowGap: 0.14 * 2.2, maxRows: 5, wFrac: 0.84, hFrac: 0.62 });
    const cw = G.cw * clamp(ctx.s.scale, 0.6, 1.2);
    const ch = cw * aspect;
    const gap = cw * 0.14;
    const fs = cw * 0.66;
    const font = fontOf(ctx, fs);
    await loadGlyphs(font, POOL_CJK + POOL_LAT + ctx.text);

    const stagger = Math.min(num(ctx, 'stagger', 0.28), n > 1 ? 2.4 / (n - 1) : 1);
    const lead = 0.35;
    const rate = 16 * k;
    const rowsN = G.rows.length;
    const maxCols = Math.max(...G.rows.map((r) => r.length));
    const rowGap = gap * 2.2;
    const cabW = maxCols * cw + (maxCols - 1) * gap + cw * 0.5;
    const cabH = rowsN * ch + (rowsN - 1) * rowGap + cw * 0.62;
    const top0 = (H - (rowsN * ch + (rowsN - 1) * rowGap)) / 2 + cw * 0.08;

    interface Cell {
      i: number;
      x: number;
      y: number;
      steps: number;
      dur: number;
    }
    const cells: Cell[] = [];
    G.rows.forEach((row, ri) => {
      const rw = row.length * cw + (row.length - 1) * gap;
      row.forEach((idx, si) => {
        if (idx < 0) return;
        const order = cells.length;
        const dur = spin + order * stagger;
        cells.push({ i: idx, x: (W - rw) / 2 + si * (cw + gap), y: top0 + ri * (ch + rowGap), steps: Math.max(4, Math.round(dur * rate * 0.7)), dur });
      });
    });
    const cycleDur = lead + spin + Math.max(0, cells.length - 1) * stagger + holdT;
    const settle = lead + spin + Math.max(0, cells.length - 1) * stagger + 0.6;
    const pick = (i: number, r: number, c: number) => {
      const pool = latinCell[i] ? POOL_LAT : POOL_CJK;
      return pool[Math.floor(hash2(i * 53 + r, c * 17 + 5, ctx.seed) * pool.length)];
    };
    const reelPos = (steps: number, p: number) => (steps + 1) * (1 - Math.pow(1 - p, 4)) + 0.2 * Math.sin(Math.PI * clamp((p - 0.7) / 0.3, 0, 1));
    let shadeGrad: CanvasGradient | null = null;
    let glassGrad: CanvasGradient | null = null;

    return canvasRuntime(
      ctx,
      (g, t) => {
        const c = Math.floor(t / cycleDur);
        const local = t - c * cycleDur;
        // cabinet
        g.fillStyle = cab;
        roundRectPath(g, (W - cabW) / 2, (H - cabH) / 2, cabW, cabH, cw * 0.18);
        g.fill();
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.font = font;
        if (!shadeGrad) {
          shadeGrad = g.createLinearGradient(0, 0, 0, ch);
          shadeGrad.addColorStop(0, 'rgba(0,0,0,.38)');
          shadeGrad.addColorStop(0.26, 'rgba(0,0,0,0)');
          shadeGrad.addColorStop(0.74, 'rgba(0,0,0,0)');
          shadeGrad.addColorStop(1, 'rgba(0,0,0,.38)');
          glassGrad = g.createLinearGradient(0, ch * 0.07, 0, ch * 0.23);
          glassGrad.addColorStop(0, 'rgba(255,255,255,.35)');
          glassGrad.addColorStop(1, 'rgba(255,255,255,0)');
        }
        for (const cell of cells) {
          const total = cell.steps + 2;
          const start = c === 0 ? pick(cell.i, 999, 0) : at(c - 1, cell.i);
          const item = (j: number) => (j <= 0 ? at(c, cell.i) : j >= total - 1 ? start : pick(cell.i, j, c));
          let y: number;
          let v = 0;
          if (local < lead) y = -0.14 * Math.sin((Math.PI * local) / lead) * k;
          else {
            const pc = clamp((local - lead) / cell.dur, 0, 1);
            y = reelPos(cell.steps, pc);
            if (pc < 1) v = (reelPos(cell.steps, clamp(pc + 0.004, 0, 1)) - y) / (0.004 * cell.dur);
          }
          const idx = total - 1 - y;
          const since = local - lead - cell.dur;
          const pop = since > 0 ? Math.exp(-since * 7) * Math.sin(since * 22) * 0.05 : 0;
          // lamp
          const lit = since > 0;
          g.fillStyle = lit ? lampC : rgba(lampC, 0.2);
          g.beginPath();
          g.arc(cell.x + cw / 2, cell.y - cw * 0.15, cw * 0.05, 0, Math.PI * 2);
          g.fill();
          g.save();
          g.translate(cell.x + cw / 2, cell.y + ch / 2);
          g.scale(1 + pop, 1 + pop);
          g.translate(-cw / 2, -ch / 2);
          roundRectPath(g, 0, 0, cw, ch, cw * 0.1);
          g.fillStyle = paper;
          g.fill();
          g.clip();
          g.fillStyle = ink;
          const blurPx = blurOn ? clamp(Math.abs(v) * ch * 0.012, 0, ch * 0.45) : 0;
          const K = blurPx > 1 ? 4 : 1;
          const j0 = Math.floor(idx) - 1;
          for (let s = 0; s < K; s++) {
            const off = K > 1 ? (s / (K - 1) - 0.5) * blurPx : 0;
            g.globalAlpha = K > 1 ? 0.36 : 1;
            for (let j = j0; j <= j0 + 3; j++) {
              if (j < 0 || j > total - 1) continue;
              const yy = (j - idx) * ch + ch / 2 + off;
              if (yy < -ch || yy > ch * 2) continue;
              g.fillText(item(j), cw / 2, yy + fs * 0.04);
            }
          }
          g.globalAlpha = 1;
          g.fillStyle = shadeGrad!;
          g.fillRect(0, 0, cw, ch);
          g.fillStyle = glassGrad!;
          roundRectPath(g, cw * 0.06, ch * 0.07, cw * 0.88, ch * 0.16, cw * 0.08);
          g.fill();
          g.restore();
        }
      },
      { settle },
    );
  },
});
