import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { LEVELS, createLevel, surfaceLayout } from '../../src/puzzle.js';
test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean(window.__cubeDebug));
});

test('real pointer picking, blocked move, hint, undo, restart, and reload resume', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await expect(page.locator('#remaining')).toHaveText('18');
  const blocked = await page.evaluate(() => window.__cubeDebug.scene.screenPoint(0));
  await page.mouse.click(blocked.x, blocked.y);
  await expect(page.locator('#toast')).toContainText('Something’s in the way');
  await expect(page.locator('#remaining')).toHaveText('18');
  const clear = await page.evaluate(() => window.__cubeDebug.scene.screenPoint(1));
  await page.mouse.click(clear.x, clear.y);
  await expect(page.locator('#remaining')).toHaveText('17');
  await page.reload();
  await expect(page.locator('#remaining')).toHaveText('17');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#remaining')).toHaveText('18');
  await page.locator('#cube-canvas').focus();
  await page.keyboard.press('h'); await page.keyboard.press('Enter');
  await expect(page.locator('#remaining')).toHaveText('17');
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.locator('#remaining')).toHaveText('18');
  await page.locator('#hint-button').click(); await page.keyboard.press('Enter');
  await expect(page.locator('#remaining')).toHaveText('17');
  expect(errors).toEqual([]);
});

test('cube dragging rotates the camera without removing an arrow', async ({ page }) => {
  const before = await page.evaluate(() => window.__cubeDebug.scene.camera.position.toArray());
  const box = await page.locator('#cube-canvas').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 110, box.y + box.height / 2 + 60, { steps: 10 }); await page.mouse.up();
  const after = await page.evaluate(() => window.__cubeDebug.scene.camera.position.toArray());
  expect(after).not.toEqual(before);
  await expect(page.locator('#remaining')).toHaveText('18');
});

test('free rotation passes through both poles and reset restores screen-up', async ({ page }) => {
  const box = await page.locator('#cube-canvas').boundingBox();
  const samples = [];
  for (let turn = 0; turn < 10; turn++) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.72);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.28, { steps: 12 });
    await page.mouse.up();
    samples.push(await page.evaluate(() => ({ upY: window.__cubeDebug.scene.camera.up.y, position: window.__cubeDebug.scene.camera.position.toArray() })));
  }
  expect(samples.some(s => s.upY < -0.3)).toBe(true);
  expect(samples.some(s => s.position[1] < -4)).toBe(true);
  expect(samples.some(s => s.position[1] > 4)).toBe(true);
  for (const sample of samples) expect(sample.position.every(Number.isFinite)).toBe(true);
  await expect(page.locator('#remaining')).toHaveText('18');
  await page.getByRole('button', { name: 'Reset camera view' }).click();
  await expect.poll(() => page.evaluate(() => window.__cubeDebug.scene.camera.up.y)).toBeGreaterThan(0.5);
  await page.locator('#cube-canvas').focus();
  for (let turn = 0; turn < 18; turn++) await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(() => window.__cubeDebug.scene.camera.up.y)).toBeLessThan(-0.3);
  await page.keyboard.press('h'); await page.keyboard.press('Enter');
  await expect(page.locator('#remaining')).toHaveText('17');
});

