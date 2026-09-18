import { expect, test } from 'bun:test';
import { PHOTOS } from '../src/lib/photo-catalog';
import { BODY_REFERENCES, matchesBody } from '../src/lib/body-reference';
import assets from '../scripts/reviewed-assets.json';
import references from '../data/catalog-review/admitted-body.json';
import summary from '../data/catalog-review/admission-summary.json';

test('admission replays reviewed data and exact original image bindings', () => {
  const result = Bun.spawnSync(['python', 'scripts/import-reviewed-catalog.py', '--check']);
  expect(result.exitCode, new TextDecoder().decode(result.stderr)).toBe(0);
  expect(assets.length).toBe(6813);
  expect(summary.completeReferences).toBe(249);
  const rejected = new Set(summary.excluded.map(row => row.id));
  expect(PHOTOS.some(photo => rejected.has(photo.id))).toBe(false);
  for (const reference of references) {
    const { id, ...body } = reference;
    expect(BODY_REFERENCES.get(id)).toEqual(body);
    if (Object.values(body).some(value => value === null)) {
      for (const build of [1, 2, 3]) expect(matchesBody(id, { build, shoulderHip: 0, waist: 1, mode: 'nearby' })).toBe(false);
    }
  }
});

test('gallery views share source-page grouping without invented person or clothing metadata', () => {
  const addedIds = new Set(assets.map(asset => asset.id));
  const grouped = new Map<string, string>();
  for (const photo of PHOTOS.filter(photo => addedIds.has(photo.id))) {
    expect(photo.collection).toBe('unclassified');
    expect(photo.frame).toBe('unknown');
    expect(photo.bottomKnown).toBe(false);
    expect(photo.shoesKnown).toBe(false);
    expect(photo.dimensions?.comfort).toBeUndefined();
    if (grouped.has(photo.sourceUrl)) expect(photo.shoot).toBe(grouped.get(photo.sourceUrl)!);
    grouped.set(photo.sourceUrl, photo.shoot);
  }
  expect(new Set(grouped.values()).size).toBe(6254);
});

test('additional review batches reject incomplete, reused and invalid observations', () => {
  const result = Bun.spawnSync(['python', 'tests/catalog-batches.py']);
  expect(result.exitCode, new TextDecoder().decode(result.stderr)).toBe(0);
}, 30000);

test('sourcing preserves committed history, deferred pages, duplicates and failures', () => {
  const result = Bun.spawnSync(['python', 'tests/catalog-sourcing.py']);
  expect(result.exitCode, new TextDecoder().decode(result.stderr)).toBe(0);
});

test('street sourcing preserves bounded snapshots, account caps and failed requests', () => {
  const result = Bun.spawnSync(['python', 'tests/catalog-street-sourcing.py']);
  expect(result.exitCode, new TextDecoder().decode(result.stderr)).toBe(0);
});

test('archive sourcing preserves provenance, pending reviews and exact restore bytes', () => {
  const result = Bun.spawnSync(['python', 'tests/catalog-fashionpedia.py']);
  expect(result.exitCode, new TextDecoder().decode(result.stderr)).toBe(0);
}, 30000);
