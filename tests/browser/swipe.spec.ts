import { test, expect, type Page } from './fixture';
import AxeBuilder from '@axe-core/playwright';
import { PHOTOS } from '../../src/lib/photo-catalog';
import { freshPhotoSession, nextPhoto, photoQueue, PHOTO_KEY, votePhoto } from '../../src/lib/photo-session';
import { STORAGE_KEY, freshSession } from '../../src/lib/style-engine';
import type { PhotoSession } from '../../src/lib/photo-types';

const wear = (page: Page) => page.getByRole('button', { name: 'I’d wear this', exact: true });
const unsure = (page: Page) => page.getByRole('button', { name: 'Not sure / skip', exact: true });
const undo = (page: Page) => page.getByRole('button', { name: 'Undo last reaction', exact: true });
const cardId = (page: Page) => page.locator('.photo-current').getAttribute('data-photo-id');
async function stored(page: Page): Promise<PhotoSession> {
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
  return page.evaluate(key => JSON.parse(localStorage.getItem(key)!), PHOTO_KEY);
}
async function start(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with real outfits', exact: true }).click();
  await expect(wear(page)).toBeEnabled();
}
async function stage(page: Page) {
  const rect = await page.locator('.swipe-photo').boundingBox();
  expect(rect).not.toBeNull();
  return { x: rect!.x + rect!.width / 2, y: rect!.y + rect!.height / 2, width: rect!.width };
}
async function drag(page: Page, dx: number, dy = 0, release = true) {
  const { x, y } = await stage(page);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps: 12 });
  if (release) await page.mouse.up();
}
function pinned() {
  const session = freshPhotoSession();
  session.step = 'discover';
  session.draft = { photoId: PHOTOS[0].id, more: [], less: [], note: '' };
  return session;
}
async function seed(page: Page, session: PhotoSession) {
  await page.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: PHOTO_KEY, session });
}

