import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';

test('home cards open each game and every game returns home', async ({ page }) => {
  await page.goto('/'); await expect(page.locator('.game-card')).toHaveCount(30);
  for (const [label, path, ready] of [['The cube', '/cube.html', '#remaining'], ['Picture puzzles', '/image.html', '#picture-canvas'], ['Colony', '/colony.html', '#colony-canvas']]) {
    await page.getByRole('link', { name: `Jouer à ${label}`, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path.replace('.', '\\.')}$$`)); await expect(page.locator(ready)).toBeVisible();
    await page.locator('header a').first().click(); await expect(page.locator('.game-card')).toHaveCount(30);
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
    await page.goto('/'); await expect(page.locator('.game-card')).toHaveCount(30);
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

test('new chapters, collection pages and an expert board remain playable on desktop and mobile', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await mkdir('.local/screenshots', { recursive: true });
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 }); await page.goto('/colony.html');
    await page.locator('#colony-collection').click(); await page.locator('[data-chapter="72"]').click();
    await expect(page.locator('#colony-page-label')).toHaveText('73 – 84');
    if (width === 1440) await page.screenshot({ path: '.local/screenshots/colony-new-collection.png', fullPage: true });
    await page.getByRole('button', { name: 'Niveaux suivants' }).click(); await expect(page.locator('#colony-page-label')).toHaveText('85 – 96');
    await page.getByRole('button', { name: 'Niveaux précédents' }).click(); await page.locator('[data-level="72"]').click();
    await expect(page.locator('#colony-difficulty')).toContainText('Expert'); await expect(page.locator('#colony-remaining')).toHaveText('576');
    expect(await page.evaluate(() => window.__colonyDebug.game.level.width)).toBe(24);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#colony-hint').click(); await page.locator('.ant-box.hinted').click();
    await page.waitForFunction(() => window.__colonyDebug.scene.ants.size > 4);
    const stats = await page.evaluate(() => ({ jobs: window.__colonyDebug.game.state.jobs.length, draws: window.__colonyDebug.scene.renderer.info.render.calls, count: window.__colonyDebug.scene.antParts[0].mesh.count }));
    expect(stats.jobs).toBeGreaterThan(4); expect(stats.count).toBeGreaterThan(4); expect(stats.draws).toBeLessThan(100);
    await page.screenshot({ path: `.local/screenshots/colony-expert-${width}.png`, fullPage: true });
    await page.locator('#colony-pause').click();
  }
  expect(errors).toEqual([]);
});
test('a version-one save keeps its legacy puzzle on reload and restart; a fresh puzzle uses new levels', async ({ page }) => {
  const { save } = JSON.parse(readFileSync(new URL('../fixtures/colony-v1.json', import.meta.url), 'utf8'));
  await page.addInitScript(value => { localStorage.setItem('cubecubecube-colony-v1', JSON.stringify(value)); }, save);
  await page.goto('/colony.html'); await page.waitForFunction(() => Boolean(window.__colonyDebug));
  await expect(page.locator('#colony-difficulty')).toContainText('Classique');
  expect(await page.evaluate(() => window.__colonyDebug.game.level.generation)).toBe(1);
  await page.locator('#colony-restart').click(); expect(await page.evaluate(() => window.__colonyDebug.game.level.width)).toBe(16);
  await page.locator('#colony-collection').click(); await page.locator('[data-level="27"]').click();
  expect(await page.evaluate(() => window.__colonyDebug.game.level.generation)).toBe(2);
  await expect(page.locator('#colony-difficulty')).toContainText('Corsé');
  await expect(page.locator('#collection-total')).toHaveText('3');
});
