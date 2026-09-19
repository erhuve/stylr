import review from '../../data/model-heights/review.json' with { type: 'json' };
import admittedAssets from '../../scripts/reviewed-assets.json' with { type: 'json' };

export const MIN_HEIGHT_CM = 90;
export const MAX_HEIGHT_CM = 250;

export type ReportedHeight = Readonly<{
  photoId: string;
  imageSha256: string;
  heightCm: number;
  sourceUrl: string;
  quote: string;
  retrievedAt: string;
  status: 'source-verified';
  original: Readonly<{ unit: 'cm' | 'ft-in'; value: string }>;
  snapshot: Readonly<{ path: string; sha256: string }>;
  evidence: Readonly<{
    kind: 'gallery-image-caption';
    galleryIndex: number;
    imageUrl: string;
    explanation: string;
  }>;
}>;

export type HeightAsset = Readonly<{ id: string; sha256: string; url: string; sourceUrl: string }>;
export type HeightBinding = Readonly<{ galleryIndex: number; imageUrls: readonly string[]; captions: readonly string[] }>;
export type HeightSnapshot = Readonly<{ sha256: string; bindings: readonly HeightBinding[] }>;
export type HeightValidationContext = Readonly<{
  assets: readonly HeightAsset[];
  imageHashes: Readonly<Record<string, string>>;
  snapshots: Readonly<Record<string, HeightSnapshot>>;
}>;

const digest = /^[a-f0-9]{64}$/;
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const validHeight = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= MIN_HEIGHT_CM && v <= MAX_HEIGHT_CM;
const normalize = (v: string) => v.replace(/\s+/g, ' ').trim();

export function isSafeHeightUrl(value: unknown): value is string {
  if (!text(value) || /[\s\\\u0000-\u001f]/.test(value)) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && !u.hash
      && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(u.hostname)
      && !/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(u.hostname)
      && !u.hostname.endsWith('.') && !u.hostname.includes('..');
  } catch { return false; }
}

