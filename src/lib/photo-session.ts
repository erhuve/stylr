import { z } from 'zod';
import { matchesBody } from './body-reference';
import { DIMENSION_KEYS, DIMENSION_PAIR_MASKS, nearIdenticalPhotos, normalizeDimensionPhrase, photoDimensionSignals, sharedDimensionGroups, type PhotoDimensionSignals } from './photo-dimensions';
import type { Feature, FeatureEvidence, Photo, PhotoFeedback, PhotoReaction, PhotoSession } from './photo-types';

export const PHOTO_KEY = 'stylr:photos:v2';
export const MAX_PHOTO_VOTES = 10_000;
export const MAX_PHOTO_SESSION_CHARS = 8 * 1024 * 1024;
export const FEATURE_LABELS: Record<Feature, string> = { relaxed: 'Loose silhouettes', fitted: 'Close-fitting pieces', layered: 'Layering', minimal: 'Simple combinations', pattern: 'Pattern', texture: 'Visible texture', bright: 'Brighter colors', muted: 'Muted colors', tailored: 'Tailoring', sporty: 'Sport styling', utility: 'Workwear details', romantic: 'Soft / romantic details', edgy: 'Sharper details', vintage: 'Vintage-inspired details' };
const features = Object.keys(FEATURE_LABELS) as Feature[];
const unique = <T,>(a: T[]) => new Set(a).size === a.length;
const feature = z.enum(features as [Feature, ...Feature[]]);
const featureList = z.array(feature).max(features.length).refine(unique);
const feedback = z.object({ photoId: z.string().max(80), note: z.string().max(600), more: featureList, less: featureList }).strict();
const disjoint = (v: PhotoFeedback) => !v.more.some(f => v.less.includes(f));
const schema = z.object({
  body: z.object({ build: z.number().min(1).max(3).nullable(), shoulderHip: z.number().min(-1).max(1).nullable(), waist: z.number().min(0).max(2).nullable(), mode: z.literal('nearby').optional() }).strict().refine(body => body.mode === 'nearby' ? [body.build, body.shoulderHip, body.waist].every(value => value !== null) : (body.build === null || Number.isInteger(body.build * 2)) && (body.shoulderHip === null || Number.isInteger(body.shoulderHip)) && (body.waist === null || Number.isInteger(body.waist))).optional(),
  version: z.literal(2), step: z.enum(['setup', 'discover', 'portrait']), sex: z.enum(['unspecified', 'female', 'male', 'intersex']),
  collection: z.enum(['all', 'women', 'men']), frame: z.enum(['all', 'smaller', 'mid', 'fuller']),
  votes: z.array(feedback.extend({ reaction: z.enum(['wear', 'admire', 'pass', 'unsure']) }).refine(disjoint)).max(MAX_PHOTO_VOTES).refine(v => unique(v.map(x => x.photoId))),
  draft: feedback.refine(disjoint).optional(), exclusions: z.array(z.enum(['no-skirts', 'no-shorts', 'no-heels', 'no-boots'])).max(4).refine(unique),
}).strict();
export function freshPhotoSession(): PhotoSession { return { version: 2, step: 'setup', sex: 'unspecified', collection: 'all', frame: 'all', votes: [], exclusions: [] }; }
export function parsePhotoSession(raw: string | null, photos: Photo[]): { session: PhotoSession; status: 'empty' | 'valid' | 'invalid' } {
  if (raw === null) return { session: freshPhotoSession(), status: 'empty' };
  try {
    if (raw.length > MAX_PHOTO_SESSION_CHARS) throw new Error('Too large');
    const s = schema.parse(JSON.parse(raw));
    const ids = new Set(photos.map(p => p.id));
    if (s.votes.some(v => !ids.has(v.photoId)) || (s.draft && (!ids.has(s.draft.photoId) || s.votes.some(v => v.photoId === s.draft!.photoId)))) throw new Error('Invalid reference');
    if (s.draft && !eligiblePhotos(s, photos).some(p => p.id === s.draft!.photoId)) throw new Error('Ineligible draft');
    return { session: s, status: 'valid' };
  } catch { return { session: freshPhotoSession(), status: 'invalid' }; }
}
export function eligiblePhotos(session: PhotoSession, photos: Photo[]): Photo[] {
  return photos.filter(p => matchesBody(p.id, session.body) && (session.collection === 'all' || p.collection === session.collection) && session.exclusions.every(x => {
    if (x === 'no-skirts') return p.bottomKnown && !p.garments.includes('skirt');
    if (x === 'no-shorts') return p.bottomKnown && !p.garments.includes('shorts');
    if (x === 'no-heels') return p.shoesKnown && !p.garments.includes('heels');
    return p.shoesKnown && !p.garments.includes('boots');
  }));
}
export function photoEvidence(session: PhotoSession, photos: Photo[]): FeatureEvidence[] {
  const byId = new Map(photos.map(p => [p.id, p]));
  return features.map(f => {
    const related = session.votes.filter(v => byId.get(v.photoId)?.features.includes(f) && v.reaction !== 'unsure');
    const seen = related.length, wear = related.filter(v => v.reaction === 'wear').length, admire = related.filter(v => v.reaction === 'admire').length, pass = related.filter(v => v.reaction === 'pass').length;
    const explicit = session.votes.reduce((sum, v) => sum + (v.more.includes(f) ? 1 : 0) - (v.less.includes(f) ? 1 : 0), 0);
    const shootVotes = new Map<string, number[]>();
    for (const v of related) {
      const shoot = byId.get(v.photoId)!.shoot;
      const list = shootVotes.get(shoot) || [];
      list.push(v.reaction === 'wear' ? 100 : v.reaction === 'admire' ? 30 : -50);
      shootVotes.set(shoot, list);
    }
    const means = [...shootVotes.values()].map(a => a.reduce((sum, n) => sum + n, 0) / a.length);
    const base = means.reduce((sum, n) => sum + n, 0) / (means.length + 2);
    return { feature: f, score: Math.round(base + explicit * 45), seen, wear, admire, pass, explicit };
  }).sort((a, b) => b.score - a.score || features.indexOf(a.feature) - features.indexOf(b.feature));
}
type IndexedPhoto = { photo: Photo; dimensions: PhotoDimensionSignals; dimensionKey: string; contributor: string; shoot: string; frame: string; features: Feature[] };
type Association = { wear: number; admire: number; pass: number };
type Associations = Map<string, Map<string, Association>>;
const bump = (counts: Map<string, number>, key: string) => counts.set(key, (counts.get(key) || 0) + 1);
const bounded = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

