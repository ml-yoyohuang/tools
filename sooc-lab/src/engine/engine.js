import { createContext, Program, createTexture, createTarget, deleteTarget, uploadImage } from './gl.js';
import { VERT, GRADE, DOWN, BRIGHT, DETAIL, FINISH, PRESENT } from './shaders.js';
import { bakeCurves, CURVE_N } from './curve.js';
import { createLutTexture } from './cube.js';
import { HSL_KEYS } from './params.js';

const TILE = 2048;
const MAX_LEVELS = 10;

// Fisheye mapping shared with the grade shader (output px -> source px).
export function warpPoint(x, y, W, H, amount) {
  const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2, k = amount * 0.8;
  const dx = (x - cx) / R, dy = (y - cy) / R, r = Math.hypot(dx, dy);
  const s = r > 0 ? ((1 + k * r * r) / (1 + k)) : 1;
  return [cx + dx * s * R, cy + dy * s * R];
}

const nextTask = () => new Promise((r) => setTimeout(r, 0));

export class Engine {
  constructor(canvas) {
    const { gl, floatRT, maxTex } = createContext(canvas);
    this.gl = gl;
    this.canvas = canvas;
    this.hdr = floatRT;
    this.maxTex = maxTex;
    this.vao = gl.createVertexArray();

    const d3 = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_3D, d3);
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGBA8, 1, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    const dummies = { d2: createTexture(gl, 1, 1, { data: new Uint8Array([0, 0, 0, 255]) }), d3 };

    const P = (fs) => new Program(gl, VERT, fs, dummies);
    this.p = { grade: P(GRADE), down: P(DOWN), bright: P(BRIGHT), detail: P(DETAIL), finish: P(FINISH), present: P(PRESENT) };

