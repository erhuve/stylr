import { createHash } from 'node:crypto';
import { z } from 'zod';

export const AXES = ['build', 'shoulderHip', 'waist', 'legs'] as const;
export type Axis = typeof AXES[number];
export const BLOCKERS = ['loose-clothing', 'structured-clothing', 'layered-clothing', 'waist-obscured', 'hips-obscured', 'shoulders-obscured', 'cropped', 'turned-pose', 'seated-pose', 'bent-pose', 'heels-platforms', 'camera-perspective', 'occlusion', 'multiple-people', 'low-resolution'] as const;
const anchor = z.number().int().min(0).max(4);
const orderedRange = z.tuple([anchor, anchor]).refine(([low, high]) => low <= high, 'Range must be ordered');
const estimate = z.object({
  range: orderedRange.refine(([low, high]) => high - low <= 1, 'An observation spans at most two adjacent anchors'),
  confidence: z.enum(['medium', 'high']),
}).strict();
const evidence = z.string().trim().min(1).max(1000).refine(value => {
  const words = value.split(/\s+/).length;
  return words >= 15 && words <= 60;
}, 'Evidence must contain 15–60 words');

export const observationSchema = z.object({
  photoId: z.string().min(1).max(160),
  pose: z.enum(['front', 'three-quarter', 'side', 'back', 'seated', 'mixed']),
  axes: z.object({ build: estimate.nullable(), shoulderHip: estimate.nullable(), waist: estimate.nullable(), legs: estimate.nullable() }).strict(),
  blockers: z.array(z.enum(BLOCKERS)).max(BLOCKERS.length).refine(values => new Set(values).size === values.length, 'Duplicate blocker'),
  evidence,
}).strict();
export type Observation = z.infer<typeof observationSchema>;
export type Preferences = Partial<Record<Axis, [number, number]>>;
export type AssetReference = { photoId: string; assetSha256: string; sourceUrl: string };

export function usability(observation: Observation): 'complete' | 'partial' | 'unavailable' {
  const count = AXES.filter(axis => observation.axes[axis] !== null).length;
  return count === AXES.length ? 'complete' : count ? 'partial' : 'unavailable';
}

const assetShape = z.object({
  photoId: z.string().min(1).max(160),
  assetSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sourceUrl: z.string().url().refine(url => new URL(url).protocol === 'https:'),
}).strict();

export const labelSchema = observationSchema.extend({
  assetSha256: assetShape.shape.assetSha256,
  sourceUrl: assetShape.shape.sourceUrl,
  usability: z.enum(['complete', 'partial', 'unavailable']),
}).strict().refine(label => label.usability === usability(label), 'Usability disagrees with supported axes');

export const bundleSchema = z.object({
  schemaVersion: z.literal(1),
  rubricVersion: z.literal('visual-proportions-v1'),
  annotationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  method: z.literal('AI-assisted visual annotation; not measured anatomy'),
  imageScope: z.literal('existing-real-photos'),
  catalogDigest: assetShape.shape.assetSha256,
  labels: z.array(labelSchema).min(1).max(10000),
}).strict();
export type Bundle = z.infer<typeof bundleSchema>;

export function catalogDigest(assets: readonly AssetReference[]): string {
  const ordered = [...assets].sort((a, b) => a.photoId < b.photoId ? -1 : a.photoId > b.photoId ? 1 : 0);
  return createHash('sha256').update(JSON.stringify(ordered.map(({ photoId, assetSha256, sourceUrl }) => [photoId, assetSha256, sourceUrl]))).digest('hex');
}

function assetMap(assets: readonly AssetReference[]) {
  const validated = assets.map(asset => assetShape.parse(asset));
  const map = new Map(validated.map(asset => [asset.photoId, asset]));
  if (!map.size || map.size !== assets.length) throw new Error('Empty or duplicate asset inventory');
  return map;
}

export function assemble(raw: unknown, assets: readonly AssetReference[], annotationDate: string): Bundle {
  const observations = z.array(observationSchema).parse(raw);
  const expected = assetMap(assets);
  const seen = new Set<string>();
  const labels = observations.map(observation => {
    const asset = expected.get(observation.photoId);
    if (!asset || seen.has(observation.photoId)) throw new Error(`Unexpected or duplicate photo: ${observation.photoId}`);
    seen.add(observation.photoId);
    return { ...observation, ...asset, usability: usability(observation) };
  }).sort((a, b) => a.photoId < b.photoId ? -1 : a.photoId > b.photoId ? 1 : 0);
  if (seen.size !== expected.size) throw new Error(`Incomplete labels: ${seen.size}/${expected.size}`);
  return validate({
    schemaVersion: 1, rubricVersion: 'visual-proportions-v1', annotationDate,
    method: 'AI-assisted visual annotation; not measured anatomy', imageScope: 'existing-real-photos',
    catalogDigest: catalogDigest(assets), labels,
  }, assets);
}

export function validate(raw: unknown, assets: readonly AssetReference[]): Bundle {
  const bundle = bundleSchema.parse(raw);
  const expected = assetMap(assets);
  if (bundle.catalogDigest !== catalogDigest(assets)) throw new Error('Catalog digest mismatch');
  const seen = new Set<string>();
  for (const label of bundle.labels) {
    const asset = expected.get(label.photoId);
    if (!asset || seen.has(label.photoId)) throw new Error(`Unexpected or duplicate photo: ${label.photoId}`);
    if (asset.assetSha256 !== label.assetSha256 || asset.sourceUrl !== label.sourceUrl) throw new Error(`Changed image or source: ${label.photoId}`);
    seen.add(label.photoId);
  }
  if (seen.size !== expected.size) throw new Error(`Incomplete labels: ${seen.size}/${expected.size}`);
  return bundle;
}

export function supportedMatch(observation: Observation, preferences: Preferences): boolean {
  const keys = Object.keys(preferences);
  if (!keys.length || keys.some(key => !AXES.includes(key as Axis))) return false;
  return keys.every(key => {
    const range = orderedRange.safeParse(preferences[key as Axis]);
    const value = observation.axes[key as Axis];
    return range.success && value !== null && value.range[0] >= range.data[0] && value.range[1] <= range.data[1];
  });
}

export function coverage(bundle: Bundle) {
  return {
    total: bundle.labels.length,
    usability: Object.fromEntries(['complete', 'partial', 'unavailable'].map(status => [status, bundle.labels.filter(label => label.usability === status).length])),
    axes: Object.fromEntries(AXES.map(axis => [axis, {
      supported: bundle.labels.filter(label => label.axes[axis] !== null).length,
      unknown: bundle.labels.filter(label => label.axes[axis] === null).length,
      highConfidence: bundle.labels.filter(label => label.axes[axis]?.confidence === 'high').length,
      supportedRanges: Object.fromEntries([...new Set(bundle.labels.flatMap(label => label.axes[axis] ? [label.axes[axis]!.range.join('–')] : []))].sort().map(range => [range, bundle.labels.filter(label => label.axes[axis]?.range.join('–') === range).length])),
    }])),
    selectedAxisCoverage: AXES.flatMap((first, i) => AXES.slice(i + 1).map(second => ({
      axes: [first, second],
      photos: bundle.labels.filter(label => supportedMatch(label, { [first]: [0, 4], [second]: [0, 4] })).length,
    }))),
    blockers: Object.fromEntries(BLOCKERS.map(blocker => [blocker, bundle.labels.filter(label => label.blockers.includes(blocker)).length])),
  };
}
