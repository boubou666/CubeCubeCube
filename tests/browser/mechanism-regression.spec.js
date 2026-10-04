import { test, expect } from '@playwright/test';

test('every arrow type unlocks on generated button levels', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => localStorage.setItem('cubecubecube.save.v1', JSON.stringify({ version: 4, generation: 2, index: 39 })));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/cube.html');
  await page.waitForFunction(() => Boolean(window.__cubeDebug));
  for (const kind of ['ordinary', 'opposite', 'button']) {
    const move = await page.evaluate(async kind => {
      const { availableMoves } = await import('/src/puzzle.js');
      const { game, scene } = window.__cubeDebug;
      const move = availableMoves(game.level, game.removed).find(m => {
        const a = game.level.arrows.find(a => a.id === m.id);
        return kind === 'opposite' ? a.twoHeads && m.end === 1 : kind === 'button' ? a.id >= game.level.arrows.length - game.level.mechanismPocketCount : !a.branch && !a.twoHeads;
      });
      if (!move) return null;
      scene.onPick(move.id, move.end);
      return move;
    }, kind);
    expect(move, kind).not.toBeNull();
    await page.waitForFunction(() => !window.__cubeDebug.scene.busy, null, { timeout: 5000 }).catch(async e => {
      console.log({ kind, errors, state: await page.evaluate(() => [...window.__cubeDebug.scene.animations].map(([id, a]) => ({ id, duration: a.duration, length: a.length, surface: a.surfaceLength, legs: a.legs?.map(l => l.surfaceLength) }))) });
      throw e;
    });
    expect(errors).toEqual([]);
  }
  for (let i = 0; i < 100; i++) {
    const remaining = await page.evaluate(async () => {
      const { availableMoves } = await import('/src/puzzle.js');
      const { game, scene } = window.__cubeDebug;
      if (!game.remaining) return 0;
      const move = availableMoves(game.level, game.removed).at(-1);
      if (!move) throw new Error('No available move');
      scene.onPick(move.id, move.end);
      return game.remaining;
    });
    await page.waitForFunction(() => !window.__cubeDebug.scene.busy, null, { timeout: 3000 }).catch(e => { console.log(errors); throw e; });
    expect(errors).toEqual([]);
    if (!remaining) break;
  }
  await expect(page.locator('#remaining')).toHaveText('0');
});

test('a failed animation releases the global lock and restores committed button state', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/cube.html');
  await page.waitForFunction(() => Boolean(window.__cubeDebug));
  await page.evaluate(async () => {
    const { createLevel } = await import('/src/puzzle.js');
    const { game, scene } = window.__cubeDebug;
    game.level = createLevel(23); game.removed.clear(); game.history = [];
    scene.load(game.level, game.removed);
    scene.onPick(0, 0);
    scene.onPick(1, 0);
  });
  await expect(page.locator('#toast')).toContainText('Let the mechanisms settle');
  expect(await page.evaluate(() => window.__cubeDebug.game.history.length)).toBe(1);
  // Reproduce a visual frame exception; the move must finish rather than leave
  // requestAnimationFrame repeatedly throwing with its lock still held.
  await page.evaluate(() => {
    const scene = window.__cubeDebug.scene, normalAt = scene.normalAt;
    scene.normalAt = function (...args) { this.normalAt = normalAt; throw new Error('Injected visual failure'); };
  });
  await page.waitForFunction(() => !window.__cubeDebug.scene.busy);
  expect(await page.evaluate(() => window.__cubeDebug.game.level.arrows[0].cells.at(-1).x)).toBe(2);
  await page.evaluate(() => window.__cubeDebug.scene.onPick(1, 0));
  await page.waitForFunction(() => !window.__cubeDebug.scene.busy);
  expect(await page.evaluate(() => window.__cubeDebug.game.removed.has(1))).toBe(true);
  await page.evaluate(() => window.__cubeDebug.scene.onPick(0, 0));
  await page.waitForFunction(() => !window.__cubeDebug.scene.busy);
  await expect(page.locator('#remaining')).toHaveText('0');
  expect(errors).toEqual([]);
});

