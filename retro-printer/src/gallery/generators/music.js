// 第 5 批：★ 音樂與娛樂（上）。全部是原創造型，不出現任何品牌或型號。
import { TAU, pick, range, circle, ellipse, roundRect, poly, accent } from './parts.js';

const base = { theme: 'music', star: true, layouts: ['center', 'repeat', 'grid3', 'badge', 'bigtype'], colors: [2, 3] };
const detail = o => (o.n > 1 ? o.L(o.n - 1) : o.L(0));
const mid = o => (o.n > 2 ? o.L(1) : o.L(0));
const rotated = (x, a, cx, cy, fn) => { x.save(); x.translate(cx, cy); x.rotate(a); x.translate(-cx, -cy); fn(x); x.restore(); };

// 黑膠唱片：唱片印在深色層，溝紋與中心標籤挖空，標籤印在淺色層
export const vinyl = {
  ...base, id: 'vinyl', name: '黑膠唱片',
  draw(o) {
    const { L, r, cut } = o, disc = detail(o), sleeve = o.n > 2 || r() < 0.5;   // 三色時一定有封套
    const cx = sleeve ? 58 : 50, R = sleeve ? 38 : 44;
    if (sleeve && o.n > 1) roundRect(L(0), 6, 14, 64, 64, 2);   // 唱片封套
    circle(disc, cx, 50, R);
    cut(disc, x => {
      x.lineWidth = 0.7;
      for (let k = 0; k < 6; k++) { x.beginPath(); x.arc(cx, 50, R * (0.45 + k * 0.09), 0, TAU); x.stroke(); }
      circle(x, cx, 50, R * 0.32);
    });
    const label = o.n > 1 ? (o.n > 2 ? L(1) : L(0)) : disc;
    if (o.n > 1) circle(label, cx, 50, R * 0.3);
    cut(label, x => circle(x, cx, 50, 1.8));
    // 一道反光
    cut(disc, x => { x.lineWidth = 2; x.beginPath(); x.arc(cx, 50, R * 0.78, -0.9, -0.5); x.stroke(); });
  }
};

// 卡帶：兩個捲軸、透明視窗、標籤
export const cassette = {
  ...base, id: 'cassette', name: '卡帶',
  draw(o) {
    const { L, r, cut } = o, body = L(0), d = detail(o), tilt = range(r, -0.2, 0.2);
    rotated(body, tilt, 50, 50, x => roundRect(x, 8, 24, 84, 54, 5));
    const lab = mid(o);
    rotated(lab, tilt, 50, 50, x => roundRect(x, 16, 30, 68, 26, 3));
    rotated(d, tilt, 50, 50, x => {
      roundRect(x, 30, 37, 40, 13, 6);                                   // 視窗
      poly(x, [[24, 78], [30, 66], [70, 66], [76, 78]]);                 // 下方梯形
      for (const sx of [12, 88]) for (const sy of [28, 74]) circle(x, sx, sy, 1.6);
    });
    cut(d, x => rotated(x, tilt, 50, 50, c => { for (const rx of [38, 62]) circle(c, rx, 43.5, 4.6); }));
    rotated(d, tilt, 50, 50, x => {
      for (const rx of [38, 62]) { circle(x, rx, 43.5, 2.2); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; circle(x, rx + Math.cos(a) * 3.6, 43.5 + Math.sin(a) * 3.6, 0.7); } }
    });
    if (o.n > 1) rotated(d, tilt, 50, 50, x => { x.lineWidth = 0.8; for (const y of [33, 54]) { x.beginPath(); x.moveTo(20, y); x.lineTo(80, y); x.stroke(); } });
  }
};

// 耳機
export const headphones = {
  ...base, id: 'headphones', name: '耳機',
  draw(o) {
    const { L, r } = o, d = detail(o), cups = L(0), wave = o.n > 2 || r() < 0.5;   // 三色時聲波印在中間層
    d.lineWidth = 6;
    d.beginPath(); d.arc(50, 52, 34, Math.PI * 1.02, Math.PI * 1.98); d.stroke();
    roundRect(cups, 8, 46, 20, 34, 9); roundRect(cups, 72, 46, 20, 34, 9);
    roundRect(d, 14, 50, 9, 26, 4.5); roundRect(d, 77, 50, 9, 26, 4.5);
    const m = mid(o);
    if (wave && m !== cups) { m.lineWidth = 2; for (let k = 0; k < 3; k++) { m.beginPath(); m.arc(50, 62, 6 + k * 6, -0.6, 0.6); m.stroke(); m.beginPath(); m.arc(50, 62, 6 + k * 6, Math.PI - 0.6, Math.PI + 0.6); m.stroke(); } }
    else { d.lineWidth = 1.6; d.beginPath(); d.moveTo(18, 80); d.bezierCurveTo(22, 96, 52, 86, 60, 96); d.stroke(); }
  }
};

