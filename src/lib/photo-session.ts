import { z } from 'zod';
import type { Feature, FeatureEvidence, Photo, PhotoFeedback, PhotoReaction, PhotoSession } from './photo-types';

export const PHOTO_KEY = 'stylr:photos:v2';
export const FEATURE_LABELS: Record<Feature, string> = { relaxed: 'Loose silhouettes', fitted: 'Close-fitting pieces', layered: 'Layering', minimal: 'Simple combinations', pattern: 'Pattern', texture: 'Visible texture', bright: 'Brighter colors', muted: 'Muted colors', tailored: 'Tailoring', sporty: 'Sport styling', utility: 'Workwear details', romantic: 'Soft / romantic details', edgy: 'Sharper details', vintage: 'Vintage-inspired details' };
const features = Object.keys(FEATURE_LABELS) as Feature[];
const unique = <T,>(a: T[]) => new Set(a).size === a.length;
const feature = z.enum(features as [Feature, ...Feature[]]);
const featureList = z.array(feature).max(features.length).refine(unique);
const feedback = z.object({ photoId: z.string().max(80), note: z.string().max(600), more: featureList, less: featureList }).strict();
const disjoint = (v: PhotoFeedback) => !v.more.some(f => v.less.includes(f));
const schema = z.object({
  version: z.literal(2), step: z.enum(['setup', 'discover', 'portrait']), sex: z.enum(['unspecified', 'female', 'male', 'intersex']),
  collection: z.enum(['all', 'women', 'men']), frame: z.enum(['all', 'smaller', 'mid', 'fuller']),
  votes: z.array(feedback.extend({ reaction: z.enum(['wear', 'admire', 'pass', 'unsure']) }).refine(disjoint)).max(1000).refine(v => unique(v.map(x => x.photoId))),
  draft: feedback.refine(disjoint).optional(), exclusions: z.array(z.enum(['no-skirts', 'no-shorts', 'no-heels', 'no-boots'])).max(4).refine(unique),
}).strict();
export function freshPhotoSession(): PhotoSession { return { version: 2, step: 'setup', sex: 'unspecified', collection: 'all', frame: 'all', votes: [], exclusions: [] }; }
export function parsePhotoSession(raw: string | null, photos: Photo[]): { session: PhotoSession; status: 'empty' | 'valid' | 'invalid' } {
  if (raw === null) return { session: freshPhotoSession(), status: 'empty' };
  try {
    if (raw.length > 256000) throw new Error('Too large');
    const s = schema.parse(JSON.parse(raw));
    const ids = new Set(photos.map(p => p.id));
    if (s.votes.some(v => !ids.has(v.photoId)) || (s.draft && (!ids.has(s.draft.photoId) || s.votes.some(v => v.photoId === s.draft!.photoId)))) throw new Error('Invalid reference');
    if (s.draft && !eligiblePhotos(s, photos).some(p => p.id === s.draft!.photoId)) throw new Error('Ineligible draft');
    return { session: s, status: 'valid' };
  } catch { return { session: freshPhotoSession(), status: 'invalid' }; }
}
export function eligiblePhotos(session: PhotoSession, photos: Photo[]): Photo[] {
  return photos.filter(p => (session.collection === 'all' || p.collection === session.collection) && session.exclusions.every(x => {
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
export function nextPhoto(session: PhotoSession, photos: Photo[]): Photo | undefined {
  const eligible = eligiblePhotos(session, photos);
  const voted = new Set(session.votes.map(v => v.photoId));
  const remaining = eligible.filter(p => !voted.has(p.id));
  const pinned = remaining.find(p => p.id === session.draft?.photoId);
  if (pinned) return pinned;
  const byId = new Map(photos.map(p => [p.id, p]));
  const seen = session.votes.map(v => byId.get(v.photoId)).filter((p): p is Photo => !!p);
  const last = seen.at(-1);
  const evidence = new Map(photoEvidence(session, photos).map(e => [e.feature, e.score]));
  const rank = (p: Photo) => {
    const nFamily = seen.filter(s => s.family === p.family).length;
    const nCollection = seen.filter(s => s.collection === p.collection).length;
    const nFrame = seen.filter(s => s.frame === p.frame && s.collection === p.collection).length;
    const nShoot = seen.filter(s => s.shoot === p.shoot).length;
    const exposure = p.features.reduce((sum, f) => sum + seen.filter(s => s.features.includes(f)).length, 0) / p.features.length;
    const affinity = session.votes.length >= 16 ? Math.max(-20, Math.min(20, p.features.reduce((sum, f) => sum + (evidence.get(f) || 0), 0) / p.features.length)) : 0;
    return -nFamily * 60 - nCollection * 45 - nFrame * 25 - nShoot * 15 - exposure * 8 + (last?.shoot === p.shoot ? -200 : 0) + (session.frame === p.frame ? 30 : 0) + (p.view === 'full' ? 12 : 0) + affinity;
  };
  return [...remaining].sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id))[0];
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