    this.curveTex = createTexture(gl, CURVE_N, 1, { internal: gl.RGBA32F, type: gl.FLOAT, filter: gl.NEAREST });
    this.curveBuf = new Float32Array(CURVE_N * 4);
    this.curveKey = '';
    this.luts = new Map();
    this.sets = new Map();
    this.preview = null;
    this.proxy = null;
    this.split = 0;
  }

  // ---------- sources ----------
  setSource(source) {
    const w = source.width, h = source.height;
    this.preview = this._set('preview', w, h);
    uploadImage(this.gl, this.preview.src, source);
    this.canvas.width = w;
    this.canvas.height = h;
  }

  setSmallSource(source) {
    this.small = this._set('small', source.width, source.height);
    uploadImage(this.gl, this.small.src, source);
  }

  registerLut(id, parsed) {
    const old = this.luts.get(id);
    if (old) this.gl.deleteTexture(old.tex);
    this.luts.set(id, { tex: createLutTexture(this.gl, parsed), size: parsed.size });
  }

  // ---------- rendering ----------
  render(p) {
    const s = this.preview;
    if (!s) return;
    this.proxy = this._run(s, p, [0, 0], [s.w, s.h], [s.w, s.h], [0, 0, s.w, s.h], null);
    this.present();
  }

  present(split = this.split) {
    const s = this.preview;
    if (!s) return;
    this.split = split;
    this._draw(this.p.present, { uOut: s.OUT, uOrig: s.src, uSplit: split }, null, s.w, s.h);
  }

  renderSmall(p) {
    const s = this.small;
    this._run(s, p, [0, 0], [s.w, s.h], [s.w, s.h], [0, 0, s.w, s.h], null);
    return this._read(s.OUT, 0, 0, s.w, s.h);
  }

  // Full-resolution export in tiles. `img` is any drawImage source (EXIF already applied);
  // the output is the W×H region starting at `crop` = [x, y] in that source.
  async exportFull(p, img, W, H, onProgress, crop = [0, 0]) {
    this.render(p); // refresh the global low-frequency proxy for these params
    const proxy = this.proxy;
    const d = this._derive(p, W, H);
    const apron = Math.min(512, Math.ceil(d.sharpR * 2.8 * (p.outline > 0 ? 1.6 : 1) + Math.max(d.downCell * 1.8, d.pixBlock * 1.1, d.jpegBlock * 1.1) + 8));
    const core = Math.max(256, Math.min(TILE, this.maxTex - apron * 2));

    const out = document.createElement('canvas');
    out.width = W;
    out.height = H;
    const octx = out.getContext('2d');
    if (!octx) throw new Error('CANVAS_TOO_LARGE');
    const tmp = document.createElement('canvas');
    const tctx = tmp.getContext('2d', { willReadFrequently: false });

    const cols = Math.ceil(W / core), rows = Math.ceil(H / core);
    const total = cols * rows;
    const used = [];
    let done = 0;
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        const x = tx * core, y = ty * core;
        const w = Math.min(core, W - x), h = Math.min(core, H - y);
        const ex = Math.max(0, x - apron), ey = Math.max(0, y - apron);
        const ew = Math.min(W, x + w + apron) - ex, eh = Math.min(H, y + h + apron) - ey;
        // source rectangle feeding this tile (larger than the tile when a fisheye pulls from outside it)
        let sr = [ex, ey, ew, eh];
        if (p.warp > 0) {
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (let i = 0; i <= 16; i++) {
            const t = i / 16;
            for (const [px, py] of [[ex + ew * t, ey], [ex + ew * t, ey + eh], [ex, ey + eh * t], [ex + ew, ey + eh * t]]) {
              const [sx, sy] = warpPoint(px, py, W, H, p.warp);
              x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
            }
          }
          x0 = Math.max(0, Math.floor(x0) - 4); y0 = Math.max(0, Math.floor(y0) - 4);
          x1 = Math.min(W, Math.ceil(x1) + 4); y1 = Math.min(H, Math.ceil(y1) + 4);
          sr = x1 > x0 && y1 > y0 ? [x0, y0, x1 - x0, y1 - y0] : [0, 0, 1, 1];
        }
        const sc = Math.min(1, (core + apron * 2) / Math.max(sr[2], sr[3]));
        const tw = Math.max(1, Math.round(sr[2] * sc)), th = Math.max(1, Math.round(sr[3] * sc));
        if (tmp.width !== tw || tmp.height !== th) { tmp.width = tw; tmp.height = th; }
        tctx.imageSmoothingQuality = 'high';
        tctx.drawImage(img, sr[0] + crop[0], sr[1] + crop[1], sr[2], sr[3], 0, 0, tw, th);
        const key = `tile${ew}x${eh}`;
        const set = this._set(key, ew, eh);
        if (!used.includes(key)) used.push(key);
        const skey = `tsrc${tw}x${th}`;
        let srcTex = this.tileSrc && this.tileSrc.key === skey ? this.tileSrc.tex : null;
        if (!srcTex) {
          if (this.tileSrc) this.gl.deleteTexture(this.tileSrc.tex);
          srcTex = createTexture(this.gl, tw, th);
          this.tileSrc = { key: skey, tex: srcTex };
        }
        uploadImage(this.gl, srcTex, tmp);
        this._run(set, p, [ex, ey], [ew, eh], [W, H], sr, proxy, srcTex);
        const id = this._read(set.OUT, x - ex, y - ey, w, h);
        octx.putImageData(id, x, y);
        done++;
        onProgress && onProgress(done / total);
        await nextTask();
      }
    }
    for (const k of used) this._dropSet(k);
    if (this.tileSrc) { this.gl.deleteTexture(this.tileSrc.tex); this.tileSrc = null; }
    tmp.width = tmp.height = 0;
    return out;
  }

  // ---------- internals ----------
  _set(name, w, h) {
    const gl = this.gl;
    let s = this.sets.get(name);
    if (s && s.w === w && s.h === h) return s;
    if (s) this._dropSet(name);
    s = {
      w, h,
      src: createTexture(gl, w, h),
      C: createTarget(gl, w, h, this.hdr),
      D: createTarget(gl, w, h, this.hdr),
      OUT: createTarget(gl, w, h, false),
      pyr: [], bloom: [],
    };
    this.sets.set(name, s);
    return s;
  }

  _dropSet(name) {
    const s = this.sets.get(name);
    if (!s) return;
    const gl = this.gl;
    gl.deleteTexture(s.src);
    [s.C, s.D, s.OUT, ...s.pyr.slice(1), ...s.bloom].forEach((t) => deleteTarget(gl, t));
    this.sets.delete(name);
  }

  _draw(prog, uniforms, target, w, h) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    gl.viewport(0, 0, w, h);
    prog.use(uniforms);
    gl.bindVertexArray(this.vao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  _read(target, x, y, w, h) {
    const gl = this.gl;
    const buf = new Uint8ClampedArray(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return new ImageData(buf, w, h);
  }

  _levels(s, list, base) {
    const gl = this.gl;
    const out = [base];
    let w = base.w, h = base.h, k = 1;
    while (k < MAX_LEVELS && Math.min(w, h) > 6) {
      w = Math.max(1, Math.ceil(w / 2));
      h = Math.max(1, Math.ceil(h / 2));
      let t = list[k];
      if (!t || t.w !== w || t.h !== h) { deleteTarget(gl, t); t = list[k] = createTarget(gl, w, h, this.hdr); }
      const prev = out[k - 1];
      this._draw(this.p.down, { uIn: prev, uTexel: [1 / prev.w, 1 / prev.h] }, t, w, h);
      out.push(t);
      k++;
    }
    return out;
  }

  _buildProxy(s, p) {
    const proxy = { long: Math.max(s.w, s.h), pyr: null, bloom: null };
    if (p.clarity !== 0 || p.hdrTone > 0 || p.miniature.amount > 0 || p.watercolor > 0 || p.skinSoft > 0) proxy.pyr = this._levels(s, s.pyr, s.C);
    if (p.diffusion.amount > 0) {
      let b0 = s.bloom[0];
      if (!b0 || b0.w !== s.w || b0.h !== s.h) { deleteTarget(this.gl, b0); b0 = s.bloom[0] = createTarget(this.gl, s.w, s.h, this.hdr); }
      this._draw(this.p.bright, { uIn: s.C, uThr: p.diffusion.threshold }, b0, s.w, s.h);
      const levels = this._levels(s, s.bloom, b0);
      proxy.bloom = levels;
    }
    return proxy;
  }

  _derive(p, W, H) {
    const L = Math.max(W, H);
    const unit = L / 2000;
    const downCell = p.downscale > 0 && L > p.downscale * 1.05 ? L / p.downscale : 0;
    const pixBlock = p.pixelate > 0 ? L / p.pixelate : 0;
    let jpegBlock = 8 * Math.max(downCell, unit);
    return {
      L, unit, downCell, pixBlock,
      jpegBlock: jpegBlock >= 3 ? jpegBlock : 0,
      sharpR: Math.max(0.6, p.sharpRadius * unit),
      grainCell: Math.max(0.05, p.grain.size * unit),
      noiseCell: Math.max(downCell, unit, 0.6),
    };
  }

  _updateCurve(p) {
    const t = p._curveT ?? 1;
    const key = JSON.stringify([p.curve, p.curveR, p.curveG, p.curveB, p._curveNeutral, t]);
    if (key === this.curveKey) return;
    this.curveKey = key;
    const full = bakeCurves(p);
    const base = bakeCurves(p._curveNeutral || {});
    const b = this.curveBuf;
    for (let i = 0; i < b.length; i++) b[i] = base[i] + (full[i] - base[i]) * t;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.curveTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, CURVE_N, 1, gl.RGBA, gl.FLOAT, b);
  }

  _gradeUniforms(p, s, src) {
    const LW = [0.2126, 0.7152, 0.0722];
    let r = Math.exp(0.3 * p.temperature + 0.025 * p.wbShift[0]);
    let g = Math.exp(-0.25 * p.tint);
    let b = Math.exp(-0.3 * p.temperature + 0.025 * p.wbShift[1]);
    const n = r * LW[0] + g * LW[1] + b * LW[2];
    const hsl = new Float32Array(24);
    let hslOn = false;
    HSL_KEYS.forEach((k, i) => {
      const v = p.hsl[k] || [0, 0, 0];
      hsl[i * 3] = v[0]; hsl[i * 3 + 1] = v[1]; hsl[i * 3 + 2] = v[2];
      if (v[0] || v[1] || v[2]) hslOn = true;
    });
    const m = p.mixer;
    const ms = m[0] + m[1] + m[2];
    const mixer = Math.abs(ms) < 1e-3 ? LW : m.map((x) => x / ms);
    const lut = p.lut ? this.luts.get(p.lut) : null;
    this._updateCurve(p);
    return {
      uSrc: src, uCurve: this.curveTex,
      uExposure: p.exposure, uWb: [r / n, g / n, b / n],
      uContrast: p.contrast,
      uLutOn: !!lut, uLut: lut ? lut.tex : null, uLutSize: lut ? lut.size : 2, uLutAmount: p.lutAmount,
      uHighlights: p.highlights, uShadows: p.shadows, uWhites: p.whites, uBlacks: p.blacks, uMidtone: p.midtone,
      uHslOn: hslOn, uHsl: hsl, uHueShift: p.hueShift,
      uSplit: [p.shadowTint.hue, p.shadowTint.amount, p.highlightTint.hue, p.highlightTint.amount], uBalance: p.balance,
      uSat: p.saturation, uVib: p.vibrance, uChrome: p.colorChrome, uChromeBlue: p.colorChromeBlue,
      uMono: p.mono, uMixer: mixer, uTone: [p.toning.hue, p.toning.amount],
      uKeep: [p.keepColor.hue, p.keepColor.width, p.keepColor.amount],
      uWarp: p.warp,
    };
  }

  _run(s, p, origin, size, image, srcRect, proxy, srcTex = s.src) {
    const W = image[0], H = image[1];
    const d = this._derive(p, W, H);
    const geo = { uTileOrigin: origin, uTileSize: size, uImageSize: image };
    this._draw(this.p.grade, { ...this._gradeUniforms(p, s, srcTex), ...geo, uSrcRect: srcRect }, s.C, s.w, s.h);
    if (!proxy) proxy = this._buildProxy(s, p);

    const du = {
      ...geo, uC: s.C, uCTexel: [1 / s.w, 1 / s.h], uSharp: p.sharpness, uSharpR: d.sharpR,
      uClarity: p.clarity, uHdr: p.hdrTone, uWater: p.watercolor, uOutline: p.outline, uSkin: p.skinSoft,
      uMini: [p.miniature.amount, p.miniature.center, p.miniature.width],
      uDiff: 0, uPN: 0, uPLong: proxy.long,
    };
    if (proxy.pyr) {
      const lv = proxy.pyr.slice(0, 8);
      const ps = new Float32Array(16);
      lv.forEach((t, i) => { du[`uP${i}`] = t; ps[i * 2] = t.w; ps[i * 2 + 1] = t.h; });
      for (let i = lv.length; i < 8; i++) { ps[i * 2] = 1; ps[i * 2 + 1] = 1; }
      du.uPS = ps;
      du.uPN = lv.length;
    }
    if (proxy.bloom && p.diffusion.amount > 0) {
      const lv = proxy.bloom, n = lv.length;
      const at = (f) => lv[Math.min(n - 1, Math.max(0, Math.round(Math.log2(Math.max(1, f * proxy.long)))))];
      const r = p.diffusion.radius;
      const b0 = at(r * 0.35), b1 = at(r), b2 = at(r * 2.4);
      Object.assign(du, { uDiff: p.diffusion.amount, uBl0: b0, uBl1: b1, uBl2: b2, uBl0Size: [b0.w, b0.h], uBl1Size: [b1.w, b1.h], uBl2Size: [b2.w, b2.h] });
    }
    this._draw(this.p.detail, du, s.D, s.w, s.h);

    this._draw(this.p.finish, {
      ...geo, uD: s.D,
      uLofiMix: p._lofiT ?? 1,
      uDownCell: d.downCell, uPixBlock: d.pixBlock,
      uPosterize: p.posterize, uPostMode: p.posterizeMode === 'luma' ? 1 : 0,
      uJpeg: d.jpegBlock ? p.jpeg : 0, uJpegBlock: d.jpegBlock || 8,
      uNoise: p.noise, uNoiseCell: d.noiseCell,
      uVig: [p.vignette.amount, p.vignette.radius, p.vignette.feather],
      uGrain: [p.grain.amount, d.grainCell],
    }, s.OUT, s.w, s.h);
    return proxy;
  }
}
