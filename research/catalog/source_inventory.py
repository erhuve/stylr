import json
import subprocess
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlsplit


REPO = Path(__file__).resolve().parents[2]
DATA = REPO / 'data/catalog-review'
OUTPUT = REPO / 'data/sourcing'


def read(path):
    return json.loads(path.read_text())


def key(url):
    parsed = urlsplit(url)
    return parsed.netloc.removeprefix('www.') + parsed.path.rstrip('/')


def inventory():
    subprocess.run(['bun', str(REPO / 'scripts/audit-presentation.ts')], cwd=REPO, check=True)
    manifests = [DATA / 'baseline.json', DATA / 'intake.json']
    manifests += sorted((DATA / 'batches').glob('*/intake.json'))
    manifests += sorted((DATA / 'batches').glob('*/pending-intake.json'))
    source_names = {urlsplit(row['sourceUrl']).netloc.removeprefix('www.'): row['source'] for manifest in manifests for row in read(manifest) if row.get('source')}
    pages = {}
    for manifest in manifests:
        for row in read(manifest):
            address = key(row['sourceUrl'])
            host = urlsplit(row['sourceUrl']).netloc.removeprefix('www.')
            page = pages.setdefault(address, {'sourceUrl': row['sourceUrl'], 'source': source_names.get(host, host), 'candidateIds': set(), 'manifests': set()})
            page['candidateIds'].add(row['id'])
            page['manifests'].add(str(manifest.relative_to(REPO)))
    observations = {}
    label_files = [DATA / 'labels.json'] + sorted(DATA.glob('continuation-*/labels.json')) + sorted((DATA / 'batches').glob('*/labels.json'))
    for path in label_files:
        observations.update({row['id']: row for row in read(path)})
    admitted = {row['id'] for row in read(REPO / 'scripts/reviewed-photos.json')}
    groups = defaultdict(list)
    for page in pages.values():
        page['candidateIds'] = sorted(page['candidateIds'])
        page['manifests'] = sorted(page['manifests'])
        page['reviewedCandidates'] = sum(identity in observations for identity in page['candidateIds'])
        page['admittedExpansionPhotos'] = sum(identity in admitted for identity in page['candidateIds'])
        page['completeExpansionReferences'] = sum(identity in admitted and all(value is not None for value in observations[identity]['body'].values()) for identity in page['candidateIds'])
        groups[page['source']].append(page)
    runs = []
    decisions = {}
    for path in sorted((OUTPUT / 'history').glob('*.json')) + sorted((DATA / 'batches').glob('*/sources.json')):
        payload = read(path)
        if isinstance(payload, list):
            payload = {'sources': payload, 'scope': 'Historical source log; retrieval time unspecified in this file.'}
        runs.append({'manifest': str(path.relative_to(REPO)), **payload})
        search_path = path.parent / 'searches.json'
        if search_path.exists():
            for row in read(search_path):
                address = key(row['sourceUrl'])
                observed_at = payload.get('retrievedAt') or ''
                if address not in decisions or observed_at >= decisions[address]['observedAt']:
                    decisions[address] = {**row, 'evidence': str(search_path.relative_to(REPO)), 'observedAt': observed_at}
    deferred = {address: row for address, row in decisions.items() if row['decision'] == 'eligible-deferred' and address not in pages}
    summaries = []
    for source in sorted(set(groups) | {row['source'] for row in deferred.values()}):
        source_pages = groups[source]
        candidates = {identity for page in source_pages for identity in page['candidateIds']}
        summaries.append({'source': source, 'sampledPages': len(source_pages), 'candidateImages': len(candidates), 'reviewedExpansionCandidates': sum(identity in observations for identity in candidates), 'admittedExpansionPhotos': sum(page['admittedExpansionPhotos'] for page in source_pages), 'completeExpansionReferences': sum(page['completeExpansionReferences'] for page in source_pages), 'deferredPages': sum(row['source'] == source for row in deferred.values())})
    OUTPUT.mkdir(exist_ok=True)
    for name, value in [('pages.json', sorted(pages.values(), key=lambda row: row['sourceUrl'])), ('next-pages.json', sorted(deferred.values(), key=lambda row: (row['source'], row['sourceUrl']))), ('summary.json', {'sources': summaries, 'runs': runs})]:
        (OUTPUT / name).write_text(json.dumps(value, indent=2) + '\n')
    lines = ['# Sourcing coverage', '', 'Generated from committed manifests by `research/catalog/source_inventory.py`.', '', 'Counts are photographs and source pages, not distinct people. Review/admission yields cover the expansion only; the 385 baseline photos have separate historical annotation formats. Deferred pages were text-eligible in the recorded snapshot, not visually reviewed or guaranteed still available. A short response is not proof a retailer is exhausted.', '', '| Source | Sampled pages | Candidate images | Reviewed expansion | Admitted expansion | Complete expansion | Deferred pages |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
    for row in summaries:
        lines.append('| ' + ' | '.join(str(value) for value in row.values()) + ' |')
    lines += ['', '## Presentation coverage', '', 'The image-bound presentation audit is refreshed with this inventory. Read `../presentation/coverage.md` for admitted photos, source breadth and complete body references by visible styling and build. Extensive masculine and feminine coverage matters; exact parity is not required. Prioritize the current masculine full-outfit gap. Missing reviews remain explicit; run `bun scripts/audit-presentation.ts --check --require-complete` before completing a batch.']
    lines += ['', '## Next sourcing pass', '', 'Start with `next-pages.json`: exact source URLs, listing URLs and the manifest that observed them. Prioritize sources with useful complete-reference yield and gaps in style coverage. Use the collector again to refresh listings and skip every committed sampled page, including rejected views. Failed downloads are retry candidates recorded in sources.json; they are not successful samples.', '', 'Historical runs retain their original scope. Older runs did not record every skipped product; their absent decisions remain unknown. `pages.json` backfills only provably sampled pages, with links to the manifests containing each image ID. Raw provider responses remain in the external corpus; new run pages include snapshot hashes.']
    (OUTPUT / 'coverage.md').write_text('\n'.join(lines) + '\n')
    print(json.dumps({'sampledPages': len(pages), 'deferredPages': len(deferred), 'sources': len(summaries), 'recordedRuns': len(runs)}))


if __name__ == '__main__':
    inventory()
