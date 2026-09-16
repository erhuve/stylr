import hashlib
import json
import sys
import csv
import statistics
from collections import Counter
from urllib.parse import urlsplit
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

import os

ROOT = Path(os.environ['STYLR_INTAKE_ROOT']).resolve()
OUTPUT = ROOT / 'body-style-review'
AXES = ['build', 'shoulderHip', 'waist']
LIMITS = [0.5, 0.75, 0.75]
STYLES = {'everyday', 'sport', 'workwear', 'dark-casual', 'goth', 'romantic', 'punk', 'industrial', 'maximalist', 'experimental', 'tailored', 'preppy', 'kimono'}


def source_key(url):
    parts = urlsplit(url)
    return parts.netloc.lower().removeprefix('www.') + parts.path.rstrip('/')


def complete(body):
    return all(body[axis] is not None for axis in AXES)


def matches(body, selection):
    return complete(body) and all(abs(body[axis] - target) <= limit for axis, target, limit in zip(AXES, selection, LIMITS))


def write_json(name, value):
    (OUTPUT / name).write_text(json.dumps(value, indent=2) + '\n')


def summarize_counts(counts):
    return {'min': min(counts), 'median': statistics.median(counts), 'max': max(counts), 'empty': counts.count(0), 'atMostFive': sum(count <= 5 for count in counts), 'atLeastTwenty': sum(count >= 20 for count in counts), 'atLeastFifty': sum(count >= 50 for count in counts)}


