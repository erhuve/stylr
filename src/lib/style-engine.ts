import { z } from 'zod';
import { DIRECTIONS, LOOKS, TRAITS } from './looks';
import type { Body, Constraint, Direction, DirectionScore, Draft, FavoriteLook, Look, Reaction, Session, SessionLoadResult, StylePortrait, Trait, Vote } from './style-types';

export type { Constraint, DirectionScore, Draft, FavoriteLook, SessionIssue, SessionLoadResult, StylePortrait } from './style-types';
export const ROUND_SIZE = 12;
export const MAX_NOTE_LENGTH = 600;
export const MAX_SESSION_BYTES = 128 * 1024;
export const SKINS = ['#f1d7bf', '#dfb996', '#c99371', '#a87050', '#845638', '#593d2c'] as const;
export const DEFAULT_BODY: Body = { shoulders: 50, chest: 45, waist: 40, hips: 50, torso: 50, skin: SKINS[1], hair: 'bob' };
export const STORAGE_KEY = 'style-study:v1';
export const CONSTRAINT_LABELS: Record<Constraint, string> = { 'no-heels': 'No heels', 'no-skirts': 'No skirts', 'no-shorts': 'No shorts', 'no-boots': 'No boots' };

const recoveredSkins = [...SKINS, '#f1d4bd', '#dfb394', '#bd8f73', '#b27b59', '#946344', '#754a36', '#563829', '#3d2a24'] as const;
const lookById = new Map(LOOKS.map(look => [look.id, look]));
const directionOrder = Object.keys(DIRECTIONS) as Direction[];
const traitOrder = Object.keys(TRAITS) as Trait[];
const strength: Record<Reaction, number> = { wear: 100, admire: 65, pass: -55, unsure: 0 };
const unique = <T,>(values: T[]) => new Set(values).size === values.length;
const traitSchema = z.enum(['relaxed', 'fitted', 'layers', 'texture', 'neutral', 'color', 'detail', 'structure']);
const reactionSchema = z.enum(['wear', 'admire', 'pass', 'unsure']);
const constraintSchema = z.enum(['no-heels', 'no-skirts', 'no-shorts', 'no-boots']);
const exclusionSchema = z.array(constraintSchema).max(4).refine(unique, 'Duplicate exclusions');
const traitList = z.array(traitSchema).max(traitOrder.length).refine(unique, 'Duplicate traits');
const feedbackShape = { lookId: z.string().max(32).refine(id => lookById.has(id), 'Unknown look'), note: z.string().max(MAX_NOTE_LENGTH), more: traitList, less: traitList };
const disjoint = (feedback: { more: Trait[]; less: Trait[] }) => !feedback.more.some(value => feedback.less.includes(value));
const draftSchema = z.object(feedbackShape).strict().refine(disjoint, 'Overlapping more/less traits');
const voteSchema = z.object({ ...feedbackShape, reaction: reactionSchema }).strict().refine(disjoint, 'Overlapping more/less traits');
const votesSchema = z.array(voteSchema).max(LOOKS.length).refine(votes => unique(votes.map(vote => vote.lookId)), 'Duplicate look votes');
const measure = z.number().finite().min(0).max(100);
const sessionSchema = z.object({
  version: z.literal(1),
  body: z.object({ shoulders: measure, chest: measure, waist: measure, hips: measure, torso: measure, skin: z.enum(recoveredSkins), hair: z.enum(['bob', 'long', 'crop']) }).strict(),
  votes: votesSchema,
  step: z.enum(['model', 'discover', 'portrait']),
  budget: z.enum(['any', '50', '100', '200']),
  exclusions: exclusionSchema.default([]),
  draft: draftSchema.optional(),
}).strict();

export function freshSession(): Session {
  return { version: 1, body: { ...DEFAULT_BODY }, votes: [], step: 'model', budget: 'any', exclusions: [] };
}

function normalizeSession(session: Session): Session {
  const { draft, ...rest } = session;
  return {
    ...rest,
    step: session.step === 'portrait' && session.votes.length < 6 ? (session.votes.length ? 'discover' : 'model')
      : session.step === 'discover' && session.votes.length === LOOKS.length ? 'portrait' : session.step,
    ...(draft && !session.votes.some(vote => vote.lookId === draft.lookId) ? { draft } : {}),
  };
}

