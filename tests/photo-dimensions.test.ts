import { describe, expect, test } from 'bun:test';
import { PHOTOS } from '../src/lib/photo-catalog';
import { DIMENSION_KEYS, DIMENSION_PAIR_MASKS, nearIdenticalPhotos, normalizeDimensionPhrase, normalizePhotoDimensions, photoDimensionSignals, sharedDimensionGroups } from '../src/lib/photo-dimensions';
import { freshPhotoSession, parsePhotoSession, photoEvidence } from '../src/lib/photo-session';
import type { Collection, DimensionKey, Frame, Photo, PhotoDimensions, PhotoSession } from '../src/lib/photo-types';

const photo = (dimensions?: PhotoDimensions): Photo => ({ ...PHOTOS[0], dimensions });

describe('optional descriptive dimensions', () => {
  test('all eight groups are optional and do not widen session choices', () => {
    const keys: DimensionKey[] = ['silhouette', 'surface', 'palette', 'styling', 'references', 'context', 'function', 'comfort'];
    expect(DIMENSION_KEYS).toEqual(keys);
    const collectionUnchanged: Exclude<PhotoSession['collection'], 'all'> extends Collection ? true : false = true;
    const frameUnchanged: Exclude<PhotoSession['frame'], 'all'> extends Frame ? true : false = true;
    expect(collectionUnchanged && frameUnchanged).toBe(true);
    const reference: Photo = { ...photo(), collection: 'unclassified', frame: 'unknown', sourceLabel: 'Personal archive', metadataBasis: 'source-description' };
    expect(reference.collection).toBe('unclassified');
    expect(parsePhotoSession(JSON.stringify({ ...freshPhotoSession(), collection: 'unclassified' }), [reference]).status).toBe('invalid');
    expect(parsePhotoSession(JSON.stringify({ ...freshPhotoSession(), frame: 'unknown' }), [reference]).status).toBe('invalid');
  });

  test('normalizes descriptive phrases, preserves meaning, deduplicates and orders consistently', () => {
    expect(normalizeDimensionPhrase('  Wide—LEG\tＴrousers  ')).toBe('wide leg trousers');
    const dimensions: PhotoDimensions = { silhouette: [' Wide-leg trousers ', 'wide LEG trousers', 'Room through body'], palette: [' RED ', 'cream'], comfort: ['Flat footwear'] };
    const before = JSON.stringify(dimensions);
    expect(normalizePhotoDimensions(dimensions)).toEqual({ silhouette: ['room through body', 'wide leg trousers'], palette: ['cream', 'red'], comfort: ['flat footwear'] });
    expect(JSON.stringify(dimensions)).toBe(before);
    expect(photoDimensionSignals(photo(dimensions))).toEqual(photoDimensionSignals(photo({ comfort: ['flat footwear'], palette: ['cream', 'red'], silhouette: ['Room through body', 'wide leg trousers'] })));
  });

  test('missing or explicitly unknown dimensions do not become invented visual or performance facts', () => {
    expect(normalizePhotoDimensions()).toEqual({});
    expect(normalizePhotoDimensions({ surface: ['unknown', 'not visible', ''], comfort: ['unspecified', 'n/a'] })).toEqual({});
    expect(photoDimensionSignals(photo()).groups.every(group => group.length === 0)).toBe(true);
    expect(photoDimensionSignals(photo()).combinations).toEqual([]);
    expect(normalizePhotoDimensions({ silhouette: ['room through body'], comfort: ['flat footwear'] })).not.toHaveProperty('function');
  });

  test('untrusted metadata is bounded and malformed values are ignored', () => {
    const malformed = { silhouette: ['x'.repeat(161), 12, null, 'valid'], surface: 'wrong', unrelated: ['not a group'] } as unknown as PhotoDimensions;
    expect(normalizePhotoDimensions(malformed)).toEqual({ silhouette: ['valid'] });
    const dimensions = Object.fromEntries(DIMENSION_KEYS.map(key => [key, Array.from({ length: 1000 }, (_, i) => `value ${i}`)])) as PhotoDimensions;
    const normalized = normalizePhotoDimensions(dimensions);
    expect(Object.values(normalized).every(values => values.length === 12)).toBe(true);
    expect(photoDimensionSignals(photo(dimensions)).combinations.length).toBe(28);
  });

  test('group identity and combination serialization prevent collisions', () => {
    const a = photoDimensionSignals(photo({ silhouette: ['red'], palette: ['wide'] }));
    const b = photoDimensionSignals(photo({ silhouette: ['wide'], palette: ['red'] }));
    expect(a.groups).not.toEqual(b.groups);
    expect(a.combinations).not.toEqual(b.combinations);
    expect(photoDimensionSignals(photo({ silhouette: ['a,b', 'c'], palette: ['d'] })).combinations).not.toEqual(photoDimensionSignals(photo({ silhouette: ['a', 'b,c'], palette: ['d'] })).combinations);
  });

  test('shared observed pairs survive extra values in either group without crossing group boundaries', () => {
    const base = photoDimensionSignals(photo({ silhouette: ['roomy top'], palette: ['warm colors'] }));
    const extra = photoDimensionSignals(photo({ silhouette: ['straight hem', 'roomy top'], palette: ['cream', 'warm colors'] }));
    const common = sharedDimensionGroups(base, extra);
    expect(common).toBe(base.mask);
    expect(DIMENSION_PAIR_MASKS.filter(pair => (common & pair) === pair)).toHaveLength(1);
    expect(sharedDimensionGroups(base, photoDimensionSignals(photo({ silhouette: ['warm colors'], palette: ['roomy top'] })))).toBe(0);
    expect(sharedDimensionGroups(base, photoDimensionSignals(photo({ silhouette: ['roomy top'], palette: ['different colors'] })))).toBe(1);
    expect(sharedDimensionGroups(base, photoDimensionSignals(photo()))).toBe(0);
  });

  test('maximum multi-value combinations retain factor references rather than materializing Cartesian products', () => {
    const dimensions = Object.fromEntries(DIMENSION_KEYS.map(key => [key, Array.from({ length: 12 }, (_, i) => `${key} value ${i}`)])) as PhotoDimensions;
    const signals = photoDimensionSignals(photo(dimensions));
    expect(signals.groups.flat()).toHaveLength(96);
    expect(signals.combinations).toHaveLength(28);
    expect(new Set(signals.combinations.flat()).size).toBe(8);
    expect(signals.combinations.every(pair => pair.every(group => signals.groups.includes(group as string[])))).toBe(true);
    expect(sharedDimensionGroups(signals, signals)).toBe(255);
    expect(DIMENSION_PAIR_MASKS).toHaveLength(28);
    expect(new Set(DIMENSION_PAIR_MASKS).size).toBe(28);
  });

  test('near-identical looks need shared visual evidence, not a contributor, context or missing fields', () => {
    const compare = (a: Photo, b: Photo) => nearIdenticalPhotos(a, photoDimensionSignals(a), b, photoDimensionSignals(b));
    expect(compare(photo({ silhouette: ['wide trousers'], palette: ['warm neutrals'] }), photo({ palette: ['Warm neutrals'], silhouette: ['Wide-trousers'] }))).toBe(true);
    expect(compare(photo({ context: ['street'], comfort: ['flat footwear'] }), photo({ context: ['street'], comfort: ['flat footwear'] }))).toBe(false);
    expect(compare(photo({ silhouette: ['wide trousers'], palette: ['warm neutrals'] }), photo({ silhouette: ['slim skirt'], palette: ['cool brights'] }))).toBe(false);
    expect(compare(photo({ silhouette: ['wide trousers'], palette: ['warm neutrals'] }), photo())).toBe(false);
    expect(compare({ ...photo(), features: [] }, { ...photo(), features: [] })).toBe(false);
    expect(compare(photo(), photo())).toBe(true);
  });

  test('new metadata does not change the original broad evidence or invent feedback', () => {
    const p = photo(), enhanced = { ...p, dimensions: { comfort: ['flat footwear'], palette: ['red'] } };
    const session: PhotoSession = { ...freshPhotoSession(), votes: [{ photoId: p.id, reaction: 'admire', more: ['texture'], less: ['pattern'], note: 'not machine interpreted' }] };
    expect(photoEvidence(session, [p])).toEqual(photoEvidence(session, [enhanced]));
    expect(photoEvidence(session, [enhanced])).toHaveLength(14);
  });
});