def audit():
    manifest = json.loads((OUTPUT / 'manifest.json').read_text())
    with (OUTPUT / 'observations.tsv').open() as stream:
        observations = list(csv.DictReader(stream, delimiter='\t'))
    assert len(manifest) == len(observations) == 411
    assert len({record['id'] for record in manifest}) == 411
    assert len({record['sha256'] for record in manifest}) == 411
    assert [int(row['ordinal']) for row in observations] == list(range(1, 412))
    catalog = json.loads((ROOT / 'baseline/catalog.json').read_text())
    baseline = json.loads((ROOT / 'baseline/reviewed.json').read_text())
    baseline_grid = json.loads((ROOT / 'baseline/coverage.json').read_text())
    baseline_sources = {source_key(row['sourceUrl']) for row in catalog}
    old_by_id = {row['id']: row for row in catalog}
    records = []
    for asset, observation in zip(manifest, observations):
        assert hashlib.sha256((ROOT / asset['localPath']).read_bytes()).hexdigest() == asset['sha256']
        body = {axis: None if observation[axis] == '?' else float(observation[axis]) for axis in AXES}
        assert body['build'] in {None, 1, 1.5, 2, 2.5, 3}
        assert body['shoulderHip'] in {None, -1, 0, 1}
        assert body['waist'] in {None, 0, 1, 2}
        styles = observation['styles'].split(',')
        assert set(styles) <= STYLES and len(set(styles)) == len(styles)
        assert observation['silhouette'] in {'fitted', 'mixed', 'loose', 'layered', 'waist-defined'}
        assert observation['palette'] in {'dark', 'muted', 'neutral', 'colorful', 'multicolor', 'pastel'}
        ordinal = asset['ordinal']
        record = {
            'id': asset['id'], 'ordinal': ordinal, 'source': asset['source'],
            'sourceUrl': asset['sourceUrl'], 'sourceGroup': source_key(asset['sourceUrl']),
            'localPath': asset['localPath'], 'sha256': asset['sha256'],
            'body': body, 'styles': styles, 'silhouette': observation['silhouette'],
            'palette': observation['palette'], 'evidence': observation['evidence'],
            'reviewer': 'primary-assistant-direct-visual', 'reviewedAt': '2026-09-16',
            'sheet': f'sheets/{(ordinal - 1) // 24 + 1:02}.jpg',
            'viewCorrection': 'back-view' if ordinal in {102, 114} else None,
            'overlapsExistingSourcePage': source_key(asset['sourceUrl']) in baseline_sources,
            'confidence': 'provisional-single-reviewer',
        }
        record['eligibleForProjectedMatching'] = complete(body) and record['viewCorrection'] is None and not record['overlapsExistingSourcePage']
        records.append(record)
    write_json('labels.json', records)
    additions = [row for row in records if row['eligibleForProjectedMatching']]
    cells = []
    for cell in baseline_grid['cells']:
        selection = cell['selection']
        before_ids = [photo_id for photo_id, body in baseline.items() if matches(body, selection)]
        assert set(before_ids) == set(cell['photoIds'])
        selected = [row for row in additions if matches(row['body'], selection)]
        before_groups = {source_key(old_by_id[photo_id]['sourceUrl']) for photo_id in before_ids}
        new_groups = {row['sourceGroup'] for row in selected}
        family_groups = {style: len({row['sourceGroup'] for row in selected if style in row['styles']}) for style in sorted(STYLES)}
        cells.append({
            'selection': selection, 'beforePhotos': len(before_ids),
            'newPhotos': len(selected), 'projectedPhotos': len(before_ids) + len(selected),
            'beforeSourceGroups': len(before_groups), 'newSourceGroups': len(new_groups),
            'projectedSourceGroups': len(before_groups | new_groups),
            'newSources': len({row['source'] for row in selected}),
            'newStyleFamilies': sum(count > 0 for count in family_groups.values()),
            'newStyleSourceGroups': family_groups,
            'newSilhouettes': len({row['silhouette'] for row in selected}),
            'newPalettes': len({row['palette'] for row in selected}),
            'largestNewSourceShare': max(Counter(row['source'] for row in {row['sourceGroup']: row for row in selected}.values()).values(), default=0) / max(1, len(new_groups)),
            'newPhotoIds': [row['id'] for row in selected],
        })
    write_json('coverage-grid.json', cells)
    with (OUTPUT / 'coverage-grid.csv').open('w') as stream:
        fields = ['build', 'shoulderHip', 'waist', 'beforePhotos', 'newPhotos', 'projectedPhotos', 'beforeSourceGroups', 'newSourceGroups', 'projectedSourceGroups', 'newSources', 'newStyleFamilies', 'newSilhouettes', 'newPalettes', 'largestNewSourceShare']
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader()
        for cell in cells:
            writer.writerow({**dict(zip(AXES, cell['selection'])), **{key: cell[key] for key in fields if key not in AXES}})
    bands = []
    for band in [1, 1.5, 2, 2.5, 3]:
        selected = [row for row in records if row['body']['build'] == band]
        accepted = [row for row in selected if row['eligibleForProjectedMatching']]
        bands.append({'build': band, 'reviewedPhotos': len(selected), 'sourceGroups': len({row['sourceGroup'] for row in selected}), 'completePhotos': sum(complete(row['body']) for row in selected), 'newMatchingPhotos': len(accepted), 'newMatchingGroups': len({row['sourceGroup'] for row in accepted}), 'matchingSources': len({row['source'] for row in accepted}), 'stylesAcrossAllReviewed': {style: len({row['sourceGroup'] for row in selected if style in row['styles']}) for style in sorted(STYLES)}, 'stylesWithCompleteBody': {style: len({row['sourceGroup'] for row in accepted if style in row['styles']}) for style in sorted(STYLES)}})
    summary = {
        'reviewedPhotos': len(records), 'buildLabeled': sum(row['body']['build'] is not None for row in records),
        'allThreeLabeled': sum(complete(row['body']) for row in records),
        'sourceGroups': len({row['sourceGroup'] for row in records}),
        'sourcePageOverlapPhotos': sum(row['overlapsExistingSourcePage'] for row in records),
        'eligibleNewPhotos': len(additions), 'eligibleNewSourceGroups': len({row['sourceGroup'] for row in additions}),
        'viewCorrections': [row['id'] for row in records if row['viewCorrection']],
        'axes': {axis: dict(Counter(str(row['body'][axis]) for row in records)) for axis in AXES},
        'bands': bands, 'sampledSliderPositions': len(cells),
        'before': summarize_counts([cell['beforePhotos'] for cell in cells]),
        'projected': summarize_counts([cell['projectedPhotos'] for cell in cells]),
        'projectedGrouped': summarize_counts([cell['projectedSourceGroups'] for cell in cells]),
        'positionsImproved': sum(cell['newPhotos'] > 0 for cell in cells),
        'positionsWithTwentyNewGroupsThreeSourcesFourStyles': sum(cell['newSourceGroups'] >= 20 and cell['newSources'] >= 3 and cell['newStyleFamilies'] >= 4 for cell in cells),
        'inputDigests': {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in [OUTPUT / 'manifest.json', OUTPUT / 'observations.tsv', ROOT / 'baseline/reviewed.json', ROOT / 'baseline/catalog.json', ROOT / 'baseline/coverage.json']},
    }
    write_json('summary.json', summary)
    draw_coverage(cells)
    all_candidates = json.loads((ROOT / 'expansion-2026-09-15/combined-reviewed.json').read_text())
    queue = [{'id': row['id'], 'source': row['source'], 'localPath': row['localPath'], 'view': row['viewReview'], 'reason': 'Not included in this full-standing review; assess visible axes independently.'} for row in all_candidates if row['viewReview'] in {'partial', 'seated', 'unreviewed'}]
    write_json('remaining-review-queue.json', queue)
    report(summary, cells, queue)
    print(json.dumps({key: value for key, value in summary.items() if key not in {'bands', 'inputDigests', 'viewCorrections'}}, indent=2))


