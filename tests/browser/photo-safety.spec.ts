import { test, expect, type Page } from './fixture';
import { PHOTO_KEY, freshPhotoSession } from '../../src/lib/photo-session';

async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with real outfits' }).click();
  await expect(page.getByRole('button', { name: 'I’d wear this', exact: true })).toBeEnabled();
  await page.getByLabel('What catches your eye?').fill('keep this note');
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
}
test('photo invalid storage stays protected after transient read failure', async ({ page }) => {
  await page.addInitScript(k => localStorage.setItem(k, '{"version":999}'), PHOTO_KEY);
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('cannot be read');
  await page.evaluate(() => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function () { throw new Error('temporary'); };
    document.dispatchEvent(new Event('visibilitychange'));
    Storage.prototype.getItem = get;
  });
  await page.getByLabel('Sex').selectOption('female');
  await page.waitForTimeout(100);
  expect(await page.evaluate(k => localStorage.getItem(k), PHOTO_KEY)).toBe('{"version":999}');
  await expect(page.getByRole('alert')).toContainText('cannot be read');
});
test('loading missing saved photo study never replaces local unsaved work', async ({ page }) => {
  await start(page);
  await page.evaluate(k => {
    localStorage.removeItem(k);
    window.dispatchEvent(new StorageEvent('storage', { key: k, storageArea: localStorage }));
  }, PHOTO_KEY);
  await expect(page.getByRole('alert')).toContainText('Another tab');
  await page.getByLabel('What catches your eye?').fill('only surviving draft');
  await page.getByRole('button', { name: 'Load saved version', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Load saved version', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('What catches your eye?')).toHaveValue('only surviving draft');
});
test('failed photo clear does not report success or lose state', async ({ page }) => {
  await start(page);
  const before = await page.evaluate(k => localStorage.getItem(k), PHOTO_KEY);
  await page.evaluate(() => { Storage.prototype.removeItem = () => {}; });
  await page.getByRole('button', { name: 'Clear photo study', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear photo study', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Clearing failed');
  expect(await page.evaluate(k => localStorage.getItem(k), PHOTO_KEY)).toBe(before);
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByLabel('What catches your eye?')).toHaveValue('keep this note');
});
test('photo writes fail visibly when storage silently does nothing', async ({ page }) => {
  await page.addInitScript(() => { Storage.prototype.setItem = () => {}; });
  await page.goto('/');
  await page.getByLabel('Sex').selectOption('female');
  await expect(page.getByRole('alert')).toContainText('storage is unavailable');
  await expect(page.getByLabel('Sex')).toHaveValue('female');
});
test('contended photo reset cannot be canceled into resurrecting old data', async ({ page }) => {
  await start(page);
  await page.evaluate(async key => {
    let acquired!: () => void;
    const held = new Promise<void>(resolve => { acquired = resolve; });
    const release = new Promise<void>(resolve => { (window as any).__releasePhoto = resolve; });
    void navigator.locks.request(key, async () => { acquired(); await release; });
    await held;
  }, PHOTO_KEY);
  await page.getByRole('button', { name: 'Clear photo study', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Clear photo study', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Keep editing', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => (window as any).__releasePhoto());
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(k => localStorage.getItem(k), PHOTO_KEY)).toBeNull();
  await page.waitForTimeout(200);
  expect(await page.evaluate(k => localStorage.getItem(k), PHOTO_KEY)).toBeNull();
});
test('photo cross-tab locks choose one write and pause the other', async ({ page, context }) => {
  await page.goto('/');
  const other = await context.newPage();
  await other.goto('/');
  await Promise.all([page.getByLabel('Sex').selectOption('female'), other.getByLabel('Sex').selectOption('male')]);
  await expect.poll(async () => (await page.getByRole('alert').count()) + (await other.getByRole('alert').count())).toBeGreaterThan(0);
  const raw = await page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}'), PHOTO_KEY);
  expect(['female', 'male']).toContain(raw.sex);
  const loser = await page.getByRole('alert').count() ? page : other;
  await loser.getByLabel('Sex').selectOption('intersex');
  await page.waitForTimeout(100);
  expect(await page.evaluate(k => JSON.parse(localStorage.getItem(k) || '{}').sex, PHOTO_KEY)).toBe(raw.sex);
});
test('photo no-Web-Locks mode is explicitly volatile', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  await page.goto('/');
  await page.getByLabel('Sex').selectOption('female');
  await expect(page.getByRole('alert')).toContainText('storage is unavailable');
  expect(await page.evaluate(k => localStorage.getItem(k), PHOTO_KEY)).toBeNull();
});
