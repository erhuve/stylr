import { describe, expect, test } from 'bun:test';
import { PHOTOS } from '../src/lib/photo-catalog';
import { DIMENSION_KEYS } from '../src/lib/photo-dimensions';
import { eligiblePhotos, freshPhotoSession, MAX_PHOTO_SESSION_CHARS, MAX_PHOTO_VOTES, nextPhoto, parsePhotoSession, photoEvidence, photoMatches, photoQueue, undoPhoto, votePhoto } from '../src/lib/photo-session';
import type { Feature, Photo, PhotoDimensions, PhotoReaction, PhotoSession, PhotoVote } from '../src/lib/photo-types';

const families: Photo['family'][] = ['everyday', 'tailoring', 'sport', 'utility', 'expressive', 'soft'];
const featureSets: Feature[][] = [['minimal', 'relaxed'], ['tailored', 'fitted'], ['sporty', 'bright'], ['utility', 'layered'], ['pattern', 'edgy'], ['romantic', 'texture']];
const makePhoto = (i: number, changes: Partial<Photo> = {}): Photo => ({
  ...PHOTOS[0], id: `test-${String(i).padStart(5, '0')}`, creator: `contributor ${i}`, shoot: `shoot ${i}`,
  collection: i % 2 ? 'men' : 'women', frame: (['smaller', 'mid', 'fuller'] as const)[Math.floor(i / 6) % 3],
  family: families[i % 6], features: featureSets[i % 6], garments: [], shoesKnown: true, bottomKnown: true,
  dimensions: { silhouette: [`shape ${i % 9}`], palette: [`palette ${Math.floor(i / 9) % 8}`], surface: [`surface ${i % 7}`], styling: [`styling ${i % 11}`] }, ...changes,
});
const library = (count: number) => Array.from({ length: count }, (_, i) => makePhoto(i));
const vote = (p: Photo, reaction: PhotoReaction = 'unsure'): PhotoVote => ({ photoId: p.id, reaction, more: [], less: [], note: '' });
const ids = (photos: Photo[]) => photos.map(p => p.id);
const withoutDraft = ({ draft: _, ...session }: PhotoSession): PhotoSession => session;
function walk(photos: Photo[], count: number, reaction: PhotoReaction): Photo[] {
  let session = freshPhotoSession();
  const picked: Photo[] = [];
  for (let i = 0; i < count; i++) {
    const p = nextPhoto(session, photos);
    if (!p) break;
    picked.push(p);
    session = votePhoto(session, p.id, reaction, photos);
  }
  return picked;
}
function relatedFixture() {
  const history = Array.from({ length: 17 }, (_, i) => makePhoto(i, {
    collection: 'women', frame: 'mid', family: 'everyday', features: ['relaxed'],
    dimensions: i < 8 ? { silhouette: ['roomy top'], palette: ['warm colors'], surface: [`old surface ${i}`], styling: [`old layers ${i}`] } : { silhouette: [`other shape ${i}`], palette: [`other palette ${i}`], surface: [`old surface ${i}`], styling: [`old layers ${i}`] },
  }));
  const related = makePhoto(900, { collection: 'women', frame: 'mid', family: 'everyday', features: ['relaxed'], dimensions: { silhouette: ['roomy top'], palette: ['warm colors'], surface: ['new brushed surface'], styling: ['new layering'] } });
  const novel = makePhoto(800, { collection: 'women', frame: 'mid', family: 'everyday', features: ['relaxed'], dimensions: { silhouette: ['new fitted top'], palette: ['new cool colors'], surface: ['new smooth surface'], styling: ['new tucked layers'] } });
  const photos = [...history, related, novel];
  const session: PhotoSession = { ...freshPhotoSession(), votes: history.map((p, i) => vote(p, i < 8 ? 'wear' : 'unsure')) };
  return { photos, history, related, novel, session };
}

