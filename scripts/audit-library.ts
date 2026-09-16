import { PHOTOS, LEGACY_PHOTOS } from '../src/lib/photo-catalog';
import { DIMENSION_KEYS, normalizePhotoDimensions } from '../src/lib/photo-dimensions';
import { freshPhotoSession, nextPhoto, votePhoto } from '../src/lib/photo-session';
import type { Photo } from '../src/lib/photo-types';

const root = new URL('../', import.meta.url).pathname;
const count = (values: string[]) => Object.fromEntries([...new Set(values)].sort().map(value => [value, values.filter(v => v === value).length]));
const hashOwners = new Map<string, string>();
let bytes = 0;
for (const photo of PHOTOS) {
  const file = Bun.file(`${root}public${photo.src}`);
  if (!await file.exists()) throw new Error(`Missing image: ${photo.id}`);
  const data = await file.arrayBuffer();
  const hash = new Bun.CryptoHasher('sha256').update(data).digest('hex');
  if (hashOwners.has(hash)) throw new Error(`Duplicate image: ${photo.id}, ${hashOwners.get(hash)}`);
  hashOwners.set(hash, photo.id);
  bytes += data.byteLength;
}
const records = await Promise.all(['photo-assets', 'fashionpedia-assets', 'streetstyle-assets', 'reviewed-assets'].map(name => Bun.file(`${root}scripts/${name}.json`).json()));
const manifestIds = records.flat().map((a: { id: string }) => a.id);
if (new Set(manifestIds).size !== manifestIds.length || manifestIds.length !== PHOTOS.length || PHOTOS.some(p => !manifestIds.includes(p.id))) throw new Error('Manifest/catalog mismatch');
const dimensions = PHOTOS.map(p => normalizePhotoDimensions(p.dimensions));
let session = freshPhotoSession();
const first: Photo[] = [];
for (let i = 0; i < Math.min(40, PHOTOS.length); i++) {
  const photo = nextPhoto(session, PHOTOS)!;
  first.push(photo);
  session = votePhoto(session, photo.id, 'unsure', PHOTOS);
}
const summary = {
  total: PHOTOS.length,
  preservedOriginals: LEGACY_PHOTOS.length,
  sources: count(PHOTOS.map(p => p.sourceLabel || (p.id.startsWith('pexels') ? 'Pexels' : 'Unsplash'))),
  family: count(PHOTOS.map(p => p.family)),
  clothingRange: count(PHOTOS.map(p => p.collection)),
  bodyReference: count(PHOTOS.map(p => p.frame)),
  framing: count(PHOTOS.map(p => p.view)),
  dimensions: Object.fromEntries(DIMENSION_KEYS.map(key => [key, { photos: dimensions.filter(d => d[key]?.length).length, values: count(dimensions.flatMap(d => d[key] || [])) }])),
  unknownFootwear: PHOTOS.filter(p => !p.shoesKnown).length,
  unknownBottoms: PHOTOS.filter(p => !p.bottomKnown).length,
  assetBytes: bytes,
  duplicateAssets: 0,
  first40: { families: count(first.map(p => p.family)), sources: count(first.map(p => p.sourceLabel || 'Original selection')), ids: first.map(p => p.id) },
};
console.log(JSON.stringify(summary, null, 2));