test('a fork can hold a button with its second head and resume without a lock', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/cube.html');
  await page.waitForFunction(() => Boolean(window.__cubeDebug));
  await page.evaluate(() => {
    const { game, scene } = window.__cubeDebug, cell = (x, y) => ({ face: 'front', x, y });
    game.removed.clear(); game.history = [];
    game.level = { size: 6, bridges: [], arrows: [{ id: 7, cells: [cell(0, 0), cell(1, 0)], direction: [1, 0], branch: { cells: [cell(0, 0), cell(0, 1), cell(0, 2)], direction: [0, 1] } }], buttons: [{ id: 'amber', ...cell(0, 3), color: '#d89b54' }], gates: [] };
    scene.load(game.level, game.removed); scene.onPick(7, 1);
  });
  await page.waitForFunction(() => !window.__cubeDebug.scene.busy);
  await expect(page.locator('#toast')).toContainText('Button held');
  expect(await page.evaluate(async () => {
    const { pressedButtons } = await import('/src/mechanics.js');
    const { game } = window.__cubeDebug; return [...pressedButtons(game.level, game.removed)];
  })).toEqual(['amber']);
  await page.evaluate(() => window.__cubeDebug.scene.onPick(7, 1));
  await page.waitForFunction(() => !window.__cubeDebug.scene.busy);
  await expect(page.locator('#remaining')).toHaveText('0'); expect(errors).toEqual([]);
});

test('orphaned and invalid animation records finish instead of locking every arrow', async ({ page }) => {
  await page.goto('/cube.html'); await page.waitForFunction(() => Boolean(window.__cubeDebug));
  for (const failure of ['missing-mesh', 'invalid-duration']) {
    await page.evaluate(async failure => {
      const { createLevel } = await import('/src/puzzle.js');
      const { game, scene } = window.__cubeDebug;
      game.level = createLevel(23); game.removed.clear(); game.history = [];
      scene.load(game.level, game.removed); scene.onPick(0, 0);
      if (failure === 'missing-mesh') {
        scene.disposeArrow(scene.meshes.get(0)); scene.meshes.delete(0);
      } else scene.animations.get(0).duration = NaN;
    }, failure);
    await page.waitForFunction(() => !window.__cubeDebug.scene.busy);
    expect(await page.evaluate(() => window.__cubeDebug.scene.meshes.get(0).arrow.cells.at(-1).x)).toBe(2);
    await page.evaluate(() => window.__cubeDebug.scene.onPick(1, 0));
    await page.waitForFunction(() => !window.__cubeDebug.scene.busy);
    expect(await page.evaluate(() => window.__cubeDebug.game.removed.has(1))).toBe(true);
  }
});

test('hints complete dependent circle groups with three and seven required parks', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/cube.html');
  for (const index of [30, 102]) {
    await page.locator('#levels-button').click(); await page.locator('#puzzle-jump').fill(String(index + 1));
    await page.locator('#jump-form button').click(); await page.locator('#cube-canvas').focus();
    const before = await page.evaluate(() => ({ remaining: window.__cubeDebug.game.remaining, stats: window.__cubeDebug.game.level.parkingStats }));
    let steps = 0;
    while (await page.evaluate(() => window.__cubeDebug.game.level.parkingGroups[0].some(id => !window.__cubeDebug.game.removed.has(id)))) {
      await page.keyboard.press('h'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => !window.__cubeDebug.scene.busy);
      steps++;
      if (steps === 2 && index === 102) await page.screenshot({ path: '.local/parking-hard.png', fullPage: true });
      expect(steps).toBeLessThan(20);
    }
    expect(steps).toBe(before.stats.arrowCount + before.stats.minimumParks);
    expect(await page.evaluate(() => window.__cubeDebug.game.remaining)).toBe(before.remaining - before.stats.arrowCount);
  }
  expect(errors).toEqual([]);
});
