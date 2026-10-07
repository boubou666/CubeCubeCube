import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { imageBlockers } from '../../src/image-puzzle.js';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/image.html');
  await page.waitForFunction(() => Boolean(window.__pictureDebug?.game) && !window.__pictureDebug.worker);
});
test('@core sample is a multicoloured puzzle; pointer blockers, hints, undo, restart and reload work', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const level = await page.evaluate(() => window.__pictureDebug.game.level);
  expect(level.arrows.every(a => a.cells.length >= 5)).toBe(true);
  expect(level.arrows.length).toBeLessThan(160);
  expect(level.arrows.some(a => new Set(a.colours.map(c => c.join(','))).size > 1)).toBe(true);
  const blockedIds = level.arrows.filter(a => imageBlockers(level, a).length).map(a => a.id);
  const head = await page.evaluate(ids => ids.map(id => ({ id, ...window.__pictureDebug.scene.screenPoint(id) })).find(p => p.x > 0 && p.x < innerWidth && p.y > 0 && p.y < innerHeight - 20), blockedIds);
  expect(head).toBeTruthy();
  const scrollBefore = await page.evaluate(() => scrollY);
  await page.mouse.click(head.x, head.y); await expect(page.locator('#play-status')).toContainText('in the way');
  expect(await page.evaluate(() => scrollY)).toBe(scrollBefore);
  expect(await page.evaluate(() => window.__pictureDebug.game.history.length)).toBe(0);
  const count = level.arrows.length;
  await page.locator('#picture-canvas').focus(); await page.keyboard.press('h'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => !window.__pictureDebug.scene.busy && window.__pictureDebug.game.history.length === 1);
  await page.evaluate(() => window.__pictureDebug.saving);
  await page.reload(); await page.waitForFunction(() => Boolean(window.__pictureDebug?.game));
  await expect(page.locator('#image-remaining')).toHaveText(String(count - 1));
  expect(await page.evaluate(() => window.__pictureDebug.game.level.arrows)).toEqual(level.arrows);
  await page.locator('#image-undo').click(); await expect(page.locator('#image-remaining')).toHaveText(String(count));
  await page.locator('#picture-canvas').focus(); await page.keyboard.press('h'); await page.keyboard.press('Enter');
  await page.locator('#image-restart').click(); await expect(page.locator('#image-remaining')).toHaveText(String(count));
  await page.locator('#show-original').click(); await expect(page.locator('#show-original')).toHaveAttribute('aria-pressed', 'true'); await expect(page.locator('#image-hint')).toBeDisabled();
  await page.locator('#show-original').click();
  await mkdir('.local', { recursive: true }); await page.screenshot({ path: '.local/picture-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('legacy tiny-arrow saves regenerate long paths while retaining the image and crop', async ({ page }) => {
  await page.locator('#image-file').setInputFiles({ name: 'Retained hills.svg', mimeType: 'image/svg+xml', buffer: await readFile('public/sample-landscape.svg') });
  await page.getByRole('button', { name: 'Square', exact: true }).click();
  await page.locator('#image-detail').selectOption('soft'); await page.locator('#create-image-puzzle').click();
  await page.waitForFunction(() => !window.__pictureDebug.worker && window.__pictureDebug.game.level.detail === 'soft');
  const crop = await page.evaluate(() => window.__pictureDebug.crop);
  await page.evaluate(async () => {
    await window.__pictureDebug.saving;
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('cube-image-puzzles', 1);
      request.onsuccess = () => {
        const db = request.result, transaction = db.transaction('puzzles', 'readwrite'), store = transaction.objectStore('puzzles'), read = store.get('active');
        read.onsuccess = () => {
          const record = read.result;
          record.level = { version: 1, cols: 2, rows: 1, arrows: [{ id: 0, cells: [[0, 0], [1, 0]], direction: [1, 0], colours: [[20, 120, 90], [20, 120, 90]] }] };
          record.history = [0]; store.put(record, 'active');
        };
        transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = reject;
      };
    });
  });
  await page.reload(); await page.waitForFunction(() => Boolean(window.__pictureDebug?.game) && !window.__pictureDebug.worker);
  await expect(page.locator('#puzzle-title')).toHaveText('Retained hills');
  expect(await page.evaluate(() => window.__pictureDebug.crop)).toEqual(crop);
  expect(await page.evaluate(() => window.__pictureDebug.game.level.arrows.every(a => a.cells.length >= 5))).toBe(true);
  expect(await page.evaluate(() => window.__pictureDebug.game.history)).toEqual([]);
  await page.evaluate(() => window.__pictureDebug.saving);
  const arrows = await page.evaluate(() => window.__pictureDebug.game.level.arrows);
  await page.reload(); await page.waitForFunction(() => Boolean(window.__pictureDebug?.game));
  expect(await page.evaluate(() => window.__pictureDebug.game.level.arrows)).toEqual(arrows);
});
test('uploaded images, preset and manual crops, settings and shuffled paths generate playable boards', async ({ page }) => {
  const data = await readFile('public/sample-landscape.svg');
  await page.locator('#image-file').setInputFiles({ name: 'My hills.svg', mimeType: 'image/svg+xml', buffer: data });
  await expect(page.locator('#source-name')).toHaveText('My hills.svg');
  await page.getByRole('button', { name: 'Square', exact: true }).click();
  await page.locator('#image-difficulty').selectOption('tangled'); await page.locator('#image-detail').selectOption('soft');
  await page.locator('#create-image-puzzle').click();
  await page.waitForFunction(() => !window.__pictureDebug.worker && window.__pictureDebug.game.level.difficulty === 'tangled');
  expect(await page.evaluate(() => [window.__pictureDebug.game.level.cols, window.__pictureDebug.game.level.rows])).toEqual([22, 22]);
  const original = await page.evaluate(() => JSON.stringify(window.__pictureDebug.game.level.arrows));
  await page.locator('#shuffle-picture').click(); await page.waitForFunction(() => !window.__pictureDebug.worker);
  expect(await page.evaluate(() => JSON.stringify(window.__pictureDebug.game.level.arrows))).not.toBe(original);
  const box = await page.locator('#crop-preview').boundingBox();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.25); await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.75, { steps: 5 }); await page.mouse.up();
  expect(await page.evaluate(() => window.__pictureDebug.crop.w)).toBeLessThan(0.8);
  await page.locator('#create-image-puzzle').click(); await page.waitForFunction(() => !window.__pictureDebug.worker);
  await page.locator('#picture-canvas').focus(); await page.keyboard.press('h'); await page.keyboard.press('Enter');
  await page.waitForFunction(() => window.__pictureDebug.game.history.length === 1 && !window.__pictureDebug.scene.busy);
  await page.evaluate(() => window.__pictureDebug.saving);
  const frame = await page.evaluate(() => window.__pictureDebug.crop);
  const arrows = await page.evaluate(() => window.__pictureDebug.game.level.arrows);
  await page.reload(); await page.waitForFunction(() => Boolean(window.__pictureDebug?.game));
  expect(await page.evaluate(() => window.__pictureDebug.crop)).toEqual(frame);
  expect(await page.evaluate(() => window.__pictureDebug.game.level.arrows)).toEqual(arrows);
  expect(await page.evaluate(() => window.__pictureDebug.game.history.length)).toBe(1);
});