export function loadSession(raw: string | null): SessionLoadResult {
  if (raw === null) return { session: freshSession(), issue: null };
  try {
    if (typeof raw !== 'string' || raw.length > MAX_SESSION_BYTES || new TextEncoder().encode(raw).length > MAX_SESSION_BYTES) {
      return { session: freshSession(), issue: 'invalid' };
    }
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === 'object' && !Array.isArray(value) && 'version' in value
      && typeof value.version === 'number' && Number.isSafeInteger(value.version) && value.version >= 0 && value.version !== 1) {
      return { session: freshSession(), issue: 'unsupported' };
    }
    const result = sessionSchema.safeParse(value);
    return result.success ? { session: normalizeSession(result.data), issue: null } : { session: freshSession(), issue: 'invalid' };
  } catch {
    return { session: freshSession(), issue: 'invalid' };
  }
}

export function parseSession(raw: string | null): { session: Session; status: 'empty' | 'valid' | 'invalid' } {
  const result = loadSession(raw);
  return { session: result.session, status: raw === null ? 'empty' : result.issue ? 'invalid' : 'valid' };
}

export function readSession(raw: string | null): Session {
  return loadSession(raw).session;
}

function validVotes(votes: Vote[]): Vote[] {
  const result = votesSchema.safeParse(votes);
  return result.success ? result.data : [];
}

export function permits(look: Look, exclusions: Constraint[] = []): boolean {
  const rules = exclusionSchema.safeParse(exclusions);
  return rules.success && rules.data.every(rule => {
    switch (rule) {
      case 'no-heels': return look.shoes !== 'heels';
      case 'no-skirts': return look.bottom !== 'skirt' && look.bottom !== 'pleated';
      case 'no-shorts': return look.bottom !== 'shorts';
      case 'no-boots': return look.shoes !== 'boots';
    }
  });
}

export function traitScores(votes: Vote[]): Record<Trait, number> {
  const scores = Object.fromEntries(traitOrder.map(trait => [trait, 0])) as Record<Trait, number>;
  for (const vote of validVotes(votes)) {
    const look = lookById.get(vote.lookId)!;
    for (const trait of look.traits) scores[trait] += strength[vote.reaction];
    for (const trait of vote.more) scores[trait] += 150;
    for (const trait of vote.less) scores[trait] -= 180;
  }
  for (const trait of traitOrder) scores[trait] /= 100;
  return scores;
}

export function directionScores(votes: Vote[]): DirectionScore[] {
  const votesToScore = validVotes(votes);
  return directionOrder.map(direction => {
    const relevant = votesToScore.filter(vote => lookById.get(vote.lookId)!.direction === direction);
    return {
      direction,
      liked: relevant.filter(vote => vote.reaction === 'wear' || vote.reaction === 'admire').length,
      seen: relevant.length,
      score: relevant.reduce((sum, vote) => sum + strength[vote.reaction], 0) / (100 * Math.max(1, relevant.length)),
    };
  }).sort((a, b) => b.score - a.score || b.liked - a.liked || directionOrder.indexOf(a.direction) - directionOrder.indexOf(b.direction));
}

export function nextLook(votes: Vote[], preferred?: string): Look | undefined {
  const clean = validVotes(votes);
  const seen = new Set(clean.map(vote => vote.lookId));
  const remaining = LOOKS.filter(look => !seen.has(look.id));
  const preferredLook = remaining.find(look => look.id === preferred);
  if (preferredLook) return preferredLook;
  const directions = directionScores(clean);
  const exposure = (look: Look) => directions.find(entry => entry.direction === look.direction)!.seen;
  if (clean.length < 6 || clean.length % 3 === 0) return remaining.sort((a, b) => exposure(a) - exposure(b))[0];
  const scores = traitScores(clean);
  const affinity = (look: Look) => look.traits.reduce((sum, trait) => sum + scores[trait], 0);
  return remaining.sort((a, b) => affinity(b) - affinity(a))[0];
}

