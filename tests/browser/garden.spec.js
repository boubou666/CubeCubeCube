import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const modes=['alveoles','potions','liaisons'];
async function ready(page){await page.waitForFunction(()=>window.__pocketDebug?.scene&&window.__pocketDebug.ready);}
async function hintStep(page){await ready(page);await page.locator('#pocket-hint').click();await page.waitForFunction(()=>window.__pocketDebug.hint?.action!==undefined);await page.keyboard.press('Enter');}
async function pointerAction(page,mode,action,touch=false){
  if(mode==='alveoles'){
    const points=await page.evaluate(a=>[window.__pocketDebug.scene.screenPoint({q:a.q}),window.__pocketDebug.scene.screenPoint({cell:a.cell})],action);
    for(const p of points){if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);}
  }else if(mode==='potions'){
    const points=await page.evaluate(a=>[window.__pocketDebug.scene.screenPoint(a.from),window.__pocketDebug.scene.screenPoint(a.to)],action);
    for(const p of points){if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);}
  }else {
    const points=await page.evaluate(a=>a.path.map(cell=>window.__pocketDebug.scene.screenPoint(cell)),action);
    if(touch){
      // Native touch events exercise the same pointer capture and single-stroke undo.
      const session=await page.context().newCDPSession(page);await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});
      for(const p of points.slice(1))await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p]});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await session.detach();
    }else {await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();for(const p of points.slice(1))await page.mouse.move(p.x,p.y,{steps:5});await page.mouse.up();}
  }
}
for(const mode of modes){
  test(`${mode}: real pointer gameplay, exact reload, undo, verified hints, completion and next puzzle`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`/${mode}.html`);await ready(page);
    const original=await page.evaluate(()=>window.__pocketDebug.game.state),action=await page.evaluate(()=>window.__pocketDebug.game.level.solution[0]);await pointerAction(page,mode,action);
    await expect.poll(()=>page.evaluate(()=>window.__pocketDebug.game.moves.length)).toBe(1);const moved=await page.evaluate(()=>window.__pocketDebug.game.state);
    await page.reload();await ready(page);expect(await page.evaluate(()=>window.__pocketDebug.game.state)).toEqual(moved);await page.locator('#pocket-undo').click();expect(await page.evaluate(()=>window.__pocketDebug.game.state)).toEqual(original);
    await hintStep(page);await ready(page);await page.locator('#pocket-restart').click();expect(await page.evaluate(()=>window.__pocketDebug.game.state)).toEqual(original);
    let guard=0;while(!await page.evaluate(()=>window.__pocketDebug.game.won)&&guard++<80)await hintStep(page);
    await expect(page.locator('#pocket-finish')).toBeVisible();await expect(page.locator('#pocket-total')).toHaveText('1 / 48');await page.locator('#pocket-next').click();await expect(page.locator('#pocket-number')).toContainText('02 / 48');
    await page.reload();await ready(page);await expect(page.locator('#pocket-total')).toHaveText('1 / 48');await expect(page.locator('#pocket-number')).toContainText('02 / 48');expect(errors).toEqual([]);
  });
  test(`${mode}: 48-level collection, expert hints and responsive desktop/mobile controls`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));await mkdir('.local/screenshots',{recursive:true});
    for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:width===1440?1000:844});await page.goto(`/${mode}.html`);await ready(page);await page.locator('#pocket-collection').click();await expect(page.locator('#pocket-levels button')).toHaveCount(12);await page.locator('[data-chapter="3"]').click();await page.locator('[data-level="47"]').click();await ready(page);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('#pocket-hint').click();await page.waitForFunction(()=>window.__pocketDebug.hint?.action!==undefined);await page.screenshot({path:`.local/screenshots/${mode}-${width}.png`,fullPage:true});
      await page.keyboard.press('Enter');await expect.poll(()=>page.evaluate(()=>window.__pocketDebug.game.moves.length)).toBe(1);await ready(page);await page.locator('#pocket-help').click();await expect(page.locator('#pocket-help-dialog')).toBeVisible();await page.getByRole('button',{name:'Fermer les règles',exact:true}).click();await page.locator('#pocket-restart').click();
    }expect(errors).toEqual([]);
  });
  test(`${mode}: real touch play on a small screen`,async({browser})=>{
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage();await page.goto(`/${mode}.html`);await ready(page);await page.locator('#pocket-stage').scrollIntoViewIfNeeded();const action=await page.evaluate(()=>window.__pocketDebug.game.level.solution[0]);await pointerAction(page,mode,action,true);await expect.poll(()=>page.evaluate(()=>window.__pocketDebug.game.moves.length)).toBe(1);await page.locator('#pocket-undo').click();await expect.poll(()=>page.evaluate(()=>window.__pocketDebug.game.moves.length)).toBe(0);await context.close();
  });
}
test('liaisons: keyboard connects endpoints and a partial drag is exactly one undoable stroke',async({page})=>{
  await page.goto('/liaisons.html');await ready(page);const action=await page.evaluate(()=>window.__pocketDebug.game.level.solution[0]);
  await page.locator(`[data-select="${action.color}"]`).click();const size=await page.evaluate(()=>window.__pocketDebug.game.level.size);
  for(let i=1;i<action.path.length;i++){const delta=action.path[i]-action.path[i-1];await page.keyboard.press(delta===1?'ArrowRight':delta===-1?'ArrowLeft':delta===size?'ArrowDown':'ArrowUp');}
  expect(await page.evaluate(color=>window.__pocketDebug.game.state.paths[color],action.color)).toEqual(action.path);await page.locator('#pocket-restart').click();
  await pointerAction(page,'liaisons',{...action,path:action.path.slice(0,3)});await expect.poll(()=>page.evaluate(()=>window.__pocketDebug.game.moves.length)).toBe(1);await hintStep(page);expect(await page.evaluate(()=>window.__pocketDebug.game.state.paths[0])).toEqual([]);await page.locator('#pocket-undo').click();expect(await page.evaluate(()=>window.__pocketDebug.game.state.paths[0])).toEqual(action.path.slice(0,3));
});
test('twenty-four illustrated home games include Alvéoles, Potions and Liaisons',async({page})=>{
  await mkdir('.local/screenshots',{recursive:true});for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});await page.goto('/');await expect(page.locator('.game-card')).toHaveCount(30);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width!==320)await page.screenshot({path:`.local/screenshots/thirteen-games-${width}.png`,fullPage:true});}
  for(const [mode,name]of [['alveoles','Alvéoles'],['potions','Potions'],['liaisons','Liaisons']]){await page.getByRole('link',{name:`Jouer à ${name}`,exact:true}).click();await ready(page);await expect(page).toHaveURL(new RegExp(`/${mode}\\.html$`));await page.getByRole('link',{name:'Les jeux',exact:true}).click();await expect(page.locator('.game-card')).toHaveCount(30);}
});