function associatedScore(groups: Map<string, Association>): number {
  let sum = 0;
  for (const group of groups.values()) sum += (group.wear + group.admire * 0.35 - group.pass * 0.5) / (group.wear + group.admire + group.pass);
  return sum / (groups.size + 2);
}

function signalRange(keys: readonly string[], scores: Map<string, number>): number {
  let positive = 0, negative = 0;
  for (const key of keys) {
    const score = scores.get(key) || 0;
    positive = Math.max(positive, score);
    negative = Math.min(negative, score);
  }
  return positive + negative;
}

function novelty(keys: readonly string[], counts: Map<string, number>): number {
  let best = 0;
  for (const key of keys) best = Math.max(best, 1 / Math.sqrt(1 + (counts.get(key) || 0)));
  return best;
}

function groupedNovelty(groups: readonly string[][], counts: Map<string, number>, uncertainty: number): number {
  const values = groups.filter(group => group.length).map(group => novelty(group, counts)).sort((a, b) => b - a);
  return ((values[0] ?? uncertainty) + (values[1] ?? uncertainty) * 0.5 + (values[2] ?? uncertainty) * 0.25) / 1.75;
}

const matchedPairs = Array.from({ length: 256 }, (_, mask) => DIMENSION_PAIR_MASKS.flatMap((pair, i) => (mask & pair) === pair ? [i] : []));
const coverageOf = (item: IndexedPhoto) => Math.min(3, item.dimensions.groups.filter(group => group.length).length);

const photoIndex = new WeakMap<Photo, { fingerprint: string; immutable: boolean; item: IndexedPhoto }>();
const frozenData = (value: object) => Object.isFrozen(value)
  && [null, Object.prototype, Array.prototype].includes(Object.getPrototypeOf(value))
  && Object.values(Object.getOwnPropertyDescriptors(value)).every(descriptor => 'value' in descriptor);
