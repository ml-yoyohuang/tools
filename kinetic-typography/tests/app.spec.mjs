import { expect, test } from '@playwright/test';

// Main user flows of the gallery shell.

function trackErrors(page) {
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return errors;
}

test('registry has 80 unique, implemented effects', async ({ page }) => {
  await page.goto('#/');
  const kt = await page.evaluate(() => window.__kt);
  expect(kt.ids).toHaveLength(80);
  expect(new Set(kt.ids).size).toBe(80);
  expect(kt.missing).toEqual([]);
});

test('list: cards, search, filters, empty state', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('#/');
  await expect(page.locator('.grid > li')).toHaveCount(80);
  await page.getByLabel('搜尋效果').fill('翻牌');
  await expect(page.locator('.grid > li')).toHaveCount(1);
  await expect(page.locator('.card-title').first()).toContainText('翻牌');
  await page.getByLabel('搜尋效果').fill('wave');
  expect(await page.locator('.grid > li').count()).toBeGreaterThan(0);
  await page.getByLabel('搜尋效果').fill('不存在的效果zzz');
  await expect(page.getByText('找不到符合條件的效果')).toBeVisible();
  await page.locator('.empty').getByRole('button', { name: '清除篩選' }).click();
  await expect(page.locator('.grid > li')).toHaveCount(80);
  // category + tech filters
  await page.getByRole('group', { name: '分類' }).getByRole('button', { name: '空間與立體' }).click();
  const n = await page.locator('.grid > li').count();
  expect(n).toBeGreaterThan(3);
  expect(n).toBeLessThan(80);
  await page.getByRole('group', { name: '技術' }).getByRole('button', { name: '3D' }).click();
  for (const tag of await page.locator('.card-tags').allInnerTexts()) expect(tag).toContain('3D');
  await page.getByRole('button', { name: '清除所有篩選' }).click();
  await expect(page.locator('.grid > li')).toHaveCount(80);
  expect(errors).toEqual([]);
});

test('favourites persist after reload and filter works', async ({ page }) => {
  await page.goto('#/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: '收藏 翻牌' }).click();
  await page.getByRole('button', { name: '收藏 打字機' }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: '取消收藏 翻牌' })).toBeVisible();
  await page.getByRole('button', { name: '只看收藏' }).click();
  await expect(page.locator('.grid > li')).toHaveCount(2);
});

