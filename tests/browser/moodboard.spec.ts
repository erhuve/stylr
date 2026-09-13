import { test, expect, type Page } from './fixture';
import AxeBuilder from '@axe-core/playwright';
import { PHOTOS } from '../../src/lib/photo-catalog';
import { freshPhotoSession, PHOTO_KEY, photoEvidence } from '../../src/lib/photo-session';
import type { PhotoSession } from '../../src/lib/photo-types';
import { readFile } from 'node:fs/promises';

function populated(): PhotoSession {
  return {
    ...freshPhotoSession(), step: 'portrait',
    votes: PHOTOS.slice(0, 20).map((p, i) => ({ photoId: p.id, reaction: i % 3 === 0 ? 'admire' : 'wear', note: `Note ${i}`, more: [], less: [] })),
  };
}
async function open(page: Page, session = populated()) {
  await page.addInitScript(({ session, key }) => localStorage.setItem(key, JSON.stringify(session)), { session, key: PHOTO_KEY });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Your moodboard.', exact: true })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}

for (const [width, height] of [[320, 640], [390, 844], [768, 900], [1440, 900]]) {
  test(`moodboard photos above fold, complete frames and accessible at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await open(page);
    await expect(page.locator('.board-card')).toHaveCount(20);
    await expect.poll(() => page.locator('.board-image img').evaluateAll(nodes => nodes.every(n => (n as HTMLImageElement).complete && (n as HTMLImageElement).naturalWidth > 0))).toBe(true);
    const geometry = await page.locator('.board-image img').evaluateAll(nodes => nodes.map(n => {
      const image = n as HTMLImageElement;
      const rect = image.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, ratio: rect.width / rect.height, natural: image.naturalWidth / image.naturalHeight };
    }));
    expect(Math.min(...geometry.map(g => g.top))).toBeLessThan(width < 768 ? 380 : 310);
    expect(geometry.filter(g => g.top >= 0 && g.bottom <= height).length).toBeGreaterThanOrEqual(width < 768 ? 2 : 3);
    expect(geometry.every(g => Math.abs(g.ratio - g.natural) < .02)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await expect(page.getByRole('button', { name: 'Style notes', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Keep exploring', exact: true })).toBeInViewport();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations;
    expect(violations.map(v => `${v.id}: ${v.description}`)).toEqual([]);
    await page.screenshot({ path: `docs/verification/photos-moodboard-${width}.png` });
  });
}

test('wear, admire and suggested boards stay distinct without changing reactions', async ({ page }) => {
  const session = populated();
  await open(page, session);
  const original = await page.evaluate(key => localStorage.getItem(key), PHOTO_KEY);
  const views = page.getByRole('group', { name: 'Moodboard views' });
  await views.getByRole('button', { name: /^Would wear/ }).click();
  await expect(page.locator('.board-card')).toHaveCount(13);
  await expect(page.locator('.board-card[data-kind="admire"]')).toHaveCount(0);
  await views.getByRole('button', { name: /^Admire/ }).click();
  await expect(page.locator('.board-card')).toHaveCount(7);
  await expect(page.locator('.board-card[data-kind="wear"]')).toHaveCount(0);
  await views.getByRole('button', { name: /^To explore/ }).click();
  await expect(page.locator('.board-context')).toContainText('not saved favorites');
  const suggested = await page.locator('.board-card').evaluateAll(nodes => nodes.map(n => ({ id: n.getAttribute('data-photo-id'), kind: n.getAttribute('data-kind') })));
  expect(suggested.length).toBeGreaterThan(0);
  expect(suggested.every(s => s.kind === 'suggested' && !session.votes.some(v => v.photoId === s.id))).toBe(true);
  expect(await page.evaluate(key => localStorage.getItem(key), PHOTO_KEY)).toBe(original);
});

test('notes dialog preserves all feature evidence, keyboard focus and downloads', async ({ page }) => {
  const s = populated();
  await open(page, s);
  const trigger = page.getByRole('button', { name: 'Style notes', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Your style notes' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.evidence-item')).toHaveCount(photoEvidence(s, PHOTOS).filter(e => e.seen || e.explicit).length);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog[open]'))).toBe(true);
  }
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export session JSON' }).click();
  const file = await (await download).path();
  const exported = JSON.parse(await readFile(file!, 'utf8'));
  expect(exported.votes).toEqual(s.votes);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => v.id)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test('admire-only and all-skipped results never claim wear favorites', async ({ page }) => {
  const s = populated();
  s.votes = s.votes.slice(0, 5).map(v => ({ ...v, reaction: 'admire' }));
  await open(page, s);
  await expect(page.locator('.board-card[data-kind="admire"]')).toHaveCount(5);
  await expect(page.locator('.board-card[data-kind="wear"]')).toHaveCount(0);
  await page.getByRole('group', { name: 'Moodboard views' }).getByRole('button', { name: /^Would wear/ }).click();
  await expect(page.getByRole('heading', { name: 'No would-wear picks here yet.' })).toBeVisible();
});

test('all-skipped and fresh sessions have honest empty boards', async ({ page }) => {
  const s = populated();
  s.votes = s.votes.slice(0, 5).map(v => ({ ...v, reaction: 'unsure', note: '', more: [], less: [] }));
  await open(page, s);
  await expect(page.locator('.board-card')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Start with a look that feels like you.' })).toBeVisible();
  await page.getByRole('group', { name: 'Moodboard views' }).getByRole('button', { name: /^To explore/ }).click();
  await expect(page.locator('.board-card')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'No untried suggestions in this selection.' })).toBeVisible();
});

test('boundaries apply to saved, admired and untried references without discarding votes', async ({ page }) => {
  const s = populated();
  s.collection = 'men';
  s.exclusions = ['no-heels', 'no-boots'];
  await open(page, s);
  for (const label of [/^Your picks/, /^Would wear/, /^Admire/, /^To explore/]) {
    await page.getByRole('group', { name: 'Moodboard views' }).getByRole('button', { name: label }).click();
    const ids = await page.locator('.board-card').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-photo-id')));
    for (const id of ids) {
      const p = PHOTOS.find(p => p.id === id)!;
      expect(p.collection).toBe('men');
      expect(p.shoesKnown).toBe(true);
      expect(p.garments.includes('heels') || p.garments.includes('boots')).toBe(false);
    }
  }
  expect(JSON.parse((await page.evaluate(key => localStorage.getItem(key), PHOTO_KEY))!).votes).toEqual(s.votes);
});

test('portrait undo still confirms a draft and hands focus to the correct dialog', async ({ page }) => {
  const s = populated();
  s.draft = { photoId: PHOTOS[20].id, note: 'keep my draft', more: [], less: [] };
  await open(page, s);
  await page.getByRole('button', { name: 'Style notes', exact: true }).click();
  await page.getByRole('button', { name: 'Undo last reaction', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Undo and replace this draft?' });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => document.querySelectorAll('dialog[open]').length)).toBe(1);
  await expect(dialog.getByRole('button', { name: 'Keep editing', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: 'Keep editing', exact: true }).click();
  const saved = JSON.parse((await page.evaluate(key => localStorage.getItem(key), PHOTO_KEY))!);
  expect(saved.draft.note).toBe('keep my draft');
  expect(saved.votes).toEqual(s.votes);
});

test('notes keep reference-library access, and broken images show a retry rather than vanishing', async ({ page }) => {
  const s = populated();
  await page.route(`**${PHOTOS[0].src}`, route => route.abort());
  await open(page, s);
  await expect(page.getByRole('button', { name: `Retry ${PHOTOS[0].title}`, exact: true })).toBeVisible();
  await page.unroute(`**${PHOTOS[0].src}`);
  await page.getByRole('button', { name: `Retry ${PHOTOS[0].title}`, exact: true }).click();
  await expect(page.locator(`[data-photo-id="${PHOTOS[0].id}"] img`)).toBeVisible();
  await page.getByRole('button', { name: 'Style notes', exact: true }).click();
  await page.getByRole('button', { name: 'Browse all eligible references', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'More ways to get dressed.' })).toBeVisible();
});