function quotedHeight(quote: string): { value: string; unit: 'cm' | 'ft-in'; cm: number } | undefined {
  if (/\b(?:or|and|between|approximately|approx|about|estimated|maybe|guess|petite)\b|[~≈]|\d\s*[-–—/]\s*\d|(?:^|\s)[+-]\d/i.test(quote)) return;
  if (!/^(?:[\p{L}]+(?: [\p{L}]+)?\s+-\s+|(?:model|height)\b)/iu.test(quote)) return;
  const matches = [...quote.matchAll(/\b(\d{1,3}(?:\.\d+)?)\s*cm\b|\b(\d)\s*['′]\s*(\d{1,2}(?:\.\d+)?)\s*["″]/gi)];
  if (matches.length !== 1) return;
  const m = matches[0];
  const prefix = quote.slice(0, m.index).trim();
  if (!/^(?:[\p{L}]+(?: [\p{L}]+)?\s+-|model(?:\s+is)?|height\s*:?)$/iu.test(prefix) || /\b(?:waist|chest|bust|inseam|length|size)\b/i.test(prefix)) return;
  if (m[1]) return { value: m[0], unit: 'cm', cm: Number(m[1]) };
  if (Number(m[3]) >= 12) return;
  return { value: m[0], unit: 'ft-in', cm: (Number(m[2]) * 12 + Number(m[3])) * 2.54 };
}

function recordErrors(value: unknown): string[] {
  if (!object(value)) return ['not an object'];
  const r = value;
  const errors: string[] = [];
  if (!text(r.photoId) || !/^[a-zA-Z0-9_-]+$/.test(r.photoId)) errors.push('invalid photo ID');
  if (!text(r.imageSha256) || !digest.test(r.imageSha256)) errors.push('invalid image digest');
  if (!validHeight(r.heightCm)) errors.push('invalid height');
  if (r.status !== 'source-verified') errors.push('unverified source');
  if (!isSafeHeightUrl(r.sourceUrl)) errors.push('unsafe source URL');
  if (!text(r.retrievedAt) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(r.retrievedAt) || !Number.isFinite(Date.parse(r.retrievedAt))) errors.push('invalid retrieval time');
  if (text(r.retrievedAt) && Number.isFinite(Date.parse(r.retrievedAt)) && new Date(r.retrievedAt).toISOString().slice(0, 19) !== r.retrievedAt.slice(0, 19)) errors.push('invalid calendar retrieval time');
  const parsed = text(r.quote) ? quotedHeight(r.quote) : undefined;
  if (!parsed) errors.push('empty, ambiguous or contradictory height quote');
  if (!object(r.original) || !parsed || r.original.unit !== parsed.unit || r.original.value !== parsed.value || typeof r.heightCm !== 'number' || Math.abs(r.heightCm - parsed.cm) > 0.005) errors.push('original height/normalization mismatch');
  if (!object(r.snapshot) || !text(r.snapshot.path) || !/^snapshots\/[a-z0-9-]+\.html\.gz$/.test(r.snapshot.path) || !text(r.snapshot.sha256) || !digest.test(r.snapshot.sha256)) errors.push('invalid snapshot binding');
  if (!object(r.evidence) || r.evidence.kind !== 'gallery-image-caption' || !Number.isSafeInteger(r.evidence.galleryIndex) || Number(r.evidence.galleryIndex) < 0 || !isSafeHeightUrl(r.evidence.imageUrl) || !text(r.evidence.explanation)) errors.push('invalid exact-image evidence');
  return errors;
}

function sameImage(assetUrl: string, observedUrl: string, sourceUrl: string): boolean {
  if (!isSafeHeightUrl(assetUrl) || !isSafeHeightUrl(observedUrl)) return false;
  const a = new URL(assetUrl), b = new URL(observedUrl), source = new URL(sourceUrl);
  if (a.href === b.href) return true;
  if (a.hostname !== 'cdn.shopify.com' || b.origin !== source.origin) return false;
  const original = a.pathname.match(/^\/s\/files\/1\/\d+(?:\/\d+)?\/files\/([^/]+)$/);
  const served = b.pathname.match(/^\/cdn\/shop\/files\/([^/]+)$/);
  return !!original && !!served && original[1] === served[1]
    && !!a.searchParams.get('v') && a.searchParams.get('v') === b.searchParams.get('v');
}

export function validateHeightRecords(input: unknown, context: HeightValidationContext): readonly string[] {
  if (!Array.isArray(input)) return ['height records must be an array'];
  const errors: string[] = [];
  const ids = new Set<string>(), images = new Set<string>(), evidenceKeys = new Set<string>();
  const assets = new Map(context.assets.map(a => [a.id, a]));
  for (const [i, value] of input.entries()) {
    const problems = recordErrors(value);
    if (problems.length) { errors.push(...problems.map(p => `record ${i}: ${p}`)); continue; }
    const r = value as ReportedHeight;
    const fail = (message: string) => errors.push(`${r.photoId}: ${message}`);
    if (ids.has(r.photoId)) fail('duplicate photo ID');
    if (images.has(r.imageSha256)) fail('reused image evidence');
    ids.add(r.photoId); images.add(r.imageSha256);
    const key = `${r.snapshot.sha256}:${r.evidence.galleryIndex}`;
    if (evidenceKeys.has(key)) fail('reused gallery evidence');
    evidenceKeys.add(key);
    const asset = assets.get(r.photoId);
    if (!asset) { fail('unknown admitted photo ID'); continue; }
    if (asset.sha256 !== r.imageSha256 || context.imageHashes[r.photoId] !== r.imageSha256) fail('changed or missing image hash');
    if (asset.sourceUrl !== r.sourceUrl) fail('source page differs from admitted photo');
    if (!sameImage(asset.url, r.evidence.imageUrl, r.sourceUrl)) fail('source image differs from admitted image');
    const snapshot = context.snapshots[r.snapshot.path];
    if (!snapshot || snapshot.sha256 !== r.snapshot.sha256) { fail('changed or missing snapshot hash'); continue; }
    const bindings = snapshot.bindings.filter(b => b.galleryIndex === r.evidence.galleryIndex);
    if (!bindings.length) fail('missing exact gallery evidence');
    for (const b of bindings) {
      const urls = [...new Set(b.imageUrls)];
      const captions = [...new Set(b.captions.map(normalize))];
      if (urls.length !== 1 || urls[0] !== r.evidence.imageUrl || captions.length !== 1 || captions[0] !== normalize(r.quote)) fail('ambiguous, contradictory or mismatched gallery evidence');
    }
  }
  return Object.freeze(errors);
}

const rows: unknown[] = review.records;
const counts = new Map<string, number>();
for (const r of rows) if (object(r) && text(r.photoId)) counts.set(r.photoId, (counts.get(r.photoId) ?? 0) + 1);
const reported = new Map<string, ReportedHeight>();
const admitted = new Map(admittedAssets.map(a => [a.id, a]));
for (const value of rows) {
  if (recordErrors(value).length) continue;
  const r = value as ReportedHeight;
  if (counts.get(r.photoId) !== 1) continue;
  const asset = admitted.get(r.photoId);
  if (!asset || asset.sha256 !== r.imageSha256 || asset.sourceUrl !== r.sourceUrl || !sameImage(asset.url, r.evidence.imageUrl, r.sourceUrl)) continue;
  if (rows.some(other => other !== value && object(other) && (other.imageSha256 === r.imageSha256 || (object(other.snapshot) && object(other.evidence) && other.snapshot.sha256 === r.snapshot.sha256 && other.evidence.galleryIndex === r.evidence.galleryIndex)))) continue;
  reported.set(r.photoId, Object.freeze({ ...r, original: Object.freeze({ ...r.original }), snapshot: Object.freeze({ ...r.snapshot }), evidence: Object.freeze({ ...r.evidence }) }));
}

export function getReportedHeight(photoId: string): ReportedHeight | undefined {
  return reported.get(photoId);
}

export function heightSimilarity(photoId: string, heightCm: number | null | undefined): number {
  if (!validHeight(heightCm)) return 0;
  const r = getReportedHeight(photoId);
  return r ? Math.max(0, 1 - Math.abs(r.heightCm - heightCm) / 15) : 0;
}