let lastIndex: IndexedPhoto[] = [];
let lastQueue: { index: IndexedPhoto[]; key: string; photos: Photo[] } | undefined;

function indexPhotos(photos: Photo[]): IndexedPhoto[] {
  const indexed = photos.map(photo => {
    const cached = photoIndex.get(photo);
    if (cached?.immutable) return cached.item;
    const fingerprint = JSON.stringify([
      photo.id, photo.creator, photo.shoot, photo.collection, photo.frame, photo.family, photo.features,
      photo.view, photo.garments, photo.shoesKnown, photo.bottomKnown,
      DIMENSION_KEYS.map(key => {
        const input = photo.dimensions?.[key];
        return Array.isArray(input) ? input.slice(0, 64).filter(value => typeof value === 'string' && value.length <= 160) : null;
      }),
    ]);
    if (cached?.fingerprint === fingerprint) return cached.item;
    const dimensions = photoDimensionSignals(photo);
    const item: IndexedPhoto = {
      photo, dimensions, dimensionKey: JSON.stringify(dimensions.groups),
      contributor: normalizeDimensionPhrase(photo.creator) || photo.id,
      shoot: normalizeDimensionPhrase(photo.shoot) || photo.id,
      frame: JSON.stringify([photo.collection, photo.frame]), features: [...new Set(photo.features)],
    };
    const immutable = frozenData(photo) && frozenData(photo.features) && frozenData(photo.garments)
      && (!photo.dimensions || (frozenData(photo.dimensions) && DIMENSION_KEYS.every(key => !Array.isArray(photo.dimensions![key]) || frozenData(photo.dimensions![key]!))));
    photoIndex.set(photo, { fingerprint, immutable, item });
    return item;
  });
  if (indexed.length !== lastIndex.length || indexed.some((item, i) => item !== lastIndex[i])) lastIndex = indexed;
  return lastIndex;
}

