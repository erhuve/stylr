import { test, expect } from './fixture';
import { PHOTOS } from '../../src/lib/photo-catalog';
import { freshPhotoSession, nextPhoto, PHOTO_KEY, votePhoto } from '../../src/lib/photo-session';

test('exhausted positive selection does not claim insufficient discovery', async ({ page }) => {
  let s = freshPhotoSession();
  for (let i = 0; i < PHOTOS.length; i++) s = votePhoto(s, nextPhoto(s, PHOTOS)!.id, 'wear', PHOTOS);
  s.step = 'portrait';
  await page.addInitScript(({ s, key }) => localStorage.setItem(key, JSON.stringify(s)), { s, key: PHOTO_KEY });
  await page.goto('/');
  await page.getByRole('group', { name: 'Moodboard views' }).getByRole('button', { name: /^To explore/ }).click();
  await expect(page.locator('.board-card')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'No untried suggestions in this selection.' })).toBeVisible();
  await expect(page.locator('.board-empty')).not.toContainText('insufficient');
  await expect(page.locator('.board-empty')).not.toContainText('More discovery before');
});

test('keyboard retry retains focus through failures and successful reload', async ({ page }) => {
  let s = freshPhotoSession();
  const photo = nextPhoto(s, PHOTOS)!;
  s = votePhoto(s, photo.id, 'wear', PHOTOS);
  s.step = 'portrait';
  await page.addInitScript(({ s, key }) => localStorage.setItem(key, JSON.stringify(s)), { s, key: PHOTO_KEY });
  let blocked = true;
  let attempts = 0;
  await page.route(`**${photo.src}`, async route => {
    attempts++;
    if (blocked) await route.abort();
    else await route.fallback();
  });
  await page.goto('/');
  const card = page.locator(`.board-card[data-photo-id="${photo.id}"]`);
  const retry = card.getByRole('button', { name: `Retry ${photo.title}`, exact: true });
  await expect(retry).toBeVisible();
  await retry.focus();
  await page.keyboard.press('Enter');
  await expect.poll(() => attempts).toBeGreaterThanOrEqual(2);
  await expect(retry).toHaveAttribute('aria-disabled', 'false');
  await expect(retry).toBeFocused();
  blocked = false;
  await page.keyboard.press('Enter');
  await expect.poll(() => attempts).toBeGreaterThanOrEqual(3);
  await expect(card.locator('img')).toBeVisible();
  await expect.poll(() => card.locator('img').evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(card).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(card.getByRole('link').first()).toBeFocused();
});
