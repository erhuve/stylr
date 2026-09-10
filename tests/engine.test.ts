import { describe, expect, test } from 'bun:test';
import { marked } from 'marked';
import { LOOKS } from '../src/lib/looks';
import { freshSession, parseSession, loadSession, readSession, nextLook, recordVote, undoSession, portrait, recommendations, permits, notesMarkdown, shoppingUrl, traitScores } from '../src/lib/style-engine';
import type { Session, Vote, Reaction, Constraint } from '../src/lib/style-types';

const vote = (i: number, reaction: Reaction = 'wear'): Vote => ({ lookId: LOOKS[i].id, reaction, note: '', more: [], less: [] });
const votes = (reaction: Reaction, count = 24) => LOOKS.slice(0, count).map((_, i) => vote(i, reaction));
const parse = (value: unknown) => parseSession(JSON.stringify(value));

describe('strict data and backwards compatibility', () => {
  test('catalog is balanced and unique', () => {
    expect(LOOKS.length).toBe(24);
    expect(new Set(LOOKS.map(l => l.id)).size).toBe(24);
    for (const d of new Set(LOOKS.map(l => l.direction))) expect(LOOKS.filter(l => l.direction === d).length).toBe(4);
  });
  test('fresh states are independent; missing exclusions migrate', () => {
    const a = freshSession(); a.body.waist = 100; a.votes.push(vote(0));
    expect(freshSession().body.waist).toBe(40); expect(freshSession().votes).toEqual([]);
    const { exclusions, ...legacy } = freshSession();
    expect(parse(legacy).session.exclusions).toEqual([]);
  });
  for (const raw of ['', '{', 'null', '[]', 'true', '42', '"foo"']) test(`invalid JSON/data ${raw}`, () => {
    expect(parseSession(raw).status).toBe('invalid');
  });
  test('future version and oversized data are rejected', () => {
    expect(loadSession('{"version":2}').issue).toBe('unsupported');
    expect(parseSession(' '.repeat(200000)).status).toBe('invalid');
    expect(parseSession(null).status).toBe('empty');
  });
  for (const field of ['shoulders', 'chest', 'waist', 'hips', 'torso']) for (const value of [-1, 101, NaN, Infinity, '50', null]) test(`reject ${field} ${value}`, () => {
    const s = freshSession();
    expect(parse({ ...s, body: { ...s.body, [field]: value } }).status).toBe('invalid');
  });
  test('unknown identities and invalid/duplicated/conflicting feedback are rejected', () => {
    for (const change of [{ lookId: 'absent' }, { reaction: 'evil' }, { note: 'x'.repeat(601) }, { more: ['color', 'color'] }, { more: ['color'], less: ['color'] }, { less: ['bogus'] }]) {
      expect(parse({ ...freshSession(), votes: [{ ...vote(0), ...change }] }).status).toBe('invalid');
    }
    expect(parse({ ...freshSession(), votes: [vote(0), vote(0)] }).status).toBe('invalid');
    expect(parse({ ...freshSession(), exclusions: ['no-heels', 'no-heels'] }).status).toBe('invalid');
  });
  test('impossible navigation and already-voted draft normalize', () => {
    expect(parse({ ...freshSession(), step: 'portrait' }).session.step).toBe('model');
    expect(parse({ ...freshSession(), step: 'discover', votes: votes('pass') }).session.step).toBe('portrait');
    expect(parse({ ...freshSession(), votes: [vote(0)], draft: { lookId: 'look-1', note: 'stale', more: [], less: [] } }).session.draft).toBeUndefined();
  });
});