test('all levels complete through keyboard controls, including new mechanics', async ({ page }) => {
  test.setTimeout(180000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (let index = 0; index < LEVELS.length; index++) {
    if (index) {
      await page.locator('#next-button').click();
      await expect(page.locator('#level-number')).toHaveText(`LEVEL ${String(index + 1).padStart(2, '0')}`);
    }
    const count = Number(await page.locator('#remaining').textContent());
    await page.locator('#cube-canvas').focus();
    for (let move = 0; move < count + 20 && Number(await page.locator('#remaining').textContent()) > 0; move++) {
      await page.keyboard.press('h'); await page.keyboard.press('Enter');
      if ([16, 17].includes(index) || index >= 23) await page.waitForFunction(() => !window.__cubeDebug.scene.busy);
    }
    await expect(page.locator('#remaining')).toHaveText('0');
    await expect(page.locator('#win-dialog')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#completed-count')).toHaveText(String(index + 1));
  }
  await page.locator('#next-button').click();
  await expect(page.locator('#level-number')).toHaveText(`LEVEL ${LEVELS.length + 1}`);
  await expect(page.locator('#level-title')).toContainText('Beyond the corners');
  await page.locator('#levels-button').click();
  await expect(page.locator('#level-grid .level-card.is-complete')).toHaveCount(LEVELS.length);
  expect(errors).toEqual([]);
});

test('undo cancels the final animation and its completion dialog', async ({ page }) => {
  await page.locator('#cube-canvas').focus();
  for (let move = 0; move < 18; move++) { await page.keyboard.press('h'); await page.keyboard.press('Enter'); }
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#remaining')).toHaveText('1');
  await page.waitForTimeout(1600);
  await expect(page.locator('#win-dialog')).not.toBeVisible();
  await page.locator('#cube-canvas').focus(); await page.keyboard.press('h'); await page.keyboard.press('Enter');
  await expect(page.locator('#win-dialog')).toBeVisible();
});

test('collection, theme, sound preferences, and help dialog work', async ({ page }) => {
  await page.locator('#levels-button').click();
  await expect(page.locator('#level-grid .level-card')).toHaveCount(LEVELS.length);
  await expect(page.locator('#endless-grid .level-card')).toHaveCount(12);
  await page.locator('[data-level="4"]').click();
  await expect(page.locator('#level-title')).toHaveText('A different angle');
  await page.getByRole('button', { name: 'Change color palette' }).click();
  await page.getByRole('button', { name: /Quiet dusk/ }).click();
  await page.getByRole('button', { name: 'Close color palette' }).click();
  await page.getByRole('button', { name: 'Turn sound on' }).click();
  await page.reload();
  await expect(page.locator('body')).toHaveAttribute('data-theme', 'dusk');
  await expect(page.getByRole('button', { name: 'Turn sound off' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'How to play' }).click();
  await expect(page.locator('#help-dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#help-dialog')).not.toBeVisible();
});

test('an arrow across a tunnel gap blocks real pointer movement until it clears', async ({ page }) => {
  await page.evaluate(() => {
    const { game, scene } = window.__cubeDebug;
    const cell = (x, y) => ({ face: 'front', x, y });
    game.level = { size: { x: 6, y: 6, z: 4, hole: { x: [2, 3], y: [2, 3] } }, bridges: [], arrows: [
      { id: 0, cells: [cell(2, 0), cell(2, 1)], direction: [0, 1] },
      { id: 1, cells: [cell(3, 4), cell(2, 4), cell(1, 4)], direction: [-1, 0] },
    ] };
    game.removed.clear(); game.history = []; scene.load(game.level, game.removed); scene.hint(0);
  });
  await page.waitForFunction(() => !window.__cubeDebug.scene.cameraTween);
  const head = await page.evaluate(() => window.__cubeDebug.scene.screenPoint(0));
  await page.mouse.click(head.x, head.y);
  await expect(page.locator('#toast')).toContainText('Something’s in the way');
  expect(await page.evaluate(() => window.__cubeDebug.game.history.length)).toBe(0);
  const obstacle = await page.evaluate(() => window.__cubeDebug.scene.screenPoint(1));
  await page.mouse.click(obstacle.x, obstacle.y);
  await expect(page.locator('#remaining')).toHaveText('1');
  await page.waitForFunction(() => window.__cubeDebug.scene.effects.length === 0 && !window.__cubeDebug.scene.busy);
  const clearedHead = await page.evaluate(() => window.__cubeDebug.scene.screenPoint(0));
  await page.mouse.click(clearedHead.x, clearedHead.y);
  await expect(page.locator('#remaining')).toHaveText('0');
});

test('pressure gates, fixed and alternating tiles react only to successful arrow moves', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#levels-button').click(); await page.locator('[data-level="23"]').click();
  await page.waitForFunction(() => !window.__cubeDebug.scene.cameraTween);
  const head = await page.evaluate(() => window.__cubeDebug.scene.screenPoint(0));
  await page.mouse.click(head.x, head.y);
  await expect(page.locator('#toast')).toContainText('Button held');
  await page.waitForFunction(() => !window.__cubeDebug.scene.busy);
  const parked = await page.evaluate(() => window.__cubeDebug.game.level.arrows[0].cells);
  await page.reload();
  expect(await page.evaluate(() => window.__cubeDebug.game.level.arrows[0].cells)).toEqual(parked);
  await page.locator('#undo-button').click();
  expect(await page.evaluate(() => window.__cubeDebug.game.level.arrows[0].cells.at(-1).x)).toBe(1);
  await page.screenshot({ path: '.local/pressure-buttons.png', fullPage: true });
  await page.locator('#levels-button').click(); await page.locator('[data-level="25"]').click();
  await page.waitForFunction(() => !window.__cubeDebug.scene.cameraTween);
  // Clicking the deflector itself does not select an arrow or change its turn.
  const tilePoint = await page.evaluate(() => {
    const { scene } = window.__cubeDebug;
    const point = scene.meshes.get(0).tip.position.clone(); point.x += 3.6 / 6;
    point.project(scene.camera); const box = scene.renderer.domElement.getBoundingClientRect();
    return { x: box.left + (point.x + 1) * box.width / 2, y: box.top + (1 - point.y) * box.height / 2 };
  });
  await page.mouse.click(tilePoint.x, tilePoint.y);
  expect(await page.evaluate(() => window.__cubeDebug.game.level.deflectors[0].turn)).toBe(1);
  await page.locator('#cube-canvas').focus(); await page.keyboard.press('h'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__cubeDebug.scene.busy);
  expect(await page.evaluate(() => window.__cubeDebug.game.level.deflectors[0].turn)).toBe(-1);
  await page.reload();
  expect(await page.evaluate(() => window.__cubeDebug.game.level.deflectors[0].turn)).toBe(-1);
  await page.locator('#undo-button').click();
  expect(await page.evaluate(() => window.__cubeDebug.game.level.deflectors[0].turn)).toBe(1);
  await page.screenshot({ path: '.local/alternating-deflector.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('rotating section animates its arrows, restores with undo, and is discoverable by family', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.locator('#levels-button').click();
  await page.getByRole('button', { name: 'Rotation', exact: true }).click();
  await expect(page.locator('#level-grid .level-card')).toHaveCount(1);
  await page.locator('[data-level="26"]').click();
  await page.locator('#cube-canvas').focus(); await page.keyboard.press('h'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => Boolean(window.__cubeDebug.scene.sectionTween));
  expect(await page.evaluate(() => window.__cubeDebug.scene.sectionTween.objects.some(o => o.object === window.__cubeDebug.scene.meshes.get(1).group))).toBe(true);
  await page.waitForFunction(() => !window.__cubeDebug.scene.busy);
  expect(await page.evaluate(() => window.__cubeDebug.scene.meshes.get(1).arrow.cells[0].face)).toBe('right');
  await page.screenshot({ path: '.local/rotating-section.png', fullPage: true });
  await page.reload();
  expect(await page.evaluate(() => window.__cubeDebug.game.level.rotors[0].turns)).toBe(1);
  await page.locator('#undo-button').click();
  expect(await page.evaluate(() => window.__cubeDebug.scene.meshes.get(1).arrow.cells[0].face)).toBe('front');
  expect(await page.evaluate(() => window.__cubeDebug.game.level.rotors[0].turns)).toBe(0);
  await page.locator('#cube-canvas').focus(); await page.keyboard.press('h'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => Boolean(window.__cubeDebug.scene.sectionTween));
  await page.locator('#undo-button').click(); await page.waitForTimeout(950);
  expect(await page.evaluate(() => window.__cubeDebug.game.level.rotors[0].turns)).toBe(0);
  expect(await page.evaluate(() => window.__cubeDebug.scene.busy)).toBe(false);
  expect(errors).toEqual([]);
});

test('painted ridge is visible and opposite heads pick their own direction', async ({ page }) => {
  await mkdir('.local', { recursive: true });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.locator('#levels-button').click(); await page.locator('[data-level="12"]').click();
  await expect(page.locator('#mechanic-notice')).toContainText('Colored ridge');
  await page.screenshot({ path: '.local/ridges.png', fullPage: true });
  for (const index of [13]) {
    await page.locator('#levels-button').click(); await page.locator(`[data-level="${index}"]`).click();
    await page.waitForFunction(() => !window.__cubeDebug.scene.cameraTween);
    const count = Number(await page.locator('#remaining').textContent());
    const primary = await page.evaluate(() => window.__cubeDebug.scene.screenPoint(0, 0));
    await page.mouse.click(primary.x, primary.y);
    await expect(page.locator('#remaining')).toHaveText(String(count));
    const alternate = await page.evaluate(() => window.__cubeDebug.scene.screenPoint(0, 1));
    await page.mouse.click(alternate.x, alternate.y);
    await expect(page.locator('#remaining')).toHaveText(String(count - 1));
    await page.waitForFunction(() => window.__cubeDebug.scene.animations.size === 0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('#remaining')).toHaveText(String(count));
    await page.screenshot({ path: `.local/${index === 13 ? 'two-heads' : 'branches'}.png`, fullPage: true });
  }
  expect(errors).toEqual([]);
});

test('fork needs both paths and both heads animate independently on release', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await mkdir('.local', { recursive: true });
  await page.locator('#levels-button').click(); await page.locator('[data-level="18"]').click();
  await page.waitForFunction(() => !window.__cubeDebug.scene.cameraTween);
  await expect(page.locator('#mechanic-notice')).toContainText('Both head paths');
  for (const end of [0, 1]) {
    const head = await page.evaluate(end => window.__cubeDebug.scene.screenPoint(0, end), end);
    await page.mouse.click(head.x, head.y);
    await expect(page.locator('#remaining')).toHaveText('4');
    await expect(page.locator('#toast')).toContainText('Both head paths must be clear');
  }
  expect(await page.evaluate(() => window.__cubeDebug.available().includes(0))).toBe(false);
  await page.locator('#cube-canvas').focus(); await page.keyboard.press('h');
  expect(await page.evaluate(() => window.__cubeDebug.scene.hintId)).toBe(1);
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__cubeDebug.scene.animations.size === 0);
  expect(await page.evaluate(() => window.__cubeDebug.available().includes(0))).toBe(true);
  await page.keyboard.press('h');
  expect(await page.evaluate(() => window.__cubeDebug.scene.hintId)).toBe(0);
  await page.waitForFunction(() => !window.__cubeDebug.scene.cameraTween);
  const before = await page.evaluate(() => {
    const entry = window.__cubeDebug.scene.meshes.get(0);
    return [entry.tip.position.toArray(), entry.otherTip.position.toArray()];
  });
  const head = await page.evaluate(() => window.__cubeDebug.scene.screenPoint(0, 1));
  await page.mouse.click(head.x, head.y);
  await expect(page.locator('#remaining')).toHaveText('2');
  await page.waitForFunction(() => {
    const a = window.__cubeDebug.scene.animations.get(0);
    return a && (performance.now() - a.start) / a.duration > 0.25;
  });
  const during = await page.evaluate(() => {
    const entry = window.__cubeDebug.scene.meshes.get(0);
    return [entry.tip.position.toArray(), entry.otherTip.position.toArray()];
  });
  expect(during[0][0]).toBeGreaterThan(before[0][0] + 0.2);
  expect(during[1][1]).toBeGreaterThan(before[1][1] + 0.2);
  expect(Math.abs(during[0][1] - before[0][1])).toBeLessThan(0.03);
  expect(Math.abs(during[1][0] - before[1][0])).toBeLessThan(0.03);
  await page.waitForFunction(() => window.__cubeDebug.scene.animations.size === 0);
  await page.reload(); await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#remaining')).toHaveText('3');
  await page.screenshot({ path: '.local/fork-corrected.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('an arrow aimed into the tunnel wall cannot leave through the solid', async ({ page }) => {
  await page.locator('#levels-button').click(); await page.locator('[data-level="21"]').click();
  await page.waitForFunction(() => !window.__cubeDebug.scene.cameraTween);
  const bottom = surfaceLayout(createLevel(21).size).cells.find(c => c.face.startsWith('top@') && c.y === 0);
  const arrow = { id: 0, cells: [{ ...bottom, x: bottom.x + 1 }, bottom], direction: [-1, 0] };
  // Reproduce the reported invalid placement to exercise the actual click guard.
  await page.evaluate(arrow => {
    const { game, scene } = window.__cubeDebug;
    game.level.arrows = [arrow]; scene.load(game.level, game.removed);
  }, arrow);
  const head = await page.evaluate(() => window.__cubeDebug.scene.screenPoint(0));
  await page.mouse.click(head.x, head.y);
  await expect(page.locator('#toast')).toContainText('The solid blocks this exit');
  expect(await page.evaluate(() => window.__cubeDebug.game.remaining)).toBe(1);
  expect(await page.evaluate(() => window.__cubeDebug.scene.animations.size)).toBe(0);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.waitForFunction(() => !window.__cubeDebug.scene.cameraTween);
  await page.screenshot({ path: '.local/hole-corrected.png', fullPage: true });
});

test('circle parking frees an arrow and persists through reload with undo', async ({ page }) => {
  await page.locator('#levels-button').click(); await page.locator('[data-level="16"]').click();
  await page.waitForFunction(() => !window.__cubeDebug.scene.cameraTween);
  const head = await page.evaluate(() => window.__cubeDebug.scene.screenPoint(0));
  await page.mouse.click(head.x, head.y);
  await expect(page.locator('#toast')).toContainText('Paused on the circle');
  await expect(page.locator('#remaining')).toHaveText('2');
  await page.waitForFunction(() => window.__cubeDebug.scene.animations.size === 0);
  await page.screenshot({ path: '.local/circles.png', fullPage: true });
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__cubeDebug));
  expect(await page.evaluate(() => window.__cubeDebug.game.level.arrows[0].cells.at(-1).x)).toBe(2);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await page.evaluate(() => window.__cubeDebug.game.level.arrows[0].cells.at(-1).x)).toBe(1);
  await page.locator('#cube-canvas').focus();
  for (let move = 0; move < 3; move++) {
    await page.keyboard.press('h'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__cubeDebug.scene.animations.size === 0);
  }
  await expect(page.locator('#win-dialog')).toBeVisible();
});

test('unequal faces, a real tunnel, and integrated terraces render and remain playable', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await mkdir('.local', { recursive: true });
  for (const [index, name] of [[20, 'prism'], [21, 'hole'], [22, 'terraces']]) {
    await page.locator('#levels-button').click(); await page.locator(`[data-level="${index}"]`).click();
    await page.waitForFunction(() => !window.__cubeDebug.scene.cameraTween);
    await page.screenshot({ path: `.local/${name}.png`, fullPage: true });
    const count = Number(await page.locator('#remaining').textContent());
    await page.locator('#cube-canvas').focus(); await page.keyboard.press('h'); await page.keyboard.press('Enter');
    await expect(page.locator('#remaining')).toHaveText(String(count - 1));
    await page.waitForFunction(() => window.__cubeDebug.scene.animations.size === 0);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.locator('#remaining')).toHaveText(String(count));
  }
  expect(errors).toEqual([]);
});

