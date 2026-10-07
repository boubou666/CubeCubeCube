import { test, expect } from '@playwright/test';

test('@smoke every campaign opens from home, executes a hint, reloads and undoes exactly', async ({ page }) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.game-card')).toHaveCount(36);
  const links = await page.locator('.game-card a[aria-label]').evaluateAll(nodes => nodes
    .map(node => ({ url: node.href, name: node.getAttribute('aria-label') }))
    .filter(node => !/\/(cube|image|colony)\.html$/.test(node.url)));
  expect(links).toHaveLength(33);
  for (const { url, name } of links) {
    await test.step(name, async () => {
      expect((await page.goto(url)).status()).toBe(200);
      await page.waitForFunction(() => window.__pocketDebug?.ready);
      const initial = await page.evaluate(() => window.__pocketDebug.game.state);
      await page.locator('#pocket-hint').click();
      await page.waitForFunction(() => window.__pocketDebug.hint?.action !== undefined);
      await page.locator('#pocket-canvas').focus();
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => window.__pocketDebug.game.moves.length === 1 && window.__pocketDebug.ready);
      const moved = await page.evaluate(() => window.__pocketDebug.game.state);
      expect(moved).not.toEqual(initial);
      await page.reload();
      await page.waitForFunction(() => window.__pocketDebug?.ready);
      expect(await page.evaluate(() => window.__pocketDebug.game.state)).toEqual(moved);
      await page.locator('#pocket-undo').click();
      expect(await page.evaluate(() => window.__pocketDebug.game.state)).toEqual(initial);
    });
  }
  expect(errors).toEqual([]);
});
