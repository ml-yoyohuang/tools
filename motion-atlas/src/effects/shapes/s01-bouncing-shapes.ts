import { defineEffect } from '../../engine/define';
import { C } from '../../engine/palette';
import { canvasRuntime, clamp, easeIn3, minSide, mod, num, TAU } from '../../engine/helpers';
import { angDiff, bottomExtent, shapePath, type Kind } from './_util';

const DT = 1 / 60;
const CYCLE = 8;
const KINDS: Kind[] = ['circle', 'square', 'triangle'];

interface Body {
  kind: Kind;
  r: number;
  bot: number;
  /** collision radius (shape–shape) */
  rc: number;
  spawn: number;
  x0: number;
  vx0: number;
  av0: number;
  col: number;
  // state
  live: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  a: number;
  av: number;
  /** squash amount (+ = flatter) and its velocity */
  s: number;
  sv: number;
}

export default defineEffect({
  id: 'bouncing-shapes',
  code: 'S01',
  nameZh: '彈跳圖形',
  nameEn: 'Bouncing Shapes',
  category: 'shapes',
  sourceType: 'reference',
  difficulty: 'intermediate',
  renderer: 'canvas',
  description: '圓、方、三角依序落下，落地與互撞時壓扁再回彈，能量逐次衰減直到靜止。',
  tags: ['彈跳', 'bounce', 'squash & stretch', '物理', '幾何'],
  suitable: ['載入畫面', '兒童／遊戲品牌', '社群短片開場'],
  principle:
    'Canvas 2D + 固定步長（1/60 s）模擬：重力積分、地面以「形狀底部距離」做位置夾限並反轉速度乘恢復係數（不會穿透地面）；圖形之間以圓形近似做位置分離與法向速度交換。每次撞擊把撞擊速度注入一個阻尼彈簧，彈簧值以「著地點為錨」的非等比縮放呈現 squash／stretch；落地後方形與三角形的角度以彈簧對齊到最近的穩定角。',
  defaultText: '',
  palette: 'POP',
  colors: { background: C.cream, primary: C.blue, secondary: C.red, accent: C.black },
  controls: ['scale', 'secondary', 'accent', 'seed'],
  params: [
    { key: 'count', label: '圖形數量', type: 'range', min: 3, max: 14, step: 1, default: 8 },
    { key: 'bounce', label: '彈性（恢復係數）', type: 'range', min: 0.15, max: 0.85, step: 0.05, default: 0.6 },
    { key: 'squash', label: '壓扁程度', type: 'range', min: 0, max: 1.5, step: 0.05, default: 0.8 },
    { key: 'gravity', label: '重力', type: 'range', min: 0.5, max: 2, step: 0.1, default: 1 },
  ],
  recipe: {
    enter: '圖形每 0.3 秒一個從舞台上方落下，空中沿速度方向略為拉長。',
    motion: '著地瞬間以底部為錨壓扁再回彈；互撞時互相推開；每次反彈高度依恢復係數遞減。',
    hold: '能量耗盡後全部靜止在地面上，方形／三角形轉正平放。',
    exit: '循環尾段圖形依序縮小消失（不穿過地面）。',
    loop: '每 8 秒重新落下一輪，同一 seed 位置相同。',
  },
  accept: [
    '圖形落地時有明顯壓扁與回彈，之後彈跳高度逐次降低至靜止。',
    '任何速度下圖形底部都不會低於地面線。',
    '彈性調到最低時幾乎不反彈，調高時反彈多次。',
    '壓扁程度為 0 時圖形保持原比例。',
  ],
  limits: ['圖形之間的碰撞以圓形近似，方形與三角形的角可能略為重疊。'],
  transparent: true,
  cycle: CYCLE,
  posterTime: 4.2,
  create(ctx) {
    const { width: w, height: h } = ctx;
    const m = minSide(ctx);
    const count = Math.max(3, Math.round(num(ctx, 'count', 8) * (ctx.q < 0.6 ? 0.75 : 1)));
    const e = num(ctx, 'bounce', 0.6);
    const squashAmt = num(ctx, 'squash', 0.8);
    const grav = m * 3.4 * num(ctx, 'gravity', 1);
    const floor = h * 0.86;
    const baseR = m * 0.07 * ctx.s.scale;
    const pad = Math.max(8, m * 0.04);
    const colors = [ctx.s.primary, ctx.s.secondary, ctx.s.accent];
    const bodies: Body[] = [];
    for (let i = 0; i < count; i++) {
      const kind = KINDS[i % 3];
      const r = baseR * (0.8 + ctx.rand() * 0.55);
      const bot = bottomExtent(kind, r);
      bodies.push({
        kind,
        r,
        bot,
        rc: kind === 'triangle' ? r * 0.8 : r * 0.95,
        spawn: 0.15 + i * 0.3,
        x0: pad + r + ctx.rand() * Math.max(1, w - 2 * (pad + r)),
        vx0: (ctx.rand() - 0.5) * m * 0.5,
        av0: (ctx.rand() - 0.5) * 5,
        col: i % 2 === 0 ? 0 : i % 3 === 1 ? 1 : 2,
        live: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        a: 0,
        av: 0,
        s: 0,
        sv: 0,
      });
    }
    let cycleIdx = -1;
    let steps = 0;
    const init = () => {
      for (const b of bodies) {
        b.live = false;
        b.s = b.sv = 0;
      }
      steps = 0;
    };
    const kick = (b: Body, speed: number) => {
      b.sv += (speed / m) * 4 * squashAmt;
    };
    const simStep = () => {
      steps++;
      const lt = steps * DT;
      for (const b of bodies) {
        if (!b.live && lt >= b.spawn) {
          b.live = true;
          b.x = b.x0;
          b.y = -b.r * 1.6;
          b.vx = b.vx0;
          b.vy = m * 0.2;
          b.a = 0;
          b.av = b.av0;
        }
      }
      for (const b of bodies) {
        if (!b.live) continue;
        b.vy += grav * DT;
        b.vx *= 0.999;
        b.x += b.vx * DT;
        b.y += b.vy * DT;
        b.a += b.av * DT;
        // floor: clamp position, reflect velocity — never tunnels at any speed
        const onFloor = b.y + b.bot >= floor - 0.5;
        if (b.y + b.bot > floor) {
          b.y = floor - b.bot;
          if (b.vy > 0) {
            const impact = b.vy;
            const bounce = impact > m * 0.25;
            b.vy = bounce ? -impact * e : 0;
            if (bounce) {
              b.vx *= 0.82;
              kick(b, impact);
            }
          }
        }
        if (onFloor) {
          if (b.kind === 'circle') b.av = b.vx / b.r;
          else {
            const stable = b.kind === 'square' ? Math.PI / 2 : TAU / 3;
            const target = Math.round(b.a / stable) * stable;
            b.av += (angDiff(b.a, target) * 160 - b.av * 14) * DT;
            b.vx *= 0.96;
          }
        } else b.av *= 0.995;
        // walls
        if (b.x - b.rc < 0) {
          b.x = b.rc;
          b.vx = Math.abs(b.vx) * e;
        } else if (b.x + b.rc > w) {
          b.x = w - b.rc;
          b.vx = -Math.abs(b.vx) * e;
        }
      }
      // shape–shape (circle approximation), two relaxation passes
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < bodies.length; i++) {
          const A = bodies[i];
          if (!A.live) continue;
          for (let j = i + 1; j < bodies.length; j++) {
            const B = bodies[j];
            if (!B.live) continue;
            const dx = B.x - A.x;
            const dy = B.y - A.y;
            const min = A.rc + B.rc;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min || d2 < 1e-6) continue;
            const d = Math.sqrt(d2);
            const nx = dx / d;
            const ny = dy / d;
            const over = min - d;
            A.x -= nx * over * 0.5;
            A.y -= ny * over * 0.5;
            B.x += nx * over * 0.5;
            B.y += ny * over * 0.5;
            const rv = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
            if (rv < 0 && pass === 0) {
              const jmp = (-(1 + e * 0.8) * rv) / 2;
              A.vx -= jmp * nx;
              A.vy -= jmp * ny;
              B.vx += jmp * nx;
              B.vy += jmp * ny;
              if (-rv > m * 0.3) {
                kick(A, -rv * 0.6 * Math.abs(ny));
                kick(B, -rv * 0.6 * Math.abs(ny));
              }
              A.av -= rv * nx * 0.004;
              B.av += rv * nx * 0.004;
            }
          }
          // keep above the floor after separation
          if (A.y + A.bot > floor) A.y = floor - A.bot;
        }
      }
      for (const b of bodies) {
        if (!b.live) continue;
        if (b.y + b.bot > floor) b.y = floor - b.bot;
        // squash spring
        b.sv += (-b.s * 520 - b.sv * 15) * DT;
        b.s = clamp(b.s + b.sv * DT, -0.3, 0.42);
      }
    };
    const reset = () => {
      cycleIdx = -1;
      init();
    };
    reset();
    const rt = canvasRuntime(ctx, (g, t) => {
      const lt = mod(t, CYCLE);
      // floor line
      g.strokeStyle = ctx.s.accent;
      g.lineWidth = Math.max(1.5, m * 0.006);
      g.beginPath();
      g.moveTo(pad, floor + g.lineWidth / 2);
      g.lineTo(w - pad, floor + g.lineWidth / 2);
      g.stroke();
      const exitStart = CYCLE - 1.4;
      bodies.forEach((b, i) => {
        if (!b.live) return;
        let k = 1;
        if (lt > exitStart) k = 1 - easeIn3(clamp((lt - exitStart - i * 0.06) / 0.5, 0, 1));
        if (k <= 0.001) return;
        // air stretch along the vertical velocity, squash spring on contact
        const air = b.y + b.bot < floor - 1 ? clamp(Math.abs(b.vy) / (m * 9), 0, 0.14) * squashAmt : 0;
        const s = b.s - air;
        const sy = 1 - s;
        const sx = 1 + s * 0.85;
        g.save();
        g.translate(b.x, b.y + b.bot);
        g.scale(sx * k, sy * k);
        g.translate(0, -b.bot);
        g.rotate(b.a);
        g.beginPath();
        shapePath(g, b.kind, b.r);
        g.fillStyle = colors[b.col];
        g.fill();
        g.restore();
      });
    });
    return {
      ...rt,
      reset,
      step(t) {
        const ci = Math.floor(t / CYCLE + 1e-9);
        if (ci !== cycleIdx) {
          cycleIdx = ci;
          init();
        }
        const target = Math.floor((t - ci * CYCLE) / DT + 1e-6);
        let guard = 600;
        while (steps < target && guard-- > 0) simStep();
      },
    };
  },
});