describe('real candidate queue, compatibility and boundaries', () => {
  test('queue starts at the exact pinned draft and never mutates data or votes', () => {
    const photos = library(80);
    const session: PhotoSession = { ...freshPhotoSession(), votes: photos.slice(0, 20).map(p => vote(p, 'wear')), draft: { photoId: photos[61].id, more: ['texture', 'relaxed'], less: ['pattern'], note: 'Keep every character: 🎀\n  cuffs ' } };
    const beforeSession = JSON.stringify(session), beforePhotos = JSON.stringify(photos);
    const queue = photoQueue(session, photos);
    expect(queue).toHaveLength(3);
    expect(queue[0]).toBe(photos[61]);
    expect(new Set(ids(queue)).size).toBe(3);
    expect(queue.every(p => photos.includes(p) && !session.votes.some(v => v.photoId === p.id))).toBe(true);
    expect(JSON.stringify(session)).toBe(beforeSession);
    expect(JSON.stringify(photos)).toBe(beforePhotos);
    expect(photoQueue({ ...session, draft: { ...session.draft!, note: 'changed draft only', more: ['bright'], less: [] } }, photos)).toEqual(queue);
    const parsed = parsePhotoSession(beforeSession, [...library(90), ...photos.slice(90)]);
    expect(parsed.status).toBe('valid');
    expect(parsed.session).toEqual(session);
    expect(nextPhoto(parsed.session, photos)?.id).toBe(photos[61].id);
    const voted = votePhoto(session, photos[61].id, 'admire', photos);
    expect(voted.votes.at(-1)).toEqual({ ...session.draft!, reaction: 'admire' });
    expect(undoPhoto(voted, photos).draft).toEqual(session.draft!);
    expect(photoQueue(undoPhoto(voted, photos), photos)).toEqual(queue);
    expect(votePhoto(voted, photos[61].id, 'wear', photos)).toBe(voted);
    expect(votePhoto(session, queue[1].id, 'wear', photos)).toBe(session);
  });

  test('lookahead changes exposure only, never assumes the next reaction or pending detail feedback', () => {
    const { photos, session } = relatedFixture();
    const more = library(80).map((p, i) => ({ ...p, id: `extra-${i}` }));
    const all = [...photos, ...more];
    const queued = photoQueue(session, all, 8);
    let current = session;
    for (const expected of queued) {
      expect(nextPhoto(current, all)).toBe(expected);
      current = votePhoto(current, expected.id, 'unsure', all);
    }
    const pending: PhotoSession = { ...session, draft: { photoId: queued[0].id, note: '', more: ['tailored'], less: ['relaxed'] } };
    expect(photoQueue(pending, all, 8)).toEqual(queued);
  });

  test('queue size is bounded, deterministic under input reordering, and exhausts real candidates', () => {
    const photos = library(20), session = freshPhotoSession();
    expect(photoQueue(session, photos).length).toBe(3);
    expect(photoQueue(session, photos, 1000).length).toBe(12);
    expect(photoQueue(session, photos, 2.9).length).toBe(2);
    for (const limit of [0, -2, NaN, Infinity, -Infinity, 0.4]) expect(photoQueue(session, photos, limit)).toEqual([]);
    expect(ids(photoQueue(session, photos, 12))).toEqual(ids(photoQueue(session, [...photos].reverse(), 12)));
    expect(photoQueue(session, [photos[0]])).toEqual([photos[0]]);
    expect(photoQueue({ ...session, votes: photos.map(p => vote(p)) }, photos)).toEqual([]);
    expect(nextPhoto(session, [])).toBeUndefined();
    expect(new Set(ids(walk(photos, 20, 'unsure'))).size).toBe(20);
  });

  test('sex is irrelevant in every clothing range; strict clothing eligibility includes unknowns only in all', () => {
    const photos = [...library(80), ...Array.from({ length: 8 }, (_, i) => makePhoto(100 + i, { collection: 'unclassified', frame: 'unknown', dimensions: undefined }))];
    for (const collection of ['all', 'women', 'men'] as const) {
      const session: PhotoSession = { ...freshPhotoSession(), collection, votes: photos.slice(0, 17).map(p => vote(p, 'wear')) };
      const queue = photoQueue(session, photos, 12);
      for (const sex of ['unspecified', 'female', 'male', 'intersex'] as const) {
        expect(photoQueue({ ...session, sex }, photos, 12)).toEqual(queue);
        expect(photoEvidence({ ...session, sex }, photos)).toEqual(photoEvidence(session, photos));
      }
      expect(queue.every(p => collection === 'all' || p.collection === collection)).toBe(true);
      expect(eligiblePhotos({ ...session, frame: 'fuller' }, photos)).toEqual(eligiblePhotos(session, photos));
    }
    const unknown = photos.at(-1)!;
    expect(eligiblePhotos(freshPhotoSession(), [unknown])).toEqual([unknown]);
    for (const collection of ['women', 'men'] as const) expect(eligiblePhotos({ ...freshPhotoSession(), collection }, [unknown])).toEqual([]);
    const men = photos.filter(p => p.collection === 'men');
    expect(photoQueue({ ...freshPhotoSession(), collection: 'men' }, photos, 8)).toEqual(photoQueue({ ...freshPhotoSession(), collection: 'men' }, men, 8));
    expect(nextPhoto(freshPhotoSession(), [unknown])).toBe(unknown);
  });

  test('new sources with unknown garment visibility fail closed even when pinned or previously liked', () => {
    const unknown = makePhoto(1, { collection: 'unclassified', frame: 'unknown', garments: [], shoesKnown: false, bottomKnown: false, dimensions: undefined });
    const safe = makePhoto(2);
    for (const exclusion of ['no-skirts', 'no-shorts', 'no-heels', 'no-boots'] as const) {
      const session: PhotoSession = { ...freshPhotoSession(), exclusions: [exclusion], draft: { photoId: unknown.id, more: [], less: [], note: '' } };
      expect(eligiblePhotos(session, [unknown, safe])).toEqual([safe]);
      expect(photoQueue(session, [unknown, safe])).toEqual([safe]);
      expect(parsePhotoSession(JSON.stringify(session), [unknown, safe]).status).toBe('invalid');
      const previous = { ...withoutDraft(session), votes: [vote(unknown, 'wear')] };
      expect(photoMatches(previous, [unknown, safe])).not.toContain(unknown);
      expect(undoPhoto(previous, [unknown, safe])).toBe(previous);
      expect(parsePhotoSession(JSON.stringify(previous), [unknown, safe]).session.votes).toEqual(previous.votes);
    }
  });

  test('v2 originals round-trip exactly alongside expanded metadata and retain filtered history', () => {
    const original = PHOTOS.slice(0, 42);
    const session: PhotoSession = { ...freshPhotoSession(), step: 'discover', sex: 'intersex', collection: 'men', votes: original.slice(0, 40).map((p, i) => ({ ...vote(p, (['wear', 'admire', 'pass', 'unsure'] as const)[i % 4]), more: ['relaxed'], less: ['pattern'], note: `Original note ${i}` })) };
    const raw = JSON.stringify(session), photos = [...original, ...library(500)];
    expect(parsePhotoSession(raw, photos)).toEqual({ status: 'valid', session });
    expect(parsePhotoSession(raw, photos.slice(1)).status).toBe('invalid');
    expect(parsePhotoSession(JSON.stringify({ ...session, version: 3 }), photos).status).toBe('invalid');
    expect(parsePhotoSession(JSON.stringify({ ...session, votes: [...session.votes, session.votes[0]] }), photos).status).toBe('invalid');
  });

  test('large valid sessions survive beyond old byte/vote caps without truncation; resource bounds reject explicitly', () => {
    const photos = library(2000);
    const session: PhotoSession = { ...freshPhotoSession(), votes: photos.map((p, i) => ({ ...vote(p, i % 2 ? 'wear' : 'admire'), note: '袖'.repeat(600), more: ['texture'], less: ['pattern'] })) };
    const raw = JSON.stringify(session);
    expect(raw.length).toBeGreaterThan(256000);
    expect(parsePhotoSession(raw, photos)).toEqual({ session, status: 'valid' });
    expect(parsePhotoSession(' '.repeat(MAX_PHOTO_SESSION_CHARS + 1), photos).status).toBe('invalid');
    const tooMany = { ...session, votes: Array.from({ length: MAX_PHOTO_VOTES + 1 }, (_, i) => ({ ...vote(photos[0]), photoId: `overflow-${i}` })) };
    expect(parsePhotoSession(JSON.stringify(tooMany), photos).status).toBe('invalid');
    const allKnown = library(MAX_PHOTO_VOTES + 1);
    expect(parsePhotoSession(JSON.stringify({ ...freshPhotoSession(), votes: allKnown.map(p => vote(p)) }), allKnown).status).toBe('invalid');
  });
});