export function recordVote(session: Session, expectedLookId: string, reaction: Reaction): Session {
  if (session.step !== 'discover' || !reactionSchema.safeParse(reaction).success) return session;
  const result = sessionSchema.safeParse(session);
  if (!result.success) return session;
  const current = result.data;
  if (current.draft && current.votes.some(vote => vote.lookId === current.draft?.lookId)) return session;
  const look = nextLook(current.votes, current.draft?.lookId);
  if (!look || look.id !== expectedLookId || current.votes.some(vote => vote.lookId === expectedLookId)) return session;
  const feedback: Draft = current.draft ?? { lookId: look.id, note: '', more: [], less: [] };
  const votes: Vote[] = [...current.votes, { ...feedback, reaction, more: [...feedback.more], less: [...feedback.less] }];
  const { draft: _draft, ...rest } = current;
  return { ...rest, votes, step: votes.length === LOOKS.length ? 'portrait' : 'discover' };
}

export function undoSession(session: Session): Session {
  const result = sessionSchema.safeParse(session);
  if (!result.success || !result.data.votes.length) return session;
  const current = result.data;
  const last = current.votes.at(-1)!;
  return { ...current, votes: current.votes.slice(0, -1), step: 'discover', draft: { lookId: last.lookId, note: last.note, more: [...last.more], less: [...last.less] } };
}

export function favoriteLooks(votes: Vote[]): FavoriteLook[] {
  return validVotes(votes).filter(vote => vote.reaction === 'wear' || vote.reaction === 'admire').map(vote => ({ look: lookById.get(vote.lookId)!, vote }));
}

export function portrait(votes: Vote[]): StylePortrait {
  const clean = validVotes(votes);
  const favorite = favoriteLooks(clean);
  const ranked = favorite.length ? directionScores(clean).filter(entry => entry.liked > 0 && entry.score > 0) : [];
  const ambiguous = ranked.length > 2 && ranked[1].score === ranked[2].score && ranked[1].liked === ranked[2].liked;
  const top = ambiguous ? [] : ranked.slice(0, 2);
  const words = top.map(entry => DIRECTIONS[entry.direction].short.toLowerCase());
  const heading = !favorite.length ? 'Still looking for your spark.' : !ranked.length ? 'You like the exceptions.'
    : ambiguous ? 'More than one direction.' : `Drawn to ${words.join(' and ')} — for now.`;
  const summary = !favorite.length
    ? 'Nothing has felt right yet. Passes and uncertainty do not define your style; there is no reason to force a label.'
    : !ranked.length ? 'Your likes are scattered across different directions. Start with the specific pieces you saved rather than a single aesthetic.'
    : ambiguous ? 'Your positive reactions span several directions without a clear leading pair. Keep the specific pieces you like rather than forcing a single aesthetic.'
    : `${top.map(entry => DIRECTIONS[entry.direction].description).join(' ')} These are possible interests, not a fixed identity.`;
  const scores = traitScores(clean);
  const traits = favorite.length ? traitOrder.filter(trait => scores[trait] > 0).sort((a, b) => scores[b] - scores[a]).slice(0, 4) : [];
  return { heading, summary, traits, ranked, favorite, wearable: favorite.filter(entry => entry.vote.reaction === 'wear'), formulas: top.map(entry => DIRECTIONS[entry.direction].formula), provisional: favorite.length < 3 || clean.length < ROUND_SIZE || !top.length };
}

export function recommendations(votes: Vote[], exclusions: Constraint[] = []): Look[] {
  if (!exclusionSchema.safeParse(exclusions).success) return [];
  const wearable = validVotes(votes).filter(vote => vote.reaction === 'wear');
  const scores = traitScores(wearable);
  const ids = new Set(wearable.map(vote => vote.lookId));
  const affinity = (look: Look) => look.traits.reduce((sum, trait) => sum + scores[trait], 0);
  return LOOKS.filter(look => ids.has(look.id) && permits(look, exclusions)).sort((a, b) => affinity(b) - affinity(a)).slice(0, 4);
}

export function shoppingUrl(piece: string, budget: Session['budget']): string {
  const suffix = budget === '50' || budget === '100' || budget === '200' ? ` under $${budget}` : '';
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent((piece + suffix).toWellFormed())}`;
}

export function escapeMarkdown(value: string): string {
  return value.replace(/[!-/:-@\[-`{-~]/g, character => {
    if (character === '&') return '&amp;';
    if (character === '<') return '&lt;';
    if (character === '>') return '&gt;';
    return `\\${character}`;
  }).replace(/(^|[\r\n])([ \t]+)/g, (_, start: string, whitespace: string) => start + whitespace.replace(/ /g, '&#32;').replace(/\t/g, '&#9;'));
}

