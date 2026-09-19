import { test, expect } from './fixture';
import { PHOTO_KEY, freshPhotoSession } from '../../src/lib/photo-session';
import review from '../../data/model-heights/review.json' with { type: 'json' };

test('height and all former optional settings are exposed on initial setup', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Centimeters', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Men’s looks', exact: true })).toBeVisible();
  await expect(page.getByLabel('Sex', { exact: false })).toBeVisible();
  await expect(page.locator('.photo-boundaries input')).toHaveCount(4);
  await expect(page.locator('.photo-settings details')).toHaveCount(0);
  await expect(page.locator('.height-coverage')).toContainText('Unknown heights remain included');
  const count = await page.locator('.body-results [role=status]').textContent();
  await page.getByLabel('Centimeters', { exact: true }).fill('172.72');
  await expect(page.locator('.body-results [role=status]')).toHaveText(count!);
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  await page.reload();
  await expect(page.getByLabel('Centimeters', { exact: true })).toHaveValue('172.72');
  await page.getByRole('combobox', { name: 'Units', exact: true }).selectOption('ft-in');
  await expect(page.getByLabel('Feet', { exact: true })).toHaveValue('5');
  await expect(page.getByLabel('Inches', { exact: true })).toHaveValue('8');
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Units', exact: true })).toHaveValue('ft-in');
  await page.getByRole('button', { name: 'Clear height' }).click();
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).heightCm, PHOTO_KEY)).toBeNull();
});

test('invalid heights block starting until corrected without persisting invalid values', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Centimeters', { exact: true }).fill('170');
  await page.getByLabel('Centimeters', { exact: true }).fill('500');
  await expect(page.getByRole('button', { name: 'Start with real outfits' })).toBeDisabled();
  await expect(page.locator('#height-error')).toHaveRole('alert');
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).heightCm, PHOTO_KEY)).toBe(170);
  await page.getByRole('combobox', { name: 'Units', exact: true }).selectOption('ft-in');
  await page.getByLabel('Inches', { exact: true }).fill('12');
  await expect(page.getByRole('button', { name: 'Start with real outfits' })).toBeDisabled();
  await page.getByLabel('Inches', { exact: true }).fill('8');
  await expect(page.getByRole('button', { name: 'Start with real outfits' })).toBeEnabled();
});

test('height changes preserve a dirty pinned draft and reported heights link to evidence', async ({ page }) => {
  const reference = review.records[0]!;
  const draft = { photoId: reference.photoId, note: 'Keep my note', more: [], less: [] };
  await page.addInitScript(({ key, session }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session));
  }, { key: PHOTO_KEY, session: { ...freshPhotoSession(), step: 'discover', draft } });
  await page.goto('/');
  await expect(page.locator('.photo-current .photo-height')).toHaveAttribute('href', reference.sourceUrl);
  await expect(page.locator('.photo-current .photo-height')).toContainText('172.72 cm');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Centimeters', { exact: true }).fill('180');
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).draft, PHOTO_KEY)).toEqual(draft);
  await page.reload();
  await expect(page.getByLabel('Centimeters', { exact: true })).toHaveValue('180');
});