describe('breadth before bounded related exploration', () => {
  test('the first sixteen are broad regardless of repeated whole-outfit likes, admiration, passes or unsure', () => {
    const photos = library(120);
    const worn = walk(photos, 16, 'wear');
    for (const reaction of ['admire', 'pass', 'unsure'] as const) expect(ids(walk(photos, 16, reaction))).toEqual(ids(worn));
    expect(new Set(worn.map(p => p.family)).size).toBe(6);
    expect(new Set(worn.map(p => p.frame)).size).toBe(3);
    expect(new Set(worn.map(p => p.creator)).size).toBe(16);
    expect(new Set(worn.flatMap(p => p.dimensions!.silhouette!)).size).toBeGreaterThanOrEqual(7);
    expect(new Set(worn.flatMap(p => p.dimensions!.palette!)).size).toBeGreaterThanOrEqual(6);
    const later = walk(photos, 48, 'wear').slice(16);
    expect(new Set(later.map(p => p.family)).size).toBe(6);
    expect(new Set(later.flatMap(p => p.dimensions!.silhouette!)).size).toBeGreaterThanOrEqual(7);
  });

  test('unseen values and unseen combinations outrank repeated looks, not just sparse broad features', () => {
    const seen = makePhoto(0, { collection: 'women', frame: 'mid', family: 'everyday', features: ['relaxed'], dimensions: { silhouette: ['wide'], palette: ['red'] } });
    const repeated = makePhoto(10, { ...seen, id: 'a-repeat', creator: 'other a', shoot: 'other a' });
    const unseen = makePhoto(11, { ...seen, id: 'z-new-value', creator: 'other b', shoot: 'other b', dimensions: { silhouette: ['slim'], palette: ['blue'] } });
    const session: PhotoSession = { ...freshPhotoSession(), votes: [vote(seen, 'wear')] };
    expect(nextPhoto(session, [seen, repeated, unseen])).toBe(unseen);
    const seen2 = { ...seen, id: 'second-history', creator: 'previous b', shoot: 'previous b', dimensions: { silhouette: ['slim'], palette: ['blue'] } };
    const combination = { ...unseen, id: 'z-new-combination', dimensions: { silhouette: ['wide'], palette: ['blue'] } };
    expect(nextPhoto({ ...session, votes: [vote(seen), vote(seen2)] }, [seen, seen2, repeated, combination])).toBe(combination);
  });

  test('suppresses a repeated contributor across shoots and near-identical looks across contributors', () => {
    const base = makePhoto(0, { collection: 'women', frame: 'mid', family: 'everyday', features: ['relaxed'], dimensions: { silhouette: ['wide'], palette: ['red'] } });
    const sameContributor = { ...base, id: 'a-contributor', shoot: 'different shoot', dimensions: { silhouette: ['slim'], palette: ['blue'] } };
    const sameLook = { ...base, id: 'b-look', creator: 'different photographer', shoot: 'another shoot' };
    const fresh = { ...sameContributor, id: 'z-fresh', creator: 'fresh photographer' };
    const session = { ...freshPhotoSession(), votes: [vote(base, 'wear')] };
    expect(nextPhoto(session, [base, sameContributor, sameLook, fresh])).toBe(fresh);
    expect(nextPhoto(session, [base, sameLook])).toBe(sameLook);
  });

  test('related slots retrieve a meaningful variation of liked looks while broad slots keep novelty', () => {
    const { photos, session, related, novel } = relatedFixture();
    expect(nextPhoto(session, photos)).toBe(related);
    expect(nextPhoto({ ...session, votes: session.votes.map(v => ({ ...v, reaction: 'unsure' })) }, photos)).toBe(novel);
    const broad: PhotoSession = { ...session, votes: session.votes.slice(0, 16) };
    const candidates = photos.filter(p => p.id !== session.votes.at(-1)!.photoId);
    expect(nextPhoto(broad, candidates)).toBe(novel);
    expect(photoQueue(session, photos)).toEqual([related, novel]);
  });

  test('sustained selective likes still alternate related variations with new directions', () => {
    const { history, related, novel, session } = relatedFixture();
    const relatedLooks = Array.from({ length: 24 }, (_, i) => ({ ...related, id: `related-${i}`, creator: `related contributor ${i}`, shoot: `related shoot ${i}`, dimensions: { ...related.dimensions, surface: [`fresh surface ${i}`], styling: [`fresh layers ${i}`] } }));
    const novelLooks = Array.from({ length: 48 }, (_, i) => ({ ...novel, id: `novel-${i}`, creator: `novel contributor ${i}`, shoot: `novel shoot ${i}`, dimensions: { silhouette: [`unexplored silhouette ${i}`], palette: [`unexplored palette ${i}`], surface: [`unexplored surface ${i}`], styling: [`unexplored layers ${i}`] } }));
    const photos = [...history, ...relatedLooks, ...novelLooks];
    const selected: Photo[] = [];
    let current = session;
    for (let i = 0; i < 30; i++) {
      const photo = nextPhoto(current, photos)!;
      selected.push(photo);
      current = votePhoto(current, photo.id, photo.id.startsWith('related-') ? 'wear' : 'unsure', photos);
    }
    const relatedCount = selected.filter(photo => photo.id.startsWith('related-')).length;
    expect(relatedCount).toBeGreaterThanOrEqual(6);
    expect(relatedCount).toBeLessThanOrEqual(14);
    expect(new Set(selected.map(photo => photo.id)).size).toBe(30);
  });

  test('wear and admiration remain distinct; unsure creates no preference; notes have no ranking effect', () => {
    const { photos, session, related, novel } = relatedFixture();
    const admired: PhotoSession = { ...session, votes: session.votes.map(v => ({ ...v, reaction: v.reaction === 'wear' ? 'admire' : v.reaction })) };
    const unsure: PhotoSession = { ...session, votes: session.votes.map(v => ({ ...v, reaction: 'unsure' })) };
    expect(photoMatches(admired, photos)).toEqual([]);
    expect(photoEvidence(admired, photos).every(e => e.wear === 0)).toBe(true);
    expect(photoEvidence(unsure, photos).every(e => e.score === 0)).toBe(true);
    expect(nextPhoto(session, photos)).toBe(related);
    expect(nextPhoto(unsure, photos)).toBe(novel);
    expect(nextPhoto({ ...session, votes: session.votes.map(v => ({ ...v, note: 'I definitely hate warm colors' })) }, photos)).toBe(related);
    expect(photoEvidence(session, photos).find(e => e.feature === 'relaxed')!.score).toBeGreaterThan(photoEvidence(admired, photos).find(e => e.feature === 'relaxed')!.score);
  });

  test('explicit detail feedback retains its weight without dilution by extra neutral tags', () => {
    const history = makePhoto(0, { collection: 'women', frame: 'mid', features: ['minimal'], dimensions: undefined });
    const favored = makePhoto(1, { collection: 'women', frame: 'mid', family: history.family, features: ['tailored'], dimensions: undefined });
    const disfavored = { ...favored, id: 'aaa-disfavored', creator: 'other', shoot: 'other', features: ['sporty'] as Feature[] };
    const session: PhotoSession = { ...freshPhotoSession(), votes: [{ ...vote(history), more: ['tailored'], less: ['sporty'] }] };
    expect(nextPhoto(session, [history, disfavored, favored])).toBe(favored);
    const richer = { ...favored, features: ['tailored', 'bright', 'romantic', 'texture', 'pattern'] as Feature[] };
    expect(nextPhoto(session, [history, disfavored, richer])).toBe(richer);
    expect(photoEvidence(session, [history, favored]).find(e => e.feature === 'tailored')!.score).toBe(45);
    expect(photoEvidence(session, [history, favored]).find(e => e.feature === 'sporty')!.score).toBe(-45);
  });
});

