(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))n(o);new MutationObserver(o=>{for(const a of o)if(a.type==="childList")for(const u of a.addedNodes)u.tagName==="LINK"&&u.rel==="modulepreload"&&n(u)}).observe(document,{childList:!0,subtree:!0});function r(o){const a={};return o.integrity&&(a.integrity=o.integrity),o.referrerPolicy&&(a.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?a.credentials="include":o.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function n(o){if(o.ep)return;o.ep=!0;const a=r(o);fetch(o.href,a)}})();function zt(e){const t=e.getContext("webgl2",{alpha:!1,antialias:!1,depth:!1,stencil:!1,premultipliedAlpha:!1,preserveDrawingBuffer:!1,powerPreference:"high-performance"});if(!t)throw new Error("WEBGL2_UNSUPPORTED");const r=!!t.getExtension("EXT_color_buffer_float");return t.pixelStorei(t.UNPACK_FLIP_Y_WEBGL,!1),t.pixelStorei(t.UNPACK_PREMULTIPLY_ALPHA_WEBGL,!1),t.pixelStorei(t.UNPACK_ALIGNMENT,1),{gl:t,floatRT:r,maxTex:t.getParameter(t.MAX_TEXTURE_SIZE)}}function vt(e,t,r){const n=e.createShader(t);if(e.shaderSource(n,r),e.compileShader(n),!e.getShaderParameter(n,e.COMPILE_STATUS)){const o=e.getShaderInfoLog(n),a=r.split(`
`).map((u,c)=>`${c+1}: ${u}`).join(`
`);throw console.error(o,`
`,a),new Error("Shader compile failed: "+o)}return n}class Ft{constructor(t,r,n,o){this.gl=t,this.dummies=o;const a=t.createProgram();if(t.attachShader(a,vt(t,t.VERTEX_SHADER,r)),t.attachShader(a,vt(t,t.FRAGMENT_SHADER,n)),t.linkProgram(a),!t.getProgramParameter(a,t.LINK_STATUS))throw new Error("Link failed: "+t.getProgramInfoLog(a));this.prog=a,this.u=new Map,t.useProgram(a);let u=0;const c=t.getProgramParameter(a,t.ACTIVE_UNIFORMS);for(let l=0;l<c;l++){const s=t.getActiveUniform(a,l),h=s.name.replace(/\[0\]$/,""),f=t.getUniformLocation(a,s.name),p=s.type===t.SAMPLER_2D||s.type===t.SAMPLER_3D,d={loc:f,type:s.type,size:s.size,sampler:p};p&&(d.unit=u++,t.uniform1i(f,d.unit)),this.u.set(h,d)}}use(t){const r=this.gl;r.useProgram(this.prog);for(const[n,o]of this.u){const a=t[n];if(o.sampler){const u=o.type===r.SAMPLER_3D,c=a&&(a.tex||a)||(u?this.dummies.d3:this.dummies.d2);r.activeTexture(r.TEXTURE0+o.unit),r.bindTexture(u?r.TEXTURE_3D:r.TEXTURE_2D,c);continue}if(a!==void 0)switch(o.type){case r.FLOAT:o.size>1?r.uniform1fv(o.loc,a):r.uniform1f(o.loc,a);break;case r.FLOAT_VEC2:r.uniform2fv(o.loc,a);break;case r.FLOAT_VEC3:r.uniform3fv(o.loc,a);break;case r.FLOAT_VEC4:r.uniform4fv(o.loc,a);break;case r.INT:r.uniform1i(o.loc,a|0);break;case r.BOOL:r.uniform1i(o.loc,a?1:0);break}}}}function O(e,t,r,{internal:n=e.RGBA8,format:o=e.RGBA,type:a=e.UNSIGNED_BYTE,filter:u=e.LINEAR,data:c=null}={}){const l=e.createTexture();return e.bindTexture(e.TEXTURE_2D,l),e.texImage2D(e.TEXTURE_2D,0,n,t,r,0,o,a,c),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MIN_FILTER,u),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_MAG_FILTER,u),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_S,e.CLAMP_TO_EDGE),e.texParameteri(e.TEXTURE_2D,e.TEXTURE_WRAP_T,e.CLAMP_TO_EDGE),l}function H(e,t,r,n){const o=n?O(e,t,r,{internal:e.RGBA16F,type:e.HALF_FLOAT}):O(e,t,r),a=e.createFramebuffer();return e.bindFramebuffer(e.FRAMEBUFFER,a),e.framebufferTexture2D(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,o,0),e.bindFramebuffer(e.FRAMEBUFFER,null),{tex:o,fbo:a,w:t,h:r}}function it(e,t){t&&(e.deleteTexture(t.tex),t.fbo&&e.deleteFramebuffer(t.fbo))}function nt(e,t,r){e.bindTexture(e.TEXTURE_2D,t),e.texImage2D(e.TEXTURE_2D,0,e.RGBA8,e.RGBA,e.UNSIGNED_BYTE,r)}const z=`#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
`,et=`
const vec3 LW = vec3(0.2126, 0.7152, 0.0722);
float luma(vec3 c) { return dot(c, LW); }
vec3 toLin(vec3 c) { c = max(c, 0.0); return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
vec3 toSrgb(vec3 c) { c = max(c, 0.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float toSrgb1(float c) { c = max(c, 0.0); return c < 0.0031308 ? c * 12.92 : 1.055 * pow(c, 1.0 / 2.4) - 0.055; }

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
vec3 hsl2rgb(vec3 h) {
  vec3 rgb = clamp(abs(mod(h.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  float C = (1.0 - abs(2.0 * h.z - 1.0)) * h.y;
  return (rgb - 0.5) * C + h.z;
}
vec3 rgb2hsl(vec3 c) {
  float mx = max(max(c.r, c.g), c.b), mn = min(min(c.r, c.g), c.b);
  float l = (mx + mn) * 0.5, d = mx - mn;
  float s = d < 1e-6 ? 0.0 : d / max(1e-6, 1.0 - abs(2.0 * l - 1.0));
  return vec3(rgb2hsv(c).x, clamp(s, 0.0, 1.0), l);
}

uint pcg(uint v) { uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float hash2(ivec2 p, uint salt) { return float(pcg(uint(p.x) * 1664525u ^ pcg(uint(p.y) + salt))) / 4294967295.0; }
float vnoise(vec2 x, uint salt) {
  vec2 i = floor(x), f = x - i; ivec2 k = ivec2(i);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash2(k, salt), b = hash2(k + ivec2(1, 0), salt), c = hash2(k + ivec2(0, 1), salt), d = hash2(k + ivec2(1, 1), salt);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 applyLuma0(vec3 p, float L, float L2) { return L > 2e-3 ? p * min(L2 / L, 6.0) : p + (L2 - L); }

vec4 cubicW(float v) {
  vec4 n = vec4(1.0, 2.0, 3.0, 4.0) - v; vec4 s = n * n * n;
  float x = s.x, y = s.y - 4.0 * s.x, z = s.z - 4.0 * s.y + 6.0 * s.x, w = 6.0 - x - y - z;
  return vec4(x, y, z, w) * (1.0 / 6.0);
}
vec3 bicubic(sampler2D t, vec2 uv, vec2 size) {
  vec2 inv = 1.0 / size; uv = uv * size - 0.5;
  vec2 f = fract(uv); uv -= f;
  vec4 xc = cubicW(f.x), yc = cubicW(f.y);
  vec4 c = uv.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw);
  vec4 o = (c + vec4(xc.yw, yc.yw) / s) * inv.xxyy;
  vec3 s0 = texture(t, o.xz).rgb, s1 = texture(t, o.yz).rgb, s2 = texture(t, o.xw).rgb, s3 = texture(t, o.yw).rgb;
  float sx = s.x / (s.x + s.y), sy = s.z / (s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}
`,Dt=`${z}
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`,Ut=`${z}${et}
in vec2 vUv; out vec4 o;
uniform sampler2D uSrc;
uniform sampler2D uCurve;            // 1024×1 RGBA32F (r,g,b composite curves)
uniform float uExposure; uniform vec3 uWb;
uniform float uContrast;
uniform bool uLutOn; uniform sampler3D uLut; uniform float uLutSize, uLutAmount;
uniform float uHighlights, uShadows, uWhites, uBlacks, uMidtone;
uniform bool uHslOn; uniform vec3 uHsl[8]; uniform float uHueShift;
uniform vec4 uSplit; uniform float uBalance;
uniform float uSat, uVib, uChrome, uChromeBlue;
uniform float uMono; uniform vec3 uMixer; uniform vec2 uTone; uniform vec3 uKeep;
uniform vec2 uTileOrigin, uTileSize, uImageSize; uniform vec4 uSrcRect; uniform float uWarp;

const float HC[9] = float[9](0.0, 30.0, 60.0, 120.0, 180.0, 220.0, 270.0, 315.0, 360.0);

vec4 cv(float x) {
  float t = clamp(x, 0.0, 1.0) * 1023.0; int i = int(floor(t)); int j = min(i + 1, 1023);
  return mix(texelFetch(uCurve, ivec2(i, 0), 0), texelFetch(uCurve, ivec2(j, 0), 0), t - float(i));
}
vec3 sCurve(vec3 x, float c) {
  float k = c >= 0.0 ? 1.0 + c * 1.5 : 1.0 / (1.0 - c * 1.2);
  x = clamp(x, 0.0, 1.0);
  vec3 lo = 0.5 * pow(2.0 * x, vec3(k)), hi = 1.0 - 0.5 * pow(max(2.0 - 2.0 * x, 0.0), vec3(k));
  return mix(lo, hi, step(0.5, x));
}
vec3 applyLuma(vec3 p, float L, float L2) {
  return L > 2e-3 ? p * min(L2 / L, 8.0) : p + (L2 - L);
}

void main() {
  // 0 geometry: optional fisheye remap (output px → source px)
  vec2 gp = uTileOrigin + vUv * uTileSize;
  vec2 sp = gp;
  float inside = 1.0;
  if (uWarp > 0.0) {
    vec2 ctr = uImageSize * 0.5; float R = min(uImageSize.x, uImageSize.y) * 0.5;
    vec2 d = (gp - ctr) / R; float r = length(d); float k = uWarp * 0.8;
    float rs = r * (1.0 + k * r * r) / (1.0 + k);
    sp = ctr + d * (r > 0.0 ? rs / r : 1.0) * R;
    vec2 e = min(sp, uImageSize - sp);
    inside = clamp(min(e.x, e.y) / max(1.0, R * 0.004) + 0.5, 0.0, 1.0);
  }
  vec2 suv = (sp - uSrcRect.xy) / uSrcRect.zw;
  // 1 linearize
  vec3 lin = toLin(texture(uSrc, suv).rgb) * inside;
  // 2 exposure / white balance
  lin *= exp2(uExposure) * uWb;
  vec3 p = toSrgb(lin);
  // 3 curves (master ∘ per-channel, baked) + contrast
  p = clamp(p, 0.0, 1.0);
  p = vec3(cv(p.r).r, cv(p.g).g, cv(p.b).b);
  if (uContrast != 0.0) p = sCurve(p, uContrast);
  // 3.5 optional 3D LUT
  if (uLutOn) {
    vec3 q = clamp(p, 0.0, 1.0) * ((uLutSize - 1.0) / uLutSize) + 0.5 / uLutSize;
    p = mix(p, texture(uLut, q).rgb, uLutAmount);
  }
  // 4 highlights / shadows / whites / blacks / midtone
  float L = luma(p);
  float d = uShadows * 0.32 * L * (1.0 - L) * (1.0 - L) * 6.75
          + uHighlights * 0.32 * L * L * (1.0 - L) * 6.75
          + uWhites * 0.2 * L * L * L;
  p = applyLuma(p, L, max(L + d, 0.0));
  if (uMidtone != 0.0) p = pow(max(p, 0.0), vec3(exp2(-uMidtone)));
  if (uBlacks > 0.0) p = uBlacks + (1.0 - uBlacks) * p;
  else if (uBlacks < 0.0) p = max(p + uBlacks, 0.0) / (1.0 + uBlacks);
  // 5 HSL, 8 bands
  if (uHslOn || uHueShift != 0.0) {
    vec3 hsv = rgb2hsv(clamp(p, 0.0, 1.0));
    float h = hsv.x * 360.0;
    vec3 a = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      if (h >= HC[i] && h < HC[i + 1]) {
        float t = (h - HC[i]) / (HC[i + 1] - HC[i]); t = t * t * (3.0 - 2.0 * t);
        a = mix(uHsl[i], uHsl[(i + 1) % 8], t);
      }
    }
    float w = smoothstep(0.02, 0.22, hsv.y);
    hsv.x = fract(hsv.x + (a.x * w + uHueShift) / 360.0 + 1.0);
    hsv.y = clamp(hsv.y * (1.0 + a.y * w), 0.0, 1.0);
    hsv.z = max(hsv.z * (1.0 + a.z * 0.6 * w), 0.0);
    p = hsv2rgb(hsv);
  }
  // 6 split toning
  if (uSplit.y > 0.0 || uSplit.w > 0.0) {
    L = luma(p);
    vec3 sc = hsl2rgb(vec3(uSplit.x / 360.0, 1.0, 0.5)); sc -= luma(sc);
    vec3 hc = hsl2rgb(vec3(uSplit.z / 360.0, 1.0, 0.5)); hc -= luma(hc);
    float ws = (1.0 - L) * (1.0 - L) * clamp(1.0 - uBalance, 0.0, 2.0);
    float wh = L * L * clamp(1.0 + uBalance, 0.0, 2.0);
    p += sc * uSplit.y * ws + hc * uSplit.w * wh;
  }
  // 7 saturation / vibrance
  {
    L = luma(p);
    float mx = max(max(p.r, p.g), p.b), mn = min(min(p.r, p.g), p.b);
    float s = clamp(mx - mn, 0.0, 1.0);
    float f = max(0.0, (1.0 + uSat) * (1.0 + uVib * (1.0 - s) * 0.9));
    p = L + (p - L) * f;
  }
  // 8 color chrome
  if (uChrome > 0.0 || uChromeBlue > 0.0) {
    vec3 hsv = rgb2hsv(clamp(p, 0.0, 1.0));
    float w = smoothstep(0.3, 0.85, hsv.y) * smoothstep(0.08, 0.35, hsv.z);
    float wb = w * (1.0 - smoothstep(25.0, 55.0, abs(hsv.x * 360.0 - 215.0)));
    float k = uChrome * 0.2 * w + uChromeBlue * 0.26 * wb;
    p *= 1.0 - k;
    L = luma(p);
    p = L + (p - L) * (1.0 + k * 0.7);
  }
  // 9 monochrome + channel mixer + toning
  float monoAmt = uMono;
  if (uKeep.z > 0.0) {
    vec3 hsv = rgb2hsv(clamp(p, 0.0, 1.0));
    float dh = abs(mod(hsv.x * 360.0 - uKeep.x + 540.0, 360.0) - 180.0);
    float m = (1.0 - smoothstep(uKeep.y * 0.55, uKeep.y, dh)) * smoothstep(0.12, 0.3, hsv.y);
    monoAmt *= 1.0 - m * uKeep.z;
  }
  if (monoAmt > 0.0) {
    float g = toSrgb1(max(dot(toLin(p), uMixer), 0.0));
    vec3 m = uTone.y > 0.0 ? hsl2rgb(vec3(uTone.x / 360.0, uTone.y, clamp(g, 0.0, 1.0))) : vec3(g);
    p = mix(p, m, monoAmt);
  }
  o = vec4(p, 1.0);
}`,Ot=`${z}
in vec2 vUv; out vec4 o;
uniform sampler2D uIn; uniform vec2 uTexel;
vec3 s(float x, float y) { return texture(uIn, vUv + vec2(x, y) * uTexel).rgb; }
void main() {
  vec3 r = s(0.0, 0.0) * 0.125
    + (s(-2.0, 2.0) + s(2.0, 2.0) + s(-2.0, -2.0) + s(2.0, -2.0)) * 0.03125
    + (s(0.0, 2.0) + s(-2.0, 0.0) + s(2.0, 0.0) + s(0.0, -2.0)) * 0.0625
    + (s(-1.0, 1.0) + s(1.0, 1.0) + s(-1.0, -1.0) + s(1.0, -1.0)) * 0.125;
  o = vec4(r, 1.0);
}`,Nt=`${z}${et}
in vec2 vUv; out vec4 o;
uniform sampler2D uIn; uniform float uThr;
void main() {
  vec3 p = texture(uIn, vUv).rgb;
  float k = smoothstep(uThr, min(uThr + 0.3, 1.0), luma(p));
  o = vec4(toLin(p) * k, 1.0);
}`,Gt=`${z}${et}
in vec2 vUv; out vec4 o;
uniform sampler2D uC; uniform vec2 uCTexel;
uniform vec2 uTileOrigin, uTileSize, uImageSize;
uniform sampler2D uP0, uP1, uP2, uP3, uP4, uP5, uP6, uP7; uniform vec2 uPS[8]; uniform int uPN; uniform float uPLong;
uniform float uClarity, uHdr, uSharp, uSharpR;
uniform vec3 uMini;            // amount, focus centre (0–1 from top), focus band height
uniform float uWater, uOutline, uSkin;
uniform float uDiff; uniform sampler2D uBl0, uBl1, uBl2; uniform vec2 uBl0Size, uBl1Size, uBl2Size;

vec3 lvl(int i, vec2 g) {
  if (i <= 0) return bicubic(uP0, g, uPS[0]);
  if (i == 1) return bicubic(uP1, g, uPS[1]);
  if (i == 2) return bicubic(uP2, g, uPS[2]);
  if (i == 3) return bicubic(uP3, g, uPS[3]);
  if (i == 4) return bicubic(uP4, g, uPS[4]);
  if (i == 5) return bicubic(uP5, g, uPS[5]);
  if (i == 6) return bicubic(uP6, g, uPS[6]);
  return bicubic(uP7, g, uPS[7]);
}
vec3 pyr(float f, vec2 g) {
  f = clamp(f, 0.0, float(uPN - 1));
  int a = int(floor(f)); int b = min(a + 1, uPN - 1);
  return mix(lvl(a, g), lvl(b, g), f - float(a));
}
float lvlFor(float frac) { return log2(max(1.0, frac * uPLong)); }

vec3 ring(vec2 uv, float r) {
  vec2 t = uCTexel * r, u = t * 0.7071;
  vec3 a = texture(uC, uv + vec2(t.x, 0.0)).rgb + texture(uC, uv - vec2(t.x, 0.0)).rgb
         + texture(uC, uv + vec2(0.0, t.y)).rgb + texture(uC, uv - vec2(0.0, t.y)).rgb;
  vec3 b = texture(uC, uv + u).rgb + texture(uC, uv - u).rgb
         + texture(uC, uv + vec2(u.x, -u.y)).rgb + texture(uC, uv + vec2(-u.x, u.y)).rgb;
  return (a + b) * 0.125;
}
float lumAt(vec2 o) { return luma(texture(uC, vUv + o * uCTexel).rgb); }

void main() {
  vec3 p = texture(uC, vUv).rgb;
  vec2 g = (uTileOrigin + vUv * uTileSize) / uImageSize;
  bool hasPyr = uPN > 1;
  // 10 local contrast
  if (hasPyr && uClarity != 0.0) {
    vec3 b = pyr(lvlFor(0.012), g);
    float L = luma(p), Lb = luma(b);
    float m = clamp(4.0 * L * (1.0 - L), 0.0, 1.0) * 0.8 + 0.2;
    p = applyLuma0(p, L, max(L + uClarity * (L - Lb) * 1.4 * m, 0.0));
  }
  if (hasPyr && uHdr > 0.0) {
    vec3 b = pyr(lvlFor(0.045), g);
    float L = luma(p), Lb = luma(b);
    float L2 = 0.5 + (Lb - 0.5) * (1.0 - 0.7 * uHdr) + (L - Lb) * (1.0 + 2.2 * uHdr);
    p = applyLuma0(p, L, clamp(L2, 0.0, 1.2));
    float Lp = luma(p);
    p = Lp + (p - Lp) * (1.0 + 0.35 * uHdr);
  }
  // soft skin: smooth mid detail inside a skin-hue mask
  if (hasPyr && uSkin > 0.0) {
    vec3 hsv = rgb2hsv(clamp(p, 0.0, 1.0));
    float h = hsv.x * 360.0; h = h > 300.0 ? h - 360.0 : h;
    float m = (1.0 - smoothstep(14.0, 30.0, abs(h - 24.0))) * smoothstep(0.08, 0.2, hsv.y) * (1.0 - smoothstep(0.65, 0.85, hsv.y)) * smoothstep(0.2, 0.4, hsv.z);
    vec3 b = pyr(lvlFor(0.004), g);
    p = mix(p, b + (p - b) * 0.3, m * uSkin);
  }
  // watercolour: wash + pigment pooling at edges
  if (hasPyr && uWater > 0.0) {
    vec3 b1 = pyr(lvlFor(0.003), g), b2 = pyr(lvlFor(0.011), g);
    float e = abs(luma(b1) - luma(b2));
    vec3 w = mix(b1, b2, 0.35);
    w = w * (1.0 - e * 3.5);
    w = mix(w, vec3(1.0), 0.1);
    p = mix(p, w, uWater);
  }
  // 11 sharpness (negative = soften)
  if (uSharp > 0.0) {
    p += (p - ring(vUv, uSharpR)) * uSharp * 1.6;
  } else if (uSharp < 0.0) {
    vec3 b = ring(vUv, uSharpR * 1.2) * 0.45 + ring(vUv, uSharpR * 2.6) * 0.4 + p * 0.15;
    p = mix(p, b, clamp(-uSharp, 0.0, 1.0));
  }
  // illustration outline (Sobel on C, width scales with resolution)
  if (uOutline > 0.0) {
    float r = uSharpR * 1.4;
    float tl = lumAt(vec2(-r, -r)), t = lumAt(vec2(0.0, -r)), tr = lumAt(vec2(r, -r));
    float l = lumAt(vec2(-r, 0.0)), rr = lumAt(vec2(r, 0.0));
    float bl = lumAt(vec2(-r, r)), b = lumAt(vec2(0.0, r)), br = lumAt(vec2(r, r));
    float gx = (tr + 2.0 * rr + br) - (tl + 2.0 * l + bl);
    float gy = (bl + 2.0 * b + br) - (tl + 2.0 * t + tr);
    float e = smoothstep(0.18, 0.5, length(vec2(gx, gy)));
    p = mix(p, p * 0.12, e * uOutline);
  }
  // miniature: blur grows away from the focus band
  if (hasPyr && uMini.x > 0.0) {
    float d = max(0.0, abs(g.y - uMini.y) - uMini.z * 0.5);
    float t = clamp(d / 0.28, 0.0, 1.0);
    float f = t * t * lvlFor(0.014) * uMini.x;
    if (f > 0.01) p = f < 1.0 ? mix(p, lvl(1, g), f) : pyr(f, g);
  }
  // 12 highlight diffusion
  if (uDiff > 0.0) {
    vec3 glow = bicubic(uBl0, g, uBl0Size) * 0.3 + bicubic(uBl1, g, uBl1Size) * 0.4 + bicubic(uBl2, g, uBl2Size) * 0.3;
    vec3 gs = clamp(toSrgb(glow * uDiff * 1.6), 0.0, 1.0);
    p = 1.0 - (1.0 - clamp(p, 0.0, 1.0)) * (1.0 - gs);
  }
  o = vec4(p, 1.0);
}`,Vt=`${z}${et}
in vec2 vUv; out vec4 o;
uniform sampler2D uD;
uniform vec2 uTileOrigin, uTileSize, uImageSize;
uniform float uLofiMix, uDownCell, uPixBlock, uPosterize; uniform int uPostMode;
uniform float uJpeg, uJpegBlock, uNoise, uNoiseCell;
uniform vec3 uVig;
uniform vec2 uGrain;

vec3 fd(vec2 gp) { return texture(uD, (gp - uTileOrigin) / uTileSize).rgb; }
vec3 box4(vec2 c, float s) {
  float k = s * 0.25;
  return 0.25 * (fd(c + vec2(-k, -k)) + fd(c + vec2(k, -k)) + fd(c + vec2(-k, k)) + fd(c + vec2(k, k)));
}
vec3 box16(vec2 c, float s) {
  vec3 a = vec3(0.0);
  for (int y = 0; y < 4; y++) for (int x = 0; x < 4; x++) a += fd(c + (vec2(x, y) - 1.5) * 0.25 * s);
  return a / 16.0;
}

void main() {
  vec2 gp = uTileOrigin + vUv * uTileSize;
  vec3 base = fd(gp);
  vec3 c = base;
  // 13 lo-fi: downscale, pixelate, JPEG feel, posterize
  bool lofi = uDownCell > 1.0 || uPixBlock > 1.0 || uJpeg > 0.0 || uPosterize > 1.0;
  if (lofi) {
    if (uDownCell > 1.0) {
      vec2 q = gp / uDownCell - 0.5, i = floor(q), f = q - i;
      vec3 a = box4((i + vec2(0.5, 0.5)) * uDownCell, uDownCell), b = box4((i + vec2(1.5, 0.5)) * uDownCell, uDownCell);
      vec3 e = box4((i + vec2(0.5, 1.5)) * uDownCell, uDownCell), h = box4((i + vec2(1.5, 1.5)) * uDownCell, uDownCell);
      c = mix(mix(a, b, f.x), mix(e, h, f.x), f.y);
    }
    if (uPixBlock > 1.0) c = box16((floor(gp / uPixBlock) + 0.5) * uPixBlock, uPixBlock);
    if (uJpeg > 0.0) {
      float B = uJpegBlock;
      vec3 avg = box16((floor(gp / B) + 0.5) * B, B);
      float la = luma(avg), lc = luma(c), q = mix(0.012, 0.085, uJpeg);
      float dl = floor((lc - la) / q + 0.5) * q;
      vec3 ch = mix(c - lc, avg - la, uJpeg * 0.75);
      c = vec3(la + dl) + ch;
    }
    if (uPosterize > 1.0) {
      float n = uPosterize - 1.0;
      if (uPostMode == 0) c = floor(clamp(c, 0.0, 1.0) * n + 0.5) / n;
      else { vec3 h = rgb2hsl(clamp(c, 0.0, 1.0)); h.z = floor(h.z * n + 0.5) / n; c = hsl2rgb(h); }
    }
    c = mix(base, c, uLofiMix);
  }
  if (uNoise > 0.0) {
    vec2 nq = gp / uNoiseCell;
    vec3 n = vec3(vnoise(nq, 11u), vnoise(nq, 23u), vnoise(nq, 37u)) - 0.5;
    c += n * uNoise * 0.22 * (1.0 - 0.6 * clamp(luma(c), 0.0, 1.0));
  }
  // 14 vignette (aspect-aware, 1 = corner)
  if (uVig.x != 0.0) {
    vec2 uv = gp / uImageSize; float a = uImageSize.x / uImageSize.y;
    float r = length((uv - 0.5) * 2.0 * vec2(a, 1.0)) / length(vec2(a, 1.0));
    float inner = uVig.y * (1.0 - uVig.z), outer = mix(uVig.y, 1.25, uVig.z) + 0.001;
    float m = smoothstep(inner, outer, r); m *= m;
    if (uVig.x > 0.0) c = toSrgb(toLin(c) * (1.0 - uVig.x * m));
    else c = mix(c, vec3(1.0), -uVig.x * m);
  }
  // 15 grain — size in image-relative units so preview and export match
  if (uGrain.x > 0.0) {
    vec2 q = gp / uGrain.y;
    float n = (vnoise(q, 101u) - 0.5) * 0.75 + (vnoise(q * 2.07 + 17.0, 211u) - 0.5) * 0.45 + (hash2(ivec2(floor(q * 3.1)), 307u) - 0.5) * 0.25;
    float L = clamp(luma(c), 0.0, 1.0);
    // sub-pixel grain averages out; coarse grain is smoothed again when viewed downscaled
    float k = min(uGrain.y, 1.0) * (1.0 + 0.15 * log2(max(uGrain.y, 1.0)));
    c += n * uGrain.x * 0.34 * k * (0.3 + 2.8 * L * (1.0 - L));
  }
  // 16 output (already sRGB-encoded)
  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`,jt=`${z}
in vec2 vUv; out vec4 o;
uniform sampler2D uOut, uOrig; uniform float uSplit;
void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  o = vec4(uv.x < uSplit ? texture(uOrig, uv).rgb : texture(uOut, uv).rgb, 1.0);
}`,S=1024;function Y(e){const t=new Float32Array(S);if(!e||e.length<2){for(let s=0;s<S;s++)t[s]=s/(S-1);return t}const r=[...e].sort((s,h)=>s[0]-h[0]),n=r.length,o=r.map(s=>s[0]),a=r.map(s=>s[1]),u=[],c=new Array(n);for(let s=0;s<n-1;s++)u.push((a[s+1]-a[s])/Math.max(1e-6,o[s+1]-o[s]));c[0]=u[0],c[n-1]=u[n-2];for(let s=1;s<n-1;s++)c[s]=u[s-1]*u[s]<=0?0:(u[s-1]+u[s])/2;for(let s=0;s<n-1;s++){if(u[s]===0){c[s]=0,c[s+1]=0;continue}const h=c[s]/u[s],f=c[s+1]/u[s],p=h*h+f*f;if(p>9){const d=3/Math.sqrt(p);c[s]=d*h*u[s],c[s+1]=d*f*u[s]}}let l=0;for(let s=0;s<S;s++){const h=s/(S-1);let f;if(h<=o[0])f=a[0];else if(h>=o[n-1])f=a[n-1];else{for(;l<n-2&&h>o[l+1];)l++;const p=o[l+1]-o[l],d=(h-o[l])/p,v=d*d,x=v*d;f=(2*x-3*v+1)*a[l]+(x-2*v+d)*p*c[l]+(-2*x+3*v)*a[l+1]+(x-v)*p*c[l+1]}t[s]=Math.min(1,Math.max(0,f))}return t}function st(e,t){const r=Math.min(1,Math.max(0,t))*(S-1),n=Math.floor(r),o=Math.min(n+1,S-1);return e[n]+(e[o]-e[n])*(r-n)}const W=new Map;function xt(e){const t=JSON.stringify([e.curve,e.curveR,e.curveG,e.curveB]);if(W.has(t))return W.get(t);const r=Y(e.curve),n=[Y(e.curveR),Y(e.curveG),Y(e.curveB)],o=new Float32Array(S*4);for(let a=0;a<S;a++){const u=r[a];o[a*4]=st(n[0],u),o[a*4+1]=st(n[1],u),o[a*4+2]=st(n[2],u),o[a*4+3]=1}return W.size>64&&W.clear(),W.set(t,o),o}function de(e){let t=0,r="",n=[0,0,0],o=[1,1,1];const a=[];for(const l of e.split(/\r?\n/)){const s=l.trim();if(!s||s[0]==="#")continue;const h=s.split(/\s+/),f=h[0].toUpperCase();if(f==="TITLE"){r=s.slice(5).trim().replace(/^"|"$/g,"");continue}if(f==="LUT_3D_SIZE"){t=parseInt(h[1],10);continue}if(f==="LUT_1D_SIZE")throw new Error("CUBE_1D_UNSUPPORTED");if(f==="DOMAIN_MIN"){n=h.slice(1,4).map(Number);continue}if(f==="DOMAIN_MAX"){o=h.slice(1,4).map(Number);continue}/^[A-Z_]/.test(f)||h.length>=3&&a.push(+h[0],+h[1],+h[2])}if(!t||a.length<t*t*t*3)throw new Error("CUBE_INVALID");const u=t*t*t,c=new Float32Array(u*4);for(let l=0;l<u;l++){for(let s=0;s<3;s++)c[l*4+s]=(a[l*3+s]-n[s])/(o[s]-n[s]||1);c[l*4+3]=1}return{size:t,data:c,title:r}}function qt(e,t){const r=e.createTexture();e.bindTexture(e.TEXTURE_3D,r),e.texImage3D(e.TEXTURE_3D,0,e.RGBA16F,t.size,t.size,t.size,0,e.RGBA,e.FLOAT,t.data);for(const n of[e.TEXTURE_WRAP_S,e.TEXTURE_WRAP_T,e.TEXTURE_WRAP_R])e.texParameteri(e.TEXTURE_3D,n,e.CLAMP_TO_EDGE);return e.texParameteri(e.TEXTURE_3D,e.TEXTURE_MIN_FILTER,e.LINEAR),e.texParameteri(e.TEXTURE_3D,e.TEXTURE_MAG_FILTER,e.LINEAR),r}const Lt={exposure:0,temperature:0,tint:0,wbShift:[0,0],curve:null,curveR:null,curveG:null,curveB:null,contrast:0,lut:null,lutAmount:1,highlights:0,shadows:0,whites:0,blacks:0,midtone:0,hsl:{red:[0,0,0],orange:[0,0,0],yellow:[0,0,0],green:[0,0,0],aqua:[0,0,0],blue:[0,0,0],purple:[0,0,0],magenta:[0,0,0]},hueShift:0,shadowTint:{hue:0,amount:0},highlightTint:{hue:0,amount:0},balance:0,saturation:0,vibrance:0,colorChrome:0,colorChromeBlue:0,mono:0,mixer:[.2126,.7152,.0722],toning:{hue:0,amount:0},keepColor:{hue:0,width:30,amount:0},warp:0,clarity:0,hdrTone:0,skinSoft:0,watercolor:0,outline:0,miniature:{amount:0,center:.55,width:.18},sharpness:0,sharpRadius:1,diffusion:{amount:0,threshold:.62,radius:.025},downscale:0,posterize:0,posterizeMode:"rgb",pixelate:0,jpeg:0,noise:0,vignette:{amount:0,radius:.7,feather:.6},grain:{amount:0,size:1}},Xt=["red","orange","yellow","green","aqua","blue","purple","magenta"],Ht=["curve","curveR","curveG","curveB"],kt=["downscale","posterize","pixelate"],Wt=new Set(["hue","width","center","size","radius","feather","threshold","mixer","posterizeMode","sharpRadius","lut",...kt]),K=e=>e&&typeof e=="object"&&!Array.isArray(e)&&!(e.size&&e.data);function B(e){if(Array.isArray(e))return e.map(B);if(K(e)){const t={};for(const r in e)t[r]=B(e[r]);return t}return e}function $(e,t){const r=B(e);if(!t)return r;for(const n in t){const o=t[n];r[n]=K(o)&&K(r[n])?$(r[n],o):B(o)}return r}function Rt(e,t,r,n){if(Wt.has(n))return B(t);if(typeof e=="number"&&typeof t=="number")return e+(t-e)*r;if(Array.isArray(e)&&Array.isArray(t)&&e.length===t.length&&typeof e[0]=="number")return e.map((o,a)=>o+(t[a]-o)*r);if(K(e)&&K(t)){const o={};for(const a in t)o[a]=Rt(e[a],t[a],r,a);return o}return B(t)}function Kt(e,t,r){const n={};for(const a in t)Ht.includes(a)?n[a]=B(t[a]):n[a]=Rt(e[a],t[a],r,a);n._curveT=r,n._curveNeutral={curve:e.curve,curveR:e.curveR,curveG:e.curveG,curveB:e.curveB};const o=kt.some(a=>t[a]!==e[a]);return n._lofiT=o?r:1,n}const $t=2048,Jt=10;function Yt(e,t,r,n,o){const a=r/2,u=n/2,c=Math.min(r,n)/2,l=o*.8,s=(e-a)/c,h=(t-u)/c,f=Math.hypot(s,h),p=f>0?(1+l*f*f)/(1+l):1;return[a+s*p*c,u+h*p*c]}const Zt=()=>new Promise(e=>setTimeout(e,0));class pe{constructor(t){const{gl:r,floatRT:n,maxTex:o}=zt(t);this.gl=r,this.canvas=t,this.hdr=n,this.maxTex=o,this.vao=r.createVertexArray();const a=r.createTexture();r.bindTexture(r.TEXTURE_3D,a),r.texImage3D(r.TEXTURE_3D,0,r.RGBA8,1,1,1,0,r.RGBA,r.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));const u={d2:O(r,1,1,{data:new Uint8Array([0,0,0,255])}),d3:a},c=l=>new Ft(r,Dt,l,u);this.p={grade:c(Ut),down:c(Ot),bright:c(Nt),detail:c(Gt),finish:c(Vt),present:c(jt)},this.curveTex=O(r,S,1,{internal:r.RGBA32F,type:r.FLOAT,filter:r.NEAREST}),this.curveBuf=new Float32Array(S*4),this.curveKey="",this.luts=new Map,this.sets=new Map,this.preview=null,this.proxy=null,this.split=0}setSource(t){const r=t.width,n=t.height;this.preview=this._set("preview",r,n),nt(this.gl,this.preview.src,t),this.canvas.width=r,this.canvas.height=n}setSmallSource(t){this.small=this._set("small",t.width,t.height),nt(this.gl,this.small.src,t)}registerLut(t,r){const n=this.luts.get(t);n&&this.gl.deleteTexture(n.tex),this.luts.set(t,{tex:qt(this.gl,r),size:r.size})}render(t){const r=this.preview;r&&(this.proxy=this._run(r,t,[0,0],[r.w,r.h],[r.w,r.h],[0,0,r.w,r.h],null),this.present())}present(t=this.split){const r=this.preview;r&&(this.split=t,this._draw(this.p.present,{uOut:r.OUT,uOrig:r.src,uSplit:t},null,r.w,r.h))}renderSmall(t){const r=this.small;return this._run(r,t,[0,0],[r.w,r.h],[r.w,r.h],[0,0,r.w,r.h],null),this._read(r.OUT,0,0,r.w,r.h)}async exportFull(t,r,n,o,a,u=[0,0]){this.render(t);const c=this.proxy,l=this._derive(t,n,o),s=Math.min(512,Math.ceil(l.sharpR*2.8*(t.outline>0?1.6:1)+Math.max(l.downCell*1.8,l.pixBlock*1.1,l.jpegBlock*1.1)+8)),h=Math.max(256,Math.min($t,this.maxTex-s*2)),f=document.createElement("canvas");f.width=n,f.height=o;const p=f.getContext("2d");if(!p)throw new Error("CANVAS_TOO_LARGE");const d=document.createElement("canvas"),v=d.getContext("2d",{willReadFrequently:!1}),x=Math.ceil(n/h),b=Math.ceil(o/h),w=x*b,M=[];let F=0;for(let k=0;k<b;k++)for(let N=0;N<x;N++){const G=N*h,V=k*h,lt=Math.min(h,n-G),ht=Math.min(h,o-V),R=Math.max(0,G-s),E=Math.max(0,V-s),P=Math.min(n,G+lt+s)-R,_=Math.min(o,V+ht+s)-E;let L=[R,E,P,_];if(t.warp>0){let A=1/0,I=1/0,D=-1/0,U=-1/0;for(let at=0;at<=16;at++){const J=at/16;for(const[It,Bt]of[[R+P*J,E],[R+P*J,E+_],[R,E+_*J],[R+P,E+_*J]]){const[dt,pt]=Yt(It,Bt,n,o,t.warp);A=Math.min(A,dt),I=Math.min(I,pt),D=Math.max(D,dt),U=Math.max(U,pt)}}A=Math.max(0,Math.floor(A)-4),I=Math.max(0,Math.floor(I)-4),D=Math.min(n,Math.ceil(D)+4),U=Math.min(o,Math.ceil(U)+4),L=D>A&&U>I?[A,I,D-A,U-I]:[0,0,1,1]}const mt=Math.min(1,(h+s*2)/Math.max(L[2],L[3])),j=Math.max(1,Math.round(L[2]*mt)),q=Math.max(1,Math.round(L[3]*mt));(d.width!==j||d.height!==q)&&(d.width=j,d.height=q),v.imageSmoothingQuality="high",v.drawImage(r,L[0]+u[0],L[1]+u[1],L[2],L[3],0,0,j,q);const ot=`tile${P}x${_}`,ft=this._set(ot,P,_);M.includes(ot)||M.push(ot);const gt=`tsrc${j}x${q}`;let X=this.tileSrc&&this.tileSrc.key===gt?this.tileSrc.tex:null;X||(this.tileSrc&&this.gl.deleteTexture(this.tileSrc.tex),X=O(this.gl,j,q),this.tileSrc={key:gt,tex:X}),nt(this.gl,X,d),this._run(ft,t,[R,E],[P,_],[n,o],L,c,X);const At=this._read(ft.OUT,G-R,V-E,lt,ht);p.putImageData(At,G,V),F++,a&&a(F/w),await Zt()}for(const k of M)this._dropSet(k);return this.tileSrc&&(this.gl.deleteTexture(this.tileSrc.tex),this.tileSrc=null),d.width=d.height=0,f}_set(t,r,n){const o=this.gl;let a=this.sets.get(t);return a&&a.w===r&&a.h===n||(a&&this._dropSet(t),a={w:r,h:n,src:O(o,r,n),C:H(o,r,n,this.hdr),D:H(o,r,n,this.hdr),OUT:H(o,r,n,!1),pyr:[],bloom:[]},this.sets.set(t,a)),a}_dropSet(t){const r=this.sets.get(t);if(!r)return;const n=this.gl;n.deleteTexture(r.src),[r.C,r.D,r.OUT,...r.pyr.slice(1),...r.bloom].forEach(o=>it(n,o)),this.sets.delete(t)}_draw(t,r,n,o,a){const u=this.gl;u.bindFramebuffer(u.FRAMEBUFFER,n?n.fbo:null),u.viewport(0,0,o,a),t.use(r),u.bindVertexArray(this.vao),u.drawArrays(u.TRIANGLES,0,3)}_read(t,r,n,o,a){const u=this.gl,c=new Uint8ClampedArray(o*a*4);return u.bindFramebuffer(u.FRAMEBUFFER,t.fbo),u.readPixels(r,n,o,a,u.RGBA,u.UNSIGNED_BYTE,c),u.bindFramebuffer(u.FRAMEBUFFER,null),new ImageData(c,o,a)}_levels(t,r,n){const o=this.gl,a=[n];let u=n.w,c=n.h,l=1;for(;l<Jt&&Math.min(u,c)>6;){u=Math.max(1,Math.ceil(u/2)),c=Math.max(1,Math.ceil(c/2));let s=r[l];(!s||s.w!==u||s.h!==c)&&(it(o,s),s=r[l]=H(o,u,c,this.hdr));const h=a[l-1];this._draw(this.p.down,{uIn:h,uTexel:[1/h.w,1/h.h]},s,u,c),a.push(s),l++}return a}_buildProxy(t,r){const n={long:Math.max(t.w,t.h),pyr:null,bloom:null};if((r.clarity!==0||r.hdrTone>0||r.miniature.amount>0||r.watercolor>0||r.skinSoft>0)&&(n.pyr=this._levels(t,t.pyr,t.C)),r.diffusion.amount>0){let o=t.bloom[0];(!o||o.w!==t.w||o.h!==t.h)&&(it(this.gl,o),o=t.bloom[0]=H(this.gl,t.w,t.h,this.hdr)),this._draw(this.p.bright,{uIn:t.C,uThr:r.diffusion.threshold},o,t.w,t.h);const a=this._levels(t,t.bloom,o);n.bloom=a}return n}_derive(t,r,n){const o=Math.max(r,n),a=o/2e3,u=t.downscale>0&&o>t.downscale*1.05?o/t.downscale:0,c=t.pixelate>0?o/t.pixelate:0;let l=8*Math.max(u,a);return{L:o,unit:a,downCell:u,pixBlock:c,jpegBlock:l>=3?l:0,sharpR:Math.max(.6,t.sharpRadius*a),grainCell:Math.max(.05,t.grain.size*a),noiseCell:Math.max(u,a,.6)}}_updateCurve(t){const r=t._curveT??1,n=JSON.stringify([t.curve,t.curveR,t.curveG,t.curveB,t._curveNeutral,r]);if(n===this.curveKey)return;this.curveKey=n;const o=xt(t),a=xt(t._curveNeutral||{}),u=this.curveBuf;for(let l=0;l<u.length;l++)u[l]=a[l]+(o[l]-a[l])*r;const c=this.gl;c.bindTexture(c.TEXTURE_2D,this.curveTex),c.texSubImage2D(c.TEXTURE_2D,0,0,0,S,1,c.RGBA,c.FLOAT,u)}_gradeUniforms(t,r,n){const o=[.2126,.7152,.0722];let a=Math.exp(.3*t.temperature+.025*t.wbShift[0]),u=Math.exp(-.25*t.tint),c=Math.exp(-.3*t.temperature+.025*t.wbShift[1]);const l=a*o[0]+u*o[1]+c*o[2],s=new Float32Array(24);let h=!1;Xt.forEach((x,b)=>{const w=t.hsl[x]||[0,0,0];s[b*3]=w[0],s[b*3+1]=w[1],s[b*3+2]=w[2],(w[0]||w[1]||w[2])&&(h=!0)});const f=t.mixer,p=f[0]+f[1]+f[2],d=Math.abs(p)<.001?o:f.map(x=>x/p),v=t.lut?this.luts.get(t.lut):null;return this._updateCurve(t),{uSrc:n,uCurve:this.curveTex,uExposure:t.exposure,uWb:[a/l,u/l,c/l],uContrast:t.contrast,uLutOn:!!v,uLut:v?v.tex:null,uLutSize:v?v.size:2,uLutAmount:t.lutAmount,uHighlights:t.highlights,uShadows:t.shadows,uWhites:t.whites,uBlacks:t.blacks,uMidtone:t.midtone,uHslOn:h,uHsl:s,uHueShift:t.hueShift,uSplit:[t.shadowTint.hue,t.shadowTint.amount,t.highlightTint.hue,t.highlightTint.amount],uBalance:t.balance,uSat:t.saturation,uVib:t.vibrance,uChrome:t.colorChrome,uChromeBlue:t.colorChromeBlue,uMono:t.mono,uMixer:d,uTone:[t.toning.hue,t.toning.amount],uKeep:[t.keepColor.hue,t.keepColor.width,t.keepColor.amount],uWarp:t.warp}}_run(t,r,n,o,a,u,c,l=t.src){const s=a[0],h=a[1],f=this._derive(r,s,h),p={uTileOrigin:n,uTileSize:o,uImageSize:a};this._draw(this.p.grade,{...this._gradeUniforms(r,t,l),...p,uSrcRect:u},t.C,t.w,t.h),c||(c=this._buildProxy(t,r));const d={...p,uC:t.C,uCTexel:[1/t.w,1/t.h],uSharp:r.sharpness,uSharpR:f.sharpR,uClarity:r.clarity,uHdr:r.hdrTone,uWater:r.watercolor,uOutline:r.outline,uSkin:r.skinSoft,uMini:[r.miniature.amount,r.miniature.center,r.miniature.width],uDiff:0,uPN:0,uPLong:c.long};if(c.pyr){const v=c.pyr.slice(0,8),x=new Float32Array(16);v.forEach((b,w)=>{d[`uP${w}`]=b,x[w*2]=b.w,x[w*2+1]=b.h});for(let b=v.length;b<8;b++)x[b*2]=1,x[b*2+1]=1;d.uPS=x,d.uPN=v.length}if(c.bloom&&r.diffusion.amount>0){const v=c.bloom,x=v.length,b=N=>v[Math.min(x-1,Math.max(0,Math.round(Math.log2(Math.max(1,N*c.long)))))],w=r.diffusion.radius,M=b(w*.35),F=b(w),k=b(w*2.4);Object.assign(d,{uDiff:r.diffusion.amount,uBl0:M,uBl1:F,uBl2:k,uBl0Size:[M.w,M.h],uBl1Size:[F.w,F.h],uBl2Size:[k.w,k.h]})}return this._draw(this.p.detail,d,t.D,t.w,t.h),this._draw(this.p.finish,{...p,uD:t.D,uLofiMix:r._lofiT??1,uDownCell:f.downCell,uPixBlock:f.pixBlock,uPosterize:r.posterize,uPostMode:r.posterizeMode==="luma"?1:0,uJpeg:f.jpegBlock?r.jpeg:0,uJpegBlock:f.jpegBlock||8,uNoise:r.noise,uNoiseCell:f.noiseCell,uVig:[r.vignette.amount,r.vignette.radius,r.vignette.feather],uGrain:[r.grain.amount,f.grainCell]},t.OUT,t.w,t.h),c}}const Qt=(e,t)=>e.reduce((r,n,o)=>Math.abs(n-t)<Math.abs(e[r]-t)?o:r,0),g=(e,t,r,n,o={})=>({type:"slider",label:e,min:t,max:r,step:1,apply:n,...o}),y=(e,t,r,n,o,a={})=>({type:"segment",label:e,options:t,values:r,from:u=>Qt(r,n(u)),apply:(u,c,l)=>o(u,r[c],l,c),...a}),Z=(e,t,r,n={})=>({type:"segment",label:e,options:t,from:()=>0,apply:(o,a,u)=>{const c=r[a];typeof c=="function"?c(o,u):c&&Et(o,c)},...n});function Et(e,t){for(const r in t){const n=t[r];n&&typeof n=="object"&&!Array.isArray(n)?Et(e[r],n):e[r]=n}}const T={none:[.2126,.7152,.0722],yellow:[.42,.62,-.04],orange:[.58,.5,-.08],red:[.88,.3,-.18],green:[.02,1.1,-.12]};function te(e){let t=Math.floor(e*2147483648)||1;return()=>(t=t*16807%2147483647)/2147483647}const bt=(e,t,r)=>y(e,["關","弱","中","強"].slice(0,t.length),t,n=>n.grain.amount,(n,o)=>{n.grain.amount=o},r),wt={saturation:g("飽和度",-4,4,(e,t)=>{e.saturation+=t*.08},{color:!0}),contrast:g("對比",-4,4,(e,t)=>{e.contrast+=t*.1}),sharpness:g("銳利度",-4,4,(e,t)=>{e.sharpness+=t*.12}),hue:g("色相",-4,4,(e,t)=>{e.hueShift+=t*5},{color:!0}),key:g("高調／低調",-4,4,(e,t)=>{e.midtone+=t*.09}),grainStrength:bt("顆粒強度",[0,.25,.5,.8],{filmOnly:!0}),grainSize:y("顆粒大小",["小","中","大"],[.8,1.3,2],e=>e.grain.size,(e,t)=>{e.grain.size=t},{filmOnly:!0}),hdf:y("HDF",["關","開"],[0,1],e=>e.diffusion.amount>0?1:0,(e,t)=>{t&&!e.diffusion.amount&&(e.diffusion.amount=.5,e.diffusion.threshold=.55,e.diffusion.radius=.03,e.contrast-=.06),t||(e.diffusion.amount=0)}),hdfStrength:g("HDF 強度",-4,4,(e,t)=>{e.diffusion.amount=Math.max(0,e.diffusion.amount+t*.1)}),crossVariant:Z("變體",["基本","洋紅","黃","綠","隨機"],[null,{tint:.3,highlightTint:{hue:325,amount:.12}},{temperature:.22,highlightTint:{hue:55,amount:.16}},{tint:-.32,shadowTint:{hue:150,amount:.14}},(e,t)=>{const r=te(t.crossSeed??.5);e.temperature+=(r()-.5)*.6,e.tint+=(r()-.5)*.6,e.shadowTint={hue:r()*360,amount:.08+r()*.1},e.highlightTint={hue:r()*360,amount:.06+r()*.1}}],{reroll:4}),shadowsM:g("陰影",-4,4,(e,t)=>{e.shadows+=t*.08}),clarityM:g("清晰度",-4,4,(e,t)=>{e.clarity+=t*.1}),toningM:y("色調",["無","棕褐","硒","藍"],[0,1,2,3],e=>e.toning.amount>0?1:0,(e,t)=>{e.toning=[{hue:0,amount:0},{hue:32,amount:.3},{hue:280,amount:.1},{hue:214,amount:.24}][t]}),grainM:bt("顆粒",[0,.25,.5,.8]),redFilter:y("紅色濾鏡",["關","開"],[0,1],e=>e.mixer[0]>.6?1:0,(e,t)=>{e.mixer=t?T.red:T.none}),fujiGrain:y("顆粒效果",["關","弱","強"],[0,.3,.55],e=>e.grain.amount,(e,t)=>{e.grain.amount=t}),fujiGrainSize:y("顆粒大小",["小","大"],[1,1.8],e=>e.grain.size,(e,t)=>{e.grain.size=t}),colorChrome:y("Color Chrome",["關","弱","強"],[0,.5,1],e=>e.colorChrome,(e,t)=>{e.colorChrome=t},{color:!0}),colorChromeBlue:y("Color Chrome Blue",["關","弱","強"],[0,.5,1],e=>e.colorChromeBlue,(e,t)=>{e.colorChromeBlue=t},{color:!0}),wbR:g("白平衡偏移 R",-9,9,(e,t)=>{e.wbShift[0]+=t},{color:!0}),wbB:g("白平衡偏移 B",-9,9,(e,t)=>{e.wbShift[1]+=t},{color:!0}),highlightTone:g("亮部色調",-2,4,(e,t)=>{e.highlights+=t*.12}),shadowTone:g("暗部色調",-2,4,(e,t)=>{e.shadows-=t*.12}),color:g("色彩",-4,4,(e,t)=>{e.saturation+=t*.08},{color:!0}),clarity:g("清晰度",-5,5,(e,t)=>{e.clarity+=t*.1}),mediumFormat:y("中片幅質感",["關","弱","強"],[0,1,2],()=>1,(e,t)=>ee(e,t),{always:!0}),aspect:{type:"segment",label:"畫面比例",options:["原始","3:2","4:3","1:1","16:9","65:24"],ratios:[0,3/2,4/3,1,16/9,65/24],from:()=>0,apply:()=>{},geometry:!0},lContrast:g("對比",-2,2,(e,t)=>{e.contrast+=t*.15}),lHighlights:g("亮部",-2,2,(e,t)=>{e.highlights+=t*.15}),lShadows:g("暗部",-2,2,(e,t)=>{e.shadows+=t*.15}),lSharpness:g("銳利度",-2,2,(e,t)=>{e.sharpness+=t*.2}),lSaturation:g("飽和度",-2,2,(e,t)=>{e.saturation+=t*.15},{color:!0}),sContrast:g("對比",-9,9,(e,t)=>{e.contrast+=t*.045}),sHighlights:g("亮部",-9,9,(e,t)=>{e.highlights+=t*.05}),sShadows:g("暗部",-9,9,(e,t)=>{e.shadows+=t*.05}),sFade:g("褪色",0,9,(e,t)=>{e.blacks+=t*.012}),sSaturation:g("飽和度",-9,9,(e,t)=>{e.saturation+=t*.04},{color:!0}),sSharpness:g("銳利度",-9,9,(e,t)=>{e.sharpness+=t*.06}),sClarity:g("清晰度",-9,9,(e,t)=>{e.clarity+=t*.05}),rContrast:g("對比",-3,3,(e,t)=>{e.contrast+=t*.12}),rSaturation:g("飽和度",-3,3,(e,t)=>{e.saturation+=t*.1},{color:!0}),rSharpness:g("銳利度",-3,3,(e,t)=>{e.sharpness+=t*.15}),toyVariant:Z("色調",["標準","冷","暖","綠","洋紅"],[null,{temperature:-.3},{temperature:.3},{tint:-.35},{tint:.35}]),posterVariant:Z("色彩",["彩色","黑白"],[null,{mono:1,posterizeMode:"luma"}]),partialVariant:Z("保留色",["紅","綠","藍","黃"],[null,{keepColor:{hue:120,width:45}},{keepColor:{hue:215,width:40}},{keepColor:{hue:55,width:25}}]),miniPos:g("清晰位置",-5,5,(e,t)=>{e.miniature.center=Math.min(.95,Math.max(.05,e.miniature.center+t*.07))}),cSharpness:g("銳利度",-4,4,(e,t)=>{e.sharpness+=t*.12}),cContrast:g("對比",-4,4,(e,t)=>{e.contrast+=t*.1}),cSaturation:g("飽和度",-4,4,(e,t)=>{e.saturation+=t*.08},{color:!0}),cTone:g("色調",-4,4,(e,t)=>{e.hueShift+=t*2.5},{color:!0}),canonFilter:y("濾鏡效果",["無","黃","橙","紅","綠"],[0,1,2,3,4],()=>0,(e,t)=>{e.mixer=[T.none,T.yellow,T.orange,T.red,T.green][t]},{monoOnly:!0}),canonToning:y("色調效果",["無","棕褐","藍","紫","綠"],[0,1,2,3,4],()=>0,(e,t)=>{e.toning=[{hue:0,amount:0},{hue:32,amount:.32},{hue:214,amount:.26},{hue:285,amount:.2},{hue:140,amount:.2}][t]},{monoOnly:!0}),xContrast:g("對比",-5,5,(e,t)=>{e.contrast+=t*.08}),xHighlights:g("亮部",-5,5,(e,t)=>{e.highlights+=t*.07}),xShadows:g("暗部",-5,5,(e,t)=>{e.shadows+=t*.07}),xSaturation:g("飽和度",-5,5,(e,t)=>{e.saturation+=t*.07},{color:!0}),xTone:g("色調",-5,5,(e,t)=>{e.temperature+=t*.04},{color:!0}),xSharpness:g("銳利度",-5,5,(e,t)=>{e.sharpness+=t*.1}),xGrain:y("顆粒",["關","低","標準","高"],[0,.22,.42,.65],e=>e.grain.amount,(e,t)=>{e.grain.amount=t}),chFrame:{type:"segment",label:"相框",options:["無","白邊","片框","底片","幻燈片"],from:()=>0,apply:()=>{},overlay:!0},chDate:{type:"segment",label:"日期戳記",options:["關","開"],from:()=>0,apply:()=>{},overlay:!0},skinSoft:y("柔膚效果",["關","開"],[0,1],e=>e.skinSoft>0?1:0,(e,t)=>{e.skinSoft=t?.7:0})};function ee(e,t){const r=[0,1,1.8][t];e.grain.size*=1-.22*r,e.sharpRadius*=1+.35*r,e.contrast-=.03*r,e.highlights-=.03*r,e.shadows+=.03*r}const m=(e={})=>({mono:1,...e}),ct={hue:32,amount:.34},i=(e,t,r={})=>({name:e,params:t,...r}),re={"gr-standard":i("Standard",{contrast:.12,sharpness:.28,saturation:.04,clarity:.06}),"gr-vivid":i("Vivid",{saturation:.38,vibrance:.12,contrast:.26,sharpness:.4}),"gr-monotone":i("Monotone",m({contrast:.12,sharpness:.22}),{film:!0}),"gr-soft-monotone":i("Soft Monotone",m({contrast:-.38,blacks:.04,highlights:.14,midtone:.06,sharpness:-.05}),{film:!0}),"gr-hard-monotone":i("Hard Monotone",m({contrast:.62,sharpness:.75,clarity:.25}),{film:!0}),"gr4-hi-contrast-bw":i("Hi-Contrast B&W",m({mixer:[.3,.6,.1],curve:[[0,0],[.22,.03],[.45,.36],[.7,.86],[1,1]],contrast:.55,blacks:-.04,clarity:.35,sharpness:.45,vignette:{amount:.6,radius:.55,feather:.75},grain:{amount:.75,size:1.6}}),{film:!0}),"gr-negative-film":i("Negative Film",{contrast:-.2,saturation:-.04,curve:[[0,.05],[.5,.5],[1,.96]],shadowTint:{hue:186,amount:.12},highlightTint:{hue:36,amount:.09}},{film:!0}),"gr-positive-film":i("Positive Film",{saturation:.32,contrast:.36,hsl:{yellow:[-6,.12,0],green:[-14,.15,-.05],aqua:[-6,0,0]},shadowTint:{hue:190,amount:.14},highlightTint:{hue:58,amount:.07}},{film:!0}),"gr-cinema-yellow":i("Cinema (Yellow)",{temperature:.12,tint:-.02,saturation:-.12,contrast:-.12,blacks:.03,highlightTint:{hue:42,amount:.13},shadowTint:{hue:34,amount:.06}},{film:!0}),"gr-cinema-green":i("Cinema (Green)",{temperature:-.06,tint:-.16,saturation:-.18,contrast:-.05,shadowTint:{hue:172,amount:.14},highlightTint:{hue:150,amount:.05}},{film:!0}),"gr-bleach-bypass":i("Bleach Bypass",{saturation:-.55,contrast:.46,clarity:.22,sharpness:.2,highlightTint:{hue:210,amount:.03}}),"gr-retro":i("Retro",{saturation:-.36,temperature:.1,contrast:-.1,curve:[[0,.07],[1,.92]],highlightTint:{hue:46,amount:.15},shadowTint:{hue:30,amount:.08},vignette:{amount:.36,radius:.6,feather:.7}}),"gr-cross-processing":i("Cross Processing",{contrast:.42,saturation:.32,curveR:[[0,0],[.25,.3],[.75,.86],[1,1]],curveG:[[0,.02],[.5,.55],[1,.95]],curveB:[[0,.16],[.5,.45],[1,.78]]},{extra:["crossVariant"]}),"gr-hdr-tone":i("HDR Tone",{hdrTone:.85,saturation:.15,clarity:.2,sharpness:.2})},oe={"grm-standard":i("Standard",m({contrast:.04,sharpness:.2,clarity:.05,curve:[[0,0],[.25,.23],[.75,.78],[1,1]]})),"grm-solid":i("Solid",m({contrast:.36,sharpness:.6,clarity:.22})),"grm-soft":i("Soft",m({contrast:-.32,highlights:.1,blacks:.03,sharpness:-.08})),"grm-hi-contrast":i("Hi-Contrast",m({contrast:.72,blacks:-.03})),"grm-grainy":i("Grainy",m({contrast:.3,highlights:-.28,shadows:-.16,blacks:-.02,grain:{amount:.6,size:1.5}})),"grm-hdr-tone":i("HDR Tone",m({hdrTone:.9,clarity:.2}))},Q={contrast:.2,shadows:-.12,sharpness:.25,grain:{amount:.18,size:.7}},ae={"fj-provia":i("PROVIA / 標準",{contrast:.08,saturation:.08}),"fj-velvia":i("Velvia / 鮮豔",{saturation:.46,vibrance:.15,contrast:.3,shadows:-.08,hsl:{green:[0,.1,-.05],blue:[0,.12,-.1]}}),"fj-astia":i("ASTIA / 柔和",{contrast:-.12,saturation:.1,highlights:-.05,hsl:{red:[0,-.05,.04],orange:[0,-.06,.06],blue:[0,.16,0]}}),"x100vi-classic-chrome":i("Classic Chrome",{saturation:-.28,curve:[[0,0],[.12,.07],[.3,.25],[.55,.55],[.8,.82],[1,.965]],contrast:.12,highlights:-.2,hsl:{red:[5,-.12,-.1],orange:[-2,-.08,0],yellow:[-6,-.3,-.04],green:[-8,-.4,-.14],aqua:[-8,-.35,-.16],blue:[-10,-.32,-.2],purple:[-6,-.3,-.1],magenta:[0,-.2,-.05]},shadowTint:{hue:195,amount:.05},highlightTint:{hue:40,amount:.03},colorChrome:.5,sharpness:.1}),"fj-reala-ace":i("REALA ACE",{contrast:.24,saturation:.05,sharpness:.12,clarity:.06}),"fj-pro-neg-hi":i("PRO Neg. Hi",{contrast:.06,saturation:-.06,hsl:{orange:[0,-.08,.05],red:[0,-.05,.03]}}),"fj-pro-neg-std":i("PRO Neg. Std",{contrast:-.2,saturation:-.12,blacks:.01,hsl:{orange:[0,-.08,.06]}}),"fj-classic-neg":i("Classic Neg.",{saturation:-.2,contrast:.32,curve:[[0,0],[.2,.13],[.5,.5],[.8,.86],[1,.97]],shadowTint:{hue:168,amount:.13},highlightTint:{hue:352,amount:.07},hsl:{red:[0,-.05,-.05],yellow:[-4,-.15,0],green:[-6,-.25,-.05],blue:[-5,-.2,-.06]}}),"fj-nostalgic-neg":i("Nostalgic Neg.",{temperature:.06,contrast:-.06,shadows:.12,saturation:-.04,highlightTint:{hue:38,amount:.15},hsl:{yellow:[-3,0,.03]}}),"fj-eterna":i("ETERNA / 電影",{saturation:-.4,contrast:-.3,shadows:-.06,curve:[[0,0],[.2,.15],[.5,.47],[.85,.83],[1,.94]],shadowTint:{hue:186,amount:.06}}),"fj-eterna-bb":i("ETERNA Bleach Bypass",{saturation:-.68,contrast:.5,clarity:.15}),"fj-acros":i("ACROS",m({...Q})),"fj-acros-ye":i("ACROS + Ye",m({...Q,mixer:T.yellow})),"fj-acros-r":i("ACROS + R",m({...Q,mixer:T.red,contrast:.32})),"fj-acros-g":i("ACROS + G",m({...Q,mixer:T.green})),"fj-mono":i("Monochrome",m({contrast:.08})),"fj-mono-ye":i("Monochrome + Ye",m({contrast:.08,mixer:T.yellow})),"fj-mono-r":i("Monochrome + R",m({contrast:.16,mixer:T.red})),"fj-mono-g":i("Monochrome + G",m({contrast:.08,mixer:T.green})),"fj-sepia":i("Sepia",m({toning:ct,contrast:.02}))},ie={"lq-standard":i("Standard",{contrast:.15,saturation:-.06,shadows:-.1,clarity:.05,curve:[[0,0],[.2,.15],[.6,.6],[1,1]]}),"lq-vivid":i("Vivid",{saturation:.3,contrast:.28,shadows:-.08}),"lq-natural":i("Natural",{contrast:-.02,saturation:-.16}),"lq-bw-natural":i("B&W Natural",m({contrast:.05})),"lq-bw-high-contrast":i("B&W High Contrast",m({contrast:.66,blacks:-.03,clarity:.15})),"lq-classic":i("Classic",{contrast:.3,saturation:-.1,temperature:.05,blacks:.03,highlightTint:{hue:40,amount:.08}},{locked:!0}),"lq-contemporary":i("Contemporary",{temperature:-.08,contrast:.1,saturation:-.08,highlights:-.05,shadowTint:{hue:200,amount:.06}},{locked:!0}),"lq-eternal":i("Eternal",{contrast:.36,saturation:.3,tint:.12,highlightTint:{hue:320,amount:.06}},{locked:!0}),"lq-pure":i("Pure",{exposure:.06,contrast:-.15,saturation:-.02,highlights:-.15,shadows:.16,blacks:.02},{locked:!0}),"lq-cine":i("Cine",{temperature:.1,contrast:-.1,highlights:-.16,saturation:-.05,shadowTint:{hue:30,amount:.05},grain:{amount:.15,size:1.2}},{locked:!0}),"lq-chrome":i("Chrome",{saturation:.3,contrast:.3,colorChrome:.6,shadowTint:{hue:200,amount:.06}},{locked:!0}),"lq-teal":i("Teal",{saturation:-.05,shadowTint:{hue:184,amount:.22},highlightTint:{hue:30,amount:.15},hsl:{orange:[0,.1,0],blue:[-14,0,0],aqua:[-6,.1,0]}},{locked:!0}),"lq-brass":i("Brass",{temperature:.15,contrast:.1,saturation:-.2,highlightTint:{hue:45,amount:.2},shadowTint:{hue:35,amount:.1}},{locked:!0}),"lq-bleach":i("Bleach",{saturation:-.6,contrast:.5},{locked:!0}),"lq-greg-williams":i("Greg Williams",{contrast:.4,temperature:.1,saturation:-.1,clarity:.2,highlightTint:{hue:35,amount:.1},vignette:{amount:.25,radius:.6,feather:.7},grain:{amount:.2,size:1.2}},{locked:!0}),"lq-selenium":i("Selenium",m({toning:{hue:275,amount:.1},contrast:.25}),{locked:!0}),"lq-sepia":i("Sepia",m({toning:{hue:32,amount:.33}}),{locked:!0}),"lq-blue":i("Blue",m({toning:{hue:215,amount:.28}}),{locked:!0}),"lq-silver":i("Silver",m({toning:{hue:210,amount:.04},contrast:.15,highlights:.1,sharpness:.1}),{locked:!0})},ne={"sn-st":i("ST（Standard）",{contrast:.08,saturation:.05}),"sn-pt":i("PT（Portrait）",{sharpness:-.25,contrast:-.05,saturation:-.05,hsl:{orange:[0,-.05,.06]}}),"sn-nt":i("NT（Neutral）",{saturation:-.3,sharpness:-.15,contrast:-.05}),"sn-vv":i("VV（Vivid）",{saturation:.36,contrast:.2,hsl:{green:[0,.15,0],blue:[0,.15,-.05],red:[0,.1,0]}}),"sn-vv2":i("VV2（Vivid 2）",{saturation:.3,vibrance:.2,exposure:.1,clarity:.12,contrast:.1}),"sn-fl":i("FL（Film）",{saturation:-.15,contrast:.3,sharpness:.2,shadowTint:{hue:195,amount:.06},hsl:{blue:[-8,-.1,-.1],aqua:[-6,-.1,-.05],green:[-8,-.1,-.05]}}),"sn-fl2":i("FL2（Film 2）",{contrast:.15,saturation:-.25,temperature:.05,blacks:.03,highlightTint:{hue:40,amount:.06}}),"sn-fl3":i("FL3（Film 3）",{contrast:.42,saturation:.25,shadowTint:{hue:200,amount:.05}}),"sn-in":i("IN（Instant）",{contrast:-.35,saturation:-.3,blacks:.1,highlights:-.1,highlightTint:{hue:50,amount:.04}}),"sn-sh":i("SH（Soft Highkey）",{exposure:.3,contrast:-.25,saturation:.12,highlights:-.1,blacks:.03}),"sn-bw":i("BW（Black & White）",m({contrast:.1})),"sn-se":i("SE（Sepia）",m({toning:ct}))},Mt={contrast:.45,saturation:.2,sharpness:-.1,vignette:{amount:.72,radius:.45,feather:.8}},Pt={miniature:{amount:1,center:.55,width:.18},saturation:.35,contrast:.2},se={saturation:-.4,temperature:.12,contrast:-.05,blacks:.08,highlightTint:{hue:45,amount:.18},vignette:{amount:.3,radius:.6,feather:.7}},ue={"rx-standard":i("Standard",{contrast:.05,saturation:.05}),"rx-vivid":i("Vivid",{saturation:.4,contrast:.2}),"rx-neutral":i("Neutral",{saturation:-.25,contrast:-.08,sharpness:-.1}),"rx-clear":i("Clear",{contrast:.1,highlights:.12,whites:.12,clarity:.06}),"rx-deep":i("Deep",{exposure:-.15,contrast:.25,saturation:.15,shadows:-.1}),"rx-light":i("Light",{exposure:.25,contrast:-.2,blacks:.03}),"rx-portrait":i("Portrait",{sharpness:-.15,contrast:-.05,hsl:{orange:[0,-.05,.08]}}),"rx-landscape":i("Landscape",{saturation:.2,sharpness:.3,clarity:.1,hsl:{green:[0,.25,0],blue:[0,.25,-.05]}}),"rx-sunset":i("Sunset",{temperature:.22,saturation:.1,hsl:{red:[0,.25,0],orange:[0,.3,0]}}),"rx-night":i("Night Scene",{exposure:-.3,contrast:-.2,saturation:-.1}),"rx-autumn":i("Autumn Leaves",{contrast:.1,saturation:.05,hsl:{red:[0,.35,0],orange:[0,.35,0],yellow:[0,.3,0]}}),"rx-bw":i("Black & White",m()),"rx-sepia":i("Sepia",m({toning:ct})),"rx-toy":i("Toy Camera",{...Mt},{locked:!0,extra:["toyVariant"]}),"rx-pop":i("Pop Color",{saturation:.8,vibrance:.3,contrast:.15},{locked:!0}),"rx-poster":i("Posterization",{posterize:4,saturation:.4,contrast:.2},{locked:!0,extra:["posterVariant"]}),"rx-retro":i("Retro Photo",{...se},{locked:!0}),"rx-soft-highkey":i("Soft High-key",{exposure:.35,contrast:-.3,saturation:-.1,blacks:.05,highlightTint:{hue:200,amount:.03},diffusion:{amount:.3,threshold:.5,radius:.02}},{locked:!0}),"rx-partial":i("Partial Color",m({keepColor:{hue:2,width:32,amount:1},saturation:.25,contrast:.08}),{locked:!0,extra:["partialVariant"]}),"rx-hc-mono":i("High Contrast Mono",m({contrast:.85,clarity:.3,blacks:-.05}),{locked:!0}),"rx-soft-focus":i("Soft Focus",{sharpness:-.6,contrast:-.1,diffusion:{amount:.55,threshold:.2,radius:.02}},{locked:!0}),"rx-hdr-painting":i("HDR Painting",{hdrTone:1,saturation:.3,clarity:.4},{locked:!0}),"rx-rich-mono":i("Rich-tone Mono",m({hdrTone:.45,contrast:.15}),{locked:!0}),"rx-miniature":i("Miniature",{...Pt},{locked:!0,extra:["miniPos"]}),"rx-watercolor":i("Watercolor",{watercolor:.9,saturation:.2,contrast:-.1,blacks:.05,posterize:12,grain:{amount:.22,size:2.6}},{locked:!0}),"rx-illustration":i("Illustration",{outline:.9,posterize:6,saturation:.35,contrast:.15},{locked:!0})},ce={"cn-auto":i("Auto",{exposure:.06,contrast:.02,saturation:.04,vibrance:.3,shadows:.08}),"cn-standard":i("Standard",{contrast:.16,saturation:.12,sharpness:.22}),"cn-portrait":i("Portrait",{exposure:.05,tint:.03,contrast:-.03,sharpness:-.1,hsl:{orange:[0,-.05,.08],red:[0,-.03,.06]}}),"cn-landscape":i("Landscape",{saturation:.15,sharpness:.3,hsl:{green:[0,.3,0],blue:[0,.3,-.05]}}),"cn-fine-detail":i("Fine Detail",{sharpness:.6,sharpRadius:.7,clarity:.1}),"cn-neutral":i("Neutral",{saturation:-.25,contrast:-.1}),"cn-faithful":i("Faithful",{saturation:-.08,contrast:-.03}),"cn-monochrome":i("Monochrome",m(),{extra:["canonFilter","canonToning"]}),"cn-grainy-bw":i("Grainy B/W",m({contrast:.55,blacks:-.02,grain:{amount:.85,size:1.8}}),{locked:!0}),"cn-soft-focus":i("Soft Focus",{sharpness:-.5,diffusion:{amount:.5,threshold:.25,radius:.022}},{locked:!0}),"cn-fisheye":i("Fish-eye",{warp:.75,saturation:.1,contrast:.08},{locked:!0}),"cn-art-bold":i("Art Bold",{saturation:.45,contrast:.3,hdrTone:.45,clarity:.3},{locked:!0}),"cn-water-painting":i("Water Painting",{watercolor:1,saturation:.1,posterize:10,grain:{amount:.25,size:3}},{locked:!0}),"cn-toy":i("Toy Camera",{...Mt,temperature:.12},{locked:!0}),"cn-miniature":i("Miniature",{...Pt},{locked:!0,extra:["miniPos"]})},le={"lx-standard":i("Standard",{contrast:.08,saturation:.05}),"lx-vivid":i("Vivid",{saturation:.35,contrast:.2}),"lx-natural":i("Natural",{saturation:-.1,contrast:-.08,sharpness:-.05}),"lx-l-classic":i("L.Classic",{saturation:-.3,contrast:-.15,blacks:.02,hsl:{green:[0,.06,.05]},curve:[[0,.02],[.3,.3],[.7,.71],[1,.98]]}),"lx-l-classic-neo":i("L.ClassicNeo",{contrast:-.12,saturation:-.1,exposure:.05,highlights:.05,shadowTint:{hue:185,amount:.11},hsl:{blue:[0,-.2,-.05]}}),"lx-l-classic-gold":i("L.ClassicGold",{temperature:.1,contrast:.05,saturation:-.05,highlightTint:{hue:40,amount:.16},diffusion:{amount:.15,threshold:.65,radius:.03}}),"lx-flat":i("Flat",{contrast:-.4,saturation:-.3,blacks:.02}),"lx-landscape":i("Landscape",{saturation:.15,hsl:{green:[0,.25,0],blue:[0,.25,-.05]}}),"lx-portrait":i("Portrait",{exposure:.04,tint:.03,contrast:-.06,sharpness:-.12,hsl:{orange:[0,-.06,.1],red:[0,-.04,.05]}}),"lx-cinelike-d2":i("Cinelike D2",{contrast:-.36,highlights:-.2,shadows:.2,saturation:-.12}),"lx-cinelike-v2":i("Cinelike V2",{contrast:.2,saturation:-.05,highlights:-.1,shadowTint:{hue:190,amount:.04}}),"lx-cinelike-a2":i("Cinelike A2",{contrast:-.1,saturation:-.08,highlights:-.12,temperature:.04}),"lx-monochrome":i("Monochrome",m()),"lx-l-monochrome":i("L.Monochrome",m({contrast:.2,blacks:-.03,curve:[[0,0],[.25,.22],[.75,.8],[1,1]]})),"lx-l-monochrome-d":i("L.Monochrome D",m({hdrTone:.4,contrast:.3,highlights:.1,shadows:-.1})),"lx-l-monochrome-s":i("L.Monochrome S",m({contrast:-.2,highlights:-.05,shadows:.08})),"lx-leica-monochrome":i("LEICA Monochrome",m({contrast:.45,shadows:-.15,blacks:-.03,clarity:.1}))},tt=(e,t)=>m({toning:{hue:e,amount:t},contrast:.25,pixelate:128,posterize:5,posterizeMode:"luma",jpeg:0}),he={"ch-original":i("原色",{}),"ch-bw":i("Black & White",m({contrast:.3,curve:[[0,.06],[1,.9]]})),"ch-cool":i("Cool Tone",{temperature:-.32,tint:.02,shadowTint:{hue:210,amount:.06}}),"ch-warm":i("Warm Tone",{temperature:.3,saturation:-.1,blacks:.04,highlightTint:{hue:40,amount:.12}}),"ch-pixel-yellow":i("Pixel Yellow",tt(48,.8)),"ch-pixel-red":i("Pixel Red",tt(2,.7)),"charmera-pixel-blue":i("Pixel Blue",tt(214,.75)),"ch-pixel-gray":i("Pixel Gray",tt(0,0))},rt={...re,...oe,...ae,...ie,...ne,...ue,...ce,...le,...he},C=(e,t)=>t.map(r=>`${e}-${r}`),yt=["gr-standard","gr-vivid","gr-monotone","gr-soft-monotone","gr-hard-monotone","gr4-hi-contrast-bw","gr-negative-film","gr-positive-film","gr-cinema-yellow","gr-cinema-green","gr-bleach-bypass","gr-retro","gr-cross-processing","gr-hdr-tone"],me=["gr-standard","gr-vivid","gr-monotone","gr-soft-monotone","gr-hard-monotone","gr4-hi-contrast-bw","gr-positive-film","gr-negative-film","gr-bleach-bypass","gr-retro","gr-cross-processing","gr-hdr-tone"],ut=["saturation","hue","key","contrast","sharpness","grainStrength","grainSize"],Tt=["fj-provia","fj-velvia","fj-astia","x100vi-classic-chrome","fj-reala-ace","fj-pro-neg-hi","fj-pro-neg-std","fj-classic-neg","fj-nostalgic-neg","fj-eterna","fj-eterna-bb","fj-acros","fj-acros-ye","fj-acros-r","fj-acros-g","fj-mono","fj-mono-ye","fj-mono-r","fj-mono-g","fj-sepia"],St=["fujiGrain","fujiGrainSize","colorChrome","colorChromeBlue","wbR","wbB","highlightTone","shadowTone","color","sharpness","clarity"],Ct=["sContrast","sHighlights","sShadows","sFade","sSaturation","sSharpness","sClarity"],fe={diffusion:{amount:.5,threshold:.55,radius:.03},contrast:-.06},ge=[{id:"ricoh-gr-iv",name:"Ricoh GR IV",short:"GR-IV",focal:"28mm",desc:"銳利、俐落，街拍的基準",controls:[...ut,"hdf"],filters:yt},{id:"ricoh-gr-iv-hdf",name:"Ricoh GR IV HDF",short:"GR-IV-HDF",focal:"28mm",desc:"高光柔和擴散，畫面帶霧感",base:fe,controls:ut,always:["hdfStrength"],filters:yt},{id:"ricoh-gr-iiix",name:"Ricoh GR IIIx",short:"GR-IIIx",focal:"40mm",desc:"稍窄視角，更安靜的觀看距離",controls:[...ut,"hdf"],filters:me},{id:"ricoh-gr-iv-mono",name:"Ricoh GR IV Monochrome",short:"GR-IV-Mono",focal:"28mm",desc:"只為黑白而生",controls:["contrast","shadowsM","clarityM","toningM","grainM","redFilter"],filters:C("grm",["standard","solid","soft","hi-contrast","grainy","hdr-tone"])},{id:"fujifilm-x100vi",name:"Fujifilm X100VI",short:"X100VI",focal:"35mm",desc:"底片模擬與配方",controls:St,filters:Tt},{id:"fujifilm-gfx100rf",name:"Fujifilm GFX100RF",short:"GFX100RF",focal:"28mm",desc:"中片幅的細膩階調",controls:St,always:["mediumFormat","aspect"],filters:Tt},{id:"leica-q3",name:"Leica Q3",short:"Q3",focal:"28mm",desc:"內斂、深沉的色彩",controls:["lContrast","lHighlights","lShadows","lSharpness","lSaturation"],filters:[...C("lq",["standard","vivid","natural","bw-natural","bw-high-contrast"]),...C("lq",["classic","contemporary","eternal","pure","cine","chrome","teal","brass","bleach","greg-williams","selenium","sepia","blue","silver"])],groups:[["Film Style",5],["Leica Looks",14]]},{id:"sony-rx1r-iii",name:"Sony RX1R III",short:"RX1R-III",focal:"35mm",desc:"全片幅隨身機的 Creative Look",controls:Ct,filters:C("sn",["st","pt","nt","vv","vv2","fl","fl2","fl3","in","sh","bw","se"])},{id:"sony-zv-1-ii",name:"Sony ZV-1 II",short:"ZV-1-II",focal:"18–50mm",desc:"輕巧的 Creative Look",controls:Ct,filters:C("sn",["st","pt","nt","vv","vv2","fl","in","sh","bw","se"])},{id:"sony-rx100-vii",name:"Sony RX100 VII",short:"RX100-VII",focal:"24–200mm",desc:"Creative Style 與 Picture Effect",controls:["rContrast","rSaturation","rSharpness"],filters:[...C("rx",["standard","vivid","neutral","clear","deep","light","portrait","landscape","sunset","night","autumn","bw","sepia"]),...C("rx",["toy","pop","poster","retro","soft-highkey","partial","hc-mono","soft-focus","hdr-painting","rich-mono","miniature","watercolor","illustration"])],groups:[["Creative Style",13],["Picture Effect",13]]},{id:"canon-g7x-iii",name:"Canon PowerShot G7X Mark III",short:"G7X-III",focal:"24–100mm",desc:"Picture Style 與創意濾鏡",controls:["cSharpness","cContrast","cSaturation","cTone"],filters:[...C("cn",["auto","standard","portrait","landscape","fine-detail","neutral","faithful","monochrome"]),...C("cn",["grainy-bw","soft-focus","fisheye","art-bold","water-painting","toy","miniature"])],groups:[["Picture Style",8],["Creative Filter",7]]},{id:"panasonic-lumix-l10",name:"Panasonic Lumix L10",short:"L10",focal:"",desc:"Photo Style 與 L.Classic 系列",controls:["xContrast","xHighlights","xShadows","xSaturation","xTone","xSharpness","xGrain","skinSoft"],filters:[...C("lx",["standard","vivid","natural","l-classic","l-classic-neo","l-classic-gold","flat","landscape","portrait","cinelike-d2","cinelike-v2","cinelike-a2"]),...C("lx",["monochrome","l-monochrome","l-monochrome-d","l-monochrome-s","leica-monochrome"])],groups:[["彩色",12],["黑白",5]]},{id:"kodak-charmera",name:"Kodak Charmera",short:"Charmera",focal:"",desc:"鑰匙圈尺寸的低傳真",base:{downscale:1440,sharpness:-.3,noise:.35,jpeg:.55,temperature:.06,tint:-.05,contrast:.08,blacks:.02,vignette:{amount:.4,radius:.55,feather:.8}},controls:[],always:["chFrame","chDate"],filters:["ch-original","ch-bw","ch-cool","ch-warm","ch-pixel-yellow","ch-pixel-red","charmera-pixel-blue","ch-pixel-gray"]}],ve=e=>ge.find(t=>t.id===e),xe=e=>rt[e];function _t(e,t){const r=rt[t],n=r.params.mono===1&&!(r.params.keepColor&&r.params.keepColor.amount),o=r.locked?[]:e.controls.filter(a=>{const u=wt[a];return!(u.color&&n||u.filmOnly&&!r.film)});return[...r.extra||[],...o,...e.always||[]].map(a=>({id:a,...wt[a]}))}function be(e,t){return $($(Lt,e.base),rt[t].params)}function we(e,t,r=1,n={}){const o=$(Lt,e.base),a=$(o,rt[t].params),u=Kt(o,a,r);for(const c of _t(e,t)){let l=n[c.id];l===void 0&&c.always&&(l=c.from(a)),l!==void 0&&c.apply(u,l,n)}return u}function ye(e,t,r,n,o){const a=_t(e,t).find(h=>h.geometry),u=a?a.ratios[r[a.id]??0]:0;if(!u)return[0,0,n,o];const c=n>=o?u:1/u;let l=n,s=Math.round(n/c);return s>o&&(s=o,l=Math.round(o*c)),[Math.round((n-l)/2),Math.round((o-s)/2),l,s]}export{ge as C,pe as E,_t as a,ve as b,ye as c,xe as d,be as f,de as p,we as r};
