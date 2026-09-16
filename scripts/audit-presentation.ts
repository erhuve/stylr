import { PHOTOS } from '../src/lib/photo-catalog';
import { BODY_REFERENCES } from '../src/lib/body-reference';
import review from '../data/presentation/review.json';
import type { Photo } from '../src/lib/photo-types';

export const EVIDENCE = {
  D: { presentation: 'feminine', cue: 'Dress or skirt-led feminine styling in the visible outfit.' },
  F: { presentation: 'feminine', cue: 'Feminine styling through fitted/cropped, romantic, lace, corset, ruffled or heeled separates; assessed as an ensemble.' },
  M: { presentation: 'masculine', cue: 'Masculine tailoring ensemble: suit, waistcoat, collared shirt or tie with structured trouser styling.' },
  C: { presentation: 'masculine', cue: 'Masculine casual/workwear ensemble: collared, utility, polo or layered separates with straight trouser/short styling.' },
  X: { presentation: 'mixed-androgynous', cue: 'Visible combination of conventionally masculine and feminine styling cues.' },
  U: { presentation: 'unclear', cue: 'Neutral basics, ambiguous styling, limited crop or insufficient visible cues for a directional assignment.' },
} as const;

type ReviewRow = { id: string; sha256: string; evidence: string; reviewedAt: string; ordinal: number; sheet: number };
type Body = { build: number | null; shoulderHip: number | null; waist: number | null };
const categories = ['masculine', 'feminine', 'mixed-androgynous', 'unclear', 'unreviewed'];
const root = new URL('../', import.meta.url).pathname;

export function validateRows(photos: Pick<Photo, 'id'>[], rows: ReviewRow[]) {
  const ids = new Set(photos.map(photo => photo.id));
  if (ids.size !== photos.length) throw new Error('Duplicate catalog ID');
  const observations = new Map<string, ReviewRow>();
  for (const row of rows) {
    if (!ids.has(row.id) || observations.has(row.id)) throw new Error(`Unknown/duplicate review: ${row.id}`);
    if (!Object.hasOwn(EVIDENCE, row.evidence) || !/^[a-f0-9]{64}$/.test(row.sha256)
      || !/^\d{4}-\d{2}-\d{2}$/.test(row.reviewedAt)) throw new Error(`Invalid review: ${row.id}`);
    observations.set(row.id, row);
  }
  return observations;
}

export function coverage(photos: Photo[], rows: ReviewRow[], bodies: Map<string, Body>) {
  const observations = validateRows(photos, rows);
  function summarize(selection: Photo[]) {
    return categories.map(presentation => {
      const members = selection.filter(photo => {
        const row = observations.get(photo.id);
        return (row ? EVIDENCE[row.evidence as keyof typeof EVIDENCE].presentation : 'unreviewed') === presentation;
      });
      const complete = members.filter(photo => {
        const body = bodies.get(photo.id);
        return body && [body.build, body.shoulderHip, body.waist].every(value => value != null);
      });
      const build = (completeOnly: boolean) => {
        const counts: Record<string, number> = {};
        for (const photo of completeOnly ? complete : members) {
          const value = bodies.get(photo.id)?.build;
          const key = value == null ? 'unknown' : String(value);
          counts[key] = (counts[key] ?? 0) + 1;
        }
        return counts;
      };
      return {
        presentation, photos: members.length,
        percent: selection.length ? Math.round(members.length / selection.length * 1000) / 10 : 0,
        sourcePages: new Set(members.map(photo => {
          const url = new URL(photo.sourceUrl);
          return url.hostname.replace(/^www\./, '') + url.pathname.replace(/\/$/, '');
        })).size,
        sourceHosts: new Set(members.map(photo => new URL(photo.sourceUrl).hostname.replace(/^www\./, ''))).size,
        completeReferences: complete.length, byBuild: build(false), completeByBuild: build(true),
      };
    });
  }
  const hosts = [...new Set(photos.map(photo => new URL(photo.sourceUrl).hostname.replace(/^www\./, '')))].sort();
  return {
    rubricVersion: 1, scope: 'Current repository catalog; not a claim about live deployment or distinct people.',
    catalogPhotos: photos.length, reviewedPhotos: observations.size, unreviewedPhotos: photos.length - observations.size,
    categories: summarize(photos),
    sources: hosts.map(host => ({ host, categories: summarize(photos.filter(photo => new URL(photo.sourceUrl).hostname.replace(/^www\./, '') === host)) })),
    unreviewedIds: photos.filter(photo => !observations.has(photo.id)).map(photo => photo.id),
  };
}