describe('500 and 2000 item sequencing performance', () => {
  for (const count of [500, 2000]) {
    test(`${count} photos with rich metadata and long history stay responsive`, () => {
      const photos = library(count).map((p, i) => ({ ...p, dimensions: { ...p.dimensions, references: [`reference ${i % 7}`], context: [`setting ${i % 5}`], function: [`visible pockets ${i % 3}`], comfort: [`room through body ${i % 4}`] } }));
      const session: PhotoSession = { ...freshPhotoSession(), votes: photos.slice(0, Math.floor(count * 0.7)).map((p, i) => vote(p, (['wear', 'admire', 'pass', 'unsure'] as const)[i % 4])) };
      const started = performance.now();
      const queue = photoQueue(session, photos);
      const milliseconds = performance.now() - started;
      expect(queue).toHaveLength(3);
      expect(queue.every(p => !session.votes.some(v => v.photoId === p.id))).toBe(true);
      expect(milliseconds).toBeLessThan(1000);
      const pinned: PhotoSession = { ...session, draft: { photoId: queue[0].id, note: 'keep this photo', more: [], less: [] } };
      const pinnedStart = performance.now();
      for (let i = 0; i < 10; i++) expect(nextPhoto(pinned, photos)).toBe(queue[0]);
      const pinnedMilliseconds = performance.now() - pinnedStart;
      expect(pinnedMilliseconds).toBeLessThan(250);
      console.info(`sequence benchmark: ${count} photos, ${session.votes.length} votes, queue ${milliseconds.toFixed(1)}ms, 10 pinned reads ${pinnedMilliseconds.toFixed(1)}ms`);
    });
  }
});

