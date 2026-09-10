import { test, expect, type Page } from './fixture';
import AxeBuilder from '@axe-core/playwright';
import { PHOTOS } from '../../src/lib/photo-catalog';
import { freshPhotoSession, nextPhoto, PHOTO_KEY, votePhoto } from '../../src/lib/photo-session';
import { STORAGE_KEY, freshSession } from '../../src/lib/style-engine';
import type { PhotoSession } from '../../src/lib/photo-types';

const stored = async (page: Page): Promise<PhotoSession> => {
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), PHOTO_KEY);
};
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with real outfits' }).click();
  await expect(page.getByRole('button', { name: 'I’d wear this', exact: true })).toBeEnabled();
}
async function react(page: Page, name = 'I’d wear this') {
  const button = page.getByRole('button', { name, exact: true });
  await expect(button).toBeEnabled();
  await button.click();
  await expect(button).toBeEnabled();
}

for (const width of [320, 390, 768, 1440]) {
  test(`photo setup, vote and portrait accessible at ${width}px`, async ({ page }) => {
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.setViewportSize({ width, height: 950 }); await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('h1')).toContainText('Real clothes.');
    await expect(page.getByLabel('Sex', { exact: false })).toHaveValue('unspecified');
    for (const stage of ['setup', 'explore', 'portrait']) {
      if (stage === 'explore') { await page.getByRole('button', { name: 'Start with real outfits' }).click(); await react(page); }
      if (stage === 'portrait') await page.getByRole('button', { name: 'See my evolving portrait' }).click();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
      await page.screenshot({ path: `docs/verification/photos-${stage}-${width}.png`, fullPage: true });
    }
    expect(errors).toEqual([]);
  });
}
test('all color catalog assets load from same origin and retain original aspect ratio', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async photos => Promise.all(photos.map(p => new Promise<{id:string;ok:boolean;chroma:number}>(resolve => {
    const im = new Image();
    im.onerror = () => resolve({id:p.id,ok:false,chroma:0});
    im.onload = () => {
      const canvas = document.createElement('canvas');canvas.width = 80;canvas.height = 80;
      const ctx = canvas.getContext('2d')!;ctx.drawImage(im,0,0,80,80);const data=ctx.getImageData(0,0,80,80).data;
      let total=0;for(let i=0;i<data.length;i+=4)total+=Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2]);
      resolve({id:p.id,ok:im.naturalWidth>0,chroma:total/6400});
    };im.src=p.src;
  }))), PHOTOS);
  expect(result).toHaveLength(PHOTOS.length);
  expect(result.filter(p => !p.ok || p.chroma < 1)).toEqual([]);
  await page.getByRole('button', { name: 'Browse the photo collection' }).click();
  await expect(page.locator('.photo-tile')).toHaveCount(PHOTOS.length);
  expect(await page.locator('.tile-image img').first().evaluate(e => getComputedStyle(e).objectFit)).toBe('contain');
});
test('sex and body inputs persist independently from clothing range and legacy data', async ({ page }) => {
  const legacy=JSON.stringify(freshSession());
  await page.addInitScript(({k,v})=>localStorage.setItem(k,v), {k:STORAGE_KEY,v:legacy});
  await page.goto('/');
  await page.getByLabel('Sex', { exact: false }).selectOption('female');
  await page.getByLabel('Body reference', { exact: false }).selectOption('fuller');
  await page.getByRole('button', { name: 'Men’s looks', exact: true }).click();
  expect(await stored(page)).toMatchObject({ sex:'female',frame:'fuller',collection:'men' });
  await page.reload();await page.getByRole('button', { name:'Start with real outfits' }).click();
  const id=await page.locator('.photo-current').getAttribute('data-photo-id');
  expect(PHOTOS.find(p=>p.id===id)?.collection).toBe('men');
  expect(await page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY)).toBe(legacy);
  await page.getByRole('link',{name:'Open original illustrated study'}).click();
  await expect(page.locator('.main-figure')).toBeVisible();
});
test('notes persist, profile changes confirm before losing draft, cancellation is lossless', async ({page})=>{
  await start(page);const id=await page.locator('.photo-current').getAttribute('data-photo-id');
  await page.getByLabel('What catches your eye?').fill('Keep this exact unfinished thought');await stored(page);await page.reload();
  await expect(page.getByLabel('What catches your eye?')).toHaveValue('Keep this exact unfinished thought');
  await page.getByRole('button',{name:'Change starting point'}).click();
  const other=PHOTOS.find(p=>p.id===id)?.collection==='men'?'Women’s looks':'Men’s looks';
  await page.getByRole('button',{name:other,exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button',{name:'Keep editing',exact:true}).click();
  expect((await stored(page)).draft?.photoId).toBe(id);
  await page.getByRole('button',{name:other,exact:true}).click();
  await page.getByRole('button',{name:'Discard draft and change'}).click();
  expect((await stored(page)).draft).toBeUndefined();await page.reload();
  await expect(page.getByRole('alert')).not.toBeVisible();
});
test('double click and held Enter produce one reaction, unsure is neutral, undo restores exact card',async({page})=>{
  await start(page);const id=await page.locator('.photo-current').getAttribute('data-photo-id');
  await page.getByLabel('What catches your eye?').fill('Sleeves');
  await page.getByRole('button',{name:'I’d wear this',exact:true}).dblclick({delay:120});
  await expect.poll(async()=> (await stored(page)).votes.length).toBe(1);
  await expect(page.getByRole('button',{name:'Undo last reaction',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Undo last reaction',exact:true}).click();
  await expect(page.locator('.photo-current')).toHaveAttribute('data-photo-id',id!);
  await expect(page.getByLabel('What catches your eye?')).toHaveValue('Sleeves');
  await react(page,'Not sure / skip');expect((await stored(page)).votes[0].reaction).toBe('unsure');
  const button=page.getByRole('button',{name:'I’d wear this',exact:true});await button.focus();
  await page.keyboard.down('Enter');await page.waitForTimeout(750);await page.keyboard.down('Enter');await page.keyboard.up('Enter');
  expect((await stored(page)).votes.length).toBe(2);
});
test('failed image cannot be positively rated, can retry and skip safely',async({page})=>{
  await page.route('**/photos/**',route=>route.abort());await startWithoutImage(page);
  await expect(page.getByRole('button',{name:'I’d wear this',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Skip unavailable photo'}).click();expect((await stored(page)).votes[0].reaction).toBe('unsure');
  await page.unroute('**/photos/**');await page.getByRole('button',{name:'Retry image'}).click();
  await expect(page.getByRole('button',{name:'I’d wear this',exact:true})).toBeEnabled();
});
async function startWithoutImage(page:Page){await page.goto('/');await page.getByRole('button',{name:'Start with real outfits'}).click();}
test('unknown stored version remains untouched until explicit clear; legacy untouched',async({page})=>{
  await page.addInitScript(({k,l})=>{localStorage.setItem(k,'{"version":999}');localStorage.setItem(l,'legacy-data')},{k:PHOTO_KEY,l:STORAGE_KEY});
  await page.goto('/');await expect(page.getByRole('alert')).toContainText('cannot be read');
  await page.getByRole('button',{name:'Men’s looks',exact:true}).click();
  expect(await page.evaluate(k=>localStorage.getItem(k),PHOTO_KEY)).toBe('{"version":999}');
  await page.getByRole('button',{name:'Clear photo study',exact:true}).click();
  await page.getByRole('dialog').getByRole('button',{name:'Clear photo study',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(k=>localStorage.getItem(k),PHOTO_KEY)).toBeNull();
  expect(await page.evaluate(k=>localStorage.getItem(k),STORAGE_KEY)).toBe('legacy-data');
});
test('no matches and exhaustion stay usable without fabricated portrait claims',async({page})=>{
  let s=freshPhotoSession();for(let i=0;i<PHOTOS.length;i++)s=votePhoto(s,nextPhoto(s,PHOTOS)!.id,'unsure',PHOTOS);s.step='discover';
  await page.addInitScript(({k,s})=>localStorage.setItem(k,JSON.stringify(s)),{k:PHOTO_KEY,s});await page.goto('/');
  await expect(page.getByRole('heading',{name:'You’ve explored this selection.'})).toBeVisible();
  await page.getByRole('button',{name:'View my portrait'}).click();
  await expect(page.locator('.evidence-item')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Other details to explore'})).not.toBeVisible();
});