for (const [width, height] of [[320, 640], [390, 844], [768, 1024], [1440, 900]]) {
  test(`quick start and all essential photo controls above fold at ${width}×${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    const startButton = page.getByRole('button', { name: 'Start with real outfits', exact: true });
    const startBox = await startButton.boundingBox();
    expect(startBox!.y).toBeGreaterThanOrEqual(0);
    expect(startBox!.y + startBox!.height).toBeLessThanOrEqual(height);
    await expect(page.locator('.photo-settings > summary')).toHaveCount(0);
    await expect(page.getByLabel('Sex', { exact: false })).toBeVisible();
    await startButton.click();
    await expect(wear(page)).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.photo-details')).not.toHaveAttribute('open');
    const controls = [wear(page), page.getByRole('button', { name: 'Not for me', exact: true }), page.getByRole('button', { name: 'Admire, not for me', exact: true }), unsure(page), undo(page)];
    for (const control of controls) {
      const bounds = await control.boundingBox();
      expect(bounds, (await control.getAttribute('aria-label')) ?? 'Essential control').not.toBeNull();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(height);
      expect(bounds!.height).toBeGreaterThanOrEqual(44);
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    }
    const image = await page.locator('.current-image img').boundingBox();
    expect(image!.height).toBeGreaterThanOrEqual(height * .4);
    expect(image!.y + image!.height).toBeLessThanOrEqual(height);
    expect(await page.locator('.current-image img').evaluate(e => getComputedStyle(e).objectFit)).toBe('contain');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`swipe-${width}x${height}.png`) });
  });
}

test('visible settings retain optional profile semantics, legacy storage and immediately available Continue', async ({ page }) => {
  const legacy = JSON.stringify(freshSession());
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: STORAGE_KEY, value: legacy });
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/');
  await page.getByLabel('Sex', { exact: false }).selectOption('female');
  await page.getByRole('slider', { name: 'Overall build' }).fill('1.5');
  await page.getByRole('slider', { name: 'Shoulders & hips' }).fill('1');
  await page.getByRole('slider', { name: 'Waist shape' }).fill('0');
  await page.getByRole('button', { name: 'Men’s looks', exact: true }).click();
  expect(await stored(page)).toMatchObject({ sex: 'female', body: { build: 1.5 }, collection: 'men' });
  await page.getByRole('button', { name: 'Start with real outfits', exact: true }).click();
  await expect(wear(page)).toBeEnabled();
  const id = await cardId(page);
  expect(PHOTOS.find(p => p.id === id)?.collection).toBe('men');
  await unsure(page).click();
  await expect(wear(page)).toBeEnabled();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const bounds = await page.getByRole('button', { name: 'Continue my photo study', exact: true }).boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(640);
  await expect(page.getByLabel('Centimeters', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Sex', { exact: false })).toHaveValue('female');
  await expect(page.getByRole('slider', { name: 'Overall build' })).toHaveValue('1.5');
  expect(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY)).toBe(legacy);
});

test('real mouse drags vote right wear and left pass, undo restores the exact card', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  const first = await cardId(page);
  await drag(page, 125, 5);
  await expect.poll(async () => (await stored(page)).votes.map(v => v.reaction)).toEqual(['wear']);
  await expect(wear(page)).toBeEnabled();
  await expect(page.locator('.current-image img')).toHaveCSS('transform', 'none');
  await drag(page, -125, -5);
  await expect.poll(async () => (await stored(page)).votes.map(v => v.reaction)).toEqual(['wear', 'pass']);
  await expect(undo(page)).toBeEnabled();
  await undo(page).click();
  await expect(undo(page)).toBeEnabled();
  await undo(page).click();
  await expect(page.locator('.photo-current')).toHaveAttribute('data-photo-id', first!);
  expect((await stored(page)).votes).toHaveLength(0);
});

test('short drags, reversed drags, pointer cancel, lost capture and blur do not vote', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  const first = await cardId(page);
  await drag(page, 30);
  await drag(page, 125, 0, false);
  const center = await stage(page);
  await page.mouse.move(center.x + 10, center.y, { steps: 10 });
  await page.mouse.up();
  for (const type of ['pointercancel', 'lostpointercapture', 'blur']) {
    await drag(page, 125, 0, false);
    await page.locator('.swipe-photo').evaluate((el, type) => {
      if (type === 'blur') window.dispatchEvent(new Event(type));
      else el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, pointerType: 'mouse' }));
    }, type);
    await page.mouse.up();
    expect((await stored(page)).votes).toHaveLength(0);
  }
  const synthetic = { pointerId: 999, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX: 100, clientY: 300 };
  await page.locator('.swipe-photo').dispatchEvent('pointerdown', synthetic);
  await page.locator('.swipe-photo').dispatchEvent('pointermove', { ...synthetic, clientX: 260 });
  await page.locator('.swipe-photo').dispatchEvent('pointerup', { ...synthetic, clientX: 260, buttons: 0 });
  expect(await cardId(page)).toBe(first);
  expect((await stored(page)).votes).toHaveLength(0);
  expect(errors).toEqual([]);
  await expect(page.locator('.current-image img')).toHaveCSS('transform', 'none');
  await drag(page, 125);
  expect((await stored(page)).votes).toHaveLength(1);
});

test('real touch swipes vote, vertical scrolling cancels intent, and multi-touch never votes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await start(page);
  let center = await stage(page);
  const touch = async (type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', points: { x: number; y: number; id?: number }[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [{ x: center.x, y: center.y, id: 1 }]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [{ x: center.x + 12.5 * i, y: center.y, id: 1 }]);
  await touch('touchEnd', []);
  await expect.poll(async () => (await stored(page)).votes.map(v => v.reaction)).toEqual(['wear']);
  await expect(wear(page)).toBeEnabled();
  await page.locator('.photo-details > summary').click();
  await page.evaluate(() => window.scrollTo(0, 0));
  center = await stage(page);
  await touch('touchStart', [{ x: center.x, y: center.y, id: 1 }]);
  for (let i = 1; i <= 10; i++) await touch('touchMove', [{ x: center.x + i, y: center.y - i * 15, id: 1 }]);
  await touch('touchEnd', []);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  expect((await stored(page)).votes).toHaveLength(1);
  await page.evaluate(() => window.scrollTo(0, 0));
  center = await stage(page);
  await touch('touchStart', [{ x: center.x, y: center.y, id: 1 }]);
  await touch('touchMove', [{ x: center.x + 35, y: center.y, id: 1 }]);
  await touch('touchStart', [{ x: center.x + 35, y: center.y, id: 1 }, { x: center.x - 80, y: center.y + 60, id: 2 }]);
  await touch('touchMove', [{ x: center.x + 125, y: center.y, id: 1 }, { x: center.x - 60, y: center.y + 60, id: 2 }]);
  await touch('touchEnd', []);
  expect((await stored(page)).votes).toHaveLength(1);
  await drag(page, -125);
  expect((await stored(page)).votes.map(v => v.reaction)).toEqual(['wear', 'pass']);
  await cdp.detach();
});

test('button double clicks, duplicate pointer events and rapid mixed input record only one vote', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await wear(page).dblclick({ delay: 80 });
  expect((await stored(page)).votes).toHaveLength(1);
  await expect(wear(page)).toBeEnabled();
  await drag(page, 125);
  await page.locator('.swipe-photo').dispatchEvent('pointerup', { pointerId: 1, pointerType: 'mouse', clientX: 350, clientY: 300 });
  await page.locator('[data-reaction=wear]').evaluate((el: HTMLButtonElement) => el.click());
  await page.keyboard.press('ArrowRight');
  expect((await stored(page)).votes).toHaveLength(2);
  await expect(undo(page)).toBeEnabled();
  await undo(page).dblclick({ delay: 80 });
  expect((await stored(page)).votes).toHaveLength(1);
});

test('buttons retain keyboard focus across cards and held keys cannot add repeated votes', async ({ page }) => {
  await start(page);
  await wear(page).focus();
  await page.keyboard.down('Enter');
  await expect(wear(page)).toBeEnabled();
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  expect((await stored(page)).votes).toHaveLength(1);
  await expect(wear(page)).toBeFocused();
  await page.locator('.swipe-photo').focus();
  await page.keyboard.press('ArrowLeft');
  expect((await stored(page)).votes.map(v => v.reaction)).toEqual(['wear', 'pass']);
});

test('late old-card loads and synthetic incomplete loads cannot make the next card ready', async ({ page }) => {
  const initial = pinned();
  const second = nextPhoto(votePhoto(initial, initial.draft!.photoId, 'unsure', PHOTOS), PHOTOS)!;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**${second.src}`, async route => { await gate; await route.fallback(); });
  await seed(page, initial);
  await page.goto('/');
  await expect(wear(page)).toBeEnabled();
  await page.locator('.current-image img').evaluate(el => {
    const props = (el as any)[Object.keys(el).find(k => k.startsWith('__reactProps$'))!];
    (window as any).__oldImageEvents = () => { props.onLoad({ currentTarget: el }); props.onError({ currentTarget: el }); };
  });
  await unsure(page).click();
  await expect(page.locator('.photo-current')).toHaveAttribute('data-photo-id', second.id);
  await expect(unsure(page)).toBeEnabled();
  await page.evaluate(() => (window as any).__oldImageEvents());
  await page.locator('.current-image img').dispatchEvent('load');
  await expect(wear(page)).toBeDisabled();
  await expect(page.getByText('Loading this look…', { exact: true })).toBeVisible();
  await page.locator('.swipe-photo').focus();
  await page.keyboard.press('ArrowRight');
  expect((await stored(page)).votes).toHaveLength(1);
  await undo(page).click();
  await expect(wear(page)).toBeEnabled();
  await unsure(page).click();
  await expect(unsure(page)).toBeEnabled();
  await expect(wear(page)).toBeDisabled();
  release();
  await expect(wear(page)).toBeEnabled();
  await page.evaluate(() => (window as any).__oldImageEvents());
  await expect(wear(page)).toBeEnabled();
});