async function main() {
  if (review.rubricVersion !== 1) throw new Error('Unsupported presentation rubric');
  const observations = validateRows(PHOTOS, review.rows);
  for (const photo of PHOTOS) {
    const row = observations.get(photo.id);
    if (!row) continue;
    const bytes = await Bun.file(`${root}public${photo.src}`).arrayBuffer();
    const digest = new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
    if (row.sha256 !== digest) throw new Error(`Changed reviewed image: ${photo.id}`);
  }
  const report = coverage(PHOTOS, review.rows, BODY_REFERENCES);
  if (process.argv.includes('--require-complete') && report.unreviewedPhotos) throw new Error(`${report.unreviewedPhotos} presentation reviews missing`);
  const lines = [
    '# Outfit presentation coverage', '', report.scope, '',
    `Reviewed: ${report.reviewedPhotos}/${report.catalogPhotos}; unreviewed: ${report.unreviewedPhotos}.`, '',
    'Direct AI visual screening, rubric v1; subjective clothing presentation, not sex/gender identity, measured anatomy or human-verified ground truth. Neutral styling remains unclear. See README.md for evidence codes and limitations.', '',
    '| Presentation | Photos | Share | Source pages | Source hosts | Complete body references |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...report.categories.map(row => `| ${row.presentation} | ${row.photos} | ${row.percent}% | ${row.sourcePages} | ${row.sourceHosts} | ${row.completeReferences} |`), '',
    '## Presentation by reviewed build', '',
    'Exact existing build scores are retained; unknown is explicit. No body labels were added or changed by this audit.', '',
    '| Presentation | All photos by build | Complete references by build |', '| --- | --- | --- |',
    ...report.categories.map(row => `| ${row.presentation} | ${JSON.stringify(row.byBuild)} | ${JSON.stringify(row.completeByBuild)} |`), '',
    '## Source coverage', '', '| Source host | Masculine | Feminine | Mixed | Unclear | Unreviewed |', '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...report.sources.map(row => `| ${row.host} | ${row.categories.map(category => category.photos).join(' | ')} |`), '',
    'Source-page counts can overlap between categories. Repeated models, shoots and gallery poses are not independent people. Counts establish image coverage only.', '',
    '## Next sourcing', '',
    'Extensive coverage of both masculine and feminine presentation is the goal; equal percentages are not required. Prioritize the smaller masculine pool, especially full-outfit views supporting all three body axes across builds. Preserve feminine coverage and mixed/unclear examples. Read data/sourcing/README.md before collecting; record targeted searches, actual reviewed/admitted yields and failed attempts. Recompute this report after every admission. Never fill gaps using brand, department, faces or inferred identity.', '',
  ];
  const outputs = { 'coverage.json': JSON.stringify(report, null, 2) + '\n', 'coverage.md': lines.join('\n') };
  for (const [name, text] of Object.entries(outputs)) {
    const path = `${root}data/presentation/${name}`;
    if (process.argv.includes('--check')) {
      if (!await Bun.file(path).exists() || await Bun.file(path).text() !== text) throw new Error(`Stale presentation report: ${name}`);
    } else await Bun.write(path, text);
  }
  console.log(JSON.stringify({ reviewed: report.reviewedPhotos, unreviewed: report.unreviewedPhotos, categories: report.categories }));
}

if (import.meta.main) await main();