// 音符散落
function note(x, cx, cy, s, kind, rot) {
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(s, s);
  x.lineWidth = 1.6;
  if (kind === 'eighth') {
    ellipse(x, 0, 0, 4.2, 3, -0.4);
    x.beginPath(); x.moveTo(3.8, -1); x.lineTo(3.8, -18); x.stroke();
    x.beginPath(); x.moveTo(3.8, -18); x.quadraticCurveTo(10, -12, 8, -6); x.stroke();
  } else if (kind === 'beam') {
    ellipse(x, 0, 0, 4.2, 3, -0.4); ellipse(x, 12, -3, 4.2, 3, -0.4);
    x.beginPath(); x.moveTo(3.8, -1); x.lineTo(3.8, -18); x.moveTo(15.8, -4); x.lineTo(15.8, -21); x.stroke();
    poly(x, [[3, -18], [16.6, -21], [16.6, -17.5], [3, -14.5]]);
  } else {
    x.lineWidth = 1.3;
    x.beginPath(); x.ellipse(0, 0, 4.2, 3, -0.4, 0, TAU); x.stroke();
    x.beginPath(); x.moveTo(3.8, -1); x.lineTo(3.8, -18); x.stroke();
  }
  x.restore();
}
export const notes = {
  ...base, id: 'notes', name: '音符', layouts: ['center', 'full', 'badge'],
  draw(o) {
    const { L, r } = o, staff = r() < 0.6;
    if (staff) {
      const s = L(0), ph = r() * TAU;
      s.lineWidth = 0.9;
      for (let k = 0; k < 5; k++) {
        s.beginPath();
        for (let x = 0; x <= 100; x += 2) s[x ? 'lineTo' : 'moveTo'](x, 42 + k * 4 + Math.sin(x / 16 + ph) * 8);
        s.stroke();
      }
    }
    // 把畫面分成 4 × 3 格，每格最多一個音符，避免擠成一團
    const slots = [];
    for (let j = 0; j < 3; j++) for (let i = 0; i < 4; i++) slots.push([8 + i * 22, 30 + j * 24]);
    slots.sort(() => r() - 0.5);
    const count = 6 + Math.floor(r() * 4);
    for (let i = 0; i < count; i++) {
      // 有五線譜時音符印在其他層；沒有時輪流分到每一層
      const layer = L(staff ? 1 + (i % Math.max(1, o.n - 1)) : i % o.n);
      const [sx, sy] = slots[i];
      note(layer, sx + range(r, 2, 10), sy + range(r, 4, 12), range(r, 0.85, 1.3), pick(r, ['eighth', 'eighth', 'beam', 'half']), range(r, -0.35, 0.35));
    }
  }
};

// 復古收音機：圓形喇叭網加旋鈕
export const radio = {
  ...base, id: 'radio', name: '收音機',
  draw(o) {
    const { L, r, cut } = o, body = L(0), d = detail(o);
    d.lineWidth = 3; d.beginPath(); d.arc(50, 30, 22, Math.PI * 1.1, Math.PI * 1.9); d.stroke();   // 提把
    if (r() < 0.6) { d.lineWidth = 1.4; d.beginPath(); d.moveTo(74, 30); d.lineTo(90, 6); d.stroke(); circle(d, 90, 6, 1.6); }
    roundRect(body, 10, 28, 80, 54, 8);
    const g = mid(o);
    circle(g, 32, 56, 17);
    cut(g === body ? body : g, x => { for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (i * i + j * j <= 10) circle(x, 32 + i * 4.2, 56 + j * 4.2, 1.3); });
    roundRect(d, 56, 38, 28, 12, 2);
    cut(d, x => { x.lineWidth = 0.7; for (let k = 0; k < 7; k++) { x.beginPath(); x.moveTo(59 + k * 3.6, 41); x.lineTo(59 + k * 3.6, k % 2 ? 44 : 46); x.stroke(); } });
    circle(d, 62, 64, 5.5); circle(d, 78, 64, 5.5);
    cut(d, x => { x.lineWidth = 1.2; for (const kx of [62, 78]) { x.beginPath(); x.moveTo(kx, 64); x.lineTo(kx + 3, 60); x.stroke(); } });
    roundRect(d, 16, 82, 10, 5, 1.5); roundRect(d, 74, 82, 10, 5, 1.5);
  }
};