def draw_coverage(cells):
    panels = [(1, 'Slender'), (1.5, 'Slender–intermediate'), (2, 'Intermediate'), (2.5, 'Intermediate–fuller'), (3, 'Fuller / broader')]
    elements = ['<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="870" viewBox="0 0 1120 870" role="img" aria-labelledby="title desc">', '<title id="title">Projected Stylr coverage by body proportions</title>', '<desc id="desc">Five build panels. Rows are hip-broader, balanced, shoulder-broader. Columns are straight, moderate, pronounced waist. Each cell counts source-page groups after staged additions, not distinct outfits.</desc>', '<rect width="1120" height="870" fill="#f6f3ec"/>', '<g font-family="sans-serif" fill="#262c28">', '<text x="30" y="40" font-size="25">Projected choices across body proportions</text>', '<text x="30" y="68" font-size="15">Source-page groups, after staged additions · current matching tolerances · not deployed</text>']
    for index, (build, name) in enumerate(panels):
        left, top = 30 + index % 3 * 365, 115 + index // 3 * 350
        elements.append(f'<text x="{left}" y="{top}" font-size="19">{name}</text>')
        for column, label in enumerate(['Straight', 'Moderate', 'Pronounced']):
            elements.append(f'<text x="{left + 120 + column * 77}" y="{top + 35}" font-size="11" text-anchor="middle">{label}</text>')
        for row, (shoulder, label) in enumerate([(-1, 'Hips wider'), (0, 'Balanced'), (1, 'Shoulders +')]):
            elements.append(f'<text x="{left}" y="{top + 91 + row * 77}" font-size="11">{label}</text>')
            for column, waist in enumerate([0, 1, 2]):
                cell = next(cell for cell in cells if cell['selection'] == [build, shoulder, waist])
                count = cell['projectedSourceGroups']
                color = '#e8dfd9' if count == 0 else '#ecd7b0' if count < 10 else '#cbd9c8' if count < 20 else '#88b29b' if count < 50 else '#47785d'
                text_color = '#ffffff' if count >= 50 else '#262c28'
                x_coord, y_coord = left + 83 + column * 77, top + 50 + row * 77
                elements.append(f'<rect x="{x_coord}" y="{y_coord}" width="73" height="73" rx="5" fill="{color}"/>')
                elements.append(f'<text x="{x_coord + 36}" y="{y_coord + 46}" text-anchor="middle" font-size="27" fill="{text_color}">{count}</text>')
    elements += ['<text x="770" y="515" font-size="18">How to read</text>', '<text x="770" y="549" font-size="14">Rows: shoulder / hip balance</text>', '<text x="770" y="576" font-size="14">Columns: waist indentation</text>', '<text x="770" y="619" font-size="14">0 = no reviewed match</text>', '<text x="770" y="646" font-size="14">Darker green = more source groups</text>', '<text x="770" y="689" font-size="14">Groups can repeat people or outfits.</text>', '<text x="770" y="716" font-size="14">More groups do not guarantee variety.</text>', '<text x="30" y="834" font-size="14">Review: 411 photos · 111 eligible additions across 92 new source groups · provisional visual labels</text>', '</g></svg>']
    (OUTPUT / 'coverage.svg').write_text('\n'.join(elements) + '\n')


