import { describe, expect, test } from 'bun:test';
import review from '../data/model-heights/review.json';
import { auditModelHeights, extractHeightBindings } from '../scripts/audit-model-heights';
import { getReportedHeight, heightSimilarity, isSafeHeightUrl, MAX_HEIGHT_CM, MIN_HEIGHT_CM, validateHeightRecords, type HeightValidationContext, type ReportedHeight } from '../src/lib/height-reference';

const row = review.records[0] as ReportedHeight;
function fixture() {
  const r = structuredClone(row);
  const context: HeightValidationContext = {
    assets: [{ id: r.photoId, sha256: r.imageSha256, sourceUrl: r.sourceUrl, url: r.evidence.imageUrl }],
    imageHashes: { [r.photoId]: r.imageSha256 },
    snapshots: { [r.snapshot.path]: { sha256: r.snapshot.sha256, bindings: [{ galleryIndex: r.evidence.galleryIndex, imageUrls: [r.evidence.imageUrl], captions: [r.quote] }] } },
  };
  return { r, context };
}

test('seed audit checks retained snapshots, admitted IDs and actual image bytes', async () => {
  const result = await auditModelHeights();
  expect(result.errors).toEqual([]);
  expect(result.records).toBe(1);
  expect(result.sourcePages).toBe(5);
});

test('immutable source-reported contract and exact original conversion', () => {
  expect(MIN_HEIGHT_CM).toBe(90);
  expect(MAX_HEIGHT_CM).toBe(250);
  const result = getReportedHeight(row.photoId)!;
  expect(result.heightCm).toBe(172.72);
  expect(result.original.value).toBe('5\'8"');
  expect(Object.isFrozen(result)).toBe(true);
  for (const value of [result.original, result.snapshot, result.evidence]) expect(Object.isFrozen(value)).toBe(true);
  expect(getReportedHeight('unknown')).toBeUndefined();
});

test('similarity is continuous, symmetric and bounded; unknown is zero, not exclusion', () => {
  for (const value of [null, undefined, NaN, Infinity, -Infinity, 89.99, 250.01, '172.72']) expect(heightSimilarity(row.photoId, value as number)).toBe(0);
  expect(heightSimilarity('unknown', 172.72)).toBe(0);
  expect(heightSimilarity(row.photoId, 172.72)).toBe(1);
  expect(heightSimilarity(row.photoId, 180.22)).toBeCloseTo(0.5);
  expect(heightSimilarity(row.photoId, 165.22)).toBeCloseTo(0.5);
  expect(heightSimilarity(row.photoId, 187.72)).toBe(0);
  for (let h = 90; h <= 250; h += 0.25) {
    const score = heightSimilarity(row.photoId, h);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  }
});

test('pure validation does not mutate data and accepts explicitly bound source evidence', () => {
  const { r, context } = fixture();
  const before = JSON.stringify({ r, context });
  expect(validateHeightRecords([r], context)).toEqual([]);
  expect(JSON.stringify({ r, context })).toBe(before);
  expect(validateHeightRecords([], context)).toEqual([]);
  expect(validateHeightRecords(null, context).length).toBeGreaterThan(0);
});

describe('malformed and unverified claims fail closed', () => {
  const patches = [
    { heightCm: 89 }, { heightCm: 251 }, { heightCm: NaN }, { heightCm: Infinity }, { heightCm: '172.72' },
    { heightCm: 174 }, { quote: '' }, { quote: 'Drew - tall' }, { quote: 'Drew - petite' },
    { quote: 'Drew - 5\'8" or 6\'0"' }, { quote: 'Drew - about 5\'8"' },
    { quote: 'Drew - 170–175 cm' }, { quote: 'Drew - -175 cm' }, { quote: 'Drew and Bob - 175 cm' },
    { quote: 'Waist circumference 175 cm' }, { quote: 'Drew - 5\'12"' },
    { original: { unit: 'cm', value: '172.72' } }, { status: 'unverified' },
    { photoId: 'unknown-photo' }, { photoId: '../escape' }, { imageSha256: 'bad' },
    { retrievedAt: '' }, { retrievedAt: 'not-a-date' }, { retrievedAt: '2026-02-30T00:00:00Z' },
    { quote: 'Model waist 175 cm' }, { quote: 'Waist - 175 cm' },
    { sourceUrl: 'javascript:alert(1)' }, { sourceUrl: 'https://other.com/products/shirt' },
    { snapshot: { ...row.snapshot, path: '../outside.html.gz' } },
    { evidence: { ...row.evidence, explanation: '' } },
    { evidence: { ...row.evidence, kind: 'lookalike-person' } },
    { evidence: { ...row.evidence, galleryIndex: 2 } },
    { evidence: { ...row.evidence, imageUrl: 'https://other.com/another.jpg' } },
  ];
  for (const [i, patch] of patches.entries()) test(`invalid claim ${i + 1}`, () => {
    const { r, context } = fixture();
    expect(validateHeightRecords([{ ...r, ...patch }], context).length).toBeGreaterThan(0);
  });
});

