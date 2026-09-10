import { test, expect } from './fixture';
import { freshSession, STORAGE_KEY } from '../../src/lib/style-engine';
import { LOOKS } from '../../src/lib/looks';

async function hold(page: import('./fixture').Page) {
  await page.evaluate(key => new Promise<void>(resolve => {
    navigator.locks.request(key, async () => {
      resolve();
      await new Promise<void>(release => { (window as any).releaseTestLock = release; });
    });
  }), STORAGE_KEY);
}

test('pending clear cannot be dismissed or revive old snapshots after deletion', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Find what feels like you' }).click();
  await page.locator('summary').click();
  await page.getByLabel('In your own words').fill('Private note before clear');
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  await hold(page);
  await page.getByLabel('In your own words').fill('Queued private note before clear');
  await page.getByRole('button', { name: 'Clear my study', exact: true }).click();
  await page.getByRole('button', { name: 'Clear & start again' }).click();
  await expect(page.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
  await expect(page.getByRole('button', { name: 'Keep my study', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Clear & start again' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.evaluate(() => (window as any).releaseTestLock());
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.model-page')).toBeVisible();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(null);
  await page.reload();
  await page.getByRole('button', { name: 'Find what feels like you' }).click();
  await page.locator('summary').click();
  await expect(page.getByLabel('In your own words')).toHaveValue('');
});

test('slow double Undo removes only one reaction at either entry point', async ({ page }) => {
  const initial = { ...freshSession(), step: 'discover', votes: LOOKS.slice(0, 7).map(look => ({ lookId: look.id, reaction: 'wear', note: '', more: [], less: [] })) };
  await page.goto('/');
  await page.evaluate(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: STORAGE_KEY, session: initial });
  await page.reload();
  await page.getByRole('button', { name: 'Undo last reaction' }).dblclick({ delay: 450 });
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).votes.length, STORAGE_KEY)).toBe(6);
  await page.getByRole('button', { name: '03 Your portrait' }).click();
  await page.getByRole('button', { name: 'Revisit the last look' }).dblclick({ delay: 450 });
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).votes.length, STORAGE_KEY)).toBe(5);
});
