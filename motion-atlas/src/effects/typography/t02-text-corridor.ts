import { defineEffect } from '../../engine/define';
import { el } from '../../engine/dom';
import { usableWeight } from '../../engine/fonts';
import { clamp, easeInOut, minSide, mod, num, smoothstep, TAU } from '../../engine/helpers';
import { fontString, phrases, textWidth } from '../../engine/text';

// Ported from kinetic-typography e18-text-corridor (CSS preserve-3d).
// The cross-section is slightly larger than the stage, so the CSS perspective eye
// stands inside it. N segments (floor: one huge word, walls: rows of text running
// into depth, ceiling: fine print + a light panel) sit in a ring along −Z:
//   front_j = −((j·L − travel) mod N·L)
// A segment only wraps once it is behind the eye / fully faded at the far end, so
// the forward motion is endless. travel(t) steps one segment per beat with an
// easeInOut and a pause, so the floor word right in front can be read.
export default defineEffect({
  id: 'text-corridor',
  code: 'T02',
  nameZh: '文字走廊',
  nameEn: 'Text Corridor',
  category: 'typography',
  sourceType: 'reference',
  difficulty: 'advanced',
  renderer: 'css3d',
  description: '地板、兩側牆面與天花板全由文字構成的立體長廊，鏡頭一節一節向前推進。',
  tags: ['3D', '走廊', '透視', '沉浸', 'corridor'],
  suitable: ['MV 視覺', '展演開場', '沉浸式背景'],
  principle:
    'CSS 3D：容器設 perspective，世界節點 preserve-3d；每節走廊由 4 個平面組成——地板 rotateX(90°)、天花板 rotateX(−90°)、左右牆 rotateY(±90°)，各平面上是真正的文字列。N 節沿 −Z 排成環，第 j 節 translateZ = 0.9L − ((jL − travel) mod NL)，遠端以透明度淡出、穿過鏡頭後才回到最遠處。travel(t) 每節先停頓再以 easeInOut 前進一節，鏡頭帶輕微晃動。',
  defaultText: 'MOTION／ATLAS／前進',
  palette: 'STREET',
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'secondary', 'accent'],
  maxChars: 30,
  textHint: '用「／」分隔多個詞，每節走廊輪流使用。',
  params: [
    { key: 'depth', label: '透視深度', type: 'range', min: 0.5, max: 2, step: 0.05, default: 1, hint: '數值越小透視越強烈' },
    { key: 'segments', label: '走廊節數', type: 'range', min: 6, max: 14, step: 1, default: 10 },
    { key: 'pause', label: '每節停頓', type: 'range', min: 0, max: 0.7, step: 0.05, default: 0.35, hint: '0 = 等速前進' },
    { key: 'sway', label: '鏡頭晃動', type: 'range', min: 0, max: 1, step: 0.05, default: 0.4 },
  ],
  recipe: {
    enter: '進場即站在走廊內，遠端淡出於消失點光源。',
    motion: '鏡頭沿 −Z 每拍前進一節（easeInOut），牆面文字列向後掠過，地板大字從腳下穿過；鏡頭有輕微上下與偏航晃動。',
    hold: '每節之間停頓（預設 35% 拍長），正前方地板的詞清楚可讀。',
    exit: '經過鏡頭的節點移到最遠處重新淡入。',
    loop: '節點以 mod 環狀排列，無限前進沒有跳動。',
  },
  accept: [
    '同時看得到地板、左右牆與天花板四個文字平面，並有明顯透視收斂。',
    '鏡頭前進時牆面文字列向後掠過，遠處的節淡出。',
    '每次前進後短暫停頓，地板上的詞可讀。',
    '調整透視深度時收斂程度改變。',
  ],
  limits: ['CSS 3D：不支援 PNG / WebM 匯出；極舊瀏覽器若不支援 preserve-3d 會變平面。'],
  cycle: 8,
  posterTime: 1.6,
  legacyIds: ['text-corridor'],
  create(ctx) {
    const W = ctx.width;
    const H = ctx.height;
    const { primary: fg, secondary: acc, accent: lit, background: bg } = ctx.s;
    const words = phrases(ctx.text);
    const sway = num(ctx, 'sway', 0.4);
    const pause = num(ctx, 'pause', 0.35);
    const Wc = W * 1.16;
    const Hc = H * 1.14;
    const P = minSide(ctx) * 0.95 * num(ctx, 'depth', 1);
    const L = Math.min(Math.max(Wc, Hc) * 0.62, P * 0.8);
    let N = Math.round(num(ctx, 'segments', 10) * (ctx.mode === 'card' ? 0.8 : 1));
    if (N % 2) N += 1;
    const far = N * L;
    const beat = 1.5 / Math.max(0.1, ctx.s.intensity);
    const fam = ctx.family;
    const mono = ctx.font.mono;
    const heavy = ctx.weight;
    const light = usableWeight(ctx.s.font, 300);
    const tr = ctx.s.tracking;
    const fsc = ctx.s.scale;

    const viewport = el('div', { style: { position: 'absolute', inset: '0', perspective: `${P}px`, perspectiveOrigin: '50% 50%', overflow: 'hidden' } }, ctx.root);
    el(
      'div',
      {
        style: {
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: `${minSide(ctx) * 0.9}px`,
          height: `${minSide(ctx) * 0.9}px`,
          transform: 'translate(-50%,-50%)',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${lit}99 0%, ${lit}22 20%, ${lit}00 60%)`,
        },
      },
      viewport,
    );
    const world = el('div', { style: { position: 'absolute', left: '50%', top: '50%', width: '0', height: '0', transformStyle: 'preserve-3d' } }, viewport);

    const plane = (parent: HTMLElement, w: number, h: number, transform: string, style: Record<string, string | number> = {}) =>
      el(
        'div',
        {
          style: {
            position: 'absolute',
            left: `${-w / 2}px`,
            top: `${-h / 2}px`,
            width: `${w}px`,
            height: `${h}px`,
            transform,
            overflow: 'hidden',
            backfaceVisibility: 'hidden',
            ...style,
          },
        },
        parent,
      );

    // a row of whole text units spread across `len` px (no glyph cut at seams)
    const row = (parent: HTMLElement, word: string, len: number, size0: number, family: string, weight: number, color: string, opacity: number, gapEm = 1.2) => {
      const size = Math.max(4, Math.min(size0, (len * 0.92 * 100) / Math.max(1, textWidth(word, 100, family, weight, tr) + 100 * gapEm * 0.5)));
      const unitW = textWidth(word, size, family, weight, tr) + size * gapEm;
      const n = Math.max(1, Math.floor(len / unitW));
      const r = el('div', { style: { display: 'flex', justifyContent: 'space-evenly', alignItems: 'center', width: `${len}px`, height: `${size * 1.25}px`, flex: 'none' } }, parent);
      for (let i = 0; i < n; i++) el('span', { text: word, style: { font: fontString(size, family, weight), letterSpacing: `${tr}em`, color, opacity, whiteSpace: 'pre', lineHeight: '1' } }, r);
      return r;
    };

    const rib = `${Math.max(1, minSide(ctx) * 0.006)}px solid ${acc}`;
    const wallRows = [
      { size: Hc * 0.045, family: mono, weight: 500, color: acc, opacity: 0.85 },
      { size: Hc * 0.13 * fsc, family: fam, weight: heavy, color: fg, opacity: 0.95 },
      { size: Hc * 0.13 * fsc, family: fam, weight: light, color: fg, opacity: 0.55 },
      { size: Hc * 0.045, family: mono, weight: 500, color: fg, opacity: 0.6 },
    ];

    const slots: { seg: HTMLDivElement; planes: HTMLDivElement[] }[] = [];
    for (let j = 0; j < N; j++) {
      const odd = j % 2 === 1;
      const word = words[j % words.length];
      const seg = el('div', { style: { position: 'absolute', left: '0', top: '0', transformStyle: 'preserve-3d', willChange: 'transform' } }, world);
      const floorFs = Math.min((Wc * 0.78 * 100) / Math.max(1, textWidth(word, 100, fam, heavy, tr)), L * 0.55) * fsc;
      const floor = plane(seg, Wc, L, `translate3d(0,${Hc / 2}px,${-L / 2}px) rotateX(90deg)`, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: rib,
        background: `linear-gradient(0deg, ${fg}14, ${fg}00 60%)`,
      });
      el('div', { text: word, style: { font: fontString(floorFs, fam, heavy), letterSpacing: `${tr}em`, color: odd ? acc : fg, whiteSpace: 'pre', lineHeight: '1' } }, floor);
      el('div', { text: String((j % 99) + 1).padStart(2, '0'), style: { position: 'absolute', left: `${Wc * 0.06}px`, bottom: `${L * 0.08}px`, font: fontString(Hc * 0.05, mono, 700), color: lit, opacity: 0.8 } }, floor);
      const ceil = plane(seg, Wc, L, `translate3d(0,${-Hc / 2}px,${-L / 2}px) rotateX(-90deg)`, {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-evenly',
        alignItems: 'center',
        borderTop: rib,
      });
      el('div', { style: { position: 'absolute', left: '50%', top: '50%', width: `${Wc * 0.22}px`, height: `${L * 0.5}px`, transform: 'translate(-50%,-50%)', background: lit, opacity: 0.22, borderRadius: `${Wc * 0.01}px` } }, ceil);
      const ceilRows = Math.max(4, Math.round(9 * Math.max(0.6, ctx.q)));
      for (let r = 0; r < ceilRows; r++) row(ceil, word, Wc * 0.96, Math.max(5, Hc * 0.026), mono, 400, fg, r % 3 === 1 ? 0.75 : 0.4, 2.2);
      const walls: HTMLDivElement[] = [];
      for (const side of [-1, 1]) {
        const wall = plane(seg, L, Hc, `translate3d(${(side * Wc) / 2}px,0,${-L / 2}px) rotateY(${-side * 90}deg)`, {
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-evenly',
          alignItems: 'center',
          [side < 0 ? 'borderLeft' : 'borderRight']: rib,
          background: `linear-gradient(${side < 0 ? 90 : 270}deg, ${bg}00, ${fg}0D)`,
        });
        wallRows.forEach((R, ri) => row(wall, word, L * 0.94, R.size, R.family, R.weight, odd && ri === 1 ? acc : R.color, R.opacity, ri === 1 || ri === 2 ? 0.9 : 2));
        walls.push(wall);
      }
      slots.push({ seg, planes: [floor, ceil, ...walls] });
    }
    el('div', { style: { position: 'absolute', inset: '0', pointerEvents: 'none', background: `radial-gradient(ellipse at 50% 50%, ${bg}00 40%, ${bg}99 100%)` } }, ctx.root);

    // stepped travel: rest `pause` of each beat, then move one segment
    const travelAt = (t: number) => {
      const k = Math.floor(t / beat);
      const u = (t - k * beat) / beat;
      const m = pause > 0 ? clamp((u - pause) / (1 - pause), 0, 1) : u;
      return (k + (pause > 0 ? easeInOut(m) : m)) * L;
    };
    const lastOp = new Array<number>(N).fill(-1);

    return {
      render(t) {
        const travel = travelAt(t);
        const bobY = Math.sin(t * TAU * 0.9) * H * 0.008 * sway;
        const bobX = Math.sin(t * TAU * 0.45) * W * 0.012 * sway;
        const yaw = Math.sin((t * TAU) / 9) * 2.2 * sway;
        const roll = Math.sin((t * TAU) / 7 + 1) * 0.8 * sway;
        world.style.transform = `translate3d(${bobX}px,${bobY}px,0) rotateZ(${roll}deg) rotateY(${yaw}deg)`;
        for (let j = 0; j < N; j++) {
          const d = mod(j * L - travel, far);
          const s = slots[j];
          s.seg.style.transform = `translate3d(0,0,${L * 0.9 - d}px)`;
          const o = Math.round(clamp(1 - smoothstep(far * 0.38, far * 0.92, d), 0, 1) * 1000) / 1000;
          if (o !== lastOp[j]) {
            lastOp[j] = o;
            for (const p of s.planes) {
              p.style.opacity = String(o);
              p.style.visibility = o > 0.002 ? 'visible' : 'hidden';
            }
          }
        }
      },
    };
  },
});
