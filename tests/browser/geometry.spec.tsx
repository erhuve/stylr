import { test, expect, type Page } from './fixture';
import { LOOKS } from '../../src/lib/looks';
import { freshSession, SKINS, STORAGE_KEY } from '../../src/lib/style-engine';
import type { Body, Session } from '../../src/lib/style-types';

const measures = ['shoulders', 'chest', 'waist', 'hips', 'torso'] as const;
async function geometry(page: Page, selector: string) {
  return page.evaluate(selector => {
    const ids = Array.from(document.querySelectorAll('[id]')).map(el => el.id);
    const roots = Array.from(document.querySelectorAll<SVGSVGElement>(selector));
    return {
      count: roots.length,
      unique: new Set(ids).size === ids.length,
      invalid: roots.filter(svg => /NaN|Infinity/.test(svg.outerHTML)).length,
      clipped: roots.map(svg => svg.getBBox()).filter(box => box.x < 0 || box.y < 0 || box.x + box.width > 320 || box.y + box.height > 560).map(box => ({ x: box.x, y: box.y, width: box.width, height: box.height })),
      missing: roots.flatMap(svg => Array.from(svg.outerHTML.matchAll(/url\(#([^)]*)\)/g), match => match[1])).filter(id => !document.getElementById(id)),
    };
  }, selector);
}

test('800 illustrations: all slider extremes and looks stay in bounds with unique complete SVG definitions', async ({ page }) => {
  await page.goto('/');
  let checked = 0;
  for (let bits = 0; bits < 32; bits++) {
    const body: Body = { ...freshSession().body, skin: SKINS[bits % SKINS.length], hair: (['crop', 'bob', 'long'] as const)[bits % 3] };
    measures.forEach((key, i) => { body[key] = bits & (1 << i) ? 100 : 0; });
    const session: Session = { ...freshSession(), body, step: 'portrait', votes: LOOKS.map(look => ({ lookId: look.id, reaction: 'wear', note: '', more: [], less: [] })) };
    await page.evaluate(({ key, session }) => localStorage.setItem(key, JSON.stringify(session)), { key: STORAGE_KEY, session });
    await page.reload();
    await expect(page.locator('.mood-tile')).toHaveCount(24);
    expect(await geometry(page, '.mood-tile svg')).toEqual({ count: 24, unique: true, invalid: 0, clipped: [], missing: [] });
    await page.getByRole('button', { name: '01 Your figure' }).click();
    await expect(page.locator('.main-figure')).toBeVisible();
    expect(await geometry(page, '.main-figure')).toEqual({ count: 1, unique: true, invalid: 0, clipped: [], missing: [] });
    await expect(page.locator('.site-footer')).not.toContainText('Saving…');
    checked += 25;
  }
  expect(checked).toBe(800);
});

test('each proportion alters body and garment paths independently', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.main-figure')).toBeVisible();
  const paths = () => page.evaluate(() => ['.main-figure', '.preview-strip svg[role="img"]'].map(selector => Array.from(document.querySelector(selector)!.querySelectorAll('path')).map(path => path.getAttribute('d')).join('|')));
  for (const key of measures) {
    await page.locator(`#body-${key}`).fill('0');
    const before = await paths();
    await page.locator(`#body-${key}`).fill('100');
    const after = await paths();
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
  }
});
