import { expect, test } from 'bun:test';
import { coverage, validateRows } from '../scripts/audit-presentation';
import { PHOTOS } from '../src/lib/photo-catalog';

const row = (id: string, evidence: string) => ({ id, evidence, sha256: 'a'.repeat(64), reviewedAt: '2026-09-16', ordinal: 1, sheet: 1 });

test('presentation rejects duplicate, orphaned and invalid observations', () => {
  const photos = PHOTOS.slice(0, 1);
  const observation = row(photos[0].id, 'U');
  expect(() => validateRows(photos, [observation, observation])).toThrow('duplicate');
  expect(() => validateRows(photos, [row('missing', 'U')])).toThrow('Unknown');
  expect(() => validateRows(photos, [row(photos[0].id, 'men')])).toThrow('Invalid');
  expect(() => validateRows(photos, [{ ...observation, sha256: '' }])).toThrow('Invalid');
});

test('unreviewed stays distinct from unclear and partial body labels stay incomplete', () => {
  const photos = PHOTOS.slice(0, 3);
  const report = coverage(photos, [row(photos[0].id, 'U'), row(photos[1].id, 'M')], new Map([
    [photos[0].id, { build: 3, shoulderHip: 0, waist: 1 }],
    [photos[1].id, { build: 3, shoulderHip: null, waist: 1 }],
  ]));
  expect(report.unreviewedIds).toEqual([photos[2].id]);
  expect(report.categories.find(category => category.presentation === 'unclear')?.completeReferences).toBe(1);
  expect(report.categories.find(category => category.presentation === 'masculine')).toMatchObject({ photos: 1, completeReferences: 0, byBuild: { '3': 1 } });
});

test('presentation uses ID bindings regardless of catalog order or clothing-range metadata', () => {
  const photos = PHOTOS.slice(0, 2).map(photo => ({ ...photo, sourceUrl: 'https://example.com/same-page/' }));
  const rows = photos.map(photo => row(photo.id, 'M'));
  const report = coverage([...photos].reverse(), rows, new Map());
  expect(report.categories[0]).toMatchObject({ photos: 2, sourcePages: 1, sourceHosts: 1, byBuild: { unknown: 2 } });
  expect(report.categories[1].photos).toBe(0);
});