test('broken localStorage does not crash the page', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('denied');
      },
    });
  });
  const errors = trackErrors(page);
  await page.goto('#/');
  await expect(page.locator('.grid > li')).toHaveCount(80);
  await page.getByRole('button', { name: '收藏 翻牌' }).click();
  await expect(page.getByRole('button', { name: '取消收藏 翻牌' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('detail: deep link restores settings, controls update URL, transport works', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('#/e/split-flap?t=%E4%BD%A0%E5%A5%BD&c1=%23FF0000&r=1:1&sp=2&p.spins=3&fs=99&c2=bad');
  await expect(page.locator('#effect-text')).toHaveValue('你好');
  await expect(page.getByRole('group', { name: '舞台比例' }).getByRole('button', { name: '1:1' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.color-field code').first()).toHaveText('#FF0000');
  await expect(page).toHaveURL(/fs=1\.6/); // clamped
  await expect(page).not.toHaveURL(/c2=/); // invalid colour dropped

  await page.locator('#effect-text').fill('TYPE MOTION 2026');
  await expect(page).toHaveURL(/t=TYPE\+MOTION\+2026/);
  // transport
  const play = page.getByRole('toolbar', { name: '播放控制' }).getByRole('button').first();
  await expect(play).toHaveAccessibleName('暫停');
  await play.click();
  await expect(play).toHaveAccessibleName('播放');
  await page.getByRole('button', { name: '重播' }).click();
  await expect(play).toHaveAccessibleName('暫停');
  // reset
  await page.getByRole('button', { name: '恢復預設' }).click();
  await expect(page.locator('#effect-text')).toHaveValue('準時');
  await expect(page).toHaveURL(/#\/e\/split-flap$/);
  expect(errors).toEqual([]);
});

test('detail: settings survive reload via localStorage', async ({ page }) => {
  await page.goto('#/e/marquee');
  await page.locator('#effect-text').fill('保存測試');
  await page.waitForTimeout(500);
  await page.goto('#/');
  await page.goto('#/e/marquee');
  await expect(page.locator('#effect-text')).toHaveValue('保存測試');
  await page.getByRole('button', { name: '恢復預設' }).click();
});

test('detail: prev / next / back keep players cleaned up', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('#/e/text-tunnel');
  for (let i = 0; i < 6; i++) {
    await page.getByRole('link', { name: /^下一個/ }).click();
    await page.waitForTimeout(250);
  }
  for (let i = 0; i < 6; i++) {
    await page.getByRole('link', { name: /^上一個/ }).click();
    await page.waitForTimeout(250);
  }
  await expect(page).toHaveURL(/text-tunnel/);
  const stats = await page.evaluate(() => window.__kt.stats());
  expect(stats.live).toBe(1);
  expect(await page.locator('canvas').count()).toBeLessThanOrEqual(1);
  await page.getByRole('link', { name: '返回圖鑑' }).click();
  await expect(page.locator('.grid > li')).toHaveCount(80);
  // focus returns to the card we came from
  await expect(page.locator('[data-effect-link="text-tunnel"]')).toBeFocused();
  expect(errors).toEqual([]);
});

test('detail: keyboard shortcuts', async ({ page }) => {
  await page.goto('#/e/typewriter');
  const play = page.getByRole('toolbar', { name: '播放控制' }).getByRole('button').first();
  await expect(play).toHaveAccessibleName('暫停');
  await page.locator('body').press('Space');
  await expect(play).toHaveAccessibleName('播放');
  await page.locator('body').press('ArrowRight');
  await expect(page).toHaveURL(/#\/e\/slot-text/);
});

test('reduced motion: detail starts paused, user can play', async ({ browser }) => {
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5199/#/e/punch-zoom');
  const play = page.getByRole('toolbar', { name: '播放控制' }).getByRole('button').first();
  await expect(play).toHaveAccessibleName('播放');
  await expect(page.getByText('已偵測到「減少動態」偏好')).toBeVisible();
  await play.click();
  await expect(play).toHaveAccessibleName('暫停');
  await page.goto('http://localhost:5199/#/');
  await expect(page.getByRole('button', { name: /自動預覽：關/ })).toBeVisible();
  await ctx.close();
});

test('no WebGL: 3D effect falls back to 2D with a notice', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('#/e/text-tunnel?nowebgl=1');
  await expect(page.getByText('此瀏覽器未啟用 WebGL')).toBeVisible();
  expect(errors).toEqual([]);
});

for (const vp of [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
]) {
  test(`responsive ${vp.name}: no horizontal overflow`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, hasTouch: true, isMobile: vp.name === 'mobile' });
    const page = await ctx.newPage();
    for (const url of ['#/', '#/e/kinetic-stack', '#/e/split-flap?r=9:16']) {
      await page.goto('http://localhost:5199/' + url);
      await page.waitForTimeout(400);
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(over, url).toBeLessThanOrEqual(0);
    }
    const cols = await page.goto('http://localhost:5199/#/').then(() =>
      page.evaluate(() => getComputedStyle(document.querySelector('.grid')).gridTemplateColumns.split(' ').length),
    );
    expect(cols).toBe(vp.name === 'mobile' ? 1 : 2);
    await ctx.close();
  });
}

test('limited concurrent card previews', async ({ page }) => {
  await page.goto('#/');
  await expect.poll(async () => (await page.evaluate(() => window.__kt.stats())).playing, { timeout: 15000 }).toBeGreaterThan(0);
  const stats = await page.evaluate(() => window.__kt.stats());
  expect(stats.playing).toBeLessThanOrEqual(6);
  expect(stats.live).toBeLessThan(40);
});
