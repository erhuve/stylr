import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { expect, test } from 'bun:test';
import { PHOTOS } from '../src/lib/photo-catalog';
import { coverage, observationSchema, supportedMatch, validate } from '../scripts/body-references/annotations';
import raw from '../data/body-references/labels.v1.json';
import primary from '../data/body-references/primary-observations.v1.json';
import adjudication from '../data/body-references/adjudication.v1.json';
import report from '../data/body-references/coverage.v1.json';

const assets = await Promise.all(PHOTOS.map(async photo => ({
  photoId: photo.id,
  sourceUrl: photo.sourceUrl,
  assetSha256: createHash('sha256').update(await readFile(new URL(`../public${photo.src}`, import.meta.url))).digest('hex'),
})));
const bundle = validate(raw, assets);

test('every catalog image has one source-bound annotation and second-pass coverage', () => {
  const ids = PHOTOS.map(photo => photo.id).sort();
  expect(bundle.labels.map(label => label.photoId).sort()).toEqual(ids);
  expect(adjudication.reviewedIds).toEqual(ids);
  expect(new Set(adjudication.reviewedIds).size).toBe(PHOTOS.length);
  expect(primary).toHaveLength(PHOTOS.length);
});

test('the adjudication journal reproduces every final observation exactly', () => {
  const replay = new Map(primary.map(value => {
    const row = observationSchema.parse(value);
    return [row.photoId, row];
  }));
  for (const change of adjudication.changes) {
    expect(replay.get(change.photoId)).toEqual(observationSchema.parse(change.before));
    replay.set(change.photoId, observationSchema.parse(change.after));
  }
  for (const { photoId, pose, axes, blockers, evidence } of bundle.labels) {
    expect(replay.get(photoId)).toEqual({ photoId, pose, axes, blockers, evidence });
  }
});

test('the coverage report is computed from observations rather than supplied by reviewers', () => {
  expect(JSON.stringify(coverage(bundle))).toBe(JSON.stringify(report));
  expect(report.usability.complete + report.usability.partial + report.usability.unavailable).toBe(PHOTOS.length);
});

test('the rejected trouser-landmark inference stays unknown and strict full profiles have no matches', () => {
  expect(bundle.labels.find(row => row.photoId === 'street-tokyo-195901')?.axes.legs).toBeNull();
  expect(bundle.labels.find(row => row.photoId === 'archive-19120')?.axes.waist?.range).toEqual([1, 2]);
  expect(bundle.labels.filter(row => supportedMatch(row, { build: [0, 4], shoulderHip: [0, 4], waist: [0, 4], legs: [0, 4] }))).toHaveLength(0);
});