describe('adversarial annotation coverage and association regressions', () => {
  const mixedDensity = (dominant: boolean) => Array.from({ length: 200 }, (_, i) => makePhoto(i, {
    id: `${i < 40 ? 'a-sparse' : 'z-rich'}-${i}`,
    collection: 'women', frame: 'mid', family: 'everyday', features: ['relaxed', 'minimal'], view: 'full',
    creator: dominant && i >= 40 ? 'shared unresolved contributor' : `creator ${i}`,
    shoot: dominant && i >= 40 ? 'shared unresolved group' : `shoot ${i}`,
    dimensions: i < 40 ? undefined : { silhouette: [`shape ${i % 8}`], palette: [`palette ${Math.floor(i / 8) % 8}`], surface: [`surface ${i % 9}`], styling: [`layers ${i % 11}`] },
  }));

  test('sparse metadata gets early and sustained exploration, not a rich-first partition', () => {
    const photos = mixedDensity(false), selected = walk(photos, 80, 'unsure');
    const sparse = (items: Photo[]) => items.filter(p => !p.dimensions).length;
    console.info('density reproduction:', selected.findIndex(p => !p.dimensions), sparse(selected.slice(0, 40)), sparse(selected.slice(40)));
    expect(selected.findIndex(p => !p.dimensions)).toBeGreaterThanOrEqual(0);
    expect(selected.findIndex(p => !p.dimensions)).toBeLessThan(12);
    expect(sparse(selected.slice(0, 40))).toBeGreaterThanOrEqual(6);
    expect(sparse(selected.slice(40))).toBeGreaterThanOrEqual(6);
    expect(sparse(selected)).toBeLessThanOrEqual(28);
  });

  test('annotated unresolved dominant group cannot crowd out many other contributors', () => {
    const selected = walk(mixedDensity(true), 80, 'unsure');
    const dominant = selected.slice(0, 40).filter(p => p.creator === 'shared unresolved contributor').length;
    console.info('dominant reproduction:', dominant);
    expect(dominant).toBeLessThanOrEqual(12);
    expect(new Set(selected.slice(0, 40).map(p => p.creator)).size).toBeGreaterThanOrEqual(29);
    expect(selected.slice(40).some(p => p.dimensions)).toBe(true);
    expect(new Set(ids(selected)).size).toBe(80);
  });

  test('partial and unknown coverage continue to appear on long neutral and selective walks', () => {
    const photos = mixedDensity(false).map((p, i) => i >= 40 && i < 80 ? { ...p, dimensions: { palette: ['warm colors'] } } : p);
    for (const reaction of ['unsure', 'wear', 'pass', 'admire'] as const) {
      const selected = walk(photos, 120, reaction);
      for (let start = 0; start < 120; start += 40) {
        const part = selected.slice(start, start + 40);
        expect(part.filter(p => !p.dimensions).length).toBeGreaterThanOrEqual(3);
        expect(part.filter(p => Object.keys(p.dimensions || {}).length === 1).length).toBeGreaterThanOrEqual(3);
        expect(part.filter(p => Object.keys(p.dimensions || {}).length >= 3).length).toBeGreaterThanOrEqual(12);
      }
      expect(new Set(ids(selected)).size).toBe(120);
    }
  });

  test('two conservative unresolved groups remain available without dominating the mixed-source long walk', () => {
    const photos = library(325).map((p, i) => ({ ...p,
      creator: i < 145 ? 'unresolved archived contributor' : i < 265 ? 'TokyoFashion' : p.creator,
      shoot: i < 145 ? 'archive unresolved group' : i < 265 ? 'TokyoFashion publisher group' : p.shoot,
      sourceLabel: i < 145 ? 'archive' : i < 265 ? 'TokyoFashion' : 'other references',
      dimensions: i < 265 ? p.dimensions : i % 2 ? undefined : { palette: ['warm colors'] },
    }));
    for (const selective of [false, true]) {
      let session = freshPhotoSession();
      const selected: Photo[] = [];
      for (let i = 0; i < 180; i++) {
        const p = nextPhoto(session, photos)!;
        selected.push(p);
        session = votePhoto(session, p.id, selective && p.sourceLabel === 'archive' ? 'wear' : 'unsure', photos);
      }
      for (let start = 0; start < 80; start += 40) {
        const part = selected.slice(start, start + 40);
        for (const source of ['archive', 'TokyoFashion']) {
          const count = part.filter(p => p.sourceLabel === source).length;
          expect(count).toBeGreaterThanOrEqual(3);
          expect(count).toBeLessThanOrEqual(15);
        }
        expect(part.filter(p => p.sourceLabel === 'other references').length).toBeGreaterThanOrEqual(10);
      }
      expect(new Set(ids(selected)).size).toBe(180);
      expect(selected.slice(80).some(p => p.sourceLabel === 'archive')).toBe(true);
      expect(selected.slice(80).some(p => p.sourceLabel === 'TokyoFashion')).toBe(true);
    }
  });

  test('actual mixed archive keeps original sparse references, sources and dimensions in exploration', () => {
    expect(PHOTOS.length).toBeGreaterThanOrEqual(287);
    const before = JSON.stringify(PHOTOS);
    for (const reaction of ['unsure', 'wear'] as const) {
      const selected = walk(PHOTOS, 120, reaction);
      const source = (p: Photo) => p.sourceLabel || new URL(p.sourceUrl).hostname;
      const first = selected.slice(0, 40), later = selected.slice(40, 80);
      const sparse = (ps: Photo[]) => ps.filter(p => !p.dimensions || Object.keys(p.dimensions).length === 0).length;
      console.info(`actual ${PHOTOS.length} ${reaction}: sparse ${sparse(first)}/${sparse(later)}, contributors ${new Set(first.map(p => p.creator)).size}, sources ${new Set(first.map(source)).size}`);
      expect(sparse(first)).toBeGreaterThanOrEqual(3);
      expect(sparse(later)).toBeGreaterThanOrEqual(2);
      expect(new Set(first.map(source)).size).toBeGreaterThanOrEqual(3);
      expect(new Set(first.map(p => p.creator)).size).toBeGreaterThanOrEqual(12);
      const unresolved = first.filter(p => /unresolved|archived contributor|flickr contributor/i.test(`${p.creator} ${p.shoot}`));
      expect(unresolved.length).toBeLessThanOrEqual(16);
      expect(new Set(selected.flatMap(p => p.dimensions?.silhouette || [])).size).toBeGreaterThanOrEqual(10);
      expect(new Set(ids(selected)).size).toBe(120);
    }
    expect(JSON.stringify(PHOTOS)).toBe(before);
  }, 15000);

  test('shared publisher labels never merge distinct people or change ranking', () => {
    const photos = mixedDensity(false), session = freshPhotoSession();
    const published = photos.map(p => ({ ...p, sourceLabel: 'One publisher, different contributors' }));
    expect(ids(walk(published, 80, 'unsure'))).toEqual(ids(walk(photos, 80, 'unsure')));
    expect(ids(photoQueue(session, published, 12))).toEqual(ids(photoQueue(session, photos, 12)));
  });

  test('shared pairs pool across differently annotated observations, not across separate outfits', () => {
    const { history, related, novel, session } = relatedFixture();
    session.votes[8].more = ['fitted'];
    novel.features = ['relaxed', 'fitted'];
    const extended = history.map((p, i) => i < 8 ? { ...p, dimensions: { ...p.dimensions, silhouette: ['roomy top', `extra shape ${i}`], palette: ['warm colors', `extra color ${i}`] } } : p);
    expect(nextPhoto(session, [...extended, related, novel])).toBe(related);
    const separated = extended.map((p, i) => i < 8 ? { ...p, dimensions: { ...p.dimensions, silhouette: i % 2 ? ['roomy top'] : [`different shape ${i}`], palette: i % 2 ? [`different color ${i}`] : ['warm colors'] } } : p);
    expect(nextPhoto(session, [...separated, related, novel])).toBe(novel);
    const concentrated = extended.map((p, i) => i < 8 ? { ...p, creator: 'shared unresolved contributor' } : p);
    expect(nextPhoto(session, [...concentrated, related, novel])).toBe(novel);
  });

  test('adding a neutral palette value retains shared outfit evidence under competing explicit feedback', () => {
    const { history, related, novel, session } = relatedFixture();
    session.votes[8].more = ['fitted'];
    novel.features = ['relaxed', 'fitted'];
    expect(nextPhoto(session, [...history, related, novel])).toBe(related);
    const extended = { ...related, dimensions: { ...related.dimensions, palette: ['warm colors', 'cream'] } };
    expect(nextPhoto(session, [...history, extended, novel])).toBe(extended);
  });
});

