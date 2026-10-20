// Pure-logic unit tests (settings validation, URL round trip, randomisation, prompt, text).
// Bundled with esbuild and run in Node by scripts/unit.mjs — no browser needed.
import { buildDefaultSettings, normalizeSettings, randomizeSettings, settingsFromQuery, settingsToQuery, validParam } from '../../src/engine/settings';
import { buildPrompt, settingsJSON } from '../../src/state/prompt';
import { graphemes, clampGraphemes, phrases, sanitizeText } from '../../src/engine/text';
import { PRESETS } from '../../src/engine/palette';
import type { EffectDef, EffectSpec } from '../../src/engine/types';

let passed = 0;
const failures: string[] = [];
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
  } catch (e) {
    failures.push(`${name}: ${(e as Error).message}`);
  }
}
const canon = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canon) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon((v as Record<string, unknown>)[k])])) : v;
function eq(a: unknown, b: unknown, msg = '') {
  const A = JSON.stringify(canon(a));
  const B = JSON.stringify(canon(b));
  if (A !== B) throw new Error(`${msg} expected ${B} got ${A}`);
}
function ok(v: unknown, msg = 'expected truthy') {
  if (!v) throw new Error(msg);
}

const spec: EffectSpec = {
  id: 'unit-fx',
  code: 'X01',
  nameZh: '測試',
  nameEn: 'Unit FX',
  category: 'typography',
  sourceType: 'original',
  difficulty: 'beginner',
  renderer: 'canvas',
  description: 'desc',
  tags: ['a'],
  suitable: ['b'],
  principle: 'p',
  defaultText: '動效圖鑑',
  palette: 'POP',
  controls: ['text', 'font', 'weight', 'tracking', 'intensity', 'scale', 'direction', 'secondary', 'accent', 'seed'],
  directions: ['left', 'right'],
  params: [
    { key: 'count', label: '數量', type: 'range', min: 2, max: 20, step: 2, default: 6 },
    { key: 'on', label: '開關', type: 'toggle', default: false },
    { key: 'mode', label: '模式', type: 'select', default: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
    { key: 'name', label: '名稱', type: 'text', default: 'X', maxLength: 5 },
    { key: 'p', label: '進度', type: 'range', min: 0, max: 100, step: 1, default: 50, when: { key: 'on', value: true } },
  ],
  recipe: { enter: 'e', motion: 'm', hold: 'h', exit: 'x', loop: 'l' },
  accept: ['看得到動畫'],
  maxChars: 30,
  create: () => ({ render() {} }),
};
const def: EffectDef = {
  ...spec,
  displayNumber: 1,
  defaultSettings: buildDefaultSettings(spec),
  parameterSchema: { common: spec.controls, params: spec.params! },
  motionRecipe: spec.recipe,
  acceptanceCriteria: spec.accept,
  capabilities: { png: 'canvas', transparentPng: false, webm: true, seek: true, pointer: false },
  rendererFactory: spec.create,
};

test('defaults use preset palette and first direction', () => {
  const d = buildDefaultSettings(spec);
  const pop = PRESETS.find((p) => p.id === 'POP')!;
  eq([d.background, d.primary, d.secondary, d.accent], [pop.background, pop.primary, pop.secondary, pop.accent]);
  eq(d.direction, 'left');
  eq(d.params, { count: 6, on: false, mode: 'a', name: 'X', p: 50 });
});

test('every preset defines 4 valid hex colours', () => {
  for (const p of PRESETS) for (const k of ['background', 'primary', 'secondary', 'accent'] as const) ok(/^#[0-9A-F]{6}$/i.test(p[k]), `${p.id}.${k}`);
  eq(PRESETS.map((p) => p.id), ['POP', 'COOL', 'PASTEL', 'MONO', 'STREET']);
});

test('normalize rejects hostile / invalid input', () => {
  const s = normalizeSettings(spec, {
    text: 'a'.repeat(500),
    background: 'red; background:url(x)',
    primary: '#abcdef',
    speed: 'NaN',
    intensity: 99,
    scale: -5,
    tracking: Infinity,
    weight: 1234,
    direction: 'cw',
    ratio: '4:3',
    seed: 1e9,
    font: 'comic',
    loop: 'yes',
    params: { count: 7, on: 'true', mode: 'zzz', name: '<b>toolong</b>', __proto__: { polluted: 1 } },
  });
  eq(s.text.length, 30, 'text clamp');
  eq(s.background, def.defaultSettings.background, 'bad colour → default');
  eq(s.primary, '#ABCDEF');
  eq(s.speed, 1, 'NaN speed → default');
  eq(s.intensity, 2, 'intensity clamped');
  eq(s.scale, 0.5, 'scale clamped');
  eq(s.tracking, 0, 'Infinity → default');
  eq(s.weight, 900, 'weight clamped');
  eq(s.direction, 'left', 'direction not allowed → default');
  eq(s.ratio, '16:9');
  eq(s.seed, 9999);
  eq(s.font, 'sans');
  eq(s.loop, true);
  eq(s.params.count, 8, 'snapped to step from min');
  eq(s.params.on, true);
  eq(s.params.mode, 'a');
  eq(s.params.name, '<b>to', 'text param clamped (plain text, never parsed)');
  ok(!('polluted' in {}), 'no prototype pollution');
});

test('normalize never throws on garbage', () => {
  for (const g of [null, undefined, 42, 'str', [], { params: 'x' }, { params: null }]) normalizeSettings(spec, g);
});

test('validParam extremes', () => {
  const r = spec.params![0];
  eq(validParam(r, -100), 2);
  eq(validParam(r, 1e9), 20);
  eq(validParam(r, ''), 6);
  eq(validParam(r, '12'), 12);
});

test('URL round trip keeps CJK, emoji, newlines and specials', () => {
  const s = normalizeSettings(spec, { text: '你好！Hello 🙂\n第二行 & = ? # ／', direction: 'right', params: { count: 12, mode: 'b', name: '名&稱' }, seed: 42, ratio: '9:16' });
  const q = settingsToQuery(spec, s);
  const back = settingsFromQuery(spec, new URLSearchParams(q.toString()));
  eq(back, s);
  ok(!q.has('c1'), 'defaults are omitted from the URL');
});

test('invalid URL params fall back to defaults', () => {
  const s = settingsFromQuery(spec, new URLSearchParams('sp=abc&r=2:1&bg=zzz&d=up&p.count=x&p.mode=evil&sd=-4&t=' + 'x'.repeat(1000)));
  eq(s.speed, 1);
  eq(s.ratio, '16:9');
  eq(s.background, def.defaultSettings.background);
  eq(s.direction, 'left');
  eq(s.params.count, 6);
  eq(s.params.mode, 'a');
  eq(s.seed, 1);
  eq(s.text, '動效圖鑑', 'over-long query value ignored');
});

test('randomize is reproducible per seed and stays in range', () => {
  const base = buildDefaultSettings(spec);
  const a = randomizeSettings(spec, base, 777);
  const b = randomizeSettings(spec, base, 777);
  const c = randomizeSettings(spec, base, 778);
  eq(a, b);
  ok(JSON.stringify(a) !== JSON.stringify(c), 'different seed differs');
  const n = a.params.count as number;
  ok(n >= 2 && n <= 20 && (n - 2) % 2 === 0, 'range respected');
  eq(normalizeSettings(spec, a), a, 'randomized settings are valid');
});

test('graphemes keep emoji / ZWJ sequences intact', () => {
  eq(graphemes('你好！Hello 🙂'), ['你', '好', '！', 'H', 'e', 'l', 'l', 'o', ' ', '🙂']);
  eq(graphemes('👩‍💻a').length, 2);
  eq(clampGraphemes('🙂🙂🙂', 2), '🙂🙂');
  eq(phrases('A／B\nC/D'), ['A', 'B', 'C', 'D']);
  eq(phrases('   '), [' ']);
  eq(sanitizeText('a\u0000b\r\nc\n\n\n\nd', 40), 'ab\nc\n\nd');
});

test('prompt contains current settings, both variants, and valid JSON', () => {
  const s = normalizeSettings(spec, { text: 'MOTION PLAY', primary: '#123456', speed: 1.5, direction: 'right', params: { count: 10, on: true, p: 70 }, ratio: '1:1' });
  const a = buildPrompt(def, s, 'standalone');
  const b = buildPrompt(def, s, 'integrate');
  for (const p of [a, b]) {
    ok(p.includes('測試 / Unit FX'), 'names');
    ok(p.includes('MOTION PLAY'), 'text');
    ok(p.includes('#123456'), 'colour token');
    ok(p.includes('1080×1080'), 'ratio size');
    ok(p.includes('1.5×'), 'speed');
    ok(p.includes('向右'), 'direction');
    ok(p.includes('數量（count）：10'), 'param');
    ok(p.includes('進度（p）：70'), 'conditional param shown when active');
    ok(p.includes('prefers-reduced-motion'), 'reduced motion section');
    ok(p.includes('destroy'), 'cleanup section');
    ok(p.includes('不是生成靜態圖片'), 'explicitly code, not image');
    ok(!/<script|<div|<svg/i.test(p), 'no raw HTML');
    const json = JSON.parse(p.split('```json\n')[1].split('\n```')[0]);
    eq(json.params.count, 10);
    eq(json.colors.primary, '#123456');
  }
  ok(b.includes('既有的網站') && b.includes('整合要求'), 'integrate variant');
  ok(!a.includes('整合要求'), 'standalone variant');
  const off = normalizeSettings(spec, { params: { on: false } });
  ok(!buildPrompt(def, off, 'standalone').includes('進度（p）'), 'inactive conditional param omitted');
  eq(Object.keys(settingsJSON(def, off).params as object).includes('p'), false);
});

console.log(`unit: ${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log('  FAIL ' + f);
if (failures.length) process.exit(1);