def report(summary, cells, queue):
    lines = ['# Stylr body × style coverage review', '', '2026-09-16 · Full-standing candidate pass complete · Staged only; not deployed', '',
             f"Direct visual review of all {summary['reviewedPhotos']} photographs previously classified as full standing, on 18 numbered contact sheets. {summary['buildLabeled']} support an apparent-build label; {summary['allThreeLabeled']} support all three current axes. These are provisional observations by one assistant, not measurements or independent reviewer agreement.", '',
             '## New reviewed references', '', '| Apparent build | Build-labeled photos | Source groups | Complete three-axis photos | New matching source groups | Matching sources |', '|---|---:|---:|---:|---:|---:|']
    names = {1: 'Slender', 1.5: 'Slender–intermediate', 2: 'Intermediate', 2.5: 'Intermediate–fuller', 3: 'Fuller/broader'}
    for band in summary['bands']:
        lines.append(f"| {names[band['build']]} | {band['reviewedPhotos']} | {band['sourceGroups']} | {band['completePhotos']} | {band['newMatchingGroups']} | {band['matchingSources']} |")
    lines += ['', 'Counts are exact label bands, not slider-match counts. A source group is one normalized source page, not a verified person or distinct outfit. Groups may appear in multiple build bands because product pages can show several people. Complete labels do not establish fit.', '', '![Projected source-group coverage by build, shoulder/hip balance and waist](coverage.svg)', '',
              '## Projected matching with current tolerances', '',
              f"Using the same 4,913 sampled positions and tolerances (build ±0.5; shoulder/hip and waist ±0.75), adding the eligible staged photos changes median image matches from {summary['before']['median']} to {summary['projected']['median']}. Empty positions change from {summary['before']['empty']} to {summary['projected']['empty']}; positions with at most five matches change from {summary['before']['atMostFive']} to {summary['projected']['atMostFive']}.", '',
              f"After grouping source pages, projected median choice is {summary['projectedGrouped']['median']} source groups, with {summary['projectedGrouped']['atLeastTwenty']} positions reaching 20 groups and {summary['projectedGrouped']['atLeastFifty']} reaching 50. {summary['positionsWithTwentyNewGroupsThreeSourcesFourStyles']} positions gain at least 20 new groups spanning at least three sources and four broad style families. These are overlapping diagnostic positions, not independent body types or population coverage.", '',
              f"{summary['eligibleNewPhotos']} new photos across {summary['eligibleNewSourceGroups']} source groups enter this projection. {summary['sourcePageOverlapPhotos']} reviewed images overlap an existing catalog source page and are conservatively excluded from additions. Two earlier framing labels are corrected to back views in the staged labels. Every baseline grid result was reproduced exactly before calculating gains.", '',
              '## Style diversity among complete new body references', '', '| Exact build band | ' + ' | '.join(sorted(STYLES)) + ' |', '|---|' + '---:|' * len(STYLES)]
    for band in summary['bands']:
        lines.append('| ' + names[band['build']] + ' | ' + ' | '.join(str(band['stylesWithCompleteBody'][style]) for style in sorted(STYLES)) + ' |')
    lines += ['', 'Entries count source groups carrying a visually reviewed style tag and complete body labels. Tags overlap: do not sum columns as unique outfits. Industrial, experimental and maximalist are broad visual descriptions; they do not certify a subculture. Full style histograms, including incomplete-body references, are preserved in summary.json.', '',
              '## What to prioritize', '',
              '1. Broader-build industrial and experimental looks with visible torso and upper-hip contours. The expressive street photographs add style breadth but many hide the proportions required by the current filter.',
              '2. Straighter-waist and pronounced-waist references across the build range. Moderate indentation dominates this intake; do not widen the filter to disguise this.',
              '3. Broader-shouldered references outside narrow-build punk and casual outfits, especially pastel, romantic and colorful looks.',
              '4. More independent sources within hip-broader everyday references. Numerous repeated studio/garden views can make a region appear healthier than its actual choice.',
              '5. Review cropped and seated candidates before more downloads. Cropping is not an automatic reason to reject visible body traits. Keep these separate from claims about a complete standing outfit.', '',
              '## Review protocol and limits', '',
              '- Build: 1 slender, 1.5 slender–intermediate, 2 intermediate, 2.5 intermediate–fuller, 3 fuller/broader. The upper band remains broad; this pass does not claim to distinguish every larger build.',
              '- Shoulder/hip: -1 hips broader, 0 similar width, 1 shoulders broader. Waist: 0 straighter, 1 moderate indentation, 2 pronounced indentation. Unknown axes remain null independently.',
              '- Ordinary clothing can support an apparent-build judgment from several visible cues. Corsets, structured shoulders, full skirts and strong turns may invalidate local comparisons without invalidating build. No inferred gender, age, health, height, weight, clothing size or person identity.',
              '- Body labels were authored from pixels, not retailer titles, product sizing or model predictions. Source names appear on sheets for traceability; some source photographs themselves contain text. That text was not used as measurement evidence.',
              '- Style families, garment silhouette and palette are separately authored observations. Silhouette describes the outfit, not the body. No softness, stretch, breathability or comfort-performance labels were inferred.',
              '- Calibration reread: all seven existing pronounced-waist references and twelve selected new images were inspected on four larger sheets. Nine new records were corrected for waist strength, obscured shoulders, corset construction or width balance. This is a targeted same-reviewer check, not an independent reliability estimate.',
              '- Original image digests are checked on every audit. Numbered records map to immutable IDs in manifest.json. observations.tsv is the authored source; labels.json, coverage-grid.json, coverage-grid.csv and summary.json are generated.',
              '- No labels are transferred across faces, product galleries or source accounts. Grouping removes repeated page contributions only; recolors and similar outfits across different pages can still overcount diversity.',
              f"- Remaining queue: {len(queue)} partial, seated or previously unreviewed candidates. This pass covers all 411 full-standing candidates, not all 1,676 downloaded images. Back views, detail-only and rejected images are outside this queue.",
              '- Existing live labels, photos, source browser, application code and saved reactions are unchanged. Projection is not a claim of deployed improvement.', '',
              '## Reproduce', '', 'Run `python /home/workspace/Documents/stylr-catalog-pilot/review_body_coverage.py audit`. No network, classifier or app build is required. `prepare` regenerates primary sheets; `calibration` regenerates the four calibration sheets.', '',
              '## Representative slider regions', '', '| Build | Shoulder/hip | Waist | Before photos | New photos | Projected source groups | New sources | New style families |', '|---:|---:|---:|---:|---:|---:|---:|---:|']
    for cell in cells:
        if cell['selection'][0] in names and cell['selection'][1] in {-1, 0, 1} and cell['selection'][2] in {0, 1, 2}:
            lines.append('| ' + ' | '.join(str(value) for value in [*cell['selection'], cell['beforePhotos'], cell['newPhotos'], cell['projectedSourceGroups'], cell['newSources'], cell['newStyleFamilies']]) + ' |')
    (OUTPUT / 'README.md').write_text('\n'.join(lines) + '\n')


