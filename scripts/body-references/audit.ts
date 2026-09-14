import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PHOTOS } from '../../src/lib/photo-catalog';
import { assemble, coverage, validate } from './annotations';

const root = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const command = args[0] ?? 'validate';
const value = (flag: string) => {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing value for ${flag}`);
  return args[index + 1];
};

if (command === '--help' || command === 'help') {
  console.log('Body-reference labeling audit (no UI, network or asset writes)\n\n  bun scripts/body-references/audit.ts validate [--file labels.json]\n  bun scripts/body-references/audit.ts report [--file labels.json] [--out coverage.json]\n  bun scripts/body-references/audit.ts assemble --from observations.json --date YYYY-MM-DD [--out labels.json]\n\nPaths are absolute or relative to this worktree. Every command verifies the current catalog and image-byte digests. The date is the observation date, not a claimed measurement date.');
  process.exit(0);
}
if (!['validate', 'report', 'assemble'].includes(command)) throw new Error(`Unknown command: ${command}`);
const defaultFile = resolve(root, 'data/body-references/labels.v1.json');
const assets = await Promise.all(PHOTOS.map(async photo => ({
  photoId: photo.id,
  sourceUrl: photo.sourceUrl,
  assetSha256: createHash('sha256').update(await readFile(resolve(root, 'public', photo.src.replace(/^\//, '')))).digest('hex'),
})));
let bundle;
if (command === 'assemble') {
  const from = value('--from');
  const date = value('--date');
  if (!from || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) {
    throw new Error('assemble requires --from and a valid --date YYYY-MM-DD');
  }
  bundle = assemble(JSON.parse(await readFile(resolve(root, from), 'utf8')), assets, date);
  const output = resolve(root, value('--out') ?? defaultFile);
  await writeFile(output, JSON.stringify(bundle, null, 2) + '\n');
  console.log(`Wrote ${bundle.labels.length} source-bound observation records to ${output}`);
} else {
  const input = resolve(root, value('--file') ?? defaultFile);
  bundle = validate(JSON.parse(await readFile(input, 'utf8')), assets);
  if (command === 'validate') console.log(`Validated ${bundle.labels.length} unique records against current image bytes and source URLs; all photos accounted for.`);
}
if (command === 'report') {
  const text = JSON.stringify(coverage(bundle), null, 2) + '\n';
  const output = value('--out');
  if (output) {
    const destination = resolve(root, output);
    await writeFile(destination, text);
    console.log(destination);
  } else console.log(text);
}
