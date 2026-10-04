import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test('home cards open each game and every game returns home', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('.game-card')).toHaveCount(3);
  for (const [label, path, ready] of [['The cube', '/cube.html', '#remaining'], ['Picture puzzles', '/image.html', '#picture-canvas'], ['Colony', '/colony.html', '#colony-canvas']]) {
    await page.getByRole('link', { name: `Jouer à ${label}`, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replace('.', '\\.')}$$`)); await expect(page.locator(ready)).toBeVisible();
    await page.locator('header a').first().click(); await expect(page.locator('.game-card')).toHaveCount(3);
  }
});
test('real boxes launch workers, transport cubes, pause, save and undo', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/colony.html'); await page.waitForFunction(() => Boolean(window.__colonyDebug));
  await expect(page.locator('#colony-remaining')).toHaveText('256');
  await page.locator('#colony-speed').click();
  await page.locator('.ant-box.ready[data-queue="0"]').click();
  await expect(page.locator('#slot-count')).toContainText('1 / 5');
  await page.waitForFunction(() => window.__colonyDebug.game.remaining < 256);
  await page.locator('#colony-pause').click();
  const before = await page.evaluate(() => window.__colonyDebug.game.state);
  await page.waitForTimeout(400); expect(await page.evaluate(() => window.__colonyDebug.game.state)).toEqual(before);
  await page.reload(); await page.waitForFunction(() => Boolean(window.__colonyDebug));
  await expect(page.locator('#colony-speed')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__colonyDebug.game.remaining)).toBeLessThan(256);
  await page.locator('#colony-undo').click(); await expect(page.locator('#colony-remaining')).toHaveText('256');
  await expect(page.locator('#slot-count')).toContainText('0 / 5');
  await page.locator('#colony-hint').click(); await expect(page.locator('.ant-box.hinted')).toHaveCount(1);
  await page.locator('#colony-canvas').focus(); await page.keyboard.press('Enter');
  await expect(page.locator('#slot-count')).toContainText('1 / 5');
  await page.locator('#colony-restart').click(); await expect(page.locator('#colony-remaining')).toHaveText('256');
  expect(errors).toEqual([]);
});
test('a complete puzzle unlocks the next, saves completion, and collection restores it', async ({ page }) => {
  await page.goto('/colony.html'); await page.waitForFunction(() => Boolean(window.__colonyDebug));
  // Transport animation is checked above; advance simulation time directly here
  // so the entire level's completion/navigation checks don't render thousands of frames.
  await page.locator('#colony-pause').click();
  const solution = await page.evaluate(() => window.__colonyDebug.game.level.solution);
  for (const queue of solution) {
    await page.locator(`.ant-box.ready[data-queue="${queue}"]`).click();
    await page.evaluate(() => { for (let i = 0; i < 40 && window.__colonyDebug.game.state.slots.some(Boolean); i++) window.__colonyDebug.advance(100); });
    expect(await page.evaluate(() => window.__colonyDebug.game.state.slots.every(s => !s))).toBe(true);
  }
  await expect(page.locator('#colony-finish')).toBeVisible(); await expect(page.locator('#collection-total')).toHaveText('1');
  await page.locator('#colony-next').click(); await expect(page.locator('#colony-title')).toHaveText('Un coin de forêt');
  await page.reload(); await expect(page.locator('#colony-title')).toHaveText('Un coin de forêt');
  await page.locator('#colony-collection').click(); await expect(page.locator('#colony-levels button')).toHaveCount(12);
  await page.locator('#colony-levels [data-level="0"]').click(); await expect(page.locator('#colony-title')).toHaveText('La petite pousse');
  await expect(page.locator('#collection-total')).toHaveText('1');
});
test('desktop and mobile layouts retain reachable cards, queues and controls', async ({ page }) => {
  await mkdir('.local/screenshots', { recursive: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    await page.goto('/'); await expect(page.locator('.game-card')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (width === 1440) await page.screenshot({ path: '.local/screenshots/home-desktop.png', fullPage: true });
    await page.getByRole('link', { name: 'Jouer à Colony' }).click(); await page.waitForFunction(() => Boolean(window.__colonyDebug));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#colony-hint').click(); await page.locator('.ant-box.hinted').click();
    await page.waitForFunction(() => window.__colonyDebug.scene.ants.size > 0);
    await page.screenshot({ path: `.local/screenshots/colony-${width}.png`, fullPage: true });
    await page.locator('#colony-collection').click(); await expect(page.locator('#colony-collection-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Fermer la collection' }).click();
    await page.getByRole('button', { name: 'Voir les règles' }).click(); await expect(page.locator('#colony-help-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Fermer les règles' }).click();
  }
});
