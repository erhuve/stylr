import { test, expect, type Page } from './fixture';
import { freshSession, STORAGE_KEY } from '../../src/lib/style-engine';
import { LOOKS } from '../../src/lib/looks';

async function start(page: Page) {
  await page.goto('/illustrated');
  await page.getByRole('button', { name: 'Find what feels like you' }).click();
}
async function settled(page: Page) {
  await expect(page.locator('.site-footer')).not.toContainText('Saving…');
}
async function state(page: Page) {
  await settled(page);
  return page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), STORAGE_KEY);
}
async function wear(page: Page) {
  const button = page.getByRole('button', { name: 'I’d wear it', exact: true });
  await expect(button).toHaveAttribute('aria-disabled', 'false');
  await button.click();
  await settled(page);
}

test('undo warns before replacing a current draft and cancel preserves it', async ({ page }) => {
  await start(page);
  await wear(page);
  await page.locator('summary').click();
  await page.getByLabel('In your own words').fill('Do not lose this second note');
  await expect(page.getByRole('button', { name: 'Undo last reaction' })).toBeEnabled();
  await page.getByRole('button', { name: 'Undo last reaction' }).click();
  await expect(page.getByRole('dialog')).toContainText('unfinished');
  await page.getByRole('button', { name: 'Keep editing', exact: true }).click();
  expect((await state(page)).draft.note).toBe('Do not lose this second note');
  expect((await state(page)).votes).toHaveLength(1);
  await page.getByRole('button', { name: 'Undo last reaction' }).click();
  await page.getByRole('button', { name: 'Discard draft & undo', exact: true }).click();
  expect((await state(page)).votes).toHaveLength(0);
  expect((await state(page)).draft.lookId).toBe('look-1');
});

test('failed clear keeps data, shows failure and can be retried', async ({ page }) => {
  await start(page);
  await wear(page);
  const before = await state(page);
  await page.evaluate(() => {
    const original = Storage.prototype.removeItem;
    (window as any).restoreRemove = () => { Storage.prototype.removeItem = original; };
    Storage.prototype.removeItem = () => { throw new DOMException('blocked', 'SecurityError'); };
  });
  await page.getByRole('button', { name: 'Clear my study', exact: true }).click();
  await page.getByRole('button', { name: 'Clear & start again', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Data is still stored');
  expect(await state(page)).toEqual(before);
  await expect(page.getByRole('status')).not.toHaveText('Study cleared.');
  await page.evaluate(() => (window as any).restoreRemove());
  await page.getByRole('button', { name: 'Clear & start again', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await state(page)).toBe(null);
});

test('failed reload preserves this tab’s only unsaved notes', async ({ page, context }) => {
  await start(page);
  const other = await context.newPage();
  await other.goto('/illustrated');
  await wear(other);
  await expect(page.getByRole('alert')).toContainText('Another tab');
  await page.locator('summary').click();
  await page.getByLabel('In your own words').fill('Only in this tab');
  await page.getByRole('button', { name: 'Load saved version', exact: true }).click();
  await page.evaluate(() => { Storage.prototype.getItem = () => { throw new DOMException('blocked'); }; });
  await page.getByRole('dialog').getByRole('button', { name: 'Load saved version', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('work has been kept');
  await expect(page.getByLabel('In your own words')).toHaveValue('Only in this tab');
});

test('origin-wide lock prevents competing tabs overwriting a winning save', async ({ page, context }) => {
  await page.goto('/illustrated');
  await page.getByRole('slider', { name: 'Waist', exact: true }).fill('41');
  await settled(page);
  const other = await context.newPage();
  await other.goto('/illustrated');
  await page.evaluate(key => {
    (window as any).gate = new Promise<void>(resolve => {
      navigator.locks.request(key, async () => {
        resolve();
        await new Promise<void>(release => { (window as any).releaseLock = release; });
      });
    });
    return (window as any).gate;
  }, STORAGE_KEY);
  await page.getByRole('slider', { name: 'Waist', exact: true }).fill('88');
  await other.getByRole('slider', { name: 'Hips', exact: true }).fill('99');
  await page.evaluate(() => (window as any).releaseLock());
  await expect(other.getByRole('alert')).toContainText('Another tab');
  const saved = await state(page);
  expect(saved.body.waist).toBe(88);
  expect(saved.body.hips).toBe(50);
  await expect(other.getByRole('slider', { name: 'Hips', exact: true })).toHaveValue('99');
});

test('successor outfit is announced; slow double click and held Enter do not rate it', async ({ page }) => {
  await start(page);
  const button = page.getByRole('button', { name: 'I’d wear it', exact: true });
  await button.dblclick({ delay: 450 });
  expect((await state(page)).votes).toHaveLength(1);
  await expect(page.getByRole('status')).toContainText(`Next: ${LOOKS[1].name}`);
  await expect(page.getByRole('status')).toContainText(LOOKS[1].pieces[0]);
  await expect(button).toHaveAttribute('aria-disabled', 'false');
  await button.focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(450);
  await page.keyboard.down('Enter');
  await page.keyboard.up('Enter');
  expect((await state(page)).votes).toHaveLength(2);
});

test('without Web Locks, state is usable in memory but not unsafely persisted', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'locks', { value: undefined }));
  await start(page);
  await wear(page);
  await expect(page.getByRole('alert')).toContainText('could not save');
  expect(await state(page)).toBe(null);
  await expect(page.locator('.outfit-card')).toHaveAttribute('data-look-id', 'look-2');
});

test('touch swipe votes once; cancellation, vertical motion and secondary pointers do not', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  const cdp = await context.newCDPSession(page);
  const box = (await page.locator('.outfit-card').boundingBox())!;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 110, y }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  expect((await state(page)).votes).toHaveLength(1);
  await expect(page.getByRole('button', { name: 'I’d wear it', exact: true })).toHaveAttribute('aria-disabled', 'false');
  const current = page.locator('.outfit-card');
  await current.dispatchEvent('pointerdown', { pointerId: 4, pointerType: 'touch', isPrimary: false, button: 0, clientX: 100, clientY: 100 });
  await current.dispatchEvent('pointerup', { pointerId: 4, pointerType: 'touch', isPrimary: false, clientX: 230, clientY: 100 });
  expect((await state(page)).votes).toHaveLength(1);
  const next = (await current.boundingBox())!;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: next.x + 100, y: next.y + 100 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  expect((await state(page)).votes).toHaveLength(1);
});

test('all render variants have unique SVG ids, finite geometry, and no missing definitions', async ({ page }) => {
  await page.addInitScript(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), {
    key: STORAGE_KEY,
    session: { ...freshSession(), step: 'portrait', votes: LOOKS.map(look => ({ lookId: look.id, reaction: 'wear', note: '', more: [], less: [] })) },
  });
  await page.goto('/illustrated');
  await expect(page.locator('.mood-tile')).toHaveCount(24);
  const result = await page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll('[id]')).map(el => el.id);
    const svgs = Array.from(document.querySelectorAll('.mood-tile svg'));
    return { unique: new Set(ids).size === ids.length, invalid: svgs.filter(svg => /NaN|Infinity/.test(svg.outerHTML)).length, missing: svgs.flatMap(svg => [...svg.outerHTML.matchAll(/url\(#([^)]*)\)/g)].map(match => match[1])).filter(id => !document.getElementById(id)) };
  });
  expect(result).toEqual({ unique: true, invalid: 0, missing: [] });
});
