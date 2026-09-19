import { createHash } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import review from '../data/model-heights/review.json';
import ledger from '../data/model-heights/search-log.json';
import assets from './reviewed-assets.json';
import { PHOTOS } from '../src/lib/photo-catalog';
import { isSafeHeightUrl, validateHeightRecords, type HeightBinding, type HeightSnapshot } from '../src/lib/height-reference';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

function decodeCaption(text: string): string {
  const named: Record<string, string> = { quot: '"', apos: "'", amp: '&', lt: '<', gt: '>', nbsp: ' ', prime: '′', Prime: '″', ndash: '–', mdash: '—' };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    if (!code.startsWith('#')) return named[code] ?? entity;
    const point = code[1]?.toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
    return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : entity;
  });
}

export async function extractHeightBindings(html: string, sourceUrl: string): Promise<HeightBinding[]> {
  const bindings: HeightBinding[] = [];
  let current: { galleryIndex: number; imageUrls: string[]; captions: string[] } | undefined;
  let caption = '';
  const parser = new HTMLRewriter()
    .on('.product-main-slide', {
      element(element) {
        if (current) throw new Error('Nested gallery containers are ambiguous');
        const index = element.getAttribute('data-index');
        current = { galleryIndex: index !== null && /^\d+$/.test(index) ? Number(index) : -1, imageUrls: [], captions: [] };
        element.onEndTag(() => { if (current) bindings.push(current); current = undefined; });
      },
    })
    .on('.product-main-slide img', {
      element(element) {
        if (!current) return;
        const image = element.getAttribute('data-photoswipe-src') ?? element.getAttribute('src');
        if (image) current.imageUrls.push(new URL(image, sourceUrl).href);
      },
    })
    .on('.product-main-slide .model-info--custom', {
      element(element) {
        caption = '';
        element.onEndTag(() => { current?.captions.push(decodeCaption(caption).replace(/\s+/g, ' ').trim()); });
      },
      text(chunk) { caption += chunk.text; },
    })
    .on('.product-main-slide .model-info--custom br', { element() { caption += ' '; } });
  await parser.transform(new Response(html)).text();
  return bindings;
}

async function confinedFile(base: string, relative: string): Promise<Buffer> {
  const directory = await realpath(base);
  const target = await realpath(resolve(directory, relative));
  if (!target.startsWith(directory + sep)) throw new Error('Path escapes evidence directory');
  return readFile(target);
}

export async function auditModelHeights(): Promise<{ records: number; sourcePages: number; errors: string[] }> {
  const errors: string[] = [];
  const snapshots: Record<string, HeightSnapshot> = {};
  const imageHashes: Record<string, string> = {};
  const ids = new Set(PHOTOS.map(p => p.id));
  const admitted = assets.filter(a => ids.has(a.id));
  const byId = new Map(admitted.map(a => [a.id, a]));
  if (review.schemaVersion !== 1 || ledger.schemaVersion !== 1 || !ledger.scope.trim()) errors.push('Invalid review or bounded search ledger');
  const pagePaths = new Set<string>();
  for (const page of ledger.sourcePages) {
    try {
      if (!isSafeHeightUrl(page.sourceUrl) || !/^snapshots\/[a-z0-9-]+\.html\.gz$/.test(page.snapshot)) throw new Error('Unsafe snapshot path or URL');
      if (pagePaths.has(page.snapshot)) throw new Error('Duplicate source snapshot');
      pagePaths.add(page.snapshot);
      if (!page.reason.trim() || !Number.isFinite(Date.parse(page.retrievedAt))) throw new Error('Missing retrieval evidence');
      if (page.candidatePhotoIds.some(id => !byId.has(id) || byId.get(id)?.sourceUrl !== page.sourceUrl)) throw new Error('Unknown or mismatched candidate');
      const bytes = gunzipSync(await confinedFile(resolve(root, 'data/model-heights'), page.snapshot), { maxOutputLength: 16 * 1024 * 1024 });
      const hash = sha256(bytes);
      if (hash !== page.snapshotSha256) throw new Error('Changed snapshot hash');
      snapshots[page.snapshot] = { sha256: hash, bindings: await extractHeightBindings(bytes.toString('utf8'), page.sourceUrl) };
    } catch (error) { errors.push(`${page.snapshot}: ${String(error)}`); }
  }
  for (const record of review.records) {
    const page = ledger.sourcePages.find(p => p.snapshot === record.snapshot.path);
    if (!page || page.sourceUrl !== record.sourceUrl || page.retrievedAt !== record.retrievedAt || page.outcome !== 'verified-exact-gallery-caption' || !page.candidatePhotoIds.includes(record.photoId)) errors.push(`${record.photoId}: missing or contradictory retrieval ledger`);
    try {
      const asset = byId.get(record.photoId);
      if (!asset || !/^\/photos\/[a-zA-Z0-9_-]+\.webp$/.test(asset.src)) throw new Error('Unknown image asset');
      imageHashes[record.photoId] = sha256(await confinedFile(resolve(root, 'public'), asset.src.slice(1)));
    } catch (error) { errors.push(`${record.photoId}: ${String(error)}`); }
  }
  errors.push(...validateHeightRecords(review.records, { assets: admitted, imageHashes, snapshots }));
  return { records: review.records.length, sourcePages: ledger.sourcePages.length, errors };
}

if (import.meta.main) {
  const result = await auditModelHeights();
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}
