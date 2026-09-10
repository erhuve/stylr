import { test, expect, type Page } from './fixture';
import AxeBuilder from '@axe-core/playwright';
import { freshSession, STORAGE_KEY } from '../../src/lib/style-engine';
import { LOOKS } from '../../src/lib/looks';
import type { Reaction, Session } from '../../src/lib/style-types';

async function stored(page: Page): Promise<Session> {
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
}
async function seed(page: Page, session: Session | string) {
  await page.addInitScript(({ key, raw }) => localStorage.setItem(key, raw), { key: STORAGE_KEY, raw: typeof session === 'string' ? session : JSON.stringify(session) });
}
async function ready(page: Page) {
  await page.goto('/');
  await expect(page.locator('h1')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
}
async function react(page: Page, name = 'I’d wear it') {
  const button = page.getByRole('button', { name, exact: true });
  await expect(button).toHaveAttribute('aria-disabled', 'false');
  await button.click();
}
const sessionWith = (reaction: Reaction, count = 24): Session => ({ ...freshSession(), step: 'portrait', votes: LOOKS.slice(0, count).map(look => ({ lookId: look.id, reaction, note: '', more: [], less: [] })) });

for (const width of [320, 390, 768, 1440]) {
  test(`figure, discovery and portrait fit ${width}px and pass accessibility checks`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error' || e.type() === 'warning') errors.push(e.text()); });
    await ready(page);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--background').trim())).toBe('#f8f5ed');
    const check = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      expect(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
    };
    await check();
    await page.screenshot({ path: `docs/verification/figure-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Find what feels like you' }).click();
    await expect(page.locator('.outfit-card')).toBeVisible();
    await check();
    await page.screenshot({ path: `docs/verification/discovery-${width}.png`, fullPage: true });
    for (let i = 0; i < 6; i++) await react(page, i % 2 ? 'Love the look, but not for me' : 'I’d wear it');
    await page.getByRole('button', { name: 'See your portrait' }).click();
    await check();
    await page.screenshot({ path: `docs/verification/portrait-${width}.png`, fullPage: true });
    expect(errors).toEqual([]);
  });
}

test('draft survives figure detour and reload; undo restores exact card and feedback', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Find what feels like you' }).click();
  await page.locator('summary').click();
  await page.getByLabel('In your own words').fill('No heels today, but I may change my mind. <b>not markup</b>');
  await page.getByRole('group', { name: 'More of this', exact: true }).getByRole('button', { name: 'Expressive color' }).click();
  await page.getByRole('group', { name: 'Less of this', exact: true }).getByRole('button', { name: 'Expressive color' }).click();
  expect((await stored(page)).draft?.more).toEqual([]);
  expect((await stored(page)).draft?.less).toEqual(['color']);
  await page.getByRole('button', { name: 'Adjust figure' }).click();
  await page.getByRole('slider', { name: 'Shoulders', exact: true }).fill('91');
  await page.getByRole('button', { name: '02 Explore' }).click();
  await page.reload();
  await expect(page.getByLabel('In your own words')).toHaveValue('No heels today, but I may change my mind. <b>not markup</b>');
  await react(page);
  await expect(page.getByRole('button', { name: 'Undo last reaction' })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo last reaction' }).click();
  const state = await stored(page);
  expect(state.votes).toHaveLength(0);
  expect(state.body.shoulders).toBe(91);
  expect(state.draft?.lookId).toBe('look-1');
  expect(state.draft?.less).toEqual(['color']);
  expect(state.exclusions).toEqual([]);
  await expect(page.locator('.outfit-card h2')).toHaveText(LOOKS[0].name);
});

test('double click is one vote; arrows in text do not vote; exhaustion and undo work', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Find what feels like you' }).click();
  await page.getByRole('button', { name: 'I’d wear it', exact: true }).dblclick();
  expect((await stored(page)).votes).toHaveLength(1);
  await page.locator('summary').click();
  await page.getByLabel('In your own words').fill('keyboard note');
  await page.getByLabel('In your own words').press('ArrowRight');
  expect((await stored(page)).votes).toHaveLength(1);
  for (let i = 1; i < 24; i++) await react(page, i % 2 ? 'Not my thing' : 'I’d wear it');
  await expect(page.locator('.portrait-page')).toBeVisible();
  expect(new Set((await stored(page)).votes.map(v => v.lookId)).size).toBe(24);
  await expect(page.getByRole('button', { name: '02 Explore' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Revisit the last look' })).toBeEnabled();
  await page.getByRole('button', { name: 'Revisit the last look' }).click();
  expect((await stored(page)).votes).toHaveLength(23);
  await react(page);
  await expect(page.locator('.portrait-page')).toBeVisible();
});

for (const reaction of ['pass', 'unsure', 'admire'] as const) {
  test(`${reaction}-only results do not invent wearable shopping suggestions`, async ({ page }) => {
    await seed(page, sessionWith(reaction));
    await ready(page);
    await expect(page.locator('.shopping-card')).toHaveCount(0);
    await expect(page.locator('.shopping-section')).toContainText('No wearable favorites yet');
    if (reaction !== 'admire') await expect(page.locator('h1')).toHaveText('Still looking for your spark.');
    else { await expect(page.locator('.mood-tile')).toHaveCount(24); await expect(page.locator('h1')).toHaveText('More than one direction.'); }
  });
}

test('explicit shopping exclusions persist and budget produces safe external searches', async ({ page }) => {
  await seed(page, sessionWith('wear'));
  await ready(page);
  await page.getByLabel('No heels', { exact: true }).check();
  await page.getByLabel('No skirts', { exact: true }).check();
  await page.getByLabel('Per-piece search budget').selectOption('50');
  expect((await stored(page)).exclusions).toEqual(['no-heels', 'no-skirts']);
  for (const link of await page.locator('.shopping-copy a').all()) {
    const url = new URL((await link.getAttribute('href'))!);
    expect(url.origin).toBe('https://www.google.com');
    expect(url.searchParams.get('q')).toContain('under $50');
    expect(url.searchParams.get('q')).not.toMatch(/skirt|heel/i);
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  }
  await expect(page.locator('.mood-tile')).toHaveCount(24);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download your notes', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('my-stylr-notes.md');
});

test('corrupt and future-version storage are preserved, not overwritten', async ({ page }) => {
  const bad = '{"version":77,"private":"keep me"}';
  await seed(page, bad);
  await ready(page);
  await expect(page.getByRole('alert')).toContainText('It has not been overwritten');
  await page.getByRole('button', { name: 'Find what feels like you' }).click();
  await react(page);
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(bad);
  await page.getByRole('button', { name: 'Clear my study', exact: true }).click();
  await page.getByRole('button', { name: 'Keep my study', exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(bad);
  await page.getByRole('button', { name: 'Clear my study', exact: true }).click();
  await page.getByRole('button', { name: 'Clear & start again', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(null);
});

test('storage denial leaves app usable with warning and download', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); });
  await ready(page);
  await expect(page.getByRole('alert')).toContainText('could not save');
  await page.getByRole('button', { name: 'Find what feels like you' }).click();
  for (let i = 0; i < 6; i++) await react(page);
  await page.getByRole('button', { name: 'See your portrait' }).click();
  await expect(page.locator('.mood-tile')).toHaveCount(6);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download your notes', exact: true }).click();
  expect((await event).suggestedFilename()).toContain('.md');
});

test('another tab pauses saving and requires confirmation before discarding local edits', async ({ page, context }) => {
  await ready(page);
  await page.getByRole('button', { name: 'Find what feels like you' }).click();
  const other = await context.newPage();
  await ready(other);
  await react(other);
  await expect(page.getByRole('alert')).toContainText('Another tab');
  await react(page, 'Not my thing');
  expect((await stored(other)).votes[0].reaction).toBe('wear');
  await page.getByRole('button', { name: 'Load saved version', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Load saved version', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.outfit-card h2')).toHaveText(LOOKS[1].name);
});

test('native dialog traps focus, Escape closes and returns focus', async ({ page }) => {
  await ready(page);
  const trigger = page.getByRole('button', { name: 'THE STUDY', exact: true });
  await trigger.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')) || document.activeElement === document.body)).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
