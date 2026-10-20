// End-to-end tests for the library UI: registry, search, categories, favourites,
// detail modal (focus / Escape / scroll), parameters, sharing, prompt copy,
// playback, lifecycle, reduced motion, storage failures, export and mobile.
import { test, expect } from '@playwright/test';

const effects = (page) => page.evaluate(() => window.__ma.effects);
const ready = (page) => page.waitForFunction(() => window.__maPlayer?.state.ready && window.__maPlayer.currentRuntime);
const openDetail = async (page, id, query = '') => {
  await page.evaluate(() => (window.__maPlayer = null));
  await page.goto(`/#/e/${id}${query ? '?' + query : ''}`);
  await ready(page);
};

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
});

test('registry: 120 unique effects, 9 categories with spec counts, complete metadata', async ({ page }) => {
  await page.goto('/');
  const list = await effects(page);
  expect(list.length).toBe(120);
  expect(new Set(list.map((e) => e.id)).size).toBe(120);
  expect(new Set(list.map((e) => e.code)).size).toBe(120);
  expect(list.some((e) => e.id === 'planet-retrograde')).toBe(false);
  const by = {};
  for (const e of list) by[e.category] = (by[e.category] ?? 0) + 1;
  expect(by).toEqual({ typography: 24, halftone: 12, grid: 12, lines: 12, shapes: 12, split: 12, wipe: 12, comic: 12, minimal: 12 });
  const full = await page.evaluate(() =>
    window.__ma.effects.filter((e) => !e.controls || !e.capabilities).map((e) => e.id),
  );
  expect(full).toEqual([]);
  // css3d never advertises PNG; canvas always advertises PNG + WebM
  for (const e of list) {
    if (e.renderer === 'css3d') expect(e.capabilities.png).toBe(false);
    if (e.renderer === 'canvas') expect(e.capabilities.webm).toBe(true);
  }
});

test('category chips show counts computed from data', async ({ page }) => {
  await page.goto('/');
  const list = await effects(page);
  await expect(page.getByRole('button', { name: /^ALL/ })).toContainText(String(list.length));
  const halftone = list.filter((e) => e.category === 'halftone').length;
  const chip = page.getByRole('button', { name: /^HALFTONE/ });
  await expect(chip).toContainText(String(halftone));
  await chip.click();
  await expect(page.locator('.grid > li')).toHaveCount(halftone);
});

test('search: Chinese, English, tag and ID; empty state offers reset', async ({ page }) => {
  await page.goto('/');
  const box = page.getByRole('searchbox', { name: '搜尋效果' });
  await box.fill('半色調');
  await expect(page.locator('.grid > li').first()).toBeVisible();
  for (const card of await page.locator('.card-cat').allTextContents()) expect(card).toBe('HALFTONE');
  await box.fill('spirograph');
  await expect(page.locator('.grid > li')).toHaveCount(1);
  await box.fill('T03');
  await expect(page.locator('[data-effect="text-cylinder"]')).toBeVisible();
  await box.fill('完全不存在的詞 zzzz');
  await expect(page.getByText('找不到符合條件的效果')).toBeVisible();
  await page.locator('.empty').getByRole('button', { name: '清除篩選' }).click();
  await expect(box).toHaveValue('');
  expect(await page.locator('.grid > li').count()).toBe((await effects(page)).length);
});

test('favourites persist after reload and filter the list', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '收藏 半色調液團' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '取消收藏 半色調液團' })).toBeVisible();
  await page.getByRole('button', { name: /^FAVORITES/ }).click();
  await expect(page.locator('.grid > li')).toHaveCount(1);
  await expect(page.locator('[data-effect="halftone-blob"]')).toBeVisible();
});

test('detail modal: deep link, focus, Escape, focus return, scroll + filters kept', async ({ page }) => {
  await page.goto('/');
  const box = page.getByRole('searchbox', { name: '搜尋效果' });
  await box.fill('grid');
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(200);
  const scrollBefore = await page.evaluate(() => scrollY);
  const link = page.locator('[data-effect-link="grid-magnet"]');
  await link.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/#\/e\/grid-magnet/);
  await expect(page.locator('#detail-title')).toBeFocused();
  // focus trap: tabbing many times never leaves the dialog
  for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(link).toBeFocused();
  await expect(box).toHaveValue('grid');
  expect(Math.abs((await page.evaluate(() => scrollY)) - scrollBefore)).toBeLessThan(5);
});