const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};

describe('bounded indexing and lookahead memoization', () => {
  test('frozen inputs and returned queue edits cannot corrupt cached candidates', () => {
    const photos = freeze(structuredClone(library(100)));
    const session = freeze({ ...freshPhotoSession(), votes: photos.slice(0, 40).map(p => vote(p, 'wear')), draft: { photoId: photos[70].id, note: 'draft', more: [], less: [] } } as PhotoSession);
    const queued = photoQueue(session, photos), expected = ids(queued);
    queued.reverse(); queued.pop();
    expect(ids(photoQueue(session, photos))).toEqual(expected);
    const clone = structuredClone(photos);
    const current = photoQueue(session, clone);
    expect(ids(current)).toEqual(expected);
    expect(current.every(p => clone.includes(p) && !photos.includes(p))).toBe(true);
    expect(photoQueue({ ...session, draft: { ...session.draft!, note: 'changed', more: ['bright'], less: ['minimal'] } }, photos).map(p => p.id)).toEqual(expected);
  });

  test('in-place changes to every indexed ranking field invalidate to the cold result', () => {
    const mutations: ((p: Photo) => void)[] = [
      p => { p.id = 'replaced-id'; }, p => { p.creator = 'contributor 2'; }, p => { p.shoot = 'shoot 2'; },
      p => { p.collection = 'unclassified'; }, p => { p.frame = 'unknown'; }, p => { p.family = 'soft'; },
      p => { p.features.splice(0, p.features.length, 'fitted'); }, p => { p.view = 'detail'; },
      p => { p.garments.push('boots'); }, p => { p.shoesKnown = false; }, p => { p.bottomKnown = false; },
      p => { p.dimensions!.palette!.push('cream'); }, p => { p.dimensions = undefined; },
    ];
    for (const mutate of mutations) {
      const photos = structuredClone(library(90));
      const session: PhotoSession = { ...freshPhotoSession(), exclusions: ['no-boots', 'no-skirts'], votes: photos.slice(0, 17).map(p => vote(p, 'wear')) };
      const chosen = photoQueue(session, photos)[0];
      mutate(chosen);
      const actual = ids(photoQueue(session, photos));
      expect(actual).toEqual(ids(photoQueue(structuredClone(session), structuredClone(photos))));
    }
    const { history, related, novel, session } = relatedFixture();
    const photos = [...history, related, novel];
    expect(photoQueue(session, photos)[0]).toBe(related);
    related.dimensions = structuredClone(novel.dimensions);
    expect(photoQueue(session, photos)[0]).toBe(novel);
  });

  test('votes, explicit feedback, filters, pinned IDs, input membership and ordering invalidate safely', () => {
    const { photos, session, related, novel } = relatedFixture();
    expect(photoQueue(session, photos)[0]).toBe(related);
    session.votes.forEach(v => { v.reaction = 'unsure'; });
    expect(photoQueue(session, photos)[0]).toBe(novel);
    session.votes[0].more.push('fitted'); related.features.push('fitted');
    expect(ids(photoQueue(session, photos))).toEqual(ids(photoQueue(structuredClone(session), structuredClone(photos))));
    for (const mutate of [
      (s: PhotoSession) => { s.collection = 'men'; }, (s: PhotoSession) => { s.frame = 'fuller'; },
      (s: PhotoSession) => { s.exclusions.push('no-heels'); }, (s: PhotoSession) => { s.votes.pop(); },
      (s: PhotoSession) => { s.votes[0].less.push('relaxed'); },
      (s: PhotoSession) => { s.draft = { photoId: related.id, note: '', more: [], less: [] }; },
    ]) {
      const current = structuredClone(session);
      photoQueue(current, photos); mutate(current);
      expect(ids(photoQueue(current, photos))).toEqual(ids(photoQueue(structuredClone(current), structuredClone(photos))));
    }
    photoQueue(session, photos); photos.pop();
    expect(photoQueue(session, photos).every(p => photos.includes(p))).toBe(true);
    photos.push(makePhoto(777));
    expect(ids(photoQueue(session, photos))).toEqual(ids(photoQueue(session, structuredClone(photos))));
    const before = ids(photoQueue(session, photos)); photos.reverse();
    expect(ids(photoQueue(session, photos))).toEqual(before);
  });

  test('shallow-frozen photos and accessor-backed dimensions are rechecked rather than trusted immutable', () => {
    for (const accessors of [false, true]) {
      const { photos, related, novel, session } = relatedFixture();
      let dimensions = related.dimensions;
      if (accessors) Object.defineProperty(related, 'dimensions', { get: () => dimensions, enumerable: true });
      Object.freeze(related);
      expect(photoQueue(session, photos)[0]).toBe(related);
      if (accessors) dimensions = novel.dimensions;
      else Object.assign(related.dimensions!, structuredClone(novel.dimensions));
      expect(photoQueue(session, photos)[0]).toBe(novel);
      expect(ids(photoQueue(session, photos))).toEqual(ids(photoQueue(structuredClone(session), structuredClone(photos))));
    }
  });

  test('frozen containers with mutable inherited dimension values are not immutable cache hits', () => {
    const { photos, related, novel, session } = relatedFixture();
    const inherited = structuredClone(related.dimensions!);
    related.dimensions = Object.freeze(Object.create(inherited));
    Object.freeze(related.features); Object.freeze(related.garments); Object.freeze(related);
    expect(photoQueue(session, photos)[0]).toBe(related);
    Object.assign(inherited, structuredClone(novel.dimensions));
    expect(photoQueue(session, photos)[0]).toBe(novel);
  });

  test('500 distinct dense annotations remain responsive without repeated-signature cache hits', () => {
    const photos = library(500).map((p, i) => ({ ...p, dimensions: Object.fromEntries(DIMENSION_KEYS.map(key => [key, Array.from({ length: 6 }, (_, j) => j === 5 ? `${key} unique ${i}` : `${key} shared ${(i + j) % 13}`)])) as PhotoDimensions }));
    const session: PhotoSession = { ...freshPhotoSession(), votes: photos.slice(0, 350).map((p, i) => vote(p, i % 3 === 0 ? 'wear' : i % 3 === 1 ? 'pass' : 'unsure')), draft: { photoId: photos[499].id, note: '', more: [], less: [] } };
    const start = performance.now(), result = photoQueue(session, photos), cold = performance.now() - start;
    expect(result).toHaveLength(3);
    expect(cold).toBeLessThan(300);
    const warmStart = performance.now();
    for (let i = 0; i < 12; i++) {
      session.draft!.note += 'edit';
      expect(photoQueue(session, photos)).toEqual(result);
    }
    const warm = performance.now() - warmStart;
    expect(warm).toBeLessThan(100);
    console.info(`distinct multi-value benchmark: 500 × 6, cold ${cold.toFixed(1)}ms, 12 mutable draft lookaheads ${warm.toFixed(1)}ms`);
  });

  for (const [count, values, budget] of [[500, 6, 250], [500, 12, 300], [2000, 6, 600]] as const) {
    test(`${count} photos × ${values} values per group: cold queue and twelve draft-only lookaheads stay responsive`, () => {
      const photos = freeze(library(count).map((p, i) => ({ ...p, creator: i < count * 0.6 ? 'shared unresolved contributor' : p.creator, dimensions: Object.fromEntries(DIMENSION_KEYS.map(key => [key, Array.from({ length: values }, (_, j) => `${key} detail ${(i + j * 3) % 31}`)])) as PhotoDimensions })));
      const session: PhotoSession = { ...freshPhotoSession(), votes: photos.slice(0, Math.floor(count * 0.7)).map((p, i) => vote(p, i % 3 === 0 ? 'wear' : i % 3 === 1 ? 'pass' : 'unsure')), draft: { photoId: photos[count - 1].id, note: '', more: [], less: [] } };
      const start = performance.now(), result = photoQueue(session, photos), cold = performance.now() - start;
      expect(result).toHaveLength(3);
      expect(result[0]).toBe(photos[count - 1]);
      expect(cold).toBeLessThan(budget);
      const warmStart = performance.now();
      for (let i = 0; i < 12; i++) {
        session.draft!.note += 'note'; session.draft!.more = i % 2 ? ['texture'] : ['bright'];
        expect(photoQueue(session, photos)).toEqual(result);
      }
      const warm = performance.now() - warmStart;
      expect(warm).toBeLessThan(count === 500 ? 100 : 300);
      console.info(`multi-value benchmark: ${count} × ${values}, cold ${cold.toFixed(1)}ms, 12 draft lookaheads ${warm.toFixed(1)}ms`);
    });
  }
});
