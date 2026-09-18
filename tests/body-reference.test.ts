import { expect, test } from 'bun:test';
import { BODY_REFERENCES, bodySelection, matchesBody } from '../src/lib/body-reference';
import { PHOTOS } from '../src/lib/photo-catalog';
import { eligiblePhotos, freshPhotoSession, parsePhotoSession, photoQueue, votePhoto, undoPhoto } from '../src/lib/photo-session';

test('reviewed references bind to catalog IDs and exclude unreviewed and unknown traits', () => {
  expect(BODY_REFERENCES.size).toBe(7082);
  expect([...BODY_REFERENCES.values()].filter(record => record.build !== null)).toHaveLength(5767);
  for (const id of BODY_REFERENCES.keys()) expect(PHOTOS.some(photo => photo.id === id)).toBe(true);
  for (const build of [1, 1.5, 2, 2.5, 3]) for (const shoulderHip of [null, -1, 0, 1]) for (const waist of [null, 0, 1, 2]) {
    const body = { build, shoulderHip, waist };
    const session = { ...freshPhotoSession(), body };
    const expected = PHOTOS.filter(photo => {
      const record = BODY_REFERENCES.get(photo.id);
      return record?.build === build && (shoulderHip === null || record.shoulderHip === shoulderHip) && (waist === null || record.waist === waist);
    });
    expect(eligiblePhotos(session, PHOTOS)).toEqual(expected);
    expect(photoQueue(session, PHOTOS, 3).every(photo => expected.includes(photo))).toBe(true);
  }
  expect(matchesBody('missing', { build: 1, shoulderHip: null, waist: null })).toBe(false);
});

test('body selection persists with exact undo and rejects malformed filters without breaking old saves', () => {
  expect(parsePhotoSession(JSON.stringify(freshPhotoSession()), PHOTOS).status).toBe('valid');
  const session = { ...freshPhotoSession(), body: { build: 3, shoulderHip: null, waist: null } };
  const photo = photoQueue(session, PHOTOS, 1)[0];
  const draft = { photoId: photo.id, note: 'keep', more: [], less: [] };
  const voted = votePhoto({ ...session, draft }, photo.id, 'wear', PHOTOS);
  expect(parsePhotoSession(JSON.stringify(voted), PHOTOS).session).toEqual(voted);
  expect(undoPhoto(voted, PHOTOS).draft).toEqual(draft);
  for (const build of [0, 4, 1.25, '2']) expect(parsePhotoSession(JSON.stringify({ ...session, body: { ...session.body, build } }), PHOTOS).status).toBe('invalid');
});

test('continuous selection requires all reviewed axes and enforces bounded proximity', () => {
  for (const build of [1, 1.23, 1.99, 2.51, 3]) for (const shoulderHip of [-1, -.31, 0, .58, 1]) for (const waist of [0, .42, 1, 1.79, 2]) {
    const body = bodySelection({ build, shoulderHip, waist });
    expect(parsePhotoSession(JSON.stringify({ ...freshPhotoSession(), body }), PHOTOS).status).toBe('valid');
    for (const photo of eligiblePhotos({ ...freshPhotoSession(), body }, PHOTOS)) {
      const reference = BODY_REFERENCES.get(photo.id)!;
      expect(reference.build).not.toBeNull();
      expect(reference.shoulderHip).not.toBeNull();
      expect(reference.waist).not.toBeNull();
      expect(Math.abs(reference.build! - build)).toBeLessThanOrEqual(.5);
      expect(Math.abs(reference.shoulderHip! - shoulderHip)).toBeLessThanOrEqual(.75);
      expect(Math.abs(reference.waist! - waist)).toBeLessThanOrEqual(.75);
    }
  }
  const incomplete = { ...bodySelection(undefined), waist: null };
  expect(parsePhotoSession(JSON.stringify({ ...freshPhotoSession(), body: incomplete }), PHOTOS).status).toBe('invalid');
  expect(PHOTOS.some(photo => matchesBody(photo.id, incomplete))).toBe(false);
});
