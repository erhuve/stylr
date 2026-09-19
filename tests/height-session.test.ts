import { expect, test } from 'bun:test';
import { PHOTOS } from '../src/lib/photo-catalog';
import { eligiblePhotos, freshPhotoSession, parsePhotoSession, photoQueue } from '../src/lib/photo-session';
import review from '../data/model-heights/review.json';

test('height preferences round trip while old v2 sessions remain valid', () => {
  const original = freshPhotoSession();
  expect(parsePhotoSession(JSON.stringify(original), PHOTOS).session).toEqual(original);
  for (const heightCm of [null, 90, 172.72, 250]) {
    const session = { ...original, heightCm, heightUnit: 'ft-in' as const };
    expect(parsePhotoSession(JSON.stringify(session), PHOTOS)).toEqual({ session, status: 'valid' });
  }
  for (const preferences of [{ heightCm: 89 }, { heightCm: 251 }, { heightCm: '170' }, { heightUnit: 'meters' }]) {
    expect(parsePhotoSession(JSON.stringify({ ...original, ...preferences }), PHOTOS).status).toBe('invalid');
  }
});

test('height never changes eligibility or widens required body filters', () => {
  for (const body of [undefined, { build: 3, shoulderHip: 1, waist: 2, mode: 'nearby' as const }]) {
    const session = { ...freshPhotoSession(), body };
    for (const heightCm of [90, 172.72, 250]) {
      expect(eligiblePhotos({ ...session, heightCm }, PHOTOS)).toEqual(eligiblePhotos(session, PHOTOS));
    }
  }
});

test('height reranks otherwise equal references and invalidates the queue cache', () => {
  const known = PHOTOS.find(photo => photo.id === review.records[0]!.photoId)!;
  const unknown = { ...known, id: 'height-unknown-reference' };
  const photos = [unknown, known];
  const session = freshPhotoSession();
  const baseline = photoQueue(session, photos, 2).map(photo => photo.id);
  expect(photoQueue({ ...session, heightCm: 172.72 }, photos, 2).map(photo => photo.id)).toEqual([known.id, unknown.id]);
  expect(photoQueue({ ...session, heightCm: 250 }, photos, 2).map(photo => photo.id)).toEqual(baseline);
  expect(photoQueue({ ...session, heightCm: null }, photos, 2).map(photo => photo.id)).toEqual(baseline);
  const draft = { photoId: unknown.id, note: 'Keep this thought', more: [], less: [] };
  expect(photoQueue({ ...session, heightCm: 172.72, draft }, photos)[0]?.id).toBe(unknown.id);
});