// 麥克風：舞台用的立麥
export const microphone = {
  ...base, id: 'microphone', name: '麥克風',
  draw(o) {
    const { L, r, cut } = o, head = L(0), d = detail(o), tilt = range(r, -0.35, 0.35);
    rotated(d, tilt, 50, 50, x => {
      x.lineWidth = 3; x.beginPath(); x.moveTo(50, 56); x.lineTo(50, 92); x.stroke();
      ellipse(x, 50, 94, 16, 3.5);
      poly(x, [[43, 46], [57, 46], [54, 62], [46, 62]]);
    });
    rotated(head, tilt, 50, 50, x => { roundRect(x, 36, 10, 28, 38, 14); });
    cut(head, x => rotated(x, tilt, 50, 50, c => {
      c.lineWidth = 0.9;
      for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(38, 16 + k * 6); c.lineTo(62, 16 + k * 6); c.stroke(); }
      for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(42 + k * 5.4, 12); c.lineTo(42 + k * 5.4, 44); c.stroke(); }
    }));
    rotated(d, tilt, 50, 50, x => roundRect(x, 35, 30, 30, 5, 2));
    const m = o.n > 2 ? L(1) : null;
    if (m) { m.lineWidth = 2.2; for (let k = 0; k < 3; k++) { m.beginPath(); m.arc(50, 28, 22 + k * 7, -0.5, 0.5); m.stroke(); m.beginPath(); m.arc(50, 28, 22 + k * 7, Math.PI - 0.5, Math.PI + 0.5); m.stroke(); } }
  }
};

// 音箱：大小喇叭圓圈疊在方框裡
export const speaker = {
  ...base, id: 'speaker', name: '音箱',
  draw(o) {
    const { L, r, cut } = o, box = L(0), d = detail(o), two = r() < 0.4;
    const units = two ? [[10, 18, 38, 66], [52, 18, 38, 66]] : [[24, 8, 52, 84]];
    for (const [x, y, w, h] of units) {
      roundRect(box, x, y, w, h, 4);
      const cx = x + w / 2, R = w * 0.36;
      circle(d, cx, y + h * 0.66, R);
      cut(d, c => circle(c, cx, y + h * 0.66, R * 0.72));
      circle(mid(o) === box ? d : mid(o), cx, y + h * 0.66, R * 0.38);
      circle(d, cx, y + h * 0.24, R * 0.42);
      cut(d, c => circle(c, cx, y + h * 0.24, R * 0.2));
    }
  }
};

// 鋼琴鍵盤：黑白鍵排成長條，可以彎成拱形
export const piano = {
  ...base, id: 'piano', name: '鋼琴鍵', layouts: ['center', 'badge', 'grid3'],
  draw(o) {
    const { L, r, cut } = o, white = L(0), black = detail(o), keys = 14, arch = r() < 0.5;
    const BLACK = [1, 1, 0, 1, 1, 1, 0];
    const place = (x, i, fn) => {
      x.save();
      if (arch) {
        const a = Math.PI * (1.08 + 0.84 * (i + 0.5) / keys);
        x.translate(50 + Math.cos(a) * 30, 74 + Math.sin(a) * 30); x.rotate(a + Math.PI / 2);
      } else x.translate(4 + (i + 0.5) * (92 / keys), 38);
      fn(x); x.restore();
    };
    const kw = arch ? 6.6 : 92 / keys - 0.8, kh = arch ? 34 : 40;
    for (let i = 0; i < keys; i++) place(white, i, x => x.fillRect(-kw / 2, arch ? -kh : 0, kw, kh));
    for (let i = 0; i < keys - 1; i++) if (BLACK[i % 7]) place(black, i + 0.5, x => x.fillRect(-kw * 0.33, arch ? -kh : 0, kw * 0.66, kh * 0.6));
    const a = accent(o);
    if (a && !arch) roundRect(a, 2, 30, 96, 8, 2);
    if (a && arch) { a.lineWidth = 6; a.beginPath(); a.arc(50, 74, 25, Math.PI * 1.06, Math.PI * 1.94); a.stroke(); }
    cut(white, x => { for (let i = 1; i < keys; i++) place(x, i - 0.5, c => c.fillRect(-0.4, arch ? -kh : 0, 0.8, kh)); });
  }
};

