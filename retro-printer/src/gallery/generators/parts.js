// 產生器共用的小工具：基本形狀、五官與表情。
// 角色的身體畫在淺色層，五官畫在最深的一層；只剩一層可用時（例如徽章、大字版面），
// 五官改成從身體上挖空，才不會跟身體同色而看不見。

export const TAU = Math.PI * 2;
export const pick = (r, list) => list[Math.floor(r() * list.length)];
export const range = (r, a, b) => a + r() * (b - a);

export function circle(x, cx, cy, rad) { x.beginPath(); x.arc(cx, cy, rad, 0, TAU); x.fill(); }
export function ellipse(x, cx, cy, rx, ry, rot = 0) { x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, TAU); x.fill(); }
export function roundRect(x, X, Y, w, h, rad) {
  const r = Math.min(rad, w / 2, h / 2);
  x.beginPath();
  x.moveTo(X + r, Y); x.lineTo(X + w - r, Y); x.arcTo(X + w, Y, X + w, Y + r, r);
  x.lineTo(X + w, Y + h - r); x.arcTo(X + w, Y + h, X + w - r, Y + h, r);
  x.lineTo(X + r, Y + h); x.arcTo(X, Y + h, X, Y + h - r, r);
  x.lineTo(X, Y + r); x.arcTo(X, Y, X + r, Y, r);
  x.closePath(); x.fill();
}
export function poly(x, pts) {
  x.beginPath();
  pts.forEach(([px, py], i) => x[i ? 'lineTo' : 'moveTo'](px, py));
  x.closePath(); x.fill();
}

// 在「細節層」作畫：有兩層以上畫在最深的一層，只剩一層就從身體挖空
export function mark(o, fn) {
  if (o.n > 1) fn(o.L(o.n - 1));
  else o.cut(o.L(0), fn);
}
// 點綴層（腮紅、斑點）：三色時才有
export const accent = o => (o.n > 2 ? o.L(1) : null);

const EYES = ['dot', 'dot', 'happy', 'sparkle', 'sleepy', 'wink', 'big'];
const MOUTHS = ['smile', 'smile', 'open', 'o', 'cat', 'flat', 'tongue'];

// 臉：中心 (cx, cy)，s 為大小（約等於臉寬的一半）
export function face(o, cx, cy, s, { eyes, mouth, blush = true, gap = 0.42 } = {}) {
  const r = o.r;
  eyes = eyes || pick(r, EYES);
  mouth = mouth || pick(r, MOUTHS);
  const ex = s * gap, ey = cy - s * 0.12, er = s * 0.1, lw = Math.max(1.2, s * 0.09);
  mark(o, x => {
    x.lineWidth = lw;
    const eye = (px, kind) => {
      if (kind === 'happy') { x.beginPath(); x.arc(px, ey + er * 0.6, er * 1.2, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
      else if (kind === 'sleepy') { x.beginPath(); x.arc(px, ey - er * 0.4, er * 1.2, Math.PI * 0.15, Math.PI * 0.85); x.stroke(); }
      else if (kind === 'line') { x.beginPath(); x.moveTo(px - er * 1.2, ey); x.lineTo(px + er * 1.2, ey); x.stroke(); }
      else if (kind === 'big') { circle(x, px, ey, er * 1.6); }
      else if (kind === 'sparkle') {
        circle(x, px, ey, er * 1.4);
        o.cut(x, c => circle(c, px + er * 0.5, ey - er * 0.5, er * 0.5));
      } else circle(x, px, ey, er);
    };
    eye(cx - ex, eyes === 'wink' ? 'dot' : eyes);
    eye(cx + ex, eyes === 'wink' ? 'line' : eyes);

    const my = cy + s * 0.22, mw = s * 0.26;
    x.beginPath();
    if (mouth === 'smile') { x.arc(cx, my - mw * 0.5, mw, Math.PI * 0.2, Math.PI * 0.8); x.stroke(); }
    else if (mouth === 'open') { x.arc(cx, my - mw * 0.2, mw * 0.8, 0, Math.PI); x.closePath(); x.fill(); }
    else if (mouth === 'o') { circle(x, cx, my, mw * 0.35); }
    else if (mouth === 'cat') {
      x.arc(cx - mw * 0.45, my - mw * 0.2, mw * 0.45, 0.1 * Math.PI, 0.9 * Math.PI);
      x.moveTo(cx + mw * 0.9, my - mw * 0.2 + 0.01);
      x.arc(cx + mw * 0.45, my - mw * 0.2, mw * 0.45, 0.1 * Math.PI, 0.9 * Math.PI);
      x.stroke();
    } else if (mouth === 'flat') { x.moveTo(cx - mw * 0.5, my); x.lineTo(cx + mw * 0.5, my); x.stroke(); }
    else if (mouth === 'tongue') {
      x.arc(cx, my - mw * 0.3, mw * 0.7, 0.1 * Math.PI, 0.9 * Math.PI); x.stroke();
      ellipse(x, cx + mw * 0.15, my + mw * 0.35, mw * 0.25, mw * 0.3);
    }
  });
  const a = accent(o);
  if (blush && a) { ellipse(a, cx - s * 0.62, cy + s * 0.12, s * 0.16, s * 0.1); ellipse(a, cx + s * 0.62, cy + s * 0.12, s * 0.16, s * 0.1); }
}
