import { test, expect } from 'bun:test';
import { PHOTOS } from '../src/lib/photo-catalog';
import { eligiblePhotos, freshPhotoSession, photoEvidence, photoMatches } from '../src/lib/photo-session';
import type { PhotoSession } from '../src/lib/photo-types';

test('visually reviewed heeled sandals obey No heels; brand hold absent', () => {
  expect(PHOTOS.find(p => p.id === 'pexels-5254744')!.garments).toContain('heels');
  expect(eligiblePhotos({ ...freshPhotoSession(), exclusions: ['no-heels'] }, PHOTOS).some(p => p.id === 'pexels-5254744')).toBe(false);
  expect(PHOTOS.some(p => p.id === 'pexels-18220798')).toBe(false);
});

test('explicit dislike of tailoring penalizes otherwise bright fitted suggestions', () => {
  const session: PhotoSession = { ...freshPhotoSession(), votes: ['pexels-17872897', 'pexels-15799200'].map(photoId => ({ photoId, reaction: 'wear', more: [], less: ['tailored'], note: '' })) };
  const baseline = { ...session, votes: session.votes.map(v => ({ ...v, less: [] })) };
  const worn = new Set(session.votes.map(v => v.photoId));
  const before = photoMatches(baseline, PHOTOS).filter(p => !worn.has(p.id));
  const after = photoMatches(session, PHOTOS).filter(p => !worn.has(p.id));
  expect(before.some(p => p.features.includes('tailored'))).toBe(true);
  expect(after.some(p => p.features.includes('tailored'))).toBe(false);
  expect(photoEvidence(session, PHOTOS).find(e => e.feature === 'tailored')!.score).toBeLessThan(0);
});
