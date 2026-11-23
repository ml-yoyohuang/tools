// GLSL sources for the single, data-driven grading pipeline.
// Pass A  (grade)  : steps 1–9   source  → C
// Pyramid          : blur levels of C (and a bright-pass) for steps 10 & 12
// Pass B1 (detail) : steps 10–12 C       → D
// Pass B2 (finish) : steps 13–16 D       → OUT
// Intermediate textures hold sRGB-encoded (perceptual) values; linear math decodes locally.

const HEAD = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler3D;
`;

const COMMON = `
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
`;

export const VERT = `${HEAD}
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

// ---------- Pass A: steps 1–9 ----------
export const GRADE = `${HEAD}${COMMON}
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
}`;

// ---------- Pyramid helpers ----------
export const DOWN = `${HEAD}
in vec2 vUv; out vec4 o;
uniform sampler2D uIn; uniform vec2 uTexel;
vec3 s(float x, float y) { return texture(uIn, vUv + vec2(x, y) * uTexel).rgb; }
void main() {
  vec3 r = s(0.0, 0.0) * 0.125
    + (s(-2.0, 2.0) + s(2.0, 2.0) + s(-2.0, -2.0) + s(2.0, -2.0)) * 0.03125
    + (s(0.0, 2.0) + s(-2.0, 0.0) + s(2.0, 0.0) + s(0.0, -2.0)) * 0.0625
    + (s(-1.0, 1.0) + s(1.0, 1.0) + s(-1.0, -1.0) + s(1.0, -1.0)) * 0.125;
  o = vec4(r, 1.0);
}`;

export const BRIGHT = `${HEAD}${COMMON}
in vec2 vUv; out vec4 o;
uniform sampler2D uIn; uniform float uThr;
void main() {
  vec3 p = texture(uIn, vUv).rgb;
  float k = smoothstep(uThr, min(uThr + 0.3, 1.0), luma(p));
  o = vec4(toLin(p) * k, 1.0);
}`;

// ---------- Pass B1: steps 10–12 (+ painterly / optical effects that need blur) ----------
export const DETAIL = `${HEAD}${COMMON}
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
}`;

// ---------- Pass B2: steps 13–16 ----------
export const FINISH = `${HEAD}${COMMON}
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
}`;

// ---------- Present (before/after split onto the visible canvas) ----------
export const PRESENT = `${HEAD}
in vec2 vUv; out vec4 o;
uniform sampler2D uOut, uOrig; uniform float uSplit;
void main() {
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  o = vec4(uv.x < uSplit ? texture(uOrig, uv).rgb : texture(uOut, uv).rgb, 1.0);
}`;
