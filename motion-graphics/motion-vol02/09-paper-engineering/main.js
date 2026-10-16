/* 09 — Paper Engineering
 * A real CSS 3D sheet: four panels on three creases, each panel a pair of faces (front and back),
 * every transform computed as a matrix chain from the timeline — hinge angles, a lift about the
 * bottom edge, a turn about the creases' direction. Shading comes from each face's normal against
 * one light; the table shadow is the panels' corners projected along that light.
 */
(() => {
  const { ease: E, track, seg, clamp, lerp } = Motion;
  const D = 20;
  const N = 4;
  const stage = document.getElementById('stage');
  const world = document.getElementById('world');
  const table = document.getElementById('table');
  const shadow = document.getElementById('shadow');
  const sctx = shadow.getContext('2d');
  let W = 0, H = 0, tall = false, pw = 0, ph = 0, Sw = 0, Sh = 0, TW = 0, TH = 0, sScale = 0.5;
  const panels = [];

  /* ---------- paper: a quiet fibre texture, generated once ---------- */
  function paperTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 340;
    const x = c.getContext('2d');
    x.fillStyle = '#f2ede3'; x.fillRect(0, 0, 340, 340);
    const r = Motion.rng(9);
    for (let i = 0; i < 900; i++) {
      const px = r() * 340, py = r() * 340, a = r() * Math.PI, l = 3 + r() * 14;
      x.strokeStyle = `rgba(${r() < 0.5 ? '120,100,70' : '255,255,250'},${0.05 + r() * 0.07})`;
      x.lineWidth = 0.6;
      x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
    }
    const img = x.getImageData(0, 0, 340, 340), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 7; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    x.putImageData(img, 0, 0);
    return c.toDataURL('image/png');
  }

  function build() {
    const tex = `url(${paperTexture()})`;
    const front = document.getElementById('front').content, back = document.getElementById('back').content;
    for (let i = 0; i < N; i++) {
      const p = document.createElement('div');
      p.className = 'panel';
      const mk = (cls, tpl) => {
        const f = document.createElement('div');
        f.className = 'face ' + cls;
        f.style.backgroundImage = tex;
        const art = tpl.firstElementChild.cloneNode(true);
        f.appendChild(art);
        const cr = document.createElement('div'); cr.className = 'crease'; f.appendChild(cr);
        const sh = document.createElement('div'); sh.className = 'shade'; f.appendChild(sh);
        p.appendChild(f);
        return { f, art, sh, cr };
      };
      const F = mk('front', front), B = mk('back', back);
      world.appendChild(p);
      panels.push({ el: p, F, B });
    }
  }

  /* place the artwork for the current orientation: data-l (wide sheet) / data-t (tall sheet), in % of sheet width */
  function placeArt() {
    for (const [i, P] of panels.entries()) {
      for (const [face, slice] of [[P.F, i], [P.B, N - 1 - i]]) {
        const art = face.art;
        art.style.width = Sw + 'px';
        art.style.height = Sh + 'px';
        art.style.fontSize = Sw / 100 + 'px';
        art.style.transform = tall ? `translate(0, ${-slice * ph}px)` : `translate(${-slice * pw}px, 0)`;
        for (const n of art.children) {
          const v = (n.dataset[tall ? 't' : 'l'] || '0,0').split(',').map(Number);
          /* positions in % of sheet width, resolved to px (an element's own em would follow its own size) */
          const u = Sw / 100;
          n.style.left = v[0] * u + 'px'; n.style.top = v[1] * u + 'px';
          n.style.width = v[2] != null ? v[2] * u + 'px' : '';
          n.style.height = v[3] != null ? v[3] * u + 'px' : '';
        }
      }
      P.el.style.width = pw + 'px';
      P.el.style.height = ph + 'px';
    }
    stage.classList.toggle('tall', tall);
    for (const n of document.querySelectorAll('.big')) n.style.fontSize = tall ? '26em' : '15em';
    const sizes = tall ? { title: 5, 'title-en': 1.3, date: 2.1, body: 2.25, 'moon-cap': 1.7, folio: 1.15, addr: 2.1, 'post-t': 1.25, mark: 1.8 } : null;
    for (const cls of ['title', 'title-en', 'date', 'body', 'moon-cap', 'folio', 'addr', 'post-t', 'mark']) {
      for (const n of document.querySelectorAll('.art .' + cls)) n.style.fontSize = sizes ? sizes[cls] + 'em' : '';
    }
  }

  /* ---------- the score ---------- */
  const ZIG = 52;
  const T = {
    /* gate folds: left panel over, then right panel over; then both swing through flat into the zigzag */
    a0: track([[0, 0], [2.9, 0], [3.25, -7, E.outSine], [4.4, 178.5, E.inOutCubic], [6.2, 178.5], [8.2, -2 * ZIG, E.inOutQuart], [14.4, -2 * ZIG], [16.6, 0, E.inOutCubic]]),
    a3: track([[0, 0], [3.6, 0], [3.95, 7, E.outSine], [5.1, -178.5, E.inOutCubic], [6.4, -178.5], [8.4, 2 * ZIG, E.inOutQuart], [14.4, 2 * ZIG], [16.6, 0, E.inOutCubic]]),
    a2: track([[0, 0], [6.6, 0], [8.5, -2 * ZIG, E.inOutQuart], [14.4, -2 * ZIG], [16.6, 0, E.inOutCubic]]),
    yaw: track([[0, 0], [6.6, 0], [8.5, ZIG, E.inOutQuart], [14.4, ZIG], [16.6, 0, E.inOutCubic]]),
    lift: track([[0, 0], [6.5, 0], [8.9, 1, E.inOutCubic], [14.2, 1], [16.8, 0, E.inOutCubic]]),
    spin: track([[0, 0], [9.6, 0], [13.2, 180, E.inOutCubic], [18.3, 180], [19.85, 360, E.inOutCubic]]),
    hover: track([[0, 0], [18.2, 0], [19.0, 1, E.outCubic], [19.85, 0, E.inCubic]]),
  };

  const L = (() => { const v = [-0.38, -0.55, 0.74]; const l = Math.hypot(...v); return v.map((x) => x / l); })();
  const pt = (m, x, y, z = 0) => m.transformPoint(new DOMPoint(x, y, z));

  function matrices(t) {
    /* tall sheets fold a shallower relief, so their louvres stay readable from above */
    const zk = (v, i) => (tall && Math.abs(v) < 150 && t > 6.2 && t < 17 ? v * 0.55 : v);
    const a = [zk(T.a0(t)), 0, zk(T.a2(t)), zk(T.a3(t))];
    /* positive angles always fold a panel up, towards the viewer, in either orientation */
    const rot = (m, deg) => (tall ? m.rotate(-deg, 0, 0) : m.rotate(0, deg, 0));
    const step = (m, d) => (tall ? m.translate(0, d, 0) : m.translate(d, 0, 0));
    const len = tall ? ph : pw;
    /* chain, with panel 1 as the base: panel 1 occupies [-len, 0] along the chain axis */
    const M1 = step(new DOMMatrix(), -len);
    const M0 = rot(M1, a[0]).translate(...(tall ? [0, -len, 0] : [-len, 0, 0]));
    const M2 = rot(step(M1, len), a[2]);
    const M3 = rot(step(M2, len), a[3]);
    const chain = [M0, M1, M2, M3];
    /* centre the folded object on its own bounding box (in the sheet plane) */
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9;
    for (const m of chain) for (const [x, y] of [[0, 0], [pw, 0], [0, ph], [pw, ph]]) {
      const p = pt(m, x, y); mnx = Math.min(mnx, p.x); mxx = Math.max(mxx, p.x); mny = Math.min(mny, p.y); mxy = Math.max(mxy, p.y);
    }
    const cx = (mnx + mxx) / 2, cy = (mny + mxy) / 2;
    const half = (mxy - mny) / 2;
    /* root: lift about the bottom edge (wide sheets stand up; tall sheets only rise),
     * turn about the creases' direction, a slight hover for the page-turn at the end */
    const lift = T.lift(t), sp = T.spin(t), hv = T.hover(t);
    let R = new DOMMatrix().translate(0, 0, 0.6 + hv * Sh * 0.12);
    if (!tall) R = R.translate(0, half, 0).rotate(-lift * 64, 0, 0).translate(0, -half, 0);
    else R = R.translate(0, 0, lift * Sh * 0.16).rotate(-lift * 30, 0, 0);
    R = tall ? R.rotate(sp, 0, 0) : R.rotate(0, sp, 0);
    R = tall ? R.rotate(T.yaw(t) * 0.0, 0, 0) : R.rotate(0, T.yaw(t), 0);
    R = R.translate(-cx, -cy, 0);
    return chain.map((m) => R.multiply(m));
  }

  function render(t) {
    const Ms = matrices(t);
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.clearRect(0, 0, shadow.width, shadow.height);
    sctx.setTransform(sScale, 0, 0, sScale, (TW / 2) * sScale, (TH / 2) * sScale);
    for (let i = 0; i < N; i++) {
      const m = Ms[i], P = panels[i];
      P.el.style.transform = m.toString();
      /* face shading from the face normal against the light */
      const o = pt(m, 0, 0), nz = pt(m, 0, 0, 1);
      const n = [nz.x - o.x, nz.y - o.y, nz.z - o.z];
      const dl = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
      P.F.sh.style.opacity = (clamp(0.82 - dl) * 0.32).toFixed(3);
      P.B.sh.style.opacity = (clamp(0.82 + dl) * 0.32).toFixed(3);
      /* creases: a soft gradient on each side of a fold, deeper the sharper the fold */
      const fold = i === 0 ? Math.abs(T.a0(t)) : i === 3 ? Math.abs(T.a3(t)) : Math.abs(T.a2(t));
      const crease = clamp(fold / 120) * 0.5;
      const dir = tall ? (i < 2 ? 'to top' : 'to bottom') : i < 2 ? 'to left' : 'to right';
      const g = `linear-gradient(${dir}, rgba(60,45,30,${crease * 0.5}) 0%, rgba(60,45,30,0) 9%, rgba(0,0,0,0) 91%, rgba(60,45,30,${crease * 0.35}) 100%)`;
      P.F.cr.style.background = g; P.F.cr.style.opacity = 1;
      P.B.cr.style.background = g; P.B.cr.style.opacity = 1;
      /* the panel's shadow on the table */
      const corners = [[0, 0], [pw, 0], [pw, ph], [0, ph]].map(([x, y]) => pt(m, x, y));
      const sh = corners.map((p) => [p.x - (L[0] * p.z) / L[2], p.y - (L[1] * p.z) / L[2]]);
      const height = corners.reduce((s, p) => s + Math.max(0, p.z), 0) / 4;
      sctx.save();
      sctx.shadowColor = `rgba(55,42,28,${0.34 - clamp(height / (Sh * 1.2)) * 0.18})`;
      sctx.shadowBlur = (3 + height * 0.09) * sScale;
      sctx.shadowOffsetX = 10000 * sScale;
      sctx.beginPath();
      sh.forEach(([x, y], k) => (k ? sctx.lineTo(x - 10000, y) : sctx.moveTo(x - 10000, y)));
      sctx.closePath();
      sctx.fill();
      sctx.restore();
    }
  }

  function resize(w, h) {
    W = w; H = h;
    tall = w / h < 0.9;
    if (tall) { Sw = Math.min(w * 0.84, h * 0.5); Sh = Sw * 1.6; pw = Sw; ph = Sh / N; }
    else { Sw = Math.min(w * 0.74, h * 1.75); Sh = Sw * 0.3625; pw = Sw / N; ph = Sh; }
    /* the camera looks down on the table from in front */
    world.style.transform = `translateY(${tall ? -h * 0.02 : -h * 0.07}px) rotateX(${tall ? 26 : 34}deg)`;
    TW = Math.max(w, h) * 2.4; TH = TW;
    table.style.width = TW + 'px'; table.style.height = TH + 'px';
    table.style.transform = `translate3d(${-TW / 2}px, ${-TH / 2}px, 0)`;
    sScale = Math.min(1, 1400 / TW);
    shadow.width = Math.round(TW * sScale); shadow.height = Math.round(TH * sScale);
    placeArt();
  }

  Motion.player({
    number: '09',
    title: 'Paper Engineering',
    subtitle: 'The Memory of a Fold',
    duration: D,
    poster: 12.6,
    stage,
    description: [
      '尚未寄出的信 — a letter not yet sent. Four panels of one sheet: a vertical title, the letter itself in two columns, and a moon drawn across the third crease. It lies on a table.',
      'First the sheet closes like a pair of gates. The outer panels fold over, one after the other, and the backs that come into view carry two characters: 去 and 寄, go and send — a fragment, out of order.',
      'Then the gates swing back through flat and keep going: the sheet becomes a concertina, an orihon, and stands up on the table. It turns around. Across the backs of its four faces: 寄不出去, “could not be sent”. The moon from the front is now on the back, and it has become a postmark cancelling the first character.',
      'The screen lies down again, still face down, so the flat sheet now reads the other way. Then it is turned over like a page, and the letter is where it was. Every panel and face is a real 3D plane; the folds, the shading and the table shadow are all computed from the same hinge angles.',
    ],
    init: async () => {
      await Motion.fonts([['700 40px "Noto Serif TC"', '尚未寄出的信'], ['900 40px "Noto Serif TC"', '寄不出去'], ['400 16px "EB Garamond"', 'Dear'], ['italic 400 16px "EB Garamond"', 'moon'], ['600 10px "Inter Tight"', 'NOT']]);
      build();
    },
    resize,
    render,
  });
})();