def prepare():
    OUTPUT.mkdir(exist_ok=True)
    (OUTPUT / 'sheets').mkdir(exist_ok=True)
    candidates = json.loads((ROOT / 'expansion-2026-09-15/combined-reviewed.json').read_text())
    records = sorted((record for record in candidates if record.get('viewReview') == 'full'), key=lambda record: (record['source'], record['id']))
    manifest = []
    for index, record in enumerate(records, 1):
        path = ROOT / record['localPath']
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if digest != record['sha256']:
            raise ValueError(record['id'])
        manifest.append({'ordinal': index, **record})
    manifest_path = OUTPUT / 'manifest.json'
    if manifest_path.exists() and json.loads(manifest_path.read_text()) != manifest:
        raise ValueError('The review mapping changed. Create a separately versioned review instead of replacing existing ordinal bindings.')
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    for start in range(0, len(manifest), 24):
        canvas = Image.new('RGB', (1680, 1600), '#f6f3ec')
        draw = ImageDraw.Draw(canvas)
        for offset, record in enumerate(manifest[start:start + 24]):
            left = (offset % 6) * 280
            top = (offset // 6) * 400
            with Image.open(ROOT / record['localPath']) as original:
                photo = ImageOps.contain(original.convert('RGB'), (276, 368))
                canvas.paste(photo, (left + (280 - photo.width) // 2, top + 24 + (368 - photo.height) // 2))
            draw.text((left + 6, top + 5), f"{record['ordinal']:03}  {record['source']}", fill='black')
        path = OUTPUT / 'sheets' / f'{start // 24 + 1:02}.jpg'
        canvas.save(path, quality=93)
        print(path)


def calibration():
    manifest = json.loads((OUTPUT / 'manifest.json').read_text())
    baseline = json.loads((ROOT / 'baseline/reviewed.json').read_text())
    catalog = json.loads((ROOT / 'baseline/catalog.json').read_text())
    examples = []
    for record in catalog:
        body = baseline.get(record['id'], {})
        if body.get('waist') == 2:
            examples.append((Path(__file__).resolve().parents[2] / 'public' / record['src'].lstrip('/'), f"OLD {record['id']} {body}"))
    for ordinal in [20, 41, 49, 50, 55, 58, 74, 96, 122, 188, 239, 396]:
        record = manifest[ordinal - 1]
        examples.append((ROOT / record['localPath'], f"NEW {ordinal}"))
    for start in range(0, len(examples), 6):
        canvas = Image.new('RGB', (1440, 1280), '#f6f3ec')
        draw = ImageDraw.Draw(canvas)
        for offset, (path, label) in enumerate(examples[start:start + 6]):
            left, top = offset % 3 * 480, offset // 3 * 640
            with Image.open(path) as original:
                photo = ImageOps.contain(original.convert('RGB'), (476, 600))
                canvas.paste(photo, (left + (480 - photo.width) // 2, top + 36 + (600 - photo.height) // 2))
            draw.text((left + 4, top + 4), label[:70], fill='black')
            draw.text((left + 4, top + 17), label[70:140], fill='black')
        path = OUTPUT / 'sheets' / f'calibration-{start // 6 + 1}.jpg'
        canvas.save(path, quality=94)
        print(path)


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == 'calibration':
        calibration()
    elif len(sys.argv) > 1 and sys.argv[1] == 'audit':
        audit()
    else:
        prepare()