test('desktop and mobile layouts render without horizontal overflow', async ({ page }) => {
  await mkdir('.local', { recursive: true });
  await page.screenshot({ path: '.local/desktop.png', fullPage: true });
  await page.locator('#levels-button').click(); await page.locator('[data-level="4"]').click();
  await page.screenshot({ path: '.local/wrapped-level.png', fullPage: true });
  await page.locator('#levels-button').click(); await page.locator('[data-level="0"]').click();
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.locator('#cube-canvas')).toBeVisible();
    await page.screenshot({ path: `.local/viewport-${width}.png`, fullPage: true });
    await page.locator('#levels-button').click();
    expect(await page.evaluate(() => document.querySelector('#levels-dialog').scrollWidth <= document.querySelector('#levels-dialog').clientWidth)).toBe(true);
    await page.getByRole('button', { name: 'Close collection' }).click();
  }
});

test('endless journey completes into another puzzle and restores seeded progress', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#levels-button').click(); await page.locator('#endless-button').click();
  await expect(page.locator('#level-number')).toHaveText(`LEVEL ${LEVELS.length + 1}`);
  await expect(page.locator('#collection-count')).toHaveText(`${LEVELS.length + 1} / ∞`);
  const fingerprint = await page.evaluate(() => JSON.stringify(window.__cubeDebug.game.level.arrows));
  const count = Number(await page.locator('#remaining').textContent());
  await page.locator('#cube-canvas').focus();
  for (let i = 0; i < 3; i++) { await page.keyboard.press('h'); await page.keyboard.press('Enter'); }
  await page.reload();
  await expect(page.locator('#remaining')).toHaveText(String(count - 3));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#remaining')).toHaveText(String(count - 2));
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  expect(await page.evaluate(() => JSON.stringify(window.__cubeDebug.game.level.arrows))).toBe(fingerprint);
  await page.locator('#cube-canvas').focus();
  for (let i = 0; i < count; i++) { await page.keyboard.press('h'); await page.keyboard.press('Enter'); }
  await expect(page.locator('#win-dialog')).toBeVisible();
  await expect(page.locator('#completed-count')).toHaveText('1');
  await page.locator('#next-button').click(); await expect(page.locator('#level-number')).toHaveText(`LEVEL ${LEVELS.length + 2}`);
  await page.locator('#levels-button').click();
  await expect(page.locator(`#endless-grid [data-level="${LEVELS.length}"]`)).toHaveClass(/is-complete/);
  await expect(page.locator('#endless-grid .level-card')).toHaveCount(12);
  await page.locator('#endless-next').click(); await expect(page.locator('#endless-page-label')).toHaveText(`${LEVELS.length + 13}–${LEVELS.length + 24}`);
  await page.locator('#endless-prev').click(); await expect(page.locator('#endless-page-label')).toHaveText(`${LEVELS.length + 1}–${LEVELS.length + 12}`);
  await page.locator('.endless-heading').scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.local/endless-collection.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('later endless circles and a distant tier render, park, reload, and remain playable on mobile', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.locator('#levels-button').click(); await page.locator('#puzzle-jump').fill(String(LEVELS.length + 32));
  await page.locator('#jump-form button').click();
  await expect(page.locator('#level-number')).toHaveText(`LEVEL ${LEVELS.length + 32}`);
  await expect(page.locator('#mechanic-notice')).toContainText('Circle = pause');
  // The hint plans the dependent parking group before unrelated filler arrows.
  await page.locator('#cube-canvas').focus();
  await page.keyboard.press('h');
  const id = await page.evaluate(() => window.__cubeDebug.scene.hintId);
  expect(await page.evaluate(id => window.__cubeDebug.game.level.parkingGroups[0].includes(id), id)).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator('#toast')).toContainText('Paused on the circle');
  await page.waitForFunction(() => window.__cubeDebug.scene.animations.size === 0);
  const parked = await page.evaluate(id => window.__cubeDebug.game.level.arrows.find(a => a.id === id).cells, id);
  await page.reload();
  expect(await page.evaluate(id => window.__cubeDebug.game.level.arrows.find(a => a.id === id).cells, id)).toEqual(parked);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.locator('#levels-button').click(); await page.locator('#puzzle-jump').fill('1000');
  await page.locator('#jump-form button').click();
  await expect(page.locator('#level-number')).toHaveText('LEVEL 1000');
  expect(Number(await page.locator('#remaining').textContent())).toBeGreaterThan(100);
  await page.waitForFunction(() => !window.__cubeDebug.scene.cameraTween);
  await page.screenshot({ path: '.local/endless-late.png', fullPage: true });
  await page.setViewportSize({ width: 320, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('#cube-canvas').focus(); await page.keyboard.press('h'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__cubeDebug.scene.animations.size === 0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await page.locator('#levels-button').click();
  expect(await page.evaluate(() => document.querySelector('#levels-dialog').scrollWidth <= document.querySelector('#levels-dialog').clientWidth)).toBe(true);
  expect(errors).toEqual([]);
});