test('duplicate IDs and image/caption reuse are rejected even with a new photo ID', () => {
  const { r, context } = fixture();
  expect(validateHeightRecords([r, r], context).join(' ')).toContain('duplicate photo ID');
  const other = { ...r, photoId: 'different-photo' };
  const errors = validateHeightRecords([r, other], { ...context, assets: [...context.assets, { ...context.assets[0]!, id: other.photoId }] }).join(' ');
  expect(errors).toContain('reused image evidence');
  expect(errors).toContain('reused gallery evidence');
});

test('changed or missing image and snapshot hashes are rejected', () => {
  const { r, context } = fixture();
  for (const imageHashes of [{}, { [r.photoId]: '0'.repeat(64) }]) expect(validateHeightRecords([r], { ...context, imageHashes }).join(' ')).toContain('image hash');
  for (const snapshots of [{}, { [r.snapshot.path]: { ...context.snapshots[r.snapshot.path]!, sha256: '0'.repeat(64) } }]) expect(validateHeightRecords([r], { ...context, snapshots }).join(' ')).toContain('snapshot hash');
});

test('empty, multi-image, conflicting, generic and unbound captions are rejected', () => {
  const { r, context } = fixture();
  const original = context.snapshots[r.snapshot.path]!;
  const binding = original.bindings[0]!;
  for (const bindings of [[], [{ ...binding, captions: [] }], [{ ...binding, imageUrls: [] }], [{ ...binding, captions: [r.quote, 'Bob - 6\'0"'] }], [{ ...binding, imageUrls: [r.evidence.imageUrl, 'https://other.com/model.jpg'] }], [{ ...binding, captions: ['Our models are all tall'] }], [binding, { ...binding, captions: ['Drew - 6\'0"'] }]]) {
    expect(validateHeightRecords([r], { ...context, snapshots: { [r.snapshot.path]: { ...original, bindings } } }).length).toBeGreaterThan(0);
  }
});

test('unsafe URL schemes, local addresses, credentials and parser confusions are rejected', () => {
  for (const url of ['http://ashanderie.com/a', 'file:///a', 'data:text/html,a', 'https://user:pass@ashanderie.com/a', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://localhost/a', 'https://private.internal/a', 'https://ashanderie.com:444/a', 'https://ashanderie.com/a#x', 'https://ashanderie.com\\@localhost/a', ' https://ashanderie.com/a']) expect(isSafeHeightUrl(url)).toBe(false);
  expect(isSafeHeightUrl(row.sourceUrl)).toBe(true);
});

test('HTML extraction requires captions in the exact slide, never a generic product caption', async () => {
  const url = row.evidence.imageUrl;
  const html = `<p>Model is 180 cm</p><div class="product-main-slide" data-index="0"><img src="${url}"><div class="model-info--custom">Drew - 5'8&quot;<br>15.5&quot; Standard</div></div><div class="product-main-slide" data-index="1"><img src="${url}"></div>`;
  const bindings = await extractHeightBindings(html, row.sourceUrl);
  expect(bindings[0]!.captions).toEqual([row.quote]);
  expect(bindings[1]!.captions).toEqual([]);
  expect(await extractHeightBindings('<p>Model is 175 cm</p><img src="/photo.jpg">', row.sourceUrl)).toEqual([]);
});

test('explicit centimeter captions normalize without assuming shirt measurements are height', () => {
  const { r, context } = fixture();
  const cm = { ...r, quote: 'Model is 175 cm', heightCm: 175, original: { unit: 'cm', value: '175 cm' } };
  const snapshot = context.snapshots[r.snapshot.path]!;
  const bound = { ...context, snapshots: { [r.snapshot.path]: { ...snapshot, bindings: [{ ...snapshot.bindings[0]!, captions: [cm.quote] }] } } };
  expect(validateHeightRecords([cm], bound)).toEqual([]);
  for (const quote of ['Model waist 175 cm', 'Waist - 175 cm', 'Model is 170–175 cm', 'Model is -175 cm', 'Model is about 175 cm']) {
    const badContext = { ...context, snapshots: { [r.snapshot.path]: { ...snapshot, bindings: [{ ...snapshot.bindings[0]!, captions: [quote] }] } } };
    expect(validateHeightRecords([{ ...cm, quote }], badContext).length).toBeGreaterThan(0);
  }
});