test('transparent crops and corrupt picture saves recover without changing cube progress', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('cubecubecube.save.v1', JSON.stringify({ version: 4, generation: 3, index: 5, moves: [], removed: [], theme: 'mint' })));
  const cubeSave = await page.evaluate(() => localStorage.getItem('cubecubecube.save.v1'));
  const before = await page.locator('#image-remaining').textContent();
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 40;
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'Transparent.png', { type: 'image/png' }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer }));
  });
  await expect(page.locator('#source-name')).toHaveText('Pasted picture'); await page.locator('#create-image-puzzle').click();
  await expect(page.locator('#source-status')).toContainText('transparent');
  await expect(page.locator('#image-remaining')).toHaveText(before); await expect(page.locator('#image-hint')).toBeEnabled();
  await page.evaluate(async () => {
    await window.__pictureDebug.saving;
    await new Promise((resolve, reject) => {
      const request = indexedDB.open('cube-image-puzzles', 1);
      request.onsuccess = () => {
        const db = request.result, transaction = db.transaction('puzzles', 'readwrite'), store = transaction.objectStore('puzzles'), read = store.get('active');
        read.onsuccess = () => { const record = read.result; record.level.arrows[0].direction = [0, 0]; store.put(record, 'active'); };
        transaction.oncomplete = () => { db.close(); resolve(); }; transaction.onerror = reject;
      };
    });
  });
  await page.reload(); await page.waitForFunction(() => Boolean(window.__pictureDebug?.game) && !window.__pictureDebug.worker);
  await expect(page.locator('#puzzle-title')).toHaveText('Sunlit hills');
  expect(await page.evaluate(() => localStorage.getItem('cubecubecube.save.v1'))).toBe(cubeSave);
});
test('paste, drop, image URLs, invalid imports and mobile controls work', async ({ page }) => {
  await page.evaluate(async () => {
    const response = await fetch('/sample-landscape.svg'), blob = await response.blob(), transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'Pasted hills.svg', { type: blob.type }));
    document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer }));
  });
  await expect(page.locator('#source-name')).toHaveText('Pasted picture');
  await page.evaluate(async () => {
    const blob = await (await fetch('/sample-landscape.svg')).blob(), transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'Dropped hills.svg', { type: blob.type }));
    document.querySelector('#drop-zone').dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true }));
  });
  await expect(page.locator('#source-name')).toHaveText('Dropped hills.svg');
  await page.locator('.image-link summary').click(); await page.locator('#image-url').fill('http://127.0.0.1:5173/sample-landscape.svg'); await page.locator('#image-url-form button').click();
  await expect(page.locator('#source-name')).toHaveText('sample-landscape.svg');
  await page.locator('#image-file').setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.locator('#source-status')).toContainText('could not be opened');
  await expect(page.locator('#create-image-puzzle')).toBeEnabled();
  for (const width of [390, 320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#picture-zoom-in').click(); expect(await page.evaluate(() => window.__pictureDebug.scene.zoom)).toBeGreaterThan(1);
    await page.locator('#picture-fit').click(); expect(await page.evaluate(() => window.__pictureDebug.scene.zoom)).toBe(1);
    await page.screenshot({ path: `.local/picture-${width}.png`, fullPage: true });
  }
});
test('a complete image puzzle celebrates after animation and supports another arrangement', async ({ page }) => {
  await page.locator('#image-detail').selectOption('soft'); await page.locator('#create-image-puzzle').click();
  await page.waitForFunction(() => !window.__pictureDebug.worker && window.__pictureDebug.game.level.detail === 'soft');
  await page.locator('#picture-canvas').focus();
  const original = await page.evaluate(() => window.__pictureDebug.game.level);
  for (let i = 0; i < original.arrows.length; i++) {
    await page.keyboard.press('h'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => !window.__pictureDebug.scene.busy);
  }
  await expect(page.locator('#picture-win')).toBeVisible(); await expect(page.locator('#image-remaining')).toHaveText('0');
  await page.locator('#image-undo').click(); await expect(page.locator('#picture-win')).toBeHidden();
  await page.locator('#picture-canvas').focus(); await page.keyboard.press('h'); await page.keyboard.press('Enter');
  await expect(page.locator('#picture-win')).toBeVisible(); await page.locator('#another-picture-layout').click();
  await page.waitForFunction(() => !window.__pictureDebug.worker);
  expect(await page.evaluate(() => window.__pictureDebug.game.level.seed)).not.toBe(original.seed);
});
