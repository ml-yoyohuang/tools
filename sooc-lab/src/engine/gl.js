// Thin WebGL2 helpers: programs with auto-assigned sampler units, render targets, a fullscreen draw.

export function createContext(canvas) {
  const gl = canvas.getContext('webgl2', {
    alpha: false, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance',
  });
  if (!gl) throw new Error('WEBGL2_UNSUPPORTED');
  const floatRT = !!gl.getExtension('EXT_color_buffer_float');
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  return { gl, floatRT, maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE) };
}

function shader(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const lines = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    console.error(log, '\n', lines);
    throw new Error('Shader compile failed: ' + log);
  }
  return s;
}

export class Program {
  constructor(gl, vs, fs, dummies) {
    this.gl = gl;
    this.dummies = dummies;
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link failed: ' + gl.getProgramInfoLog(p));
    this.prog = p;
    this.u = new Map();
    gl.useProgram(p);
    let unit = 0;
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, '');
      const loc = gl.getUniformLocation(p, info.name);
      const sampler = info.type === gl.SAMPLER_2D || info.type === gl.SAMPLER_3D;
      const entry = { loc, type: info.type, size: info.size, sampler };
      if (sampler) { entry.unit = unit++; gl.uniform1i(loc, entry.unit); }
      this.u.set(name, entry);
    }
  }

  use(values) {
    const gl = this.gl;
    gl.useProgram(this.prog);
    for (const [name, e] of this.u) {
      const v = values[name];
      if (e.sampler) {
        const is3D = e.type === gl.SAMPLER_3D;
        const tex = (v && (v.tex || v)) || (is3D ? this.dummies.d3 : this.dummies.d2);
        gl.activeTexture(gl.TEXTURE0 + e.unit);
        gl.bindTexture(is3D ? gl.TEXTURE_3D : gl.TEXTURE_2D, tex);
        continue;
      }
      if (v === undefined) continue;
      switch (e.type) {
        case gl.FLOAT: e.size > 1 ? gl.uniform1fv(e.loc, v) : gl.uniform1f(e.loc, v); break;
        case gl.FLOAT_VEC2: gl.uniform2fv(e.loc, v); break;
        case gl.FLOAT_VEC3: gl.uniform3fv(e.loc, v); break;
        case gl.FLOAT_VEC4: gl.uniform4fv(e.loc, v); break;
        case gl.INT: gl.uniform1i(e.loc, v | 0); break;
        case gl.BOOL: gl.uniform1i(e.loc, v ? 1 : 0); break;
        default: break;
      }
    }
  }
}

export function createTexture(gl, w, h, { internal = gl.RGBA8, format = gl.RGBA, type = gl.UNSIGNED_BYTE, filter = gl.LINEAR, data = null } = {}) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

export function createTarget(gl, w, h, hdr) {
  const tex = hdr
    ? createTexture(gl, w, h, { internal: gl.RGBA16F, type: gl.HALF_FLOAT })
    : createTexture(gl, w, h);
  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo, w, h };
}

export function deleteTarget(gl, t) {
  if (!t) return;
  gl.deleteTexture(t.tex);
  if (t.fbo) gl.deleteFramebuffer(t.fbo);
}

export function uploadImage(gl, tex, source) {
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
}