// 吉他、小提琴的剪影
export const strings = {
  ...base, id: 'strings', name: '吉他與提琴',
  draw(o) {
    const { L, r, cut } = o, body = L(0), d = detail(o), kind = pick(r, ['guitar', 'violin']), tilt = range(r, -0.6, 0.6);
    rotated(body, tilt, 50, 50, x => {
      if (kind === 'guitar') { circle(x, 50, 72, 20); circle(x, 50, 46, 14); x.fillRect(46, 50, 8, 10); }
      else {
        circle(x, 50, 74, 15); circle(x, 50, 46, 12); x.fillRect(42, 52, 16, 18);
        cut(x, c => { circle(c, 37, 60, 5); circle(c, 63, 60, 5); });
      }
    });
    rotated(d, tilt, 50, 50, x => {
      x.fillRect(47, 6, 6, 42);                                         // 琴頸
      roundRect(x, 45, 2, 10, 9, 3);
      if (kind === 'guitar') { circle(x, 50, 60, 6); x.fillRect(42, 80, 16, 3); }
      else { x.lineWidth = 1; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(50 + s * 7, 62); x.quadraticCurveTo(50 + s * 10, 68, 50 + s * 7, 74); x.stroke(); } x.fillRect(44, 80, 12, 2.5); }
      x.lineWidth = 0.5;
      for (let k = 0; k < 4; k++) { x.beginPath(); x.moveTo(48.5 + k, 8); x.lineTo(48.5 + k, 82); x.stroke(); }
    });
    if (kind === 'guitar') cut(d, x => rotated(x, tilt, 50, 50, c => circle(c, 50, 60, 3.5)));
    // 三色時：吉他加護板，提琴加一把琴弓
    const m = accent(o);
    if (m && kind === 'guitar') rotated(m, tilt, 50, 50, x => ellipse(x, 59, 70, 6, 9, -0.4));
    if (m && kind === 'violin') {
      m.lineWidth = 1.6; m.beginPath(); m.moveTo(12, 84); m.lineTo(88, 30); m.stroke();
      m.lineWidth = 0.7; m.beginPath(); m.moveTo(14, 88); m.lineTo(88, 35); m.stroke();
      roundRect(m, 8, 82, 8, 6, 1.5);
    }
  }
};

// 鼓組：從上方俯視的圓形構成
export const drums = {
  ...base, id: 'drums', name: '鼓組', layouts: ['center', 'badge', 'grid3'],
  draw(o) {
    const { L, r, cut } = o, skin = L(0), d = detail(o), m = mid(o);
    // 從上方俯視：各鼓彼此分開，不重疊
    const kit = [[50, 74, 14, 'kick'], [37, 42, 9, 'tom'], [63, 42, 9, 'tom'], [22, 68, 11, 'snare'], [78, 68, 12, 'floor'], [14, 30, 12, 'cym'], [86, 28, 13, 'cym']];
    for (const [x, y, R, kind] of kit) {
      if (kind === 'cym') {
        const c = m === skin ? d : m;
        circle(c, x, y, R);
        cut(c, k => { k.lineWidth = 0.6; for (let i = 1; i < 4; i++) { k.beginPath(); k.arc(x, y, R * i / 4, 0, TAU); k.stroke(); } });
        circle(d, x, y, 1.6);
      } else {
        circle(skin, x, y, R);
        d.lineWidth = 2; d.beginPath(); d.arc(x, y, R, 0, TAU); d.stroke();
        for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; circle(d, x + Math.cos(a) * R, y + Math.sin(a) * R, 1.3); }
      }
    }
    // 一對鼓棒交叉擺在小鼓上
    d.lineWidth = 2.2;
    const sa = range(r, -4, 4);
    d.beginPath(); d.moveTo(8, 56 + sa); d.lineTo(38, 82 - sa); d.moveTo(36, 54 - sa); d.lineTo(8, 82 + sa); d.stroke();
  }
};

export const MUSIC_A = [vinyl, cassette, headphones, notes, radio, microphone, speaker, piano, strings, drums];
