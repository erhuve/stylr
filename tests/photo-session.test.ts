import { describe, expect, test } from 'bun:test';
import { PHOTOS } from '../src/lib/photo-catalog';
import { eligiblePhotos, freshPhotoSession, nextPhoto, parsePhotoSession, photoEvidence, photoMatches, photoNotes, votePhoto, undoPhoto } from '../src/lib/photo-session';
import type { PhotoSession } from '../src/lib/photo-types';

const empty = () => freshPhotoSession();
const react = (s: PhotoSession, reaction: 'wear' | 'admire' | 'pass' | 'unsure' = 'wear') => votePhoto(s, nextPhoto(s, PHOTOS)!.id, reaction, PHOTOS);
describe('color photo catalog and engine', () => {
  test('every reference has unique source, local color image, credits and visible traits', async () => {
    expect(PHOTOS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(PHOTOS.map(p => p.id)).size).toBe(PHOTOS.length);
    expect(new Set(PHOTOS.map(p => p.sourceUrl)).size).toBe(PHOTOS.length);
    for (const p of PHOTOS) {
      expect(p.src.startsWith('/photos/')).toBe(true);
      expect(await Bun.file(`public${p.src}`).exists()).toBe(true);
      expect(p.sourceUrl).toMatch(/^https:\/\/(www\.pexels\.com|unsplash\.com)\//);
      expect(p.creator.length).toBeGreaterThan(0);
      expect(p.features.length).toBeGreaterThan(0);
      expect(new Set(p.features).size).toBe(p.features.length);
    }
    expect(PHOTOS.some(p => p.id.includes('31063303'))).toBe(false);
    expect(PHOTOS.some(p => ['6520931','18404805','30677128','17037280','34608849','17049703','13024431'].some(id => p.id.includes(id)))).toBe(false);
  });
  test('new session round trips independently from legacy version', () => {
    expect(parsePhotoSession(JSON.stringify(empty()), PHOTOS).status).toBe('valid');
    expect(parsePhotoSession(JSON.stringify({ version: 1 }), PHOTOS).status).toBe('invalid');
    expect(parsePhotoSession(null, PHOTOS).status).toBe('empty');
  });
  for (const value of ['', '{', 'null', '[]', '{"version":99}', JSON.stringify({ ...empty(), sex: 'guess' }), JSON.stringify({ ...empty(), extra: true }), 'x'.repeat(256001)]) {
    test(`rejects malformed input ${value.slice(0, 30)}`, () => expect(parsePhotoSession(value, PHOTOS).status).toBe('invalid'));
  }
  test('strict refs, duplicate votes and overlapping feedback rejected', () => {
    const s = react(empty());
    expect(parsePhotoSession(JSON.stringify({ ...s, votes: [...s.votes, s.votes[0]] }), PHOTOS).status).toBe('invalid');
    expect(parsePhotoSession(JSON.stringify({ ...s, draft: { photoId: 'unknown', note: '', more: [], less: [] } }), PHOTOS).status).toBe('invalid');
    expect(parsePhotoSession(JSON.stringify({ ...s, draft: { ...s.draft, more: ['pattern'], less: ['pattern'] } }), PHOTOS).status).toBe('invalid');
  });
  test('no duplicate cards and deterministic balanced broad exposure', () => {
    let s = empty();
    const selected = [];
    for (let n = 0; n < PHOTOS.length; n++) {
      const p = nextPhoto(s, PHOTOS)!;
      expect(nextPhoto(s, PHOTOS)?.id).toBe(p.id);
      selected.push(p);
      s = react(s, 'unsure');
      expect(parsePhotoSession(JSON.stringify(s), PHOTOS).status).toBe('valid');
    }
    expect(new Set(selected.map(p => p.id)).size).toBe(PHOTOS.length);
    expect(nextPhoto(s, PHOTOS)).toBeUndefined();
    expect(new Set(selected.slice(0, 12).map(p => p.family)).size).toBe(6);
    const women = selected.slice(0, 12).filter(p => p.collection === 'women').length;
    expect(women).toBeGreaterThanOrEqual(4); expect(women).toBeLessThanOrEqual(8);
    expect(new Set(selected.slice(0, 12).map(p => p.frame)).size).toBe(3);
  });
  test('sex never determines selection or style; body preference does not exclude', () => {
    const s = react(react(empty()));
    for (const sex of ['female', 'male', 'intersex', 'unspecified'] as const) {
      expect(nextPhoto({ ...s, sex }, PHOTOS)!.id).toBe(nextPhoto(s, PHOTOS)!.id);
      expect(photoEvidence({ ...s, sex }, PHOTOS)).toEqual(photoEvidence(s, PHOTOS));
    }
    expect(eligiblePhotos({ ...s, frame: 'fuller' }, PHOTOS)).toEqual(eligiblePhotos(s, PHOTOS));
  });
  test('collection and every boundary respected, unknown garments fail closed', () => {
    for (const collection of ['women', 'men'] as const) {
      const s = { ...empty(), collection };
      expect(eligiblePhotos(s, PHOTOS).every(p => p.collection === collection)).toBe(true);
    }
    for (const exclusion of ['no-skirts','no-shorts','no-heels','no-boots'] as const) {
      const chosen = eligiblePhotos({ ...empty(), exclusions: [exclusion] }, PHOTOS);
      const garment = ({ 'no-skirts': 'skirt', 'no-shorts': 'shorts', 'no-heels': 'heels', 'no-boots': 'boots' } as const)[exclusion];
      expect(chosen.every(p => !p.garments.includes(garment))).toBe(true);
      expect(chosen.every(p => exclusion === 'no-skirts' || exclusion === 'no-shorts' ? p.bottomKnown : p.shoesKnown)).toBe(true);
    }
  });
  test('draft pinned, exact feedback consumed, stale/duplicate ignored, undo exact', () => {
    let s = empty(); const p = nextPhoto(s, PHOTOS)!;
    s = { ...s, draft: { photoId: p.id, note: 'the sleeves', more: ['texture'], less: ['pattern'] } };
    const voted = react(s);
    expect(voted.votes[0]).toEqual({ ...s.draft!, reaction: 'wear' });
    expect(votePhoto(voted, p.id, 'wear', PHOTOS)).toBe(voted);
    expect(votePhoto(s, 'wrong', 'wear', PHOTOS)).toBe(s);
    const undone = undoPhoto(voted, PHOTOS);
    expect(undone.draft).toEqual(s.draft!);
    expect(nextPhoto(undone, PHOTOS)?.id).toBe(p.id);
  });
  test('skip is neutral, admiration never creates wear recommendations', () => {
    const skipped = react(empty(), 'unsure');
    expect(photoEvidence(skipped, PHOTOS).every(e => e.score === 0)).toBe(true);
    const admired = react(react(empty(), 'admire'), 'admire');
    expect(photoMatches(admired, PHOTOS)).toEqual([]);
    const worn = react(empty());
    expect(photoMatches(worn, PHOTOS)[0].id).toBe(worn.votes[0].photoId);
  });
  test('notes are escaped and credits included without sex disclosure', () => {
    let s = empty(); const p = nextPhoto(s, PHOTOS)!;
    s = react({ ...s, sex: 'intersex', draft: { photoId: p.id, note: '<script>alert(1)</script> ![bad](javascript:x)', more: [], less: [] } });
    const notes = photoNotes(s, PHOTOS);
    expect(notes).not.toContain('<script>'); expect(notes).not.toContain('![bad]');
    expect(notes).toContain(p.sourceUrl); expect(notes).not.toContain('intersex');
  });
});
