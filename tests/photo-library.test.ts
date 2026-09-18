import { expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { LEGACY_PHOTOS, PHOTOS } from '../src/lib/photo-catalog';
import { DIMENSION_KEYS } from '../src/lib/photo-dimensions';
import { FEATURE_LABELS, nextPhoto, parsePhotoSession, photoQueue, votePhoto } from '../src/lib/photo-session';
import type { Feature, PhotoSession } from '../src/lib/photo-types';
import identities from './fixtures/photo-original-identity.json' with { type: 'json' };
import legacySession from './fixtures/photo-v2-original-session.json' with { type: 'json' };
import originalAssets from '../scripts/photo-assets.json' with { type: 'json' };
import archiveAssets from '../scripts/fashionpedia-assets.json' with { type: 'json' };
import streetAssets from '../scripts/streetstyle-assets.json' with { type: 'json' };
import reviewedAssets from '../scripts/reviewed-assets.json' with { type: 'json' };

const features = Object.keys(FEATURE_LABELS) as [Feature, ...Feature[]];
const url = z.string().url().refine(value => new URL(value).protocol === 'https:' && !new URL(value).username && !new URL(value).password);
const strings = z.array(z.string().min(1).max(160)).max(12).refine(values => new Set(values).size === values.length);
const photo = z.object({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/).max(80),
  title: z.string().min(3).max(180), description: z.string().min(8).max(1000),
  src: z.string().regex(/^\/photos\/[A-Za-z0-9][A-Za-z0-9_-]*\.webp$/),
  sourceUrl: url, creatorUrl: url, licenseUrl: url, creator: z.string().min(1),
  collection: z.enum(['men', 'women', 'unclassified']), frame: z.enum(['smaller', 'mid', 'fuller', 'unknown']),
  features: z.array(z.enum(features)).refine(values => new Set(values).size === values.length),
  family: z.enum(['everyday', 'tailoring', 'sport', 'utility', 'expressive', 'soft', 'unknown']),
  shoot: z.string().min(1), view: z.enum(['full', 'detail']),
  garments: z.array(z.enum(['skirt', 'shorts', 'heels', 'boots'])).refine(values => new Set(values).size === values.length),
  shoesKnown: z.boolean(), bottomKnown: z.boolean(),
  dimensions: z.object(Object.fromEntries(DIMENSION_KEYS.map(key => [key, strings.optional()]))).strict().optional(),
  sourceLabel: z.string().min(1).optional(), metadataBasis: z.enum(['visual-review', 'source-description', 'legacy-tags']).optional(),
}).strict();
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('expanded library has 7510 distinct, source-linked and schema-valid references', () => {
  expect(PHOTOS).toHaveLength(7510);
  expect(LEGACY_PHOTOS).toHaveLength(42);
  expect(PHOTOS.filter(p => p.id.startsWith('archive-'))).toHaveLength(237);
  expect(PHOTOS.filter(p => p.id.startsWith('street-'))).toHaveLength(106);
  for (const p of PHOTOS) expect(photo.safeParse(p).success, p.id).toBe(true);
  expect(new Set(PHOTOS.map(p => p.id)).size).toBe(PHOTOS.length);
  expect(new Set(PHOTOS.map(p => p.src)).size).toBe(PHOTOS.length);
  expect(PHOTOS.filter(p => p.view === 'full').length).toBeGreaterThan(350);
});

test('every admitted photo has exactly one portable asset record and a unique local file', async () => {
  const assets = [...originalAssets, ...archiveAssets, ...streetAssets, ...reviewedAssets];
  expect(assets).toHaveLength(PHOTOS.length);
  expect(new Set(assets.map(a => a.id))).toEqual(new Set(PHOTOS.map(p => p.id)));
  const hashes = new Set<string>();
  for (const p of PHOTOS) {
    const bytes = new Uint8Array(await Bun.file(`public${p.src}`).arrayBuffer());
    expect(new TextDecoder().decode(bytes.slice(8, 12)), p.id).toBe('WEBP');
    const digest = hash(bytes);
    expect(hashes.has(digest), `Duplicate asset ${p.id}`).toBe(false);
    hashes.add(digest);
  }
  for (const asset of archiveAssets) {
    expect(asset.archive.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(asset.archive.member).toMatch(/^test\/[a-f0-9]+\.jpg$/);
    expect(asset.archive.url).toBe('https://s3.amazonaws.com/ifashionist-dataset/images/val_test2020.zip');
  }
});

test('all original photo IDs, source links and visual identities remain unchanged from fixed baseline', () => {
  expect(identities).toHaveLength(42);
  expect(LEGACY_PHOTOS.map(p => p.id)).toEqual(identities.map(p => p.id));
  for (const old of identities) {
    expect(PHOTOS.find(p => p.id === old.id)).toMatchObject({ src: old.src, sourceUrl: old.sourceUrl });
  }
  const result = Bun.spawnSync(['python', 'scripts/check-original-photos.py']);
  expect(result.exitCode, new TextDecoder().decode(result.stderr)).toBe(0);
});

test('independent pre-expansion v2 fixture preserves exact history, unfinished note and next card', () => {
  const expected = legacySession as PhotoSession;
  const parsed = parsePhotoSession(JSON.stringify(legacySession), PHOTOS);
  expect(parsed.status).toBe('valid');
  expect(parsed.session).toEqual(expected);
  expect(nextPhoto(parsed.session, PHOTOS)?.id).toBe(expected.draft!.photoId);
  const result = votePhoto(parsed.session, expected.draft!.photoId, 'unsure', PHOTOS);
  expect(result.votes.at(-1)).toEqual({ ...expected.draft!, reaction: 'unsure' });
  expect(result.votes.slice(0, 2)).toEqual(expected.votes);
  expect(parsePhotoSession(JSON.stringify(result), PHOTOS).status).toBe('valid');
});

test('all eight dimensions have real coverage; comfort does not invent fabric performance', () => {
  for (const dimension of DIMENSION_KEYS) expect(PHOTOS.filter(p => p.dimensions?.[dimension]?.length).length, dimension).toBeGreaterThan(20);
  const comfort = PHOTOS.flatMap(p => p.dimensions?.comfort || []);
  expect(comfort.length).toBeGreaterThan(80);
  expect(comfort.some(value => /flat/.test(value))).toBe(true);
  expect(comfort.some(value => /roomy/.test(value))).toBe(true);
  expect(comfort.some(value => /breathable|waterproof|stretch|soft fabric|comfortable|fits/.test(value))).toBe(false);
});

test('reading a candidate queue never changes the fixed legacy session', () => {
  const session = JSON.parse(JSON.stringify(legacySession)) as PhotoSession;
  const before = JSON.stringify(session);
  const queue = photoQueue(session, PHOTOS, 3);
  expect(queue).toHaveLength(3);
  expect(queue[0].id).toBe(session.draft!.photoId);
  expect(JSON.stringify(session)).toBe(before);
});