const reactionLabels: Record<Reaction, string> = { wear: 'I would wear it', admire: 'inspiration only, not a shopping choice', pass: 'Not my thing', unsure: 'Not decided' };

function feedbackMarkdown(feedback: Draft): string[] {
  return [
    `More: ${feedback.more.length ? feedback.more.map(trait => TRAITS[trait]).join(', ') : 'None selected.'}`,
    `Less: ${feedback.less.length ? feedback.less.map(trait => TRAITS[trait]).join(', ') : 'None selected.'}`,
    'Note:', '', feedback.note.length ? escapeMarkdown(feedback.note) : 'No written note.', '',
  ];
}

export function notesMarkdown(session: Session): string {
  const p = portrait(session.votes);
  const exclusions = session.exclusions ?? [];
  const suggestions = recommendations(session.votes, exclusions);
  return [
    '# Your style study', '', p.heading, '', p.summary, '',
    `${p.provisional ? 'Provisional:' : 'Working portrait:'} ${session.votes.length} of ${LOOKS.length} reactions. A starting point, not a verdict.`, '',
    '## Illustration settings', '',
    ...(['shoulders', 'chest', 'waist', 'hips', 'torso', 'skin', 'hair'] as const).map(key => `- ${key}: ${escapeMarkdown(String(session.body[key]))}`), '',
    'Illustrative proportions, not measurements and not a fit prediction.', '',
    '## The threads', '', ...(p.traits.length ? p.traits.map(trait => `- ${TRAITS[trait]}`) : ['No positive style pattern established.']), '',
    '## Inspiration formulas', '',
    'Admired looks and formulas are inspiration only, not a claim that you would wear them. Exclusions apply to shopping, not your portrait.',
    ...(p.formulas.length ? p.formulas.map(formula => `- ${escapeMarkdown(formula)}`) : ['No formula inferred yet.']), '',
    '## Shopping exclusions', '',
    ...(exclusions.length ? exclusions.map(rule => `- ${CONSTRAINT_LABELS[rule]}`) : ['No exclusions selected.']), '',
    session.budget === 'any' ? 'Budget: No price limit selected.' : `Budget: Under $${escapeMarkdown(session.budget)} per item`,
    'Only explicit exclusions filter shopping suggestions. Written notes are not interpreted as exclusions.', '',
    '## Wearable starting points', '',
    ...(suggestions.length ? suggestions.flatMap(look => [
      `### ${escapeMarkdown(look.name)}`, ...look.pieces.map(piece => `- [${escapeMarkdown(piece)}](${shoppingUrl(piece, session.budget)})`), '',
    ]) : ['No eligible looks marked wear. Admired, passed, undecided and unseen looks are not shopping recommendations.', '']),
    '## Notes from every look', '',
    ...(session.votes.length ? session.votes.flatMap(vote => [
      `### ${escapeMarkdown(lookById.get(vote.lookId)?.name ?? vote.lookId)}`,
      `Look ID: ${escapeMarkdown(vote.lookId)}`,
      `Reaction: ${vote.reaction} — ${reactionLabels[vote.reaction]}`, '', ...feedbackMarkdown(vote),
    ]) : ['No reactions submitted.', '']),
    ...(session.draft ? [
      '## Unfinished draft', '', `### ${escapeMarkdown(lookById.get(session.draft.lookId)?.name ?? session.draft.lookId)}`,
      `Look ID: ${escapeMarkdown(session.draft.lookId)}`, 'Not voted yet; no reaction recorded.',
      'This feedback does not affect your portrait or recommendations.', '', ...feedbackMarkdown(session.draft),
    ] : []),
    '## Prototype caveats', '',
    'A small curated deck and deterministic tags, not AI interpretation, a trained taste model or a definitive classification. Notes remain plain text.',
    'Body proportions and budget do not affect style scoring. Illustration controls do not predict sizing, garment fit, drape or comfort.',
    'Shopping links are external searches, not verified stock, current prices or guaranteed budget matches. Check retailers for availability, sizing, taxes and shipping. Nothing is purchased by this prototype.',
    'Your study is stored in this browser when storage is available. This exported copy may include personal notes and illustration settings.', '',
  ].join('\n');
}
