/* 卡面印刷引擎：空白卡底稿、每一次蓋印的墨量遮罩、疊色合成
   每一種瑕疵都來自操作（沾墨、施力、滑動、位置、角度），另加輕微的 Risograph 基礎質感 */
import { CONFIG } from './config.js';
import { shapeOf, drawGuides } from './art.js';
import { TAU, D2R, clamp, lerp, smooth, hex, makeCanvas, hash2, vnoise } from './util.js';

export const CARD = { W: 440, H: 420, FX: 220, FY: 215, BLOCK: 344 };   // 卡片單位；印面 = 300
export const PR = 2;                                                      // 印刷解析度（px / 卡片單位）
export const PW = CARD.W * PR, PH = CARD.H * PR;
const PAPER = [247, 244, 237];

export const baseCv = makeCanvas(PW, PH);    // 空白卡（紙＋淡淡的框）
export const printCv = makeCanvas(PW, PH);   // 合成後的卡面
export const inkCv = makeCanvas(PW, PH);     // 只有墨的部分（聚焦時加深用）
const shapeCv = makeCanvas(PW, PH);
const sctx = shapeCv.getContext('2d', { willReadFrequently: true });
let baseData = null;

export function buildBase() {
  const c = baseCv.getContext('2d', { willReadFrequently: true });
  c.setTransform(1, 0, 0, 1, 0, 0);
  const img = c.createImageData(PW, PH), d = img.data;
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const i = (y * PW + x) * 4;
    const n = (hash2(x, y, 7) - .5) * 5 + (vnoise(x / 26, y / 9, 11) - .5) * 5;
    d[i] = PAPER[0] + n; d[i + 1] = PAPER[1] + n; d[i + 2] = PAPER[2] + n * 1.1; d[i + 3] = 255;
  }
  c.putImageData(img, 0, 0);
  c.setTransform(PR, 0, 0, PR, CARD.FX * PR, CARD.FY * PR);
  drawGuides(c, 'rgba(60,52,40,.27)', 1.1, 'rgba(60,52,40,.22)');
  baseData = c.getImageData(0, 0, PW, PH);
  printCv.getContext('2d').drawImage(baseCv, 0, 0);
}

function boxBlur(src, w, h, r) {
  if (r < 1) return Float32Array.from(src);
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  const H1 = (s, d) => {
    for (let y = 0; y < h; y++) {
      const o = y * w; let acc = 0;
      for (let x = -r; x <= r; x++) acc += s[o + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) { d[o + x] = acc / n; acc += s[o + Math.min(w - 1, x + r + 1)] - s[o + Math.max(0, x - r)]; }
    }
  };
  const V1 = (s, d) => {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += s[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) { d[y * w + x] = acc / n; acc += s[Math.min(h - 1, y + r + 1) * w + x] - s[Math.max(0, y - r) * w + x]; }
    }
  };
  H1(src, tmp); V1(tmp, out); H1(out, tmp); V1(tmp, out);
  return out;
}

/* 按住時滑動 → 沿路徑多次疊印：起點最重，停下的地方再印一次（雙重印） */
function smearSamples(path) {
  let len = 0; const cum = [0];
  for (let i = 1; i < path.length; i++) { len += Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); cum.push(len); }
  if (len < .8) return [{ x: 0, y: 0, w: 1 }];
  const n = clamp(Math.round(len / 2.5), 3, 12), out = [];
  let j = 0;
  for (let s = 0; s <= n; s++) {
    const t = s / n, target = t * len;
    while (j < cum.length - 2 && cum[j + 1] < target) j++;
    const seg = cum[j + 1] - cum[j] || 1, f = clamp((target - cum[j]) / seg, 0, 1);
    const p = { x: lerp(path[j].x, path[j + 1].x, f), y: lerp(path[j].y, path[j + 1].y, f) };
    p.w = s === 0 ? 1 : s === n ? .55 : .18 + .7 * Math.pow(1 - t, 1.3);
    out.push(p);
  }
  return out;
}

/* 把滑動路徑精簡到最多 n 點，方便儲存（重建結果幾乎相同） */
export function simplifyPath(path, n = 32) {
  if (path.length <= n) return path.map(p => ({ x: +p.x.toFixed(2), y: +p.y.toFixed(2) }));
  const out = [];
  for (let i = 0; i < n; i++) { const p = path[Math.round(i * (path.length - 1) / (n - 1))]; out.push({ x: +p.x.toFixed(2), y: +p.y.toFixed(2) }); }
  return out;
}

/* 操作 → 瑕疵強度 */
export function effectsOf(L) {
  const I = CONFIG.INK_TAPS, P = CONFIG.PRESS;
  const starve = L.taps < I.GOOD_MIN ? (I.GOOD_MIN - L.taps) / I.GOOD_MIN : 0;
  const excess = L.taps > I.GOOD_MAX ? Math.min(1, (L.taps - I.GOOD_MAX) / I.EXCESS_RANGE) : 0;
  const short = L.hold < P.SHORT_S ? clamp((P.SHORT_S - L.hold) / (P.SHORT_S - P.DECIDE_MS / 1000), 0, 1) : 0;
  const long = L.hold > P.LONG_S ? Math.min(1, (L.hold - P.LONG_S) / P.LONG_RANGE_S) : 0;
  // 壓力圈還沒滿：從剛蓋下（1）一路退到滿圈（0），飛白跟著變少
  const under = clamp((P.LONG_S - L.hold) / (P.LONG_S - P.DECIDE_MS / 1000), 0, 1) ** P.UNDER_CURVE;
  return { starve, excess, short, long, under, spread: Math.min(1.4, excess * 1.1 + long * .9) };
}