function createSequence(session: PhotoSession, photos: Photo[], indexed: IndexedPhoto[]) {
  const eligible = new Set(eligiblePhotos(session, photos).map(photo => photo.id));
  const byId = new Map(indexed.map(item => [item.photo.id, item]));
  const selected = new Set(session.votes.map(vote => vote.photoId));
  const families = new Map<string, number>(), collections = new Map<string, number>(), frames = new Map<string, number>();
  const contributors = new Map<string, number>();
  const featureCounts = new Map<string, number>(), dimensionCounts = new Map<string, number>();
  const featureAssociations: Associations = new Map(), dimensionAssociations: Associations = new Map();
  const coverageCounts = [0, 0, 0, 0], coveragePool = [0, 0, 0, 0];
  for (const item of indexed) if (eligible.has(item.photo.id)) coveragePool[coverageOf(item)]++;
  const hasDimensions = indexed.some(item => item.dimensions.mask);
  const postings = new Map<string, number[]>();
  const observed: { item: IndexedPhoto; contributor: string; weight?: number }[] = [];
  const combinationCache = new Map<string, { counts: Uint32Array; affinity?: number; observed: number }>();
  const contributorIds = new Map<string, number>();
  for (const item of indexed) if (!contributorIds.has(item.contributor)) contributorIds.set(item.contributor, contributorIds.size);
  const groupSums = new Float64Array(contributorIds.size * 28), groupCounts = new Uint32Array(groupSums.length), groupEpoch = new Float64Array(groupSums.length);
  let epoch = 0;
  const explicit = new Map<string, number>();
  const recent: IndexedPhoto[] = [];
  let exposures = 0;

  function observe(item: IndexedPhoto, reaction?: PhotoReaction) {
    const ordinal = observed.length;
    observed.push({ item, contributor: item.contributor, weight: reaction === 'wear' ? 1 : reaction === 'admire' ? 0.35 : reaction === 'pass' ? -0.5 : undefined });
    for (const group of item.dimensions.groups) for (const signal of group) {
      const list = postings.get(signal);
      if (list) list.push(ordinal); else postings.set(signal, [ordinal]);
    }
    if (eligible.has(item.photo.id)) coverageCounts[coverageOf(item)]++;
    exposures++;
    bump(families, item.photo.family); bump(collections, item.photo.collection); bump(frames, item.frame);
    bump(contributors, item.contributor);
    for (const feature of item.features) bump(featureCounts, feature);
    for (const group of item.dimensions.groups) for (const signal of group) bump(dimensionCounts, signal);
    recent.unshift(item);
    if (recent.length > 4) recent.pop();
  }

  function associate(keys: readonly string[], groups: Associations, item: IndexedPhoto, reaction: 'wear' | 'admire' | 'pass') {
    for (const key of keys) {
      let contributors = groups.get(key);
      if (!contributors) { contributors = new Map(); groups.set(key, contributors); }
      let counts = contributors.get(item.contributor);
      if (!counts) { counts = { wear: 0, admire: 0, pass: 0 }; contributors.set(item.contributor, counts); }
      counts[reaction]++;
    }
  }

  for (const vote of session.votes) {
    const item = byId.get(vote.photoId);
    if (!item) continue;
    observe(item, vote.reaction);
    for (const feature of vote.more) explicit.set(feature, (explicit.get(feature) || 0) + 45);
    for (const feature of vote.less) explicit.set(feature, (explicit.get(feature) || 0) - 45);
    if (vote.reaction === 'unsure') continue;
    associate(item.features, featureAssociations, item, vote.reaction);
    associate(item.dimensions.groups.flat(), dimensionAssociations, item, vote.reaction);
  }
  const scores = (associations: Associations) => new Map([...associations].map(([key, groups]) => [key, associatedScore(groups)]));
  const featureScores = scores(featureAssociations), dimensionScores = scores(dimensionAssociations);

  function combinations(item: IndexedPhoto, uncertainty: number, related: boolean): { fresh: number; affinity: number } {
    if (!item.dimensions.combinations.length) return { fresh: uncertainty, affinity: 0 };
    const cached = combinationCache.get(item.dimensionKey);
    if (cached && (!related || cached.affinity !== undefined)) {
      for (let ordinal = cached.observed; ordinal < observed.length; ordinal++) {
        for (const pair of matchedPairs[sharedDimensionGroups(item.dimensions, observed[ordinal].item.dimensions)]) cached.counts[pair]++;
      }
      cached.observed = observed.length;
      let fresh = 0;
      for (const pair of matchedPairs[item.dimensions.mask]) fresh = Math.max(fresh, 1 / Math.sqrt(1 + cached.counts[pair]));
      return { fresh, affinity: cached.affinity || 0 };
    }
    const masks = new Uint8Array(observed.length);
    for (let g = 0; g < item.dimensions.groups.length; g++) {
      for (const signal of item.dimensions.groups[g]) {
        for (const ordinal of postings.get(signal) || []) masks[ordinal] |= 1 << g;
      }
    }
    const counts = new Uint32Array(28), sums = new Float64Array(28), contributors = new Uint32Array(28), histogram = new Uint32Array(256);
    for (const mask of masks) histogram[mask]++;
    for (let mask = 0; mask < histogram.length; mask++) {
      if (histogram[mask]) for (const pair of matchedPairs[mask]) counts[pair] += histogram[mask];
    }
    epoch++;
    for (let ordinal = 0; related && ordinal < masks.length; ordinal++) {
      const pairs = matchedPairs[masks[ordinal]], observation = observed[ordinal];
      if (!pairs.length || observation.weight === undefined) continue;
      const offset = contributorIds.get(observation.contributor)! * 28;
      for (const pair of pairs) {
        const index = offset + pair;
        if (groupEpoch[index] !== epoch) {
          groupEpoch[index] = epoch; groupCounts[index] = 0; groupSums[index] = 0; contributors[pair]++;
        }
        if (groupCounts[index]) sums[pair] -= groupSums[index] / groupCounts[index];
        groupSums[index] += observation.weight; groupCounts[index]++;
        sums[pair] += groupSums[index] / groupCounts[index];
      }
    }
    let fresh = 0, positive = 0, negative = 0;
    for (const pair of matchedPairs[item.dimensions.mask]) {
      fresh = Math.max(fresh, 1 / Math.sqrt(1 + counts[pair]));
      const score = sums[pair] / (contributors[pair] + 2);
      positive = Math.max(positive, score); negative = Math.min(negative, score);
    }
    combinationCache.set(item.dimensionKey, { counts, affinity: related ? positive + negative : undefined, observed: observed.length });
    return { fresh, affinity: positive + negative };
  }

  function rank(item: IndexedPhoto): number {
    const p = item.photo, broad = exposures < 16;
    const related = !broad && (exposures - 16) % 3 === 1;
    const count = (counts: Map<string, number>, key: string) => counts.get(key) || 0;
    const variety = broad
      ? -count(families, p.family) * 60 - count(collections, p.collection) * 45 - count(frames, item.frame) * 25 - count(contributors, item.contributor) * 15
      : 32 / Math.sqrt(1 + count(families, p.family)) + 24 / Math.sqrt(1 + count(collections, p.collection)) + 16 / Math.sqrt(1 + count(frames, item.frame)) + 12 / Math.sqrt(1 + count(contributors, item.contributor));
    const coverage = coverageOf(item), uncertainty = hasDimensions ? 1 / Math.sqrt(1 + coverageCounts[coverage]) : 0;
    const combination = combinations(item, uncertainty, related);
    const fresh = novelty(item.features, featureCounts) * 14 + groupedNovelty(item.dimensions.groups, dimensionCounts, uncertainty) * (related ? 18 : 14) + combination.fresh * 10;
    const covered = coverageCounts.reduce((sum, value) => sum + value, 0);
    const coverageBalance = related || !hasDimensions ? 0 : bounded((covered * coveragePool[coverage] / Math.max(1, eligible.size) - coverageCounts[coverage]) * 3, 18);
    let repetition = 0;
    for (let i = 0; i < recent.length; i++) {
      const previous = recent[i], decay = 1 / (i + 1);
      const contributorPenalty = previous.contributor === item.contributor ? 130 : 0;
      const shootPenalty = previous.shoot === item.shoot ? 200 : 0;
      const lookPenalty = nearIdenticalPhotos(p, item.dimensions, previous.photo, previous.dimensions) ? (hasDimensions && !item.dimensions.mask && !previous.dimensions.mask ? 35 : 110) : 0;
      repetition = Math.max(repetition, Math.max(contributorPenalty, shootPenalty, lookPenalty) * decay);
    }
    // Outfit associations retrieve related references; they are not causal detail preferences.
    const association = signalRange(item.features, featureScores) * 0.2 + signalRange(item.dimensions.groups.flat(), dimensionScores) * 0.3 + combination.affinity * 0.5;
    const affinity = broad ? 0 : bounded(association * (related ? 110 : hasDimensions ? 0 : 4), related ? 65 : 3);
    const detail = bounded(signalRange(item.features, explicit), 90) * (broad ? 0.2 : 0.45);
    return variety + fresh + coverageBalance + affinity + detail - repetition + (session.frame === p.frame ? 18 : 0) + (p.view === 'full' ? 8 : 0);
  }

  return {
    take(pinned?: string): Photo | undefined {
      let best: IndexedPhoto | undefined, bestScore = -Infinity;
      const draft = pinned ? byId.get(pinned) : undefined;
      if (draft && eligible.has(draft.photo.id) && !selected.has(draft.photo.id)) best = draft;
      else for (const item of indexed) {
        if (!eligible.has(item.photo.id) || selected.has(item.photo.id)) continue;
        const score = rank(item);
        if (score > bestScore || (score === bestScore && (!best || item.photo.id < best.photo.id))) { best = item; bestScore = score; }
      }
      if (!best) return undefined;
      selected.add(best.photo.id);
      observe(best);
      return best.photo;
    },
  };
}