test('parameters update URL; share link restores; invalid params fall back', async ({ page }) => {
  await openDetail(page, 'wave-wipe');
  await page.getByRole('button', { name: 'STREET' }).click();
  await page.getByRole('button', { name: '向上' }).click();
  await page.getByRole('textbox', { name: '自訂文字' }).fill('你好／Hello 🙂');
  await page.waitForTimeout(400);
  const url = page.url();
  const q = new URLSearchParams(await page.evaluate(() => location.hash.split('?')[1]));
  expect(q.get('d')).toBe('up');
  expect(q.get('t')).toBe('你好／Hello 🙂');
  // reopen from the shared URL in a clean context
  const page2 = await page.context().newPage();
  await page2.goto(url);
  await ready(page2);
  const s = await page2.evaluate(() => window.__maPlayer.settings);
  expect(s.direction).toBe('up');
  expect(s.text).toBe('你好／Hello 🙂');
  expect(s.background).toBe('#141414');
  // invalid
  await openDetail(page2, 'wave-wipe', 'sp=abc&d=sideways&bg=javascript:alert(1)&p.amp=999&r=7:3');
  const bad = await page2.evaluate(() => window.__maPlayer.settings);
  expect(bad.speed).toBe(1);
  expect(['right', 'left', 'down', 'up']).toContain(bad.direction);
  expect(bad.background).toMatch(/^#[0-9A-F]{6}$/);
  expect(bad.params.amp).toBe(0.2);
  expect(bad.ratio).toBe('16:9');
});

test('playback: play advances time, pause holds, restart resets', async ({ page }) => {
  await openDetail(page, 'spirograph');
  await page.evaluate(() => window.__maPlayer.play());
  await page.waitForTimeout(500);
  const t1 = await page.evaluate(() => window.__maPlayer.t);
  expect(t1).toBeGreaterThan(0.2);
  await page.getByRole('button', { name: '暫停' }).click();
  const t2 = await page.evaluate(() => window.__maPlayer.t);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__maPlayer.t)).toBe(t2);
  await page.getByRole('button', { name: '重播' }).click();
  expect(await page.evaluate(() => window.__maPlayer.t)).toBeLessThan(0.2);
  // speed applies live without rebuild
  const builds = await page.evaluate(() => window.__maPlayer.state.builds);
  await page.evaluate(() => window.__maPlayer.update({ ...window.__maPlayer.settings, speed: 2 }));
  expect(await page.evaluate(() => window.__maPlayer.state.builds)).toBe(builds);
});

test('colours / params really change the rendered frame', async ({ page }) => {
  await openDetail(page, 'halftone-blob');
  await page.evaluate(() => {
    window.__maPlayer.pause();
    window.__maPlayer.seek(2);
  });
  const a = await page.locator('.stage-box').screenshot();
  await page.getByRole('button', { name: 'MONO' }).click();
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__maPlayer.seek(2));
  const b = await page.locator('.stage-box').screenshot();
  expect(a.equals(b)).toBe(false);
});

test('AI prompt copy includes current settings; clipboard failure shows manual textarea', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openDetail(page, 'comic-burst', 't=' + encodeURIComponent('哇！'));
  await page.getByRole('button', { name: '獨立實作' }).click();
  await expect(page.getByRole('status').filter({ hasText: '已複製 AI 製作 prompt' })).toBeVisible();
  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toContain('漫畫爆炸框 / Comic Burst');
  expect(text).toContain('哇！');
  expect(text).toContain('```json');
  await page.evaluate(() => {
    navigator.clipboard.writeText = () => Promise.reject(new Error('denied'));
  });
  await page.getByRole('button', { name: '整合到既有網站' }).click();
  await expect(page.getByText('無法存取剪貼簿')).toBeVisible();
  await expect(page.locator('#manual-copy-ta')).toHaveValue(/整合要求/);
});

test('lifecycle: opening/closing detail many times does not leak players', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /列表預覽/ }).click(); // previews off → only the detail player exists
  for (let i = 0; i < 6; i++) {
    await openDetail(page, i % 2 ? 'text-cylinder' : 'venetian-split');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  await page.waitForTimeout(200);
  expect((await page.evaluate(() => window.__ma.stats())).live).toBe(0);
});

test('card previews: limited concurrency and paused while modal open', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(1200);
  const s = await page.evaluate(() => window.__ma.previews());
  expect(s.active).toBeGreaterThan(0);
  expect(s.active).toBeLessThanOrEqual(s.maxActive);
  await openDetail(page, 'shape-morph');
  await page.waitForTimeout(300);
  expect((await page.evaluate(() => window.__ma.previews())).active).toBe(0);
});