export function genMask(L) {
  const N = PW * PH, cov = new Float32Array(N), wt = new Float32Array(N);
  for (const sm of smearSamples(L.smear)) {
    sctx.setTransform(1, 0, 0, 1, 0, 0); sctx.clearRect(0, 0, PW, PH);
    sctx.setTransform(PR, 0, 0, PR, (CARD.FX + L.x + sm.x) * PR, (CARD.FY + L.y + sm.y) * PR);
    sctx.rotate(L.a * D2R); sctx.fillStyle = '#fff';
    shapeOf(L.station)(sctx);
    const d = sctx.getImageData(0, 0, PW, PH).data;
    for (let i = 0; i < N; i++) {
      const a = d[i * 4 + 3]; if (!a) continue;
      const v = a / 255; if (v > cov[i]) cov[i] = v;
      const w = v * sm.w; if (w > wt[i]) wt[i] = w;
    }
  }

  const T = CONFIG.TEXTURE;
  const fx = effectsOf(L); L.fx = fx;
  const { starve, excess, short, long, under, spread } = fx;
  const underVoid = under * CONFIG.PRESS.UNDER_SPECKLE;
  const r = Math.round(PR * (1.6 + excess * 7 + long * 5));
  const v = boxBlur(cov, PW, PH, r), wv = boxBlur(wt, PW, PH, Math.max(1, r >> 1));

  // 施力不足時，離手指按壓點越遠的一側越淺
  const ca = Math.cos(L.a * D2R), sa = Math.sin(L.a * D2R);
  let px = L.press.x * ca - L.press.y * sa, py = L.press.x * sa + L.press.y * ca, pl = Math.hypot(px, py);
  if (pl < 12) { const ang = hash2(L.seed, 3, 9) * TAU; px = Math.cos(ang); py = Math.sin(ang); pl = 1; }
  const dx = -px / pl, dy = -py / pl;

  const mask = new Float32Array(N), seed = L.seed | 0;
  for (let y = 0; y < PH; y++) {
    const uy = y / PR;
    for (let x = 0; x < PW; x++) {
      const i = y * PW + x, vv = v[i];
      if (vv < .004) continue;
      const ux = x / PR;
      const n1 = vnoise(ux / 3.5, uy / 3.5, seed) * .6 + vnoise(ux / 1.4, uy / 1.4, seed + 1) * .4;
      const n2 = vnoise(ux / 19, uy / 19, seed + 2);
      let thr = .5 + T.JITTER * (n1 - .5) - spread * (.24 + .5 * n2);
      thr = Math.max(.04, thr);
      const sw = .05 + spread * .06;
      let a = smooth(thr - sw, thr + sw, vv);
      if (spread > 0) a = Math.max(a, smooth(.01, thr + .1, vv) * spread * .3 * (.5 + n2));   // 暈開的淡墨圈
      if (a <= 0) continue;
      const w = Math.min(1, wv[i] / Math.max(vv, .02));
      const g0 = ((ux - CARD.FX - L.x) * dx + (uy - CARD.FY - L.y) * dy) / 150;
      const pressure = 1 - short * (.12 + .88 * smooth(-.7, .9, g0));
      const n3 = vnoise(ux / 1.1, uy / 1.1, seed + 3) * .55 + vnoise(ux / 3.5, uy / 3.5, seed + 4) * .45;
      const voidThr = T.SPECKLE + underVoid + starve * .42 + (1 - pressure) * .95 + (1 - w) * .35 - excess * .04;
      if (voidThr > 0) a *= smooth(voidThr - .06, voidThr + .06, n3);
      const dens = T.DENSITY * (1 - starve * .42) * (1 - under * .12) * (.88 + .12 * pressure) * (.94 + .06 * Math.min(1, excess + long)) * (1 + spread * .1 * (n2 - .4));
      const grain = 1 - T.GRAIN * vnoise(ux / .65, uy / .65, seed + 5);
      mask[i] = clamp(a * dens * grain * w, 0, 1);
    }
  }
  return mask;
}

/* 疊色：相乘＋遮蓋力。後蓋的墨會蓋住一部分先蓋的墨，順序不同，結果就不同 */
export function composite(layers) {
  const b = baseData.data, N = PW * PH;
  const out = new ImageData(PW, PH), o = out.data;
  const io = new ImageData(PW, PH), od = io.data;
  const inks = layers.map(L => hex(CONFIG.INKS[L.station].ink).map(v => v / 255));
  const C = CONFIG.COVER;
  for (let i = 0; i < N; i++) {
    const j = i * 4;
    let r = b[j] / 255, gg = b[j + 1] / 255, bb = b[j + 2] / 255, rem = 1;
    for (let l = 0; l < layers.length; l++) {
      const a = layers[l].mask[i]; if (a < .002) continue;
      const ink = inks[l];
      const mr = r * ink[0], mg = gg * ink[1], mb = bb * ink[2];
      r += (mr + (ink[0] - mr) * C - r) * a;
      gg += (mg + (ink[1] - mg) * C - gg) * a;
      bb += (mb + (ink[2] - mb) * C - bb) * a;
      rem *= 1 - a;
    }
    o[j] = r * 255; o[j + 1] = gg * 255; o[j + 2] = bb * 255; o[j + 3] = 255;
    od[j] = o[j]; od[j + 1] = o[j + 1]; od[j + 2] = o[j + 2]; od[j + 3] = (1 - rem) * 255;
  }
  printCv.getContext('2d').putImageData(out, 0, 0);
  inkCv.getContext('2d').putImageData(io, 0, 0);
}
