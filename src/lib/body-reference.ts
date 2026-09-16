import calibrationIds from '../../data/apparent-build/calibration-ids.json' with { type: 'json' };
import calibration from '../../data/apparent-build/visual-review.json' with { type: 'json' };
import holdoutIds from '../../data/apparent-build/holdout-ids.json' with { type: 'json' };
import holdout from '../../data/apparent-build/holdout-review.json' with { type: 'json' };
import admitted from '../../data/catalog-review/admitted-body.json' with { type: 'json' };
import type { PhotoSession } from './photo-types';

export const BUILD_LABELS = ['Slender', 'Slender–intermediate', 'Intermediate', 'Intermediate–fuller', 'Fuller / broader'];
export function bodySelection(body: PhotoSession['body']) {
  return { build: body?.build ?? 1.5, shoulderHip: body?.shoulderHip ?? 0, waist: body?.waist ?? 1, mode: 'nearby' as const };
}

export function bodyDistance(id: string, body: PhotoSession['body']): number {
  const reference = BODY_REFERENCES.get(id);
  if (!reference || !body) return Infinity;
  return (['build', 'shoulderHip', 'waist'] as const).reduce((sum, axis) => {
    if (reference[axis] === null || body[axis] === null) return Infinity;
    return sum + ((reference[axis]! - body[axis]!) / 2) ** 2;
  }, 0);
}
export const BODY_REFERENCES = new Map<string, { build: number | null; shoulderHip: number | null; waist: number | null }>();
for (const [ids, review] of [[calibrationIds, calibration], [holdoutIds, holdout]] as const) {
  for (const row of review.rows) BODY_REFERENCES.set(ids[row[0] as number], { build: row[1] as number | null, shoulderHip: row[2] as number | null, waist: row[3] as number | null });
}

for (const { id, ...body } of admitted) BODY_REFERENCES.set(id, body);

export function matchesBody(id: string, body: PhotoSession['body']): boolean {
  if (!body) return true;
  const reference = BODY_REFERENCES.get(id);
  if (body.mode === 'nearby') return (['build', 'shoulderHip', 'waist'] as const).every(axis => body[axis] !== null && reference?.[axis] != null && Math.abs(reference[axis]! - body[axis]!) <= (axis === 'build' ? 0.5 : 0.75));
  return (['build', 'shoulderHip', 'waist'] as const).every(axis => body[axis] === null || (reference?.[axis] != null && reference[axis] === body[axis]));
}