test('global pause stops card previews', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: '暫停全部動畫' }).click();
  await page.waitForTimeout(300);
  expect((await page.evaluate(() => window.__ma.previews())).active).toBe(0);
  expect((await page.evaluate(() => window.__ma.stats())).playing).toBe(0);
});

test('reduced motion: static first frame, user can still play', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.waitForTimeout(600);
  expect((await page.evaluate(() => window.__ma.stats())).playing).toBe(0);
  await openDetail(page, 'spirograph');
  expect(await page.evaluate(() => window.__maPlayer.state.playing)).toBe(false);
  await expect(page.getByText('已偵測到「減少動態」偏好')).toBeVisible();
  await page.getByRole('button', { name: '播放', exact: true }).click();
  expect(await page.evaluate(() => window.__maPlayer.state.playing)).toBe(true);
  await ctx.close();
});

test('storage blocked: site still works, favourites kept in memory', async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('SecurityError: storage disabled');
      },
    });
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await page.goto('/');
  await page.getByRole('button', { name: '收藏 萬花尺' }).click();
  await expect(page.getByRole('button', { name: '取消收藏 萬花尺' })).toBeVisible();
  await openDetail(page, 'spirograph');
  expect(errors).toEqual([]);
  await ctx.close();
});

test('legacy favourites and links from the previous library migrate', async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    if (!localStorage.getItem('ma:migrated')) localStorage.setItem('kt:favorites', JSON.stringify(['typewriter', 'pulse-grid', 'marquee']));
  });
  const page = await ctx.newPage();
  await page.goto('/');
  const favs = await page.evaluate(() => JSON.parse(localStorage.getItem('ma:favorites') || '[]'));
  expect(favs).toContain('typewriter');
  expect(favs).toContain('word-surge-grid');
  expect(favs).not.toContain('marquee'); // not part of the atlas → ignored
  await page.goto('/#/e/karaoke-ball');
  await ready(page);
  await expect(page).toHaveURL(/#\/e\/karaoke-text/);
  await ctx.close();
});

test('export: canvas PNG downloads; css3d shows no PNG button; transparent option only when supported', async ({ page }) => {
  await openDetail(page, 'halftone-blob');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '截取 PNG' }).click()]);
  expect(dl.suggestedFilename()).toBe('H06-halftone-blob.png');
  await expect(page.getByText('透明背景')).toBeVisible();
  await expect(page.getByRole('button', { name: '錄製 WebM' })).toBeVisible();
  await openDetail(page, 'text-cylinder');
  await expect(page.getByRole('button', { name: '截取 PNG' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '錄製 WebM' })).toHaveCount(0);
  await openDetail(page, 'shape-morph');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '截取 PNG' }).click()]);
  expect(dl2.suggestedFilename()).toBe('S03-shape-morph.png');
  // DOM renderer: experimental foreignObject capture (must either download or show a clear error)
  await openDetail(page, 'typewriter');
  const [dl3] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '截取 PNG' }).click()]);
  expect(dl3.suggestedFilename()).toBe('T10-typewriter.png');
  await expect(page.getByText('DOM 截取為實驗功能')).toBeVisible();
});

test('safe-area overlay toggles and is not part of the effect layer', async ({ page }) => {
  await openDetail(page, 'minimal-blocks');
  await page.getByText('安全區預覽').click();
  await expect(page.locator('.safe-area')).toBeVisible();
  expect(await page.locator('.ma-layer .safe-area').count()).toBe(0);
});

test('fonts unavailable: effects still render', async ({ page }) => {
  await page.goto('/#/?nofonts=1');
  await page.reload();
  await openDetail(page, 'typewriter', 't=' + encodeURIComponent('動效圖鑑'));
  expect(await page.evaluate(() => window.__maPlayer.state.error)).toBe(null);
});

test('mobile: stage keeps the chosen ratio and panel stacks below', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('/#/e/venetian-split?r=9%3A16');
  await ready(page);
  const box = await page.locator('.stage-box').boundingBox();
  expect(Math.abs(box.width / box.height - 9 / 16)).toBeLessThan(0.02);
  const panel = await page.locator('.detail-right').boundingBox();
  expect(panel.y).toBeGreaterThan(box.y);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await ctx.close();
});
