/* 03 — Living Editorial
 * A spread from an imaginary journal, "Hours", re-edits itself through three complete layouts.
 * Each layout is a finished page; the transitions are the editor's hand, moving in a fixed order:
 * pictures first, then the headline, then the columns, then the small type.
 */
(() => {
  const { ease: E, seg, clamp, lerp } = Motion;
  const D = 27;
  const stage = document.getElementById('stage');
  const spread = document.getElementById('spread');
  const $ = (id) => document.getElementById(id);

  /* ---------- layouts ----------
   * images: f = frame [x, y, w, h] on the artboard, z = zoom beyond "cover", p = focal point
   * text:   x, y, s = scale, c = reveal (1 shown, 0 wiped away)
   */
  const LAND = {
    size: [1600, 1000],
    A: {
      img1: { f: [0, 72, 800, 928], z: 1.0, p: [0.5, 0.52] },
      img2: { f: [856, 72, 680, 0], z: 1.0, p: [0.62, 0.55] },
      img3: { f: [1536, 72, 0, 680], z: 1.0, p: [0.56, 0.56] },
      kicker: { x: 852, y: 112 }, gathering: { x: 840, y: 146 }, light: { x: 846, y: 290 },
      numeral: { x: 52, y: 250, s: 0.74, c: 0 }, deck: { x: 856, y: 500 },
      bodyA: { x: 856, y: 664 }, bodyB: { x: 1196, y: 664 }, cjk: { x: 1496, y: 112 },
      quote: { x: 100, y: 610, c: 0 }, cap1: { x: 856, y: 930 }, cap2: { x: 64, y: 512, c: 0 }, cap3: { x: 856, y: 764, c: 0 },
    },
    B: {
      img1: { f: [64, 560, 236, 360], z: 1.9, p: [0.52, 0.42] },
      img2: { f: [64, 72, 1472, 430], z: 1.0, p: [0.6, 0.55] },
      img3: { f: [1536, 560, 0, 360], z: 1.0, p: [0.56, 0.56] },
      kicker: { x: 330, y: 562 }, gathering: { x: 324, y: 590, s: 0.93 }, light: { x: 874, y: 590, s: 0.93 },
      numeral: { x: 52, y: 250, s: 0.74, c: 0 }, deck: { x: 330, y: 760 },
      bodyA: { x: 856, y: 760 }, bodyB: { x: 1196, y: 760 }, cjk: { x: 1500, y: 548 },
      quote: { x: 100, y: 610, c: 0 }, cap1: { x: 64, y: 930 }, cap2: { x: 64, y: 512 }, cap3: { x: 856, y: 764, c: 0 },
    },
    C: {
      img1: { f: [64, 72, 150, 196], z: 2.3, p: [0.5, 0.44] },
      img2: { f: [64, 884, 680, 44], z: 1.25, p: [0.62, 0.6] },
      img3: { f: [856, 72, 680, 680], z: 1.0, p: [0.56, 0.56] },
      kicker: { x: 252, y: 152 }, gathering: { x: 248, y: 72, s: 0.3 }, light: { x: 448, y: 72, s: 0.3 },
      numeral: { x: 48, y: 268, s: 0.74 }, deck: { x: 330, y: 760, c: 0 },
      bodyA: { x: 856, y: 806 }, bodyB: { x: 1196, y: 806 }, cjk: { x: 696, y: 72 },
      quote: { x: 100, y: 640 }, cap1: { x: 64, y: 280, c: 0 }, cap2: { x: 64, y: 940 }, cap3: { x: 856, y: 764 },
    },
    folios: { L: [64, 36], R: [1536, 36] },
    guides: [64, 744, 856, 1536, 330, 1196],
  };

  const PORT = {
    size: [1000, 1700],
    A: {
      img1: { f: [0, 84, 1000, 860], z: 1.0, p: [0.5, 0.5] },
      img2: { f: [64, 84, 872, 0], z: 1.0, p: [0.6, 0.55] },
      img3: { f: [936, 84, 0, 872], z: 1.0, p: [0.56, 0.56] },
      kicker: { x: 64, y: 1046 }, gathering: { x: 52, y: 1082 }, light: { x: 60, y: 1250 },
      numeral: { x: 40, y: 1046, s: 0.72, c: 0 }, deck: { x: 64, y: 1468 },
      bodyA: { x: 526, y: 900, c: 0 }, bodyB: { x: 526, y: 1290, c: 0 }, cjk: { x: 892, y: 1046 },
      quote: { x: 110, y: 1374, c: 0 }, cap1: { x: 64, y: 958 }, cap2: { x: 64, y: 616, c: 0 }, cap3: { x: 64, y: 970, c: 0 },
    },
    B: {
      img1: { f: [64, 900, 300, 600], z: 1.8, p: [0.52, 0.45] },
      img2: { f: [64, 84, 872, 520], z: 1.0, p: [0.6, 0.55] },
      img3: { f: [936, 900, 0, 600], z: 1.0, p: [0.56, 0.56] },
      kicker: { x: 64, y: 694 }, gathering: { x: 52, y: 728, s: 0.78 }, light: { x: 654, y: 728, s: 0.78 },
      numeral: { x: 40, y: 1046, s: 0.72, c: 0 }, deck: { x: 64, y: 1468, c: 0 },
      bodyA: { x: 526, y: 900 }, bodyB: { x: 526, y: 1290 }, cjk: { x: 400, y: 900 },
      quote: { x: 110, y: 1374, c: 0 }, cap1: { x: 64, y: 1514 }, cap2: { x: 64, y: 616 }, cap3: { x: 64, y: 970, c: 0 },
    },
    C: {
      img1: { f: [64, 1566, 0, 36], z: 2.4, p: [0.5, 0.44] },
      img2: { f: [64, 1566, 760, 36], z: 1.3, p: [0.62, 0.6] },
      img3: { f: [64, 84, 872, 872], z: 1.0, p: [0.56, 0.56] },
      kicker: { x: 524, y: 1128 }, gathering: { x: 520, y: 1052, s: 0.26 }, light: { x: 700, y: 1052, s: 0.26 },
      numeral: { x: 40, y: 1046, s: 0.72 }, deck: { x: 64, y: 1468, c: 0 },
      bodyA: { x: 526, y: 900, c: 0 }, bodyB: { x: 526, y: 1290, c: 0 }, cjk: { x: 892, y: 1100 },
      quote: { x: 110, y: 1374 }, cap1: { x: 64, y: 1514, c: 0 }, cap2: { x: 64, y: 1618 }, cap3: { x: 64, y: 970 },
    },
    folios: { L: [64, 36], R: [936, 36] },
    guides: [64, 936, 400, 526],
  };

  /* ---------- the editor's order of operations ---------- */
  const GROUP = {
    img1: ['img', 0], img2: ['img', 0.05], img3: ['img', 0.1],
    gathering: ['head', 0], light: ['head', 0.05], numeral: ['head', 0.08],
    deck: ['text', 0], bodyA: ['text', 0.04], bodyB: ['text', 0.08], cjk: ['text', 0.12], quote: ['text', 0.06],
    kicker: ['small', 0], cap1: ['small', 0.03], cap2: ['small', 0.06], cap3: ['small', 0.09],
  };
  const TIMING = {
    img: [0.0, 0.6, E.inOutQuart],
    head: [0.14, 0.62, E.inOutQuint],
    text: [0.27, 0.5, E.inOutCubic],
    small: [0.38, 0.46, E.outCubic],
  };
  /* [start, end, from, to] — holds sit between transitions */
  const TRANS = [[4.2, 8.4, 'A', 'B'], [12.6, 16.8, 'B', 'C'], [21.6, 25.8, 'C', 'A']];

  /* ---------- nodes ---------- */
  const ids = Object.keys(GROUP);
  const nodes = {};
  const images = {};
  let L = LAND, scale = 1;

  function state(lay, id) {
    const s = lay[id];
    return s.f ? s : { x: s.x, y: s.y, s: s.s == null ? 1 : s.s, c: s.c == null ? 1 : s.c };
  }

  function at(t, id) {
    let from = 'A', to = 'A', p = 0;
    for (const [a, b, f, g] of TRANS) {
      if (t >= a && t < b) { from = f; to = g; p = (t - a) / (b - a); break; }
      if (t >= b) { from = g; to = g; }
    }
    const S0 = state(L[from], id), S1 = state(L[to], id);
    if (from === to) return S0;
    const [g, d] = GROUP[id];
    const [t0, dur, ease] = TIMING[g];
    const k = ease(seg(p, t0 + d, t0 + d + dur));
    if (S0.f) {
      return { f: S0.f.map((v, i) => lerp(v, S1.f[i], k)), z: lerp(S0.z, S1.z, k), p: [lerp(S0.p[0], S1.p[0], k), lerp(S0.p[1], S1.p[1], k)] };
    }
    /* reveals: what leaves is wiped away first; what arrives is set only after everything has moved */
    let c;
    if (S0.c > S1.c) c = 1 - E.inCubic(seg(p, 0.02 + d * 0.5, 0.2 + d * 0.5));
    else if (S0.c < S1.c) c = E.outCubic(seg(p, 0.7 + d * 0.5, 0.94 + d * 0.5));
    else c = S0.c;
    return { x: lerp(S0.x, S1.x, k), y: lerp(S0.y, S1.y, k), s: lerp(S0.s, S1.s, k), c };
  }

  function applyImage(id, st) {
    const n = nodes[id], cv = images[id];
    const [fx, fy, fw, fh] = st.f;
    const AW = L.size[0], AH = L.size[1];
    n.style.clipPath = `inset(${fy}px ${AW - fx - fw}px ${AH - fy - fh}px ${fx}px)`;
    const iw = cv.width, ih = cv.height;
    const sc = Math.max(Math.max(fw, 1) / iw, Math.max(fh, 1) / ih) * st.z;
    let tx = fx + fw / 2 - st.p[0] * iw * sc, ty = fy + fh / 2 - st.p[1] * ih * sc;
    tx = clamp(tx, fx + fw - iw * sc, fx);
    ty = clamp(ty, fy + fh - ih * sc, fy);
    cv.style.transform = `translate(${tx}px, ${ty}px) scale(${sc})`;
  }

  function applyText(id, st) {
    const n = nodes[id];
    n.style.transform = `translate(${st.x}px, ${st.y}px) scale(${st.s})`;
    n.style.clipPath = st.c >= 1 ? 'none' : `inset(0 0 ${(1 - st.c) * 100}% 0)`;
    n.style.visibility = st.c <= 0 ? 'hidden' : 'visible';
  }

  /* column guides surface while the page is being re-edited, like a layout table under the spread */
  const guides = $('guides');
  function buildGuides() {
    guides.innerHTML = L.guides.map((x) => `<i style="left:${x}px"></i>`).join('');
  }
  function applyGuides(t) {
    let o = 0;
    for (const [a, b] of TRANS) if (t > a && t < b) o = Math.sin(((t - a) / (b - a)) * Math.PI);
    guides.style.opacity = (o * 0.55).toFixed(3);
  }

  function render(t) {
    for (const id of ids) {
      const st = at(t, id);
      if (st.f) applyImage(id, st);
      else applyText(id, st);
    }
    applyGuides(t);
  }

  function placeFolios() {
    const fl = $('folioL'), fr = $('folioR');
    fl.style.transform = `translate(${L.folios.L[0]}px, ${L.folios.L[1]}px)`;
    fr.style.transform = `translate(${L.folios.R[0] - fr.offsetWidth}px, ${L.folios.R[1]}px)`;
  }

  function resize(w, h) {
    const portrait = w / h < 0.95;
    L = portrait ? PORT : LAND;
    spread.classList.toggle('is-portrait', portrait);
    document.body.classList.toggle('is-portrait', portrait);
    const [AW, AH] = L.size;
    const pad = portrait ? Math.min(w * 0.04, 22) : Math.min(w, h) * 0.05;
    const top = portrait ? Math.max(70, h * 0.07) : Math.max(56, h * 0.06);
    const bottom = portrait ? 74 : Math.max(56, h * 0.07);
    scale = Math.min((w - pad * 2) / AW, (h - top - bottom) / AH);
    const x = (w - AW * scale) / 2, y = top + (h - top - bottom - AH * scale) / 2;
    spread.style.width = AW + 'px';
    spread.style.height = AH + 'px';
    spread.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    buildGuides();
    placeFolios();
  }

  Motion.player({
    number: '03',
    title: 'Living Editorial',
    subtitle: 'A Magazine That Refuses to Stay Still',
    duration: D,
    poster: 10.5,
    stage,
    description: [
      '“Gathering Light” is a feature in an imaginary journal of ordinary light: a year spent photographing what falls through one north window at 4:12 in the afternoon.',
      'The spread keeps re-editing itself through three complete layouts — an opening with the wall photograph full-bleed, a panorama that crosses the gutter with the headline set across both pages, and a still life where the time itself, 4:12, becomes the largest image on the page.',
      'Every transition follows the same editorial order: pictures are recropped first, then the headline moves, then the columns, then the captions. Type that leaves is wiped away before anything moves; type that arrives is set only once the page has settled. The column grid surfaces briefly underneath, like a layout table showing through.',
      'The three photographs are not files: they are painted at load time from light, shadow and film grain with fixed seeds.',
    ],
    init: async () => {
      await Motion.fonts([
        ['400 100px "Instrument Serif"', 'Gathering'], ['italic 400 100px "Instrument Serif"', 'Light'],
        ['400 16px Newsreader', 'For a year'], ['italic 400 16px Newsreader', 'A year'],
        ['500 20px "Noto Serif TC"', '四點十二分光從同一扇窗走進來'], ['600 11px "Inter Tight"', 'Feature'], ['400 11px "Inter Tight"', 'Fig'],
      ]);
      const gen = { img1: EditorialImages.wall, img2: EditorialImages.horizon, img3: EditorialImages.glass };
      for (const id of ids) nodes[id] = $(id);
      for (const id of ['img1', 'img2', 'img3']) {
        images[id] = gen[id]();
        images[id].setAttribute('aria-hidden', 'true');
        nodes[id].appendChild(images[id]);
      }
    },
    resize,
    render,
  });
})();
