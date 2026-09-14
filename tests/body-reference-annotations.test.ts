import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import { AXES, assemble, bundleSchema, catalogDigest, coverage, observationSchema, supportedMatch, usability, validate, type AssetReference, type Observation, type Preferences } from '../scripts/body-references/annotations';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const assets: AssetReference[] = ['a', 'b'].map(photoId => ({ photoId, assetSha256: digest(photoId), sourceUrl: `https://example.org/photos/${photoId}` }));
const observation = (photoId = 'a'): Observation => ({
  photoId, pose: 'front', axes: { build: null, shoulderHip: null, waist: null, legs: null },
  blockers: ['loose-clothing'],
  evidence: 'The loose coat and full skirt conceal the torso, waist and hip contours, so the visible outline cannot support these traits.',
});
const sample = () => assemble([observation('a'), observation('b')], assets, '2026-09-14');

describe('body-reference annotation schema', () => {
  test('four explicit unknowns are valid and unavailable, never filled with defaults', () => {
    const value = observationSchema.parse(observation());
    expect(value.axes).toEqual({ build: null, shoulderHip: null, waist: null, legs: null });
    expect(usability(value)).toBe('unavailable');
  });

  test('malformed, reversed, wide, non-ordinal and low-confidence estimates fail', () => {
    for (const range of [[1, 0], [0, 2], [-1, 0], [4, 5], [0.5, 1], [1], [1, 1, 1], [NaN, 2]]) {
      const value = { ...observation(), axes: { ...observation().axes, build: { range, confidence: 'medium' } } };
      expect(observationSchema.safeParse(value).success).toBe(false);
    }
    expect(observationSchema.safeParse({ ...observation(), axes: { ...observation().axes, build: { range: [1, 1], confidence: 'low' } } }).success).toBe(false);
  });

  test('omitted axes and unexpected measurement or demographic fields are rejected', () => {
    const { legs, ...incomplete } = observation().axes;
    expect(legs).toBeNull();
    expect(observationSchema.safeParse({ ...observation(), axes: incomplete }).success).toBe(false);
    for (const extra of [{ height: 170 }, { weight: 60 }, { sex: 'unspecified' }, { bodyFat: 10 }]) {
      expect(observationSchema.safeParse({ ...observation(), ...extra }).success).toBe(false);
      expect(observationSchema.safeParse({ ...observation(), axes: { ...observation().axes, ...extra } }).success).toBe(false);
    }
  });

  test('empty explanations, duplicate or invented blockers cannot be admitted', () => {
    expect(observationSchema.safeParse({ ...observation(), evidence: 'Not sure.' }).success).toBe(false);
    expect(observationSchema.safeParse({ ...observation(), blockers: ['loose-clothing', 'loose-clothing'] }).success).toBe(false);
    expect(observationSchema.safeParse({ ...observation(), blockers: ['assumed-body-type'] }).success).toBe(false);
  });

  test('partial and complete are derived, not discretionary quality claims', () => {
    const value = observation();
    value.axes.build = { range: [1, 2], confidence: 'medium' };
    expect(usability(value)).toBe('partial');
    for (const axis of AXES) value.axes[axis] = { range: [2, 2], confidence: 'high' };
    expect(usability(value)).toBe('complete');
    const bundle = sample();
    bundle.labels[0].usability = 'complete';
    expect(bundleSchema.safeParse(bundle).success).toBe(false);
  });
});

describe('source identity and completeness', () => {
  test('all catalog photos are represented exactly once and order is deterministic', () => {
    const normal = sample();
    const reversed = assemble([observation('b'), observation('a')], [...assets].reverse(), '2026-09-14');
    expect(normal).toEqual(reversed);
    expect(validate(normal, assets)).toEqual(normal);
    expect(catalogDigest(assets)).toBe(catalogDigest([...assets].reverse()));
  });

  test('missing, duplicate and foreign photos fail both assembly and validation', () => {
    for (const rows of [[observation('a')], [observation('a'), observation('a')], [observation('a'), observation('unknown')]]) {
      expect(() => assemble(rows, assets, '2026-09-14')).toThrow();
    }
    for (const labels of [sample().labels.slice(0, 1), [sample().labels[0], sample().labels[0]], sample().labels.map((label, i) => i ? { ...label, photoId: 'unknown' } : label)]) {
      expect(() => validate({ ...sample(), labels }, assets)).toThrow();
    }
    expect(() => assemble([], [], '2026-09-14')).toThrow();
    expect(() => assemble([observation('a')], [assets[0], assets[0]], '2026-09-14')).toThrow();
  });

  test('changed bytes, changed sources and stale catalog digests fail closed', () => {
    const bundle = sample();
    expect(() => validate(bundle, [{ ...assets[0], assetSha256: digest('changed') }, assets[1]])).toThrow();
    expect(() => validate(bundle, [{ ...assets[0], sourceUrl: 'https://example.org/other' }, assets[1]])).toThrow();
    expect(() => validate({ ...bundle, catalogDigest: digest('other') }, assets)).toThrow();
    const changed = structuredClone(bundle);
    changed.labels[0].assetSha256 = digest('changed');
    expect(() => validate(changed, assets)).toThrow();
    const generated = { ...bundle, imageScope: 'generated-photos' };
    expect(() => validate(generated, assets)).toThrow();
  });
});

describe('strict coverage analysis, not a live feed change', () => {
  test('no selection does not claim a match; unknown fails even against a full range', () => {
    const value = observation();
    expect(supportedMatch(value, {})).toBe(false);
    expect(supportedMatch(value, { build: [0, 4] })).toBe(false);
    expect(supportedMatch(value, { invented: [0, 4] } as unknown as Preferences)).toBe(false);
  });

  test('a label must fit completely inside every selected interval, not merely overlap', () => {
    const value = observation();
    value.axes.build = { range: [1, 2], confidence: 'medium' };
    expect(supportedMatch(value, { build: [1, 2] })).toBe(true);
    expect(supportedMatch(value, { build: [0, 1] })).toBe(false);
    expect(supportedMatch(value, { build: [2, 3] })).toBe(false);
    expect(supportedMatch(value, { build: [1, 1] })).toBe(false);
    expect(supportedMatch(value, { build: [0, 4], waist: [0, 4] })).toBe(false);
    for (const range of [[2, 1], [-1, 2], [1, 5], [1.5, 2], [1], [1, NaN]]) expect(supportedMatch(value, { build: range } as Preferences)).toBe(false);
  });

  test('all ordinal intervals obey containment and unknown constraints', () => {
    for (let low = 0; low <= 4; low++) for (let high = low; high <= Math.min(4, low + 1); high++) {
      const value = observation();
      value.axes.build = { range: [low, high], confidence: 'medium' };
      for (let min = 0; min <= 4; min++) for (let max = min; max <= 4; max++) {
        expect(supportedMatch(value, { build: [min, max] })).toBe(low >= min && high <= max);
        expect(supportedMatch(value, { build: [min, max], waist: [0, 4] })).toBe(false);
      }
    }
  });

  test('coverage does not count partial records as complete matches', () => {
    const a = observation('a');
    a.axes.build = { range: [1, 2], confidence: 'medium' };
    const report = coverage(assemble([a, observation('b')], assets, '2026-09-14'));
    expect(report.usability).toEqual({ complete: 0, partial: 1, unavailable: 1 });
    expect(report.axes.build.supported).toBe(1);
    expect(report.axes.waist.unknown).toBe(2);
    expect(report.selectedAxisCoverage.every(pair => pair.photos === 0)).toBe(true);
  });
});