export function photoQueue(session: PhotoSession, photos: Photo[], limit = 3): Photo[] {
  if (!Number.isFinite(limit) || limit <= 0) return [];
  const size = Math.min(12, Math.floor(limit));
  if (!size) return [];
  if (size === 1 && session.draft && !session.votes.some(vote => vote.photoId === session.draft!.photoId)) {
    const pinned = photos.find(photo => photo.id === session.draft!.photoId);
    if (pinned && eligiblePhotos(session, [pinned]).length) return [pinned];
  }
  const index = indexPhotos(photos);
  const key = JSON.stringify([size, session.body, session.collection, session.frame, session.exclusions, session.draft?.photoId, session.votes.map(vote => [vote.photoId, vote.reaction, vote.more, vote.less])]);
  if (lastQueue?.index === index && lastQueue.key === key) return lastQueue.photos.slice();
  const sequence = createSequence(session, photos, index), queue: Photo[] = [];
  for (let i = 0; i < size; i++) {
    const photo = sequence.take(i === 0 ? session.draft?.photoId : undefined);
    if (!photo) break;
    queue.push(photo);
  }
  lastQueue = { index, key, photos: queue.slice() };
  return queue;
}

export function nextPhoto(session: PhotoSession, photos: Photo[]): Photo | undefined {
  return photoQueue(session, photos, 1)[0];
}
export function votePhoto(session: PhotoSession, id: string, reaction: PhotoReaction, photos: Photo[]): PhotoSession {
  if (!['wear', 'admire', 'pass', 'unsure'].includes(reaction) || nextPhoto(session, photos)?.id !== id || session.votes.some(v => v.photoId === id)) return session;
  const draft = session.draft?.photoId === id ? session.draft : { photoId: id, note: '', more: [], less: [] };
  const { draft: _, ...rest } = session;
  const next: PhotoSession = { ...rest, votes: [...session.votes, { ...draft, reaction }] };
  const p = nextPhoto(next, photos);
  if (p) next.draft = { photoId: p.id, note: '', more: [], less: [] };
  return next;
}
export function undoPhoto(session: PhotoSession, photos: Photo[]): PhotoSession {
  const last = session.votes.at(-1);
  if (!last || !eligiblePhotos(session, photos).some(p => p.id === last.photoId)) return session;
  const { reaction: _, ...draft } = last;
  return { ...session, votes: session.votes.slice(0, -1), draft, step: 'discover' };
}
export function photoMatches(session: PhotoSession, photos: Photo[]): Photo[] {
  const eligible = eligiblePhotos(session, photos);
  const map = new Map(session.votes.map(v => [v.photoId, v]));
  const worn = eligible.filter(p => map.get(p.id)?.reaction === 'wear');
  const hasWear = session.votes.some(v => v.reaction === 'wear');
  if (!hasWear) return worn;
  const signals = photoEvidence(session, photos).filter(e => e.score < 0 || (e.score > 10 && (e.wear >= 2 || e.explicit > 0)));
  const score = (p: Photo) => signals.reduce((sum, e) => sum + (p.features.includes(e.feature) ? e.score : 0), 0) / p.features.length;
  return [...worn, ...eligible.filter(p => !map.has(p.id) && score(p) > 0).sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id)).slice(0, 6)];
}
const escape = (s: string) => s.replace(/[&<>"'`\\\[\]()*_#~|!]/g, c => `&#${c.charCodeAt(0)};`);
export function photoNotes(session: PhotoSession, photos: Photo[]): string {
  const byId = new Map(photos.map(p => [p.id, p]));
  return ['# Your Stylr photo study', '', `Clothing range: ${session.collection}. Body reference: ${session.frame}.`, 'Sex is optional, self-reported and not a style-scoring input. All study data remains in this browser.', '', '## Emerging preferences', ...photoEvidence(session, photos).filter(e => e.seen || e.explicit).map(e => `- ${FEATURE_LABELS[e.feature]}: ${e.wear} wear, ${e.admire} admire, ${e.pass} not for me; ${e.explicit} net explicit requests.`), '', 'These are provisional associations from a small curated catalog, not isolated causal preferences or a fit prediction.', '', '## Reactions and sources', ...session.votes.flatMap(v => { const p = byId.get(v.photoId); return p ? [`### ${escape(p.title)} — ${v.reaction}`, escape(v.note), `More: ${v.more.map(f => FEATURE_LABELS[f]).join(', ') || '—'}. Less: ${v.less.map(f => FEATURE_LABELS[f]).join(', ') || '—'}.`, `Photo: ${escape(p.creator)} — ${p.sourceUrl}`, ''] : []; }), ...(session.draft ? ['## Unfinished note', escape(session.draft.note), `More: ${session.draft.more.join(', ')}; Less: ${session.draft.less.join(', ')}`] : [])].join('\n');
}
