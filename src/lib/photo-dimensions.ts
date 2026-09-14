import type { DimensionKey, Photo, PhotoDimensions } from './photo-types';

export const DIMENSION_KEYS: readonly DimensionKey[] = ['silhouette', 'surface', 'palette', 'styling', 'references', 'context', 'function', 'comfort'];
const visualKeys: readonly DimensionKey[] = ['silhouette', 'surface', 'palette', 'styling'];
const unknownValues = new Set(['unknown', 'unspecified', 'unclassified', 'not known', 'not visible', 'n/a']);

export function normalizeDimensionPhrase(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[_\u2010-\u2015-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function normalizePhotoDimensions(dimensions?: PhotoDimensions): PhotoDimensions {
  const normalized: PhotoDimensions = {};
  for (const key of DIMENSION_KEYS) {
    const input = dimensions?.[key];
    if (!Array.isArray(input)) continue;
    const values = [...new Set(input.slice(0, 64).filter((value): value is string => typeof value === 'string' && value.length <= 160).map(normalizeDimensionPhrase).filter(value => value && !unknownValues.has(value)))].sort().slice(0, 12);
    if (values.length) normalized[key] = values;
  }
  return normalized;
}

export const DIMENSION_PAIR_MASKS = DIMENSION_KEYS.flatMap((_, a) => DIMENSION_KEYS.slice(a + 1).map((_, offset) => (1 << a) | (1 << (a + offset + 1))));

export type PhotoDimensionSignals = {
  groups: string[][];
  combinations: [readonly string[], readonly string[]][];
  visual: string[][];
  mask: number;
};

export function sharedDimensionGroups(a: PhotoDimensionSignals, b: PhotoDimensionSignals): number {
  let mask = 0;
  for (let i = 0; i < DIMENSION_KEYS.length; i++) {
    if (a.groups[i].some(value => b.groups[i].includes(value))) mask |= 1 << i;
  }
  return mask;
}

export function photoDimensionSignals(photo: Photo): PhotoDimensionSignals {
  const dimensions = normalizePhotoDimensions(photo.dimensions);
  const groups = DIMENSION_KEYS.map(key => (dimensions[key] || []).map(value => JSON.stringify([key, value])));
  const combinations: PhotoDimensionSignals['combinations'] = [];
  for (let a = 0; a < groups.length; a++) {
    if (!groups[a].length) continue;
    for (let b = a + 1; b < groups.length; b++) {
      if (groups[b].length) combinations.push([groups[a], groups[b]]);
    }
  }
  return { groups, combinations, visual: visualKeys.map(key => dimensions[key] || []), mask: groups.reduce((mask, group, i) => group.length ? mask | (1 << i) : mask, 0) };
}

export function nearIdenticalPhotos(a: Photo, aSignals: PhotoDimensionSignals, b: Photo, bSignals: PhotoDimensionSignals): boolean {
  let compared = 0, overlap = 0, total = 0;
  for (let i = 0; i < aSignals.visual.length; i++) {
    const av = aSignals.visual[i], bv = bSignals.visual[i];
    if (!av.length || !bv.length) continue;
    compared++;
    const shared = av.filter(value => bv.includes(value)).length;
    overlap += shared;
    total += av.length + bv.length - shared;
  }
  if (compared >= 2) return overlap / total >= 0.85;
  if (aSignals.groups.some(group => group.length) || bSignals.groups.some(group => group.length)) return false;
  const af = new Set(a.features), bf = new Set(b.features);
  const shared = [...af].filter(value => bf.has(value)).length;
  return a.family === b.family && shared >= 2 && shared / (af.size + bf.size - shared) >= 0.85;
}