test('failed and hidden images cannot be rated directionally; explicit unsure stays available', async ({ page }) => {
  await page.route('**/photos/**', route => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Start with real outfits', exact: true }).click();
  await expect(page.getByText('This photo couldn’t load.', { exact: true })).toBeVisible();
  await expect(wear(page)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Not for me', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Admire, not for me', exact: true })).toBeDisabled();
  await unsure(page).click();
  expect((await stored(page)).votes[0].reaction).toBe('unsure');
  await page.unroute('**/photos/**');
  await page.getByRole('button', { name: 'Retry image', exact: true }).click();
  await expect(wear(page)).toBeEnabled();
  for (const style of ['visibility:hidden', 'display:none', 'opacity:0']) {
    await page.locator('.current-image img').evaluate((el, style) => el.setAttribute('style', style), style);
    await wear(page).click();
    await page.getByRole('button', { name: 'Admire, not for me', exact: true }).click();
    expect((await stored(page)).votes).toHaveLength(1);
  }
  await unsure(page).click();
  expect((await stored(page)).votes.map(v => v.reaction)).toEqual(['unsure', 'unsure']);
});

test('retry ignores a detached failed image, even while replacement is pending', async ({ page }) => {
  const initial = pinned();
  await seed(page, initial);
  await page.route(`**${PHOTOS[0].src}`, route => route.abort());
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Retry image', exact: true })).toBeVisible();
  await page.locator('.current-image img').evaluate(el => {
    const props = (el as any)[Object.keys(el).find(k => k.startsWith('__reactProps$'))!];
    (window as any).__retryOldEvents = () => { props.onLoad({ currentTarget: el }); props.onError({ currentTarget: el }); };
  });
  await page.unroute(`**${PHOTOS[0].src}`);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**${PHOTOS[0].src}`, async route => { await gate; await route.fallback(); });
  await page.getByRole('button', { name: 'Retry image', exact: true }).click();
  await page.evaluate(() => (window as any).__retryOldEvents());
  await expect(wear(page)).toBeDisabled();
  await expect(page.getByText('Loading this look…', { exact: true })).toBeVisible();
  release();
  await expect(wear(page)).toBeEnabled();
  await page.evaluate(() => (window as any).__retryOldEvents());
  await expect(wear(page)).toBeEnabled();
});

test('notes and explicit feedback stay behind disclosure and undo safeguards preserve both drafts', async ({ page }) => {
  await start(page);
  const first = await cardId(page);
  await page.locator('.photo-details > summary').click();
  await page.getByLabel('What catches your eye?').fill('Keep these sleeves');
  await page.locator('.photo-details details > summary').click();
  await page.getByRole('group', { name: 'More of', exact: true }).getByRole('button', { name: 'Brighter colors', exact: true }).click();
  await wear(page).click();
  await expect(wear(page)).toBeEnabled();
  await expect(page.locator('.photo-details')).not.toHaveAttribute('open');
  await page.locator('.photo-details > summary').click();
  await page.getByLabel('What catches your eye?').fill('New unfinished note');
  await undo(page).click();
  await expect(page.getByRole('dialog')).toContainText('Undo and replace this draft?');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect((await stored(page)).draft?.note).toBe('New unfinished note');
  await undo(page).click();
  await page.getByRole('button', { name: 'Discard draft and undo', exact: true }).click();
  await expect(page.locator('.photo-current')).toHaveAttribute('data-photo-id', first!);
  await page.locator('.photo-details > summary').click();
  await expect(page.getByLabel('What catches your eye?')).toHaveValue('Keep these sleeves');
  await page.locator('.photo-details details > summary').click();
  await expect(page.getByRole('group', { name: 'More of', exact: true }).getByRole('button', { name: 'Brighter colors', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await stored(page);
  await page.reload();
  await expect(page.locator('.photo-details')).not.toHaveAttribute('open');
  await page.locator('.photo-details > summary').click();
  await expect(page.getByLabel('What catches your eye?')).toHaveValue('Keep these sleeves');
});

test('reduced motion preserves swipe functionality without moving the photo', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await start(page);
  await drag(page, 125, 0, false);
  await expect(page.locator('.swipe-wear')).toHaveAttribute('data-visible', 'true');
  await expect(page.locator('.current-image img')).toHaveCSS('transform', 'none');
  await expect(page.locator('.current-image img')).toHaveCSS('transition-duration', '0s');
  await page.mouse.up();
  expect((await stored(page)).votes[0].reaction).toBe('wear');
});

test('preloading stays within the real three-photo queue without recording reactions or replacing a draft', async ({ page }) => {
  const initial = pinned();
  initial.draft!.note = 'Still deciding';
  const expected = photoQueue(initial, PHOTOS, 3).map(photo => photo.src).sort();
  const requested = new Set<string>();
  page.on('request', request => {
    const path = new URL(request.url()).pathname;
    if (path.startsWith('/photos/')) requested.add(path);
  });
  await seed(page, initial);
  await page.goto('/');
  await expect(wear(page)).toBeEnabled();
  await expect.poll(() => [...requested].sort()).toEqual(expected);
  expect((await stored(page)).votes).toEqual([]);
  expect((await stored(page)).draft).toEqual(initial.draft);
  await page.locator('.photo-details > summary').click();
  await page.getByLabel('What catches your eye?').fill('Keep this one pinned');
  expect((await stored(page)).draft).toMatchObject({ photoId: initial.draft!.photoId, note: 'Keep this one pinned' });
  expect([...requested].sort()).toEqual(expected);
});

test('settings filter changes still confirm before replacing a nonempty pinned draft', async ({ page }) => {
  await start(page);
  const first = await cardId(page);
  await page.locator('.photo-details > summary').click();
  await page.getByLabel('What catches your eye?').fill('Unfinished sleeve note');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const range = PHOTOS.find(photo => photo.id === first)?.collection === 'men' ? 'Women’s looks' : 'Men’s looks';
  await page.getByRole('button', { name: range, exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Change your selection and replace this draft?');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect((await stored(page)).draft).toMatchObject({ photoId: first, note: 'Unfinished sleeve note' });
  await page.getByRole('button', { name: range, exact: true }).click();
  await page.getByRole('button', { name: 'Discard draft and change', exact: true }).click();
  expect((await stored(page)).draft).toBeUndefined();
  if (await page.getByRole('button', { name: 'Start with real outfits', exact: true }).isDisabled()) {
    await expect(page.locator('.body-controls [role=status]')).toContainText('No reviewed matches');
    await page.getByRole('slider', { name: 'Shoulders & hips' }).fill('1');
    await page.getByRole('slider', { name: 'Waist shape' }).fill('0');
  }
  await page.getByRole('button', { name: 'Start with real outfits', exact: true }).click();
  await expect(wear(page)).toBeEnabled();
  expect(await cardId(page)).not.toBe(first);
});

test('a save conflict retains the protected version while new swipe feedback stays in memory', async ({ page }) => {
  await start(page);
  const before = await stored(page);
  const other: PhotoSession = { ...before, sex: 'intersex' };
  const protectedValue = JSON.stringify(other);
  await page.evaluate(({ key, value }) => {
    const oldValue = localStorage.getItem(key);
    localStorage.setItem(key, value);
    window.dispatchEvent(new StorageEvent('storage', { key, oldValue, newValue: value, storageArea: localStorage }));
  }, { key: PHOTO_KEY, value: protectedValue });
  await expect(page.getByRole('alert')).toContainText('Another tab changed');
  await drag(page, 125);
  await expect(undo(page)).toBeEnabled();
  expect(await page.evaluate(key => localStorage.getItem(key), PHOTO_KEY)).toBe(protectedValue);
  await page.getByRole('button', { name: 'Load saved version', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Load the saved version?');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect(await page.evaluate(key => localStorage.getItem(key), PHOTO_KEY)).toBe(protectedValue);
  await undo(page).click();
  await expect(page.locator('.photo-current')).toHaveAttribute('data-photo-id', before.draft!.photoId);
});

for (const primaryFirst of [true, false]) {
  test(`mouse-button chording cancels an armed swipe, primary released first: ${primaryFirst}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await start(page);
    const first = await cardId(page);
    await drag(page, 125, 0, false);
    await page.mouse.down({ button: 'right' });
    await page.mouse.up({ button: primaryFirst ? 'left' : 'right' });
    await page.mouse.up({ button: primaryFirst ? 'right' : 'left' });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    expect((await stored(page)).votes).toHaveLength(0);
    expect(await cardId(page)).toBe(first);
    await drag(page, -125, 0, false);
    await page.locator('.swipe-photo').dispatchEvent('contextmenu');
    await page.mouse.up();
    expect((await stored(page)).votes).toHaveLength(0);
    await drag(page, 125);
    expect((await stored(page)).votes).toHaveLength(1);
  });
}
