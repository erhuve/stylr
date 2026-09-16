import { test, expect } from './fixture';
import { matchesBody } from '../../src/lib/body-reference';
import { PHOTO_KEY } from '../../src/lib/photo-session';
import { PHOTOS } from '../../src/lib/photo-catalog';
import admitted from '../../data/catalog-review/admitted-body.json' with { type: 'json' };

test('expanded reviewed references load in setup and remain eligible after starting', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('slider', { name: 'Overall build' }).fill('3');
  const previews = page.locator('.body-previews img');
  await expect(previews).toHaveCount(3);
  await expect.poll(() => previews.evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  const sources = await previews.evaluateAll(images => images.map(image => image.getAttribute('src')));
  expect(sources.some(src => admitted.some(row => src === `/photos/${row.id}.webp`))).toBe(true);
  await page.getByRole('button', { name: 'Start with real outfits' }).click();
  await expect(page.getByRole('button', { name: 'I’d wear this', exact: true })).toBeEnabled();
  const id = await page.locator('.photo-current').getAttribute('data-photo-id');
  expect(matchesBody(id!, { build: 3, shoulderHip: 0, waist: 1, mode: 'nearby' })).toBe(true);
});

test('body sliders filter swipes, persist, and protect a dirty draft', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('slider', { name: 'Overall build' }).fill('3');
  const count = PHOTOS.filter(photo => matchesBody(photo.id, { build: 3, shoulderHip: 0, waist: 1, mode: 'nearby' })).length;
  expect(count).toBeGreaterThan(1);
  await expect(page.locator('.body-controls [role=status]')).toHaveText(`${count} matches`);
  await page.screenshot({ path: 'docs/verification/body-controls-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Start with real outfits' }).click();
  const current = page.locator('.photo-current');
  const id = await current.getAttribute('data-photo-id');
  expect(matchesBody(id!, { build: 3, shoulderHip: 0, waist: 1, mode: 'nearby' })).toBe(true);
  await page.locator('.photo-details > summary').click();
  await page.getByLabel('What catches your eye?').fill('keep body draft');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('slider', { name: 'Overall build' }).fill('1');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Overall build' })).toHaveValue('3');
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  await page.reload();
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).draft.note, PHOTO_KEY)).toBe('keep body draft');
  await expect(page.getByRole('slider', { name: 'Overall build' })).toHaveValue('3');
});

test('empty strict combinations never fall back to unrelated bodies', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('slider', { name: 'Overall build' }).fill('3');
  await page.getByRole('slider', { name: 'Shoulders & hips' }).fill('1');
  await page.getByRole('slider', { name: 'Waist shape' }).fill('2');
  await expect(page.locator('.body-controls [role=status]')).toContainText('No reviewed matches');
  await expect(page.getByRole('button', { name: 'Start with real outfits' })).toBeDisabled();
  await expect(page.locator('.body-previews img')).toHaveCount(0);
});

test('required smooth controls update the figure and persist fractional values', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.body-controls input[type=checkbox]')).toHaveCount(0);
  await expect(page.locator('.body-controls input[type=range]')).toHaveCount(3);
  await expect(page.getByText('Slender', { exact: true })).toBeVisible();
  await expect(page.getByText('Shoulders wider', { exact: true })).toBeVisible();
  const outline = page.locator('.body-silhouette > path');
  const before = await outline.getAttribute('d');
  await page.getByRole('slider', { name: 'Overall build' }).fill('1.63');
  expect(await outline.getAttribute('d')).not.toBe(before);
  await page.getByRole('slider', { name: 'Shoulders & hips' }).fill('0.12');
  await page.getByRole('slider', { name: 'Waist shape' }).fill('1.21');
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  await page.reload();
  await expect(page.getByRole('slider', { name: 'Overall build' })).toHaveValue('1.63');
  await page.getByRole('button', { name: 'Start with real outfits' }).click();
  const body = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).body, PHOTO_KEY);
  expect(body).toEqual({ build: 1.63, shoulderHip: .12, waist: 1.21, mode: 'nearby' });
  expect(matchesBody((await page.locator('.photo-current').getAttribute('data-photo-id'))!, body)).toBe(true);
});
