import argparse
import hashlib
import json
import re
import shutil
from collections import Counter
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data/catalog-review'
AXES = {'build': {None, 1, 1.5, 2, 2.5, 3}, 'shoulderHip': {None, -1, 0, 1}, 'waist': {None, 0, 1, 2}}


def read(path):
    return json.loads(path.read_text())


def source_key(url):
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError(f'Invalid source URL: {url}')
    return parsed.hostname.removeprefix('www.') + parsed.path.rstrip('/')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def assemble(image_root=None, check=False):
    intake = read(DATA / 'intake.json')
    catalog = {row['id']: row for row in intake}
    baseline = read(DATA / 'baseline.json')
    existing_sources = {source_key(row['sourceUrl']) for row in baseline}
    existing_ids = {row['id'] for row in baseline}
    seen_hashes = {digest(ROOT / 'public' / row['src'].lstrip('/')) for row in baseline}
    records = read(DATA / 'labels.json')
    for directory in sorted(DATA.glob('continuation-*')):
        records.extend(read(directory / 'labels.json'))
    expected = read(DATA / 'manifest.json') + read(DATA / 'remaining-review-queue.json')
    if len(records) != 1193 or len({row['id'] for row in records}) != 1193 or {row['id'] for row in records} != {row['id'] for row in expected}:
        raise ValueError('Incomplete or duplicate candidate review')
    if read(DATA / 'continuation-07/remaining-review-queue.json'):
        raise ValueError('Review queue is not complete')
    for batch in sorted((DATA / 'batches').glob('*')):
        if not batch.is_dir():
            continue
        additional = read(batch / 'intake.json')
        observations = read(batch / 'labels.json')
        identities = {row['id'] for row in additional}
        if len(identities) != len(additional) or identities & catalog.keys():
            raise ValueError(f'Duplicate batch intake IDs: {batch}')
        if len(observations) != len(additional) or {row['id'] for row in observations} != identities:
            raise ValueError(f'Incomplete batch review: {batch}')
        prior_sources = existing_sources | {source_key(row['sourceUrl']) for row in catalog.values()}
        if any(source_key(row['sourceUrl']) in prior_sources for row in additional):
            raise ValueError(f'Batch reuses an earlier source page: {batch}')
        catalog.update({row['id']: row for row in additional})
        records.extend(observations)
    photos, assets, references, excluded = [], [], [], []
    for row in records:
        asset = catalog[row['id']]
        if any(row[key] != asset[key] for key in ['source', 'sourceUrl', 'localPath', 'sha256']):
            raise ValueError(f'Stale image binding: {row["id"]}')
        if set(row['body']) != set(AXES) or any(value not in AXES[axis] or isinstance(value, bool) for axis, value in row['body'].items()):
            raise ValueError(f'Invalid axes: {row["id"]}')
        if row['reviewer'] != 'primary-assistant-direct-visual' or not row['evidence'].strip():
            raise ValueError(f'Missing visual review: {row["id"]}')
        if image_root:
            original = (image_root / row['localPath']).resolve()
            if not original.is_relative_to(image_root.resolve()) or digest(original) != row['sha256']:
                raise ValueError(f'Changed original: {row["id"]}')
        view = row.get('view') or row.get('viewCorrection') or asset['viewReview']
        group = source_key(row['sourceUrl'])
        reason = None
        if view not in {'full', 'partial', 'seated'}:
            reason = 'non-outfit-view'
        elif group in existing_sources:
            reason = 'existing-source-page'
        elif row['sha256'] in seen_hashes:
            reason = 'duplicate-image'
        if reason:
            excluded.append({'id': row['id'], 'reason': reason})
            continue
        if row['id'] in existing_ids or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}', row['id']):
            raise ValueError(f'Invalid or reused ID: {row["id"]}')
        seen_hashes.add(row['sha256'])
        existing_ids.add(row['id'])
        src = f'/photos/{row["id"]}.webp'
        target = ROOT / 'public' / src.lstrip('/')
        if check:
            if digest(target) != row['sha256']:
                raise ValueError(f'Changed deployed asset: {row["id"]}')
        elif image_root:
            target.parent.mkdir(parents=True, exist_ok=True)
            if target.exists() and digest(target) != row['sha256']:
                raise ValueError(f'Refusing to overwrite different asset: {row["id"]}')
            shutil.copyfile(original, target)
        else:
            raise ValueError('Pass --image-root to import original assets')
        dimensions = {}
        for field, axis in [('styles', 'references'), ('silhouette', 'silhouette'), ('palette', 'palette')]:
            value = row.get(field)
            if value:
                dimensions[axis] = value if isinstance(value, list) else [value]
        features = []
        if row.get('silhouette') == 'loose':
            features.append('relaxed')
        elif row.get('silhouette') == 'fitted':
            features.append('fitted')
        photos.append({
            'id': row['id'], 'title': asset['title'][:180],
            'description': row.get('clothing') or f'Reviewed outfit reference from {row["source"]}.',
            'src': src, 'sourceUrl': row['sourceUrl'], 'creator': row['source'],
            'creatorUrl': 'https://' + urlsplit(row['sourceUrl']).netloc,
            'licenseUrl': row['sourceUrl'], 'sourceLabel': row['source'],
            'collection': 'unclassified', 'frame': 'unknown', 'features': features,
            'family': 'unknown', 'shoot': group, 'view': 'full' if view == 'full' else 'detail',
            'garments': [], 'shoesKnown': False, 'bottomKnown': False,
            'dimensions': dimensions, 'metadataBasis': 'visual-review',
        })
        assets.append({'id': row['id'], 'src': src, 'url': asset['imageUrl'], 'sha256': row['sha256'], 'sourceUrl': row['sourceUrl'], 'reviewedView': view})
        references.append({'id': row['id'], **row['body']})
    summary = {
        'reviewedCandidates': len(records), 'admittedPhotos': len(photos),
        'totalPhotos': len(baseline) + len(photos),
        'axisSupport': {axis: sum(row[axis] is not None for row in references) for axis in AXES},
        'completeReferences': sum(all(row[axis] is not None for axis in AXES) for row in references),
        'sourcePages': len({photo['shoot'] for photo in photos}),
        'excludedReasons': dict(Counter(row['reason'] for row in excluded)),
        'excluded': excluded,
    }
    outputs = {
        ROOT / 'scripts/reviewed-photos.json': photos,
        ROOT / 'scripts/reviewed-assets.json': assets,
        DATA / 'admitted-body.json': references,
        DATA / 'admission-summary.json': summary,
    }
    for path, value in outputs.items():
        if check:
            if read(path) != value:
                raise ValueError(f'Stale generated file: {path}')
        else:
            path.write_text(json.dumps(value, indent=2) + '\n')
    print(json.dumps({key: value for key, value in summary.items() if key != 'excluded'}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Validate reviews and import unchanged outfit assets; no predictions or label propagation.')
    parser.add_argument('--image-root', type=Path)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    assemble(args.image_root, args.check)
