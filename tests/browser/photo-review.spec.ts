import { test, expect } from './fixture';
import { PHOTOS } from '../../src/lib/photo-catalog';
import { freshPhotoSession, nextPhoto, PHOTO_KEY, votePhoto } from '../../src/lib/photo-session';

test('setup mosaic respects clothing range and exclusions', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Men’s looks', exact: true }).click();
  const allowed = PHOTOS.filter(p => p.collection === 'men').map(p => p.src);
  const sources = await page.locator('.photo-mosaic img').evaluateAll(nodes => nodes.map(n => n.getAttribute('src')));
  expect(sources.length).toBeGreaterThan(0);
  expect(sources.every(s => allowed.includes(s!))).toBe(true);
});

test('the last reaction is undoable after catalog exhaustion', async ({ page }) => {
  let s = freshPhotoSession();
  for (let i = 0; i < PHOTOS.length; i++) s = votePhoto(s, nextPhoto(s, PHOTOS)!.id, 'unsure', PHOTOS);
  s.step = 'discover';
  const last = s.votes.at(-1)!.photoId;
  await page.addInitScript(({ s, key }) => localStorage.setItem(key, JSON.stringify(s)), { s, key: PHOTO_KEY });
  await page.goto('/');
  await page.getByRole('button', { name: 'Undo last reaction', exact: true }).click();
  await expect(page.locator('.photo-current')).toHaveAttribute('data-photo-id', last);
});

test('skip explains that explicit negative detail feedback is retained', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with real outfits' }).click();
  await page.locator('.photo-details summary').click();
  await page.getByRole('group', { name: 'Less of', exact: true }).getByRole('button', { name: 'Brighter colors', exact: true }).click();
  await page.getByRole('button', { name: 'Not sure / skip', exact: true }).click();
  await expect(page.locator('.sr-only[role=status]')).toContainText('explicit detail choices were saved');
});

test('explicit reset recovers after another tab has already cleared storage', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Sex').selectOption('female');
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  await page.evaluate(key => {
    localStorage.removeItem(key);
    window.dispatchEvent(new StorageEvent('storage', { key, storageArea: localStorage }));
  }, PHOTO_KEY);
  await expect(page.getByRole('alert')).toContainText('Another tab');
  await page.getByRole('button', { name: 'Clear photo study', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear photo study', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('alert')).not.toBeVisible();
  await expect(page.getByLabel('Sex')).toHaveValue('unspecified');
});

test('internal navigation protects queued photo notes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with real outfits' }).click();
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  await page.evaluate(async key => {
    let acquired!: () => void;
    const held = new Promise<void>(resolve => { acquired = resolve; });
    const release = new Promise<void>(resolve => { (window as any).__releasePhotoNav = resolve; });
    void navigator.locks.request(key, async () => { acquired(); await release; });
    await held;
  }, PHOTO_KEY);
  await page.getByLabel('What catches your eye?').fill('pending and important');
  await expect(page.locator('.site-footer')).toContainText('Saving…');
  await page.getByRole('link', { name: 'Open original illustrated study' }).click();
  await expect(page).not.toHaveURL(/illustrated/);
  await expect(page.getByLabel('What catches your eye?')).toHaveValue('pending and important');
  await page.getByRole('link', { name: 'Stylr home' }).click();
  await page.evaluate(() => (window as any).__releasePhotoNav());
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).draft.note, PHOTO_KEY)).toBe('pending and important');
});
