import csv
import hashlib
import json
import sys
from collections import Counter, defaultdict, deque
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

import os

ROOT = Path(os.environ['STYLR_INTAKE_ROOT']).resolve()
OUTPUT = ROOT / 'body-style-review' / 'continuation-01'
PREVIOUS = OUTPUT.parent
if len(sys.argv) > 2:
    batch = int(sys.argv[2])
    assert batch >= 1
    OUTPUT = ROOT / 'body-style-review' / f'continuation-{batch:02}'
    PREVIOUS = OUTPUT.parent if batch == 1 else OUTPUT.parent / f'continuation-{batch - 1:02}'
AXES = ['build', 'shoulderHip', 'waist']


def save(name, value):
    (OUTPUT / name).write_text(json.dumps(value, indent=2) + '\n')


def prepare():
    queue = json.loads((PREVIOUS / 'remaining-review-queue.json').read_text())
    catalog = {row['id']: row for row in json.loads((ROOT / 'expansion-2026-09-15/combined-reviewed.json').read_text())}
    sources = defaultdict(deque)
    for row in queue:
        sources[row['source']].append(row)
    selected = []
    target = min(120, len(queue))
    while len(selected) < target:
        for source in sorted(sources):
            if sources[source] and len(selected) < target:
                selected.append(sources[source].popleft())
    selected.sort(key=lambda row: (row['source'], row['id']))
    manifest = [{'ordinal': ordinal, **catalog[row['id']]} for ordinal, row in enumerate(selected, 1)]
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / 'sheets').mkdir(exist_ok=True)
    if (OUTPUT / 'manifest.json').exists():
        assert json.loads((OUTPUT / 'manifest.json').read_text()) == manifest
    save('manifest.json', manifest)
    for start in range(0, len(manifest), 12):
        canvas = Image.new('RGB', (1440, 1440), '#f6f3ec')
        draw = ImageDraw.Draw(canvas)
        for offset, record in enumerate(manifest[start:start + 12]):
            path = ROOT / record['localPath']
            assert hashlib.sha256(path.read_bytes()).hexdigest() == record['sha256']
            left, top = offset % 4 * 360, offset // 4 * 480
            with Image.open(path) as original:
                photo = ImageOps.contain(original.convert('RGB'), (352, 448))
                canvas.paste(photo, (left + (360 - photo.width) // 2, top + 26 + (448 - photo.height) // 2))
            draw.text((left + 6, top + 6), f"{record['ordinal']:03} {record['source']}", fill='black')
        canvas.save(OUTPUT / 'sheets' / f'{start // 12 + 1:02}.jpg', quality=94)
    print(f'Prepared {len(manifest)} bound candidates in {OUTPUT}')


def audit():
    manifest = json.loads((OUTPUT / 'manifest.json').read_text())
    queue = json.loads((PREVIOUS / 'remaining-review-queue.json').read_text())
    earlier = json.loads((OUTPUT.parent / 'labels.json').read_text())
    for directory in sorted(OUTPUT.parent.glob('continuation-*')):
        if directory.name < OUTPUT.name:
            earlier.extend(json.loads((directory / 'labels.json').read_text()))
    catalog = {row['id']: row for row in json.loads((ROOT / 'expansion-2026-09-15/combined-reviewed.json').read_text())}
    with (OUTPUT / 'observations.tsv').open() as stream:
        observations = list(csv.DictReader(stream, delimiter='\t'))
    target = min(120, len(queue))
    assert len(manifest) == len(observations) == target
    assert [int(row['ordinal']) for row in observations] == list(range(1, target + 1))
    reviewed_ids = {row['id'] for row in manifest}
    assert len(reviewed_ids) == target
    assert reviewed_ids <= {row['id'] for row in queue}
    assert not reviewed_ids & {row['id'] for row in earlier}
    assert len({row['sha256'] for row in manifest}) == target
    labels = []
    for asset, observation in zip(manifest, observations):
        assert {key: value for key, value in asset.items() if key != 'ordinal'} == catalog[asset['id']]
        assert hashlib.sha256((ROOT / asset['localPath']).read_bytes()).hexdigest() == asset['sha256']
        body = {axis: None if observation[axis] == '?' else float(observation[axis]) for axis in AXES}
        assert body['build'] in {None, 1, 1.5, 2, 2.5, 3}
        assert body['shoulderHip'] in {None, -1, 0, 1}
        assert body['waist'] in {None, 0, 1, 2}
        assert observation['view'] in {'full', 'partial', 'seated', 'back', 'detail', 'reject'}
        assert observation['evidence'].strip() and observation['clothing'].strip()
        if observation['view'] in {'detail', 'reject'}:
            assert all(value is None for value in body.values())
        labels.append({
            **{key: asset[key] for key in ['ordinal', 'id', 'source', 'sourceUrl', 'localPath', 'sha256']},
            'body': body, 'view': observation['view'], 'previousView': asset['viewReview'],
            'clothing': observation['clothing'], 'evidence': observation['evidence'],
            'reviewer': 'primary-assistant-direct-visual', 'reviewedAt': '2026-09-16',
            'confidence': 'provisional-single-reviewer',
            'sheet': f"sheets/{(asset['ordinal'] - 1) // 12 + 1:02}.jpg",
        })
    remaining = [row for row in queue if row['id'] not in reviewed_ids]
    assert len(remaining) + len(labels) == len(queue)
    assert len({row['id'] for row in queue}) == len(queue)
    reread = json.loads((OUTPUT / 'reread.json').read_text())
    for correction in reread['corrections']:
        assert labels[correction['ordinal'] - 1]['body'][correction['axis']] == correction['after']
    summary = {
        'reviewedPhotos': len(labels), 'sources': dict(Counter(row['source'] for row in labels)),
        'axisSupport': {axis: sum(row['body'][axis] is not None for row in labels) for axis in AXES},
        'allThreeLabeled': sum(all(row['body'][axis] is not None for axis in AXES) for row in labels),
        'buildBands': dict(Counter(str(row['body']['build']) for row in labels)),
        'views': dict(Counter(row['view'] for row in labels)),
        'remainingPhotos': len(remaining), 'totalReviewedIncludingFullStandingPass': len(earlier) + len(labels),
        'matchingProjectionUpdated': False, 'deployed': False,
    }
    save('labels.json', labels)
    save('remaining-review-queue.json', remaining)
    save('summary.json', summary)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    {'prepare': prepare, 'audit': audit}[sys.argv[1]]()
