import { el, svgEl } from '../../engine/dom';
import { bool, clamp, ease, num, str, PALETTE } from '../../engine/helpers';
import { fontString, glyphWidth100, graphemes } from '../../engine/text';
import type { EffectContext, EffectImpl, EffectRuntime } from '../../engine/types';

// value(t) tweens from → to (power2.out), holds, then rolls back (power2.inOut)
// so the loop closes on itself. Digit k shows a continuous wheel position:
//   odometer:   floor(v/10^k) + max(0, (v mod 10^k) − (10^k − 1))
//               → a higher digit only moves while every lower digit passes 9→0
//   continuous: (v / 10^k) mod 10
// Both land on exact integers, so 99 → 100 carries correctly. Each wheel is a
// strip 0…9,0 behind a masked window; leading zeros collapse their width so
// the line re-centres smoothly, and separators follow their digit.
let uid = 0;

async function loadGlyphs(font: string, chars: string, ms = 2500) {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    await Promise.race([document.fonts.load(font, chars), new Promise((r) => setTimeout(r, ms))]);
  } catch {
    /* fall back silently */
  }
}

async function create(ctx: EffectContext): Promise<EffectRuntime> {
  const W = ctx.width;
  const H = ctx.height;
  const { primary: fg, secondary: acc } = ctx.s;
  const from = Math.round(num(ctx, 'from', 0));
  const to = Math.round(num(ctx, 'to', 12480));
  const prefix = str(ctx, 'prefix', '累計 ');
  const suffix = str(ctx, 'suffix', ' 人');
  const dur = num(ctx, 'duration', 2.6);
  const sepOn = bool(ctx, 'separator', true);
  const mechanical = str(ctx, 'carry', 'odometer') !== 'continuous';
  const family = ctx.font.sans;
  await loadGlyphs(fontString(64, family, 900), prefix + suffix + '0123456789,');

  const digits = Math.max(1, String(Math.max(from, to)).length);
  // measure at 100px, then fit the full line to the stage
  const dw100 = Math.max(...'0123456789'.split('').map((d) => glyphWidth100(d, family, 900))) * 1.02;
  const sw100 = glyphWidth100(',', family, 900) * 1.05;
  const affix100 = (s: string, w: number) => graphemes(s).reduce((a, g) => a + glyphWidth100(g, family, w), 0);
  const nSep = sepOn ? Math.floor((digits - 1) / 3) : 0;
  const line100 = affix100(prefix, 700) * 0.62 + affix100(suffix, 700) * 0.62 + digits * dw100 + nSep * sw100;
  const fs = Math.max(8, Math.min((W * 0.86 * 100) / Math.max(1, line100), H * 0.34) * ctx.s.fontScale);
  const dw = (dw100 / 100) * fs;
  const sw = (sw100 / 100) * fs;
  const winH = fs * 1.18;
  const affFs = fs * 0.62;

  const row = el(
    'div',
    { style: { position: 'absolute', left: '50%', top: '50%', display: 'flex', alignItems: 'center', transform: 'translate(-50%,-50%)', whiteSpace: 'pre' } },
    ctx.root,
  );
  const affStyle = { font: fontString(affFs, family, 700), color: acc, lineHeight: '1', flex: 'none' };
  if (prefix) el('div', { text: prefix, style: { ...affStyle, marginRight: `${fs * 0.08}px` } }, row);
  const numBox = el('div', { style: { display: 'flex', alignItems: 'center', flex: 'none' } }, row);
  if (suffix) el('div', { text: suffix, style: { ...affStyle, marginLeft: `${fs * 0.08}px` } }, row);
  // underline that fills with progress
  const bar = el('div', { style: { position: 'absolute', left: '0', right: '0', bottom: `${-fs * 0.22}px`, height: `${Math.max(2, fs * 0.04)}px`, background: `${acc}33`, borderRadius: '99px', overflow: 'hidden' } }, row);
  const fill = el('div', { style: { height: '100%', width: '100%', background: acc, transformOrigin: '0 50%', borderRadius: '99px' } }, bar);

  const svg = svgEl('svg', { width: 0, height: 0 });
  Object.assign(svg.style, { position: 'absolute', width: '0', height: '0' });
  ctx.root.appendChild(svg);
  const defs = svgEl('defs', {}, svg);

  interface Wheel {
    k: number;
    slot: HTMLDivElement;
    strip: HTMLDivElement;
    blur: SVGFEGaussianBlurElement;
    fid: string;
    sep: HTMLDivElement | null;
    lastBlur: number;
  }
  const wheels: Wheel[] = [];
  for (let k = digits - 1; k >= 0; k--) {
    const slot = el(
      'div',
      {
        style: {
          position: 'relative',
          width: `${dw}px`,
          height: `${winH}px`,
          overflow: 'hidden',
          flex: 'none',
          WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, #000 22%, #000 78%, transparent 100%)',
          maskImage: 'linear-gradient(180deg, transparent 0%, #000 22%, #000 78%, transparent 100%)',
        },
      },
      numBox,
    );
    const strip = el('div', { style: { position: 'absolute', left: '0', top: '0', width: '100%', willChange: 'transform' } }, slot);
    for (let d = 0; d <= 10; d++)
      el('div', { text: String(d % 10), style: { height: `${winH}px`, display: 'flex', alignItems: 'center', justifyContent: 'center', font: fontString(fs, family, 900), color: fg, lineHeight: '1', fontVariantNumeric: 'tabular-nums' } }, strip);
    const fid = `kt-odo-${++uid}-${k}`;
    const filter = svgEl('filter', { id: fid, x: '-10%', y: '-30%', width: '120%', height: '160%' }, defs);
    const blur = svgEl('feGaussianBlur', { stdDeviation: '0 0' }, filter);
    let sep: HTMLDivElement | null = null;
    if (sepOn && k > 0 && k % 3 === 0)
      sep = el('div', { text: ',', style: { width: `${sw}px`, overflow: 'hidden', flex: 'none', font: fontString(fs, family, 900), color: fg, lineHeight: '1', textAlign: 'center', transform: `translateY(${fs * 0.08}px)` } }, numBox);
    wheels.push({ k, slot, strip, blur, fid, sep, lastBlur: -1 });
  }

  const outE = ease('power2.out');
  const backE = ease('power2.inOut');
  const lead = 0.35;
  const hold = 2.2;
  const back = 0.9;
  const cycle = lead + dur + hold + back + 0.25;
  const valueAt = (t: number) => {
    const c = t % cycle;
    if (c < lead) return from;
    if (c < lead + dur) return from + (to - from) * outE((c - lead) / dur);
    if (c < lead + dur + hold) return to;
    if (c < lead + dur + hold + back) return to + (from - to) * backE((c - lead - dur - hold) / back);
    return from;
  };
  const wheelPos = (v: number, k: number) => {
    const p = Math.pow(10, k);
    if (!mechanical) return ((v / p) % 10 + 10) % 10;
    const low = v - Math.floor(v / p) * p; // v mod 10^k
    const carry = k === 0 ? low : Math.max(0, low - (p - 1));
    return ((Math.floor(v / p) + carry) % 10 + 10) % 10;
  };

  return {
    settle: lead + dur + 0.5,
    render(t) {
      const v = Math.max(0, valueAt(t));
      const v2 = Math.max(0, valueAt(t + 1 / 120));
      const range = Math.abs(to - from) || 1;
      fill.style.transform = `scaleX(${clamp(Math.abs(v - from) / range, 0, 1)})`;
      for (const w of wheels) {
        const pos = wheelPos(v, w.k);
        w.strip.style.transform = `translate3d(0,${-pos * winH}px,0)`;
        // speed in digits/sec (handles the 9→0 wrap)
        let d = wheelPos(v2, w.k) - pos;
        if (d > 5) d -= 10;
        if (d < -5) d += 10;
        const speed = Math.abs(d) * 120;
        const b = Math.round(clamp(speed * winH * 0.004, 0, winH * 0.22) * 2) / 2;
        if (b !== w.lastBlur) {
          w.blur.setAttribute('stdDeviation', `0 ${b}`);
          w.strip.style.filter = b > 0 ? `url(#${w.fid})` : 'none';
          w.lastBlur = b;
        }
        // leading zeros collapse: digit k appears while v rolls past 10^k
        const vis = w.k === 0 ? 1 : clamp(v - (Math.pow(10, w.k) - 1), 0, 1);
        w.slot.style.width = `${dw * vis}px`;
        w.slot.style.opacity = String(vis);
        if (w.sep) {
          w.sep.style.width = `${sw * vis}px`;
          w.sep.style.opacity = String(vis);
        }
      }
    },
  };
}

const impl: EffectImpl = {
  id: 'odometer',
  defaults: { ...PALETTE.limeOnDark },
  loopable: true,
  posterTime: 3.4,
  hide: ['text', 'tracking'],
  params: [
    { key: 'from', label: '起始值', type: 'range', min: 0, max: 9999999, step: 1, default: 0 },
    { key: 'to', label: '目標值', type: 'range', min: 0, max: 9999999, step: 1, default: 12480 },
    { key: 'prefix', label: '前綴', type: 'text', default: '累計 ', maxLength: 12 },
    { key: 'suffix', label: '後綴', type: 'text', default: ' 人', maxLength: 12 },
    { key: 'duration', label: '滾動秒數', type: 'range', min: 0.6, max: 8, step: 0.1, default: 2.6, unit: 's' },
    { key: 'separator', label: '千分位', type: 'toggle', default: true },
    { key: 'carry', label: '進位方式', type: 'select', default: 'odometer', options: [{ value: 'odometer', label: '機械進位' }, { value: 'continuous', label: '連續滾動' }] },
  ],
  create,
};
export default impl;