describe('deterministic exploration and reversible state', () => {
  test('100 mixed studies explore all directions and exhaust without repetition', () => {
    const reactions: Reaction[] = ['wear', 'pass', 'admire', 'unsure'];
    for (let seed = 0; seed < 100; seed++) {
      let s: Session = { ...freshSession(), step: 'discover' };
      for (let i = 0; i < 24; i++) {
        const current = nextLook(s.votes)!;
        expect(s.votes.some(v => v.lookId === current.id)).toBe(false);
        expect(nextLook(s.votes)?.id).toBe(current.id);
        s = recordVote(s, current.id, reactions[(seed * 7 + i * 3) % 4]);
        if (i === 5) expect(new Set(s.votes.map(v => LOOKS.find(l => l.id === v.lookId)!.direction)).size).toBe(6);
      }
      expect(s.step).toBe('portrait'); expect(s.votes.length).toBe(24); expect(nextLook(s.votes)).toBeUndefined();
    }
  });
  test('guard against stale duplicate votes and preserve complete draft on undo', () => {
    const s: Session = { ...freshSession(), step: 'discover', draft: { lookId: 'look-1', note: 'keep me', more: ['color'], less: ['structure'] } };
    const v = recordVote(s, 'look-1', 'wear');
    expect(recordVote(v, 'look-1', 'pass')).toBe(v);
    expect(recordVote(freshSession(), 'look-1', 'wear').votes).toHaveLength(0);
    const restored = undoSession(v);
    expect(restored.draft).toEqual(s.draft!); expect(restored.votes).toHaveLength(0);
    expect(readSession(JSON.stringify(restored)).draft).toEqual(s.draft!);
    expect(nextLook(restored.votes, restored.draft?.lookId)?.id).toBe('look-1');
  });
  test('explicit feedback changes traits without inferring from prose', () => {
    expect(traitScores([{ ...vote(0, 'unsure'), more: ['color'] }]).color).toBe(1.5);
    expect(traitScores([{ ...vote(0, 'unsure'), less: ['color'] }]).color).toBe(-1.8);
    expect(traitScores([{ ...vote(0), note: 'I hate colors' }])).toEqual(traitScores([vote(0)]));
  });
});

describe('honest portraits, shopping and safe export', () => {
  for (const r of ['pass', 'unsure'] as const) test(`${r} does not invent preferences`, () => {
    const p = portrait(votes(r)); expect(p.favorite).toEqual([]); expect(p.ranked).toEqual([]); expect(p.traits).toEqual([]); expect(p.formulas).toEqual([]);
  });
  test('admired-only outfits never become wearable suggestions, ties stay open', () => {
    const v = votes('admire'); expect(portrait(v).wearable).toEqual([]); expect(recommendations(v)).toEqual([]);
    expect(portrait(v).heading).toBe('More than one direction.'); expect(portrait(v).formulas).toEqual([]);
  });
  test('all 16 shopping boundary combinations are respected without changing portrait', () => {
    const rules: Constraint[] = ['no-heels', 'no-skirts', 'no-shorts', 'no-boots'];
    const v = votes('wear');
    for (let mask = 0; mask < 16; mask++) {
      const selected = rules.filter((_, i) => mask & 1 << i);
      for (const look of recommendations(v, selected)) expect(permits(look, selected)).toBe(true);
    }
    expect(recommendations([{ ...vote(15), note: 'no heels' }])).toHaveLength(1);
    expect(recommendations([vote(15)], ['no-heels'])).toHaveLength(0);
    expect(portrait(v).favorite).toHaveLength(24);
  });
  test('budget is an encoded search hint', () => {
    const u = new URL(shoppingUrl('Red skirt & blouse', '50'));
    expect(u.origin).toBe('https://www.google.com'); expect(u.searchParams.get('q')).toBe('Red skirt & blouse under $50');
  });
  test('all notes, reactions, traits, body and unfinished draft are exported inertly', () => {
    const s: Session = { ...freshSession(), exclusions: ['no-heels'], votes: [{ ...vote(0, 'pass'), more: ['color'], note: '<img src=x onerror=alert(1)> ![x](https://evil.test)\n<script>bad()</script>' }], draft: { lookId: 'look-2', note: 'unfinished', more: [], less: [] } };
    const md = notesMarkdown(s);
    for (const word of ['unfinished', 'No heels', 'Expressive color', 'shoulders: 50', 'Not my thing']) expect(md).toContain(word);
    const html = marked.parse(md) as string;
    expect(html).not.toMatch(/<(?:img|script)\b|href="https:\/\/evil/i);
  });
});
