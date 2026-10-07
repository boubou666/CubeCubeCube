import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
const modes=['passages','voyage','carrousel','broderie'];
async function ready(page){await page.waitForFunction(()=>window.__pocketDebug?.scene&&window.__pocketDebug.ready);}
async function step(page){await ready(page);await page.locator('#pocket-hint').click();await page.waitForFunction(()=>window.__pocketDebug.hint?.action!==undefined);await page.keyboard.press('Enter');}
for(const mode of modes){
  test(`${mode}: real pointer play, exact reload, undo, hints, completed puzzle and next level`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`/${mode}.html`);await ready(page);
    const original=await page.evaluate(()=>window.__pocketDebug.game.state),action=await page.evaluate(()=>window.__pocketDebug.game.level.solution[0]);
    if(mode==='passages'){
      const points=await page.evaluate(a=>{const b=window.__pocketDebug.game.state.blocks.find(b=>b.id===a.id);return[window.__pocketDebug.scene.screenPoint([b.x,b.y]),window.__pocketDebug.scene.screenPoint([b.x+a.dx,b.y+a.dy])];},action);
      await page.mouse.move(points[0].x,points[0].y);await page.mouse.down();await page.mouse.move(points[1].x,points[1].y,{steps:8});await page.mouse.up();
    }else if(mode==='carrousel')await page.locator(`.ready[data-queue="${action.q}"]`).click();
    else{const point=await page.evaluate(a=>window.__pocketDebug.scene.screenPoint(a),action);await page.mouse.click(point.x,point.y);}
    await expect.poll(()=>page.evaluate(()=>window.__pocketDebug.game.moves.length)).toBe(1);const moved=await page.evaluate(()=>window.__pocketDebug.game.state);
    await page.reload();await ready(page);expect(await page.evaluate(()=>window.__pocketDebug.game.state)).toEqual(moved);
    await page.locator('#pocket-undo').click();expect(await page.evaluate(()=>window.__pocketDebug.game.state)).toEqual(original);
    await step(page);await ready(page);await page.locator('#pocket-restart').click();expect(await page.evaluate(()=>window.__pocketDebug.game.state)).toEqual(original);
    let guard=0;while(!await page.evaluate(()=>window.__pocketDebug.game.won)&&guard++<100)await step(page);
    await expect(page.locator('#pocket-finish')).toBeVisible();await expect(page.locator('#pocket-total')).toHaveText('1 / 48');await page.locator('#pocket-next').click();await expect(page.locator('#pocket-number')).toContainText('PUZZLE 02 / 48');
    await page.reload();await ready(page);await expect(page.locator('#pocket-number')).toContainText('PUZZLE 02 / 48');await expect(page.locator('#pocket-total')).toHaveText('1 / 48');expect(errors).toEqual([]);
  });
  test(`${mode}: chapter collection, expert hint and reachable mobile controls`,async({page})=>{
    const errors=[];page.on('pageerror',e=>errors.push(e.message));await mkdir('.local/screenshots',{recursive:true});
    for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:width===1440?1000:844});await page.goto(`/${mode}.html`);await ready(page);await page.locator('#pocket-collection').click();await expect(page.locator('#pocket-levels button')).toHaveCount(12);await page.locator('[data-chapter="3"]').click();await page.locator('[data-level="47"]').click();await ready(page);await expect(page.locator('#pocket-number')).toContainText('48 / 48');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.locator('#pocket-hint').click();await page.waitForFunction(()=>window.__pocketDebug.hint?.action!==undefined);
      await page.screenshot({path:`.local/screenshots/${mode}-${width}.png`,fullPage:true});await page.keyboard.press('Enter');await expect.poll(()=>page.evaluate(()=>window.__pocketDebug.game.moves.length)).toBe(1);await ready(page);
      await page.locator('#pocket-help').click();await expect(page.locator('#pocket-help-dialog')).toBeVisible();await page.getByRole('button',{name:'Fermer les règles',exact:true}).click();await page.locator('#pocket-restart').click();
    }expect(errors).toEqual([]);
  });
}
test('twenty-four home illustrations open the four additional games and return to the collection',async({page})=>{
  await mkdir('.local/screenshots',{recursive:true});
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});await page.goto('/');await expect(page.locator('.game-card')).toHaveCount(39);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width!==320)await page.screenshot({path:`.local/screenshots/ten-games-${width}.png`,fullPage:true});}
  for(const [name,mode]of [['Passages','passages'],['Voyage','voyage'],['Carrousel','carrousel'],['Broderie','broderie']]){await page.getByRole('link',{name:`Jouer à ${name}`,exact:true}).click();await ready(page);await expect(page).toHaveURL(new RegExp(`/${mode}\\.html$`));await page.getByRole('link',{name:'Les jeux',exact:true}).click();await expect(page.locator('.game-card')).toHaveCount(39);}
});
