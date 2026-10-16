/* 01 — Typographic Choreography
 * 間 (ma) is 門 (gate) with 日 (sun) inside it: a piece of architecture and an interval of time
 * in a single character. The piece builds it, takes it apart and lets it find itself again.
 */
(() => {
  const { ease: E, track, tw, seg, clamp, lerp } = Motion;
  const D = 18;
  const PAPER = '#ECE9E2', INK = '#141414', RED = '#DB4227';
  const F_GATE = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
  const F_LAT = 'Archivo, "Helvetica Neue", Arial, sans-serif';
  const F_MICRO = '"Inter Tight", "Helvetica Neue", Arial, sans-serif';
  const F_POEM = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif';
  const POEM = '文字は、時間の中に建つ。';

  const stage = document.getElementById('stage');
  const cv = Motion.canvas(stage, { alpha: true });
  const ctx = cv.ctx;
  const probe = document.createElement('canvas').getContext('2d');

  let W = 0, H = 0, L = null;
  const metric = (font, s) => { probe.font = font; return probe.measureText(s); };

  function layout() {
    const portrait = W / H < 0.95;
    const o = { portrait };
    /* gate */
    /* in a tall frame the gate is sized by width, but never taller than half the page */
    o.Gs = portrait ? Math.min(W * 0.93, H * 0.52) : Math.min(H * 0.84, W * 0.66);
    const g = metric(`900 ${o.Gs}px ${F_GATE}`, '門');
    o.gw = g.actualBoundingBoxLeft + g.actualBoundingBoxRight;
    o.gh = g.actualBoundingBoxAscent + g.actualBoundingBoxDescent;
    o.xL = portrait ? (W - o.gw) / 2 : W * 0.07;
    o.yB = portrait ? H * 0.62 : H * 0.915;
    o.gDrawX = o.xL + g.actualBoundingBoxLeft;
    o.gBase = o.yB - g.actualBoundingBoxDescent;
    o.gcx = o.xL + o.gw / 2;
    o.gTop = o.yB - o.gh;
    /* composition A: the halves pushed apart */
    o.Ax = portrait ? -o.gw * 0.31 : -W * 0.04;
    o.Bx = portrait ? o.gw * 0.31 : W * 0.965 - (o.xL + o.gw);
    o.X = o.gw * 0.27; /* composition B: how far the halves pass through each other */
    /* sun 日 */
    o.Ss = o.gh * 0.335;
    const s = metric(`900 ${o.Ss}px ${F_GATE}`, '日');
    o.sw = s.actualBoundingBoxLeft + s.actualBoundingBoxRight;
    o.sh = s.actualBoundingBoxAscent + s.actualBoundingBoxDescent;
    o.sAL = s.actualBoundingBoxLeft; o.sAA = s.actualBoundingBoxAscent;
    o.sunCx = o.gcx + o.gw * 0.004;
    o.sunCy = o.yB - o.gh * 0.385;
    /* seed square */
    o.seed = Math.max(7, Math.min(W, H) * 0.017);
    o.seedX = o.sunCx; o.seedY = o.sunCy;
    /* micro typography */
    o.m = Math.max(9, Math.min(W, H) * 0.0122);
    /* right column (landscape) or lower band (portrait) */
    if (portrait) {
      o.colX = W * 0.36;
      o.capSize = W * 0.088;
      o.capY = o.yB + H * 0.115;
      o.poemX = W * 0.17;
      o.poemY = o.yB + H * 0.06;
      o.poemSize = Math.min(W * 0.05, H * 0.022);
      o.vLineX = W * 0.295;
      o.microX = W * 0.6; o.microY = Math.max(64, H * 0.085);
    } else {
      /* the right column always starts a clear gap after the gate, whatever the frame's proportion */
      o.colX = Math.max(W * 0.705, o.xL + o.gw + W * 0.065);
      o.capSize = Math.min(H * 0.062, W * 0.04);
      o.capY = o.yB - o.gh * 0.66;
      o.poemX = W * 0.905;
      o.poemY = o.gTop;
      o.poemSize = Math.min(H * 0.033, W * 0.022);
      o.vLineX = o.colX - W * 0.022;
      o.microX = o.colX; o.microY = H * 0.085;
    }
    /* the void of composition A, where SPACE lives */
    /* both halves are split on the gate's axis, so the void runs between the two moved split lines */
    const voidL = o.gcx + o.Ax, voidR = o.gcx + o.Bx;
    o.voidL = voidL; o.voidR = voidR;
    const sp1 = metric(`800 100px ${F_LAT}`, 'SPACE');
    o.spSize = Math.min(H * 0.16, ((voidR - voidL) * 0.8) / (sp1.width / 100));
    o.spBase = portrait ? o.gTop + o.gh * 0.88 : o.yB - o.gh * 0.08;
    /* TIME: very large and extra condensed */
    o.tmSize = portrait ? W * 0.62 : H * 0.62;
    o.tmBase = portrait ? o.gTop + o.gh * 0.86 : H * 0.8;
    /* per-letter advances for SPACE and TIME at any size (store at 100px) */
    o.spAdv = letters('SPACE', `800 100px ${F_LAT}`);
    o.tmAdv = letters('TIME', `900 extra-condensed 100px ${F_LAT}`);
    o.capW = o.spAdv.total * o.capSize;
    /* TIME in the caption is justified to the exact width of SPACE above it */
    o.tcSize = o.capW / o.tmAdv.total;
    const tCap = metric(`900 extra-condensed ${o.tcSize}px ${F_LAT}`, 'T').actualBoundingBoxAscent;
    o.tcBase = o.capY + o.capSize * 0.2 + tCap;
    return o;
  }
  function letters(word, font) {
    const out = [];
    let x = 0;
    for (let i = 0; i < word.length; i++) {
      const w = metric(font, word.slice(0, i + 1)).width;
      out.push({ ch: word[i], x0: x / 100, x1: w / 100 });
      x = w;
    }
    out.total = x / 100;
    return out;
  }

  /* ---------- timeline ---------- */
  const MOVES = [
    [0, 'I', 'Silence'], [2.4, 'II', 'Entrance'], [5.6, 'III', 'Collision'],
    [9.6, 'IV', 'Recomposition'], [13.0, 'V', 'Resolution'], [15.4, '—', 'Coda'],
  ];
  const gate = {};
  function buildTracks() {
    const o = L;
    const off = H * 1.12;
    gate.dxL = track([[0, o.Ax], [5.7, o.Ax], [8.7, o.X, E.inOutCubic], [9.5, o.X * 0.94, E.outSine], [11.3, 0, E.inOutQuint]]);
    gate.dxR = track([[0, o.Bx], [5.9, o.Bx], [8.8, -o.X, E.inOutCubic], [9.5, -o.X * 0.93, E.outSine], [11.25, 0, E.inOutQuint]]);
    gate.dyL = track([[0, off], [2.4, off], [3.5, 0, (x) => E.outBack(x, 0.9)], [15.6, 0], [16.55, off, E.inExpo], [D, off]]);
    gate.dyR = track([[0, -off], [2.85, -off], [3.95, 0, (x) => E.outBack(x, 0.9)], [15.85, 0], [16.8, -off, E.inExpo], [D, -off]]);
  }

  /* ---------- drawing helpers ---------- */
  function gateHalf(c, side, dx, dy) {
    const cut = L.gcx + dx;
    c.save();
    c.beginPath();
    if (side < 0) c.rect(-10, -10, cut + 10, H + 20);
    else c.rect(cut, -10, W - cut + 10, H + 20);
    c.clip();
    c.font = `900 ${L.Gs}px ${F_GATE}`;
    c.fillText('門', L.gDrawX + dx, L.gBase + dy);
    c.restore();
  }

  /* SPACE: its letters, choreographed one by one */
  function spaceLetters(t) {
    const o = L, adv = o.spAdv, n = adv.length;
    const out = [];
    const wordW = adv.total * o.spSize;
    const ax = (o.voidL + o.voidR) / 2 - wordW / 2;
    const capW = adv.total * o.capSize;
    for (let i = 0; i < n; i++) {
      const a = adv[i];
      /* entrance: slides out from behind the left pillar, leading letter first so no letter overtakes another */
      const ein = E.outQuint(seg(t, 3.7 + (n - 1 - i) * 0.11, 4.8 + (n - 1 - i) * 0.11));
      let x = ax + a.x0 * o.spSize;
      const hiddenX = o.voidL - (wordW - a.x0 * o.spSize) - o.spSize * 0.1;
      x = lerp(hiddenX, x, ein);
      let y = o.spBase, size = o.spSize;
      /* collision: the word is squeezed, letters slide into each other */
      const sq = E.inOutCubic(seg(t, 6.0 + i * 0.12, 8.6 + i * 0.12));
      const centre = ax + wordW / 2;
      x = lerp(x, centre + (x - centre) * 0.9 + o.X * 0.35, sq);
      y -= sq * (n - 1 - i) * o.spSize * 0.62;
      /* recomposition: every letter flies to the caption, in staggered order from the last */
      const fly = E.inOutQuart(seg(t, 9.75 + (n - 1 - i) * 0.09, 11.0 + (n - 1 - i) * 0.09));
      const cx = o.colX + a.x0 * o.capSize;
      x = lerp(x, cx, fly);
      y = lerp(y, o.capY, fly) - Math.sin(fly * Math.PI) * o.spSize * 0.35;
      size = lerp(size, o.capSize, fly);
      /* coda: caption letters drop below the baseline, first letter first */
      const out1 = E.inQuart(seg(t, 15.5 + i * 0.07, 16.25 + i * 0.07));
      out.push({ ch: a.ch, x, y: y + out1 * (H - o.capY + o.capSize * 1.2), size, clipL: t < 6 ? o.voidL : -1e5, capW });
    }
    return out;
  }

  /* TIME: arrives from the left at enormous size, decelerates, then folds into the caption */
  function timeLetters(t) {
    const o = L, adv = o.tmAdv, n = adv.length;
    const wordW = adv.total * o.tmSize;
    const travel = track([[5.3, -wordW - W * 0.02], [9.4, W * 0.5 - wordW * 0.62, E.outCubic], [10.4, W * 0.5 - wordW * 0.5, E.linear]])(t);
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = adv[i];
      const fly = E.inOutQuart(seg(t, 10.0 + i * 0.1, 11.4 + i * 0.1));
      let x = lerp(travel + a.x0 * o.tmSize, o.colX + a.x0 * o.tcSize, fly);
      let y = lerp(o.tmBase, o.tcBase, fly);
      const size = lerp(o.tmSize, o.tcSize, fly);
      const out1 = E.inQuart(seg(t, 15.62 + i * 0.07, 16.4 + i * 0.07));
      y += out1 * (H - o.capY + o.capSize * 3);
      out.push({ ch: a.ch, x, y, size });
    }
    return out;
  }

  function drawWordLetters(c, list, weight, stretch) {
    for (const l of list) {
      if (l.y - l.size > H + 4) continue;
      c.font = `${weight} ${stretch} ${l.size}px ${F_LAT}`;
      c.fillText(l.ch, l.x, l.y);
    }
  }

  /* the red element: seed square → lintel → sun 日 → seed */
  function red(t, c) {
    const o = L;
    const s0 = o.seed;
    const bar = { cx: (o.xL + W * 0.965) / 2 - W * 0.01, cy: o.gTop + o.gh * 0.035, w: W * 0.965 - o.xL + W * 0.02, h: o.gh * 0.075 };
    if (o.portrait) { bar.cx = W / 2; bar.w = W * 1.02; bar.cy = o.gTop + o.gh * 0.035; }
    const sun = { cx: o.sunCx, cy: o.sunCy, w: o.sw, h: o.sh };
    /* the sun waits half-hidden behind the gate's head (multiply: red disappears into black) */
    const above = { cx: o.sunCx, cy: o.gTop - o.sh * 0.18, w: o.sw, h: o.sh };
    let r = { cx: o.seedX, cy: o.seedY, w: s0, h: s0 };
    let glyph = 0;
    const mix = (a, b, k) => ({ cx: lerp(a.cx, b.cx, k), cy: lerp(a.cy, b.cy, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });
    /* anticipation in silence: a single breath of the seed */
    const breath = Math.sin(seg(t, 0.9, 2.2) * Math.PI) * 0.18;
    r.w *= 1 + breath; r.h *= 1 - breath * 0.5;
    /* collision: the seed is pulled up and stretched into a lintel across the gate */
    const k1 = seg(t, 6.3, 7.7);
    if (k1 > 0) {
      const lift = E.inOutQuart(clamp(k1 * 1.6));
      const span = E.outExpo(seg(k1, 0.42, 1));
      const lifted = { cx: r.cx, cy: bar.cy, w: s0, h: bar.h };
      r = mix(mix(r, lifted, lift), bar, span);
    }
    /* recomposition: the lintel contracts over the gate's axis, then drops in as the sun */
    const k2 = E.inOutQuint(seg(t, 9.9, 11.3));
    if (k2 > 0) r = mix(r, above, k2);
    const k3 = seg(t, 11.55, 12.6);
    if (k3 > 0) {
      r = mix(above, sun, E.spring(k3, 0.42, 14));
      glyph = E.outCubic(seg(k3, 0.15, 0.55));
    }
    /* coda: the sun lifts out of the gate and shrinks back into its seed */
    const k4 = seg(t, 15.3, 16.5);
    if (k4 > 0) {
      r = mix(sun, above, E.inOutCubic(clamp(k4 * 1.25)));
      glyph = 1 - E.inCubic(seg(k4, 0, 0.45));
      const back = E.inOutQuart(seg(t, 16.3, 17.6));
      const seedBox = { cx: o.seedX, cy: o.seedY, w: s0, h: s0 };
      r = mix(r, seedBox, back);
    }
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.fillStyle = RED;
    /* square → sun is a shutter: a solid band closes vertically and leaves the glyph's counters open */
    if (glyph > 0) {
      const sc = r.h / o.sh;
      c.font = `900 ${o.Ss * sc}px ${F_GATE}`;
      c.fillText('日', r.cx - (o.sw * sc) / 2 + o.sAL * sc, r.cy - (o.sh * sc) / 2 + o.sAA * sc);
    }
    if (glyph < 1) {
      const bh = r.h * (1 - glyph);
      c.fillRect(r.cx - r.w / 2, r.cy - bh / 2, r.w, bh);
    }
    c.restore();
  }

  /* vertical poem: characters descend into their column one after another */
  function poem(t, c) {
    const o = L;
    const s = o.poemSize, lead = s * 1.08;
    c.save();
    c.font = `500 ${s}px ${F_POEM}`;
    c.fillStyle = INK;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.beginPath();
    c.rect(o.poemX - s, o.poemY - s * 0.2, s * 2, lead * POEM.length + s * 0.4);
    c.clip();
    for (let i = 0; i < POEM.length; i++) {
      const kin = E.outQuint(seg(t, 11.9 + i * 0.075, 12.85 + i * 0.075));
      const kout = E.inQuint(seg(t, 15.2 + i * 0.05, 15.95 + i * 0.05));
      const y0 = o.poemY + i * lead + lead / 2;
      const y = y0 - (1 - kin) * lead * 1.4 + kout * lead * 1.4;
      if (kin <= 0 || kout >= 1) continue;
      const ch = POEM[i];
      if (ch === '、' || ch === '。') c.fillText(ch, o.poemX + s * 0.36, y - s * 0.36);
      else c.fillText(ch, o.poemX, y);
    }
    c.restore();
  }

  function micro(t, c) {
    const o = L, m = o.m;
    c.save();
    c.fillStyle = INK;
    c.font = `600 ${m}px ${F_MICRO}`;
    c.textBaseline = 'alphabetic';
    let mv = MOVES[0];
    for (const x of MOVES) if (t >= x[0]) mv = x;
    const lines = [
      ['600', 'MOTION STUDIES — VOL. 01'],
      ['400', 'No. 01  Typographic Choreography'],
      ['400', ''],
      ['600', `${mv[1]}   ${mv[2].toUpperCase()}`],
      ['400', `T + ${t.toFixed(2).padStart(5, '0')} s  /  ${D.toFixed(2)} s`],
    ];
    lines.forEach((l, i) => { c.font = `${l[0]} ${m}px ${F_MICRO}`; c.fillText(l[1], o.microX, o.microY + i * m * 1.45); });
    /* progress rule under the block: time drawn as a line */
    const ry = o.microY + lines.length * m * 1.45 + m * 0.2;
    const rw = m * 17;
    c.fillRect(o.microX, ry, rw * (t / D), 1);
    c.globalAlpha = 0.25;
    c.fillRect(o.microX, ry, rw, 1);
    c.globalAlpha = 1;
    /* definition, set like a dictionary entry */
    const defY = o.portrait ? H * 0.875 : o.yB - m * 4.4;
    const defX = o.portrait ? o.colX : o.colX;
    const def = ['ma 間  n.', 'the interval between two things;', 'a pause that has a shape.'];
    /* present in the silence, wiped away as the gate arrives, rewritten when 間 is complete */
    const reveal = t < 6 ? 1 - E.inOutCubic(seg(t, 2.3, 3.1))
      : E.outCubic(seg(t, 12.4, 13.3)) * (1 - E.inCubic(seg(t, 15.3, 15.9))) + E.outCubic(seg(t, 16.9, 17.8));
    if (reveal > 0) {
      c.save();
      c.beginPath();
      c.rect(defX, defY - m * 1.6, (m * 22) * reveal, m * 5);
      c.clip();
      def.forEach((d, i) => { c.font = `${i ? 400 : 600} ${m}px ${F_MICRO}`; c.fillText(d, defX, defY + i * m * 1.45); });
      c.restore();
    }
    c.restore();
  }

  function hairlines(t, c) {
    const o = L;
    c.save();
    c.fillStyle = INK;
    /* baseline rule, drawn from the left as the gate arrives */
    const bl = E.inOutQuart(seg(t, 0.4, 2.0)) * (1 - E.inOutQuart(seg(t, 16.6, 17.7)));
    const x0 = o.portrait ? W * 0.06 : W * 0.035;
    const x1 = W - x0;
    c.fillRect(x0, Math.round(o.yB) + 0.5, (x1 - x0) * bl, 1);
    /* column rule, drawn downward a beat later */
    const vl = E.inOutQuart(seg(t, 0.9, 2.3)) * (1 - E.inOutQuart(seg(t, 16.75, 17.8)));
    const y0 = o.portrait ? o.yB : o.gTop;
    const y1 = o.portrait ? H * 0.93 : o.yB;
    c.fillRect(Math.round(o.vLineX) + 0.5, y0, 1, (y1 - y0) * vl);
    c.restore();
  }

  /* ---------- frame ---------- */
  function render(t) {
    if (!L) return;
    /* ink first, on a transparent sheet: every overlap of black on black cancels (xor) */
    const lx = ctx;
    lx.clearRect(0, 0, W, H);
    lx.fillStyle = INK;
    lx.globalCompositeOperation = 'source-over';
    gateHalf(lx, -1, gate.dxL(t), gate.dyL(t));
    lx.globalCompositeOperation = 'xor';
    gateHalf(lx, 1, gate.dxR(t), gate.dyR(t));
    /* SPACE is masked by the left pillar's inner edge while it emerges */
    const sp = spaceLetters(t);
    lx.save();
    if (t < 6) {
      lx.beginPath();
      lx.rect(L.gcx + gate.dxL(t), -10, W, H + 20);
      lx.clip();
    }
    drawWordLetters(lx, sp, 800, 'normal');
    lx.restore();
    if (t > 5.2 && t < 17) drawWordLetters(lx, timeLetters(t), 900, 'extra-condensed');
    /* then the paper is laid in underneath, so the knocked-out holes read as paper */
    lx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    lx.globalCompositeOperation = 'source-over';
    hairlines(t, ctx);

    red(t, ctx);
    poem(t, ctx);
    micro(t, ctx);
  }

  function resize(w, h, dpr) {
    W = w; H = h;
    cv.resize(w, h, dpr);
    L = layout();
    buildTracks();
  }

  Motion.player({
    number: '01',
    title: 'Typographic Choreography',
    subtitle: 'The Architecture of Moving Letters',
    duration: D,
    poster: 13.9,
    stage,
    description: [
      'In Japanese, 間 (ma) is the interval between two things — a gap in a room and a pause in music are the same word. The character is a gate, 門, with the sun, 日, standing inside it.',
      'The piece builds that character as architecture over eighteen seconds, in five movements: silence, entrance, collision, recomposition, resolution. The two pillars of the gate arrive from opposite edges, pass through each other — where black meets black the ink cancels back into paper — and lock. A red square that waited at the centre the whole time is stretched into a lintel, then dropped into the gate as its sun.',
      'SPACE and TIME, the two halves of the idea, cross the page at very different scales and end as a small caption beside the finished sign.',
    ],
    init: () => Motion.fonts([
      [`900 100px "Noto Sans JP"`, '門日'],
      [`800 100px Archivo`, 'SPACE'],
      [`900 extra-condensed 100px Archivo`, 'TIME'],
      [`500 40px "Noto Serif JP"`, POEM],
      [`600 12px "Inter Tight"`, 'MOTION'],
      [`400 12px "Inter Tight"`, 'MOTION'],
    ]),
    resize,
    render,
  });
})();
