import { expect, test } from 'bun:test';
import { LOOKS, DIRECTIONS } from '../src/lib/looks';
import { directionScores, portrait, traitScores } from '../src/lib/style-engine';
import type { Reaction, Vote } from '../src/lib/style-types';

test('equivalent evidence has exactly equal direction and trait scores regardless of vote order', () => {
  const reactions: Reaction[] = ['wear', 'admire', 'pass', 'unsure'];
  const votes: Vote[] = Object.keys(DIRECTIONS).flatMap(direction => LOOKS.filter(look => look.direction === direction).map((look, i) => ({ lookId: look.id, reaction: reactions[i], note: '', more: [], less: [] })));
  const original = directionScores(votes);
  expect(new Set(original.map(entry => entry.score)).size).toBe(1);
  for (let offset = 0; offset < votes.length; offset++) {
    const rotated = [...votes.slice(offset), ...votes.slice(0, offset)].reverse();
    expect(directionScores(rotated)).toEqual(original);
    expect(traitScores(rotated)).toEqual(traitScores(votes));
    expect(portrait(rotated).heading).toBe('More than one direction.');
    expect(portrait(rotated).formulas).toEqual([]);
  }
});
