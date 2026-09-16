import argparse
import base64
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import html
import io
import itertools
import json
from pathlib import Path
import re
import statistics
import subprocess
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

import requests
from bs4 import BeautifulSoup
from PIL import Image, ImageOps, ImageDraw

import os

ROOT = Path(os.environ['STYLR_INTAKE_ROOT']).resolve()
SITE = Path(__file__).resolve().parents[2]
HOSTS = ['www.universalstandard.com', 'bigbudpress.com', 'kirrinfinch.com']


def save(name, value):
    path = ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def fetch(url):
    response = requests.get(url, timeout=40, headers={'User-Agent': 'Stylr personal catalog research/1.0'}, stream=True)
    response.raise_for_status()
    chunks = []
    size = 0
    for chunk in response.iter_content(65536):
        size += len(chunk)
        if size > 24 * 1024 * 1024:
            raise ValueError('Download exceeds 24 MiB')
        chunks.append(chunk)
    return b''.join(chunks)


def audit():
    folder = SITE / 'data/apparent-build'
    records = {}
    for mapping, review in [('calibration-ids.json', 'visual-review.json'), ('holdout-ids.json', 'holdout-review.json')]:
        ids = json.loads((folder / mapping).read_text())
        for row in json.loads((folder / review).read_text())['rows']:
            records[ids[row[0]]] = dict(zip(['build', 'shoulderHip', 'waist'], row[1:4]))
    catalog = json.loads(subprocess.check_output(['bun', '-e', f"import {{ PHOTOS }} from '{SITE}/src/lib/photo-catalog.ts'; console.log(JSON.stringify(PHOTOS));"], text=True))
    save('baseline/catalog.json', catalog)
    save('baseline/reviewed.json', records)
    complete = {key: value for key, value in records.items() if all(part is not None for part in value.values())}
    cells = []
    by_id = {photo['id']: photo for photo in catalog}
    for build, shoulder, waist in itertools.product([1 + index / 8 for index in range(17)], [-1 + index / 8 for index in range(17)], [index / 8 for index in range(17)]):
        matches = [key for key, value in complete.items() if abs(value['build'] - build) <= .5 and abs(value['shoulderHip'] - shoulder) <= .75 and abs(value['waist'] - waist) <= .75]
        dimensions = defaultdict(Counter)
        for key in matches:
            for group, tags in by_id[key].get('dimensions', {}).items():
                dimensions[group].update(tags)
        cells.append({'selection': [build, shoulder, waist], 'count': len(matches), 'photoIds': matches, 'dimensions': {group: dict(counts) for group, counts in dimensions.items()}})
    counts = [cell['count'] for cell in cells]
    summary = {'catalog': len(catalog), 'reviewed': len(records), 'completeThreeAxes': len(complete), 'buildBands': dict(Counter(str(value['build']) for value in records.values())), 'sampledSliderPositions': len(cells), 'empty': counts.count(0), 'atMostFive': sum(count <= 5 for count in counts), 'belowFifty': sum(count < 50 for count in counts), 'min': min(counts), 'median': statistics.median(counts), 'max': max(counts), 'limitations': 'Overlapping diagnostic grid, not population frequencies or independent body categories. All looks, no exclusions. Uses deployed nearby tolerances. Style tags are existing annotations, not an independent style review.'}
    save('baseline/coverage.json', {'summary': summary, 'cells': cells})
    print(json.dumps(summary))


def collect(limit):
    candidates = []
    statuses = []
    for host in HOSTS:
        source = host.replace('www.', '').split('.')[0]
        try:
            payload = json.loads(fetch(f'https://{host}/products.json?limit=250'))
            save(f'raw/{source}.json', payload)
            groups = defaultdict(list)
            families = Counter()
            for product in payload['products']:
                title = product['title']
                if re.search(r'underwear|brief|bra\b|gift|belt|sock|hats?\b|caps?\b|accessor|swatch|bags?\b|totes?\b|patch|sticker', product['product_type'] + ' ' + title, re.I):
                    continue
                if not product['images']:
                    continue
                family = re.split(r'\s[-–|]\s', title)[0].lower()
                if families[family] >= 3:
                    continue
                families[family] += 1
                image = product['images'][0]
                groups[product['product_type']].append({'id': f'{source}-{product["id"]}', 'source': source, 'sourceUrl': f'https://{host}/products/{product["handle"]}', 'imageUrl': image['src'], 'title': title, 'productType': product['product_type'], 'sourceText': BeautifulSoup(product.get('body_html') or '', 'html.parser').get_text(' ', strip=True), 'sourceImageAlt': image.get('alt'), 'personGroup': None, 'body': None, 'reviewStatus': 'unreviewed'})
            chosen = []
            while any(groups.values()) and len(chosen) < limit:
                for group in sorted(groups):
                    if groups[group] and len(chosen) < limit:
                        chosen.append(groups[group].pop(0))
            candidates.extend(chosen)
            statuses.append({'source': source, 'status': 'ok', 'productsFetched': len(payload['products']), 'candidates': len(chosen), 'scope': 'First public products page, 250 limit; first image per product; product-type round robin; at most three title-family variants.'})
        except Exception as error:
            statuses.append({'source': source, 'status': 'failed', 'error': str(error)})
    try:
        raw = fetch('https://wear.jp/coordinate/').decode()
        (ROOT / 'raw/wear.html').write_text(raw)
        soup = BeautifulSoup(raw, 'html.parser')
        chosen = {}
        for anchor in soup.find_all('a', href=True):
            match = re.fullmatch(r'/([^/]+)/(\d{6,})/', anchor['href'])
            if not match:
                continue
            photo = anchor.find('img')
            if not photo:
                continue
            url = photo.get('src', '')
            if not url.startswith('https://images.wear2.jp/coordinate/'):
                continue
            key = f'wear-{match[2]}'
            chosen.setdefault(key, {'id': key, 'source': 'wear', 'sourceUrl': 'https://wear.jp' + anchor['href'], 'imageUrl': url, 'title': photo.get('alt') or match[2], 'sourceText': anchor.get_text(' ', strip=True), 'personGroup': 'wear-account:' + match[1], 'personGroupBasis': 'Explicit account URL; not verified identity or proof every image shows the account holder.', 'body': None, 'reviewStatus': 'unreviewed'})
            if len(chosen) >= limit:
                break
        candidates.extend(chosen.values())
        statuses.append({'source': 'wear', 'status': 'ok', 'candidates': len(chosen), 'scope': 'First coordinate listing page; account links preserved. No height or account category converted into body labels.'})
    except Exception as error:
        statuses.append({'source': 'wear', 'status': 'failed', 'error': str(error)})
    save('candidates.json', candidates)
    save('sources.json', {'retrievedAt': datetime.now(timezone.utc).isoformat(), 'sources': statuses})
    print(json.dumps(statuses))


def download(record):
    record = {key: value for key, value in record.items() if key != 'downloadError'}
    path = ROOT / 'images' / (record['id'] + '.webp')
    try:
        if not path.exists():
            url = record['imageUrl']
            if 'cdn.shopify.com/' in url:
                parsed = urlsplit(url)
                query = dict(parse_qsl(parsed.query))
                query['width'] = '720'
                url = urlunsplit(parsed._replace(query=urlencode(query)))
            image = ImageOps.exif_transpose(Image.open(io.BytesIO(fetch(url)))).convert('RGB')
            image.thumbnail((720, 1000))
            image.save(path, 'WEBP', quality=85)
        with Image.open(path) as image:
            image.load()
            gray = image.convert('L').resize((9, 8))
            pixels = list(gray.getdata())
            bits = ''.join('1' if pixels[row * 9 + col] > pixels[row * 9 + col + 1] else '0' for row in range(8) for col in range(8))
            return {**record, 'localPath': str(path.relative_to(ROOT)), 'width': image.width, 'height': image.height, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'dhash': f'{int(bits, 2):016x}'}
    except Exception as error:
        return {**record, 'downloadError': str(error)}


def assets():
    (ROOT / 'images').mkdir(exist_ok=True)
    candidates = json.loads((ROOT / 'candidates.json').read_text())
    with ThreadPoolExecutor(max_workers=4) as executor:
        records = list(executor.map(download, candidates))
    save('candidates.json', records)
    valid = [record for record in records if 'sha256' in record]
    pairs = []
    for index, record in enumerate(valid):
        for other in valid[:index]:
            distance = (int(record['dhash'], 16) ^ int(other['dhash'], 16)).bit_count()
            if record['sha256'] == other['sha256'] or distance <= 5:
                pairs.append({'ids': [record['id'], other['id']], 'exact': record['sha256'] == other['sha256'], 'hashDistance': distance})
    save('duplicate-candidates.json', pairs)
    print(f'Downloaded {len(valid)}/{len(records)}; {len(pairs)} duplicate candidates require review.')
    return valid


def browse(records):
    sample = []
    for source in sorted({record['source'] for record in records}):
        group = [record for record in records if record['source'] == source]
        selected = [group[index] for index in sorted({round(index * (len(group) - 1) / 11) for index in range(min(12, len(group)))})]
        sheet = Image.new('RGB', (1200, 1200), 'white')
        draw = ImageDraw.Draw(sheet)
        for index, record in enumerate(selected):
            with Image.open(ROOT / record['localPath']) as original:
                thumb = ImageOps.contain(original, (290, 355))
                left, top = (index % 4) * 300, (index // 4) * 400
                sheet.paste(thumb, (left + (300 - thumb.width) // 2, top))
                draw.text((left + 5, top + 358), f'{source} {index + 1}\n{record["id"]}', fill='black')
            sample.append({'sheet': f'{source}.jpg', 'position': index + 1, 'id': record['id']})
        sheet.save(ROOT / f'{source}.jpg', quality=92)
    save('review-sample.json', sample)
    def image_source(record):
        encoded = base64.b64encode((ROOT / record['localPath']).read_bytes()).decode('ascii')
        return f'data:image/webp;base64,{encoded}'

    cards = ''.join(f'<article data-source="{html.escape(record["source"])}"><img loading="lazy" src="{image_source(record)}" alt="Candidate outfit photograph"><p>{html.escape(record["source"])} · <a href="{html.escape(record["sourceUrl"], quote=True)}">{html.escape(record["title"][:90])}</a></p><small>{record["id"]} · Unreviewed candidate</small></article>' for record in records)
    (ROOT / 'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Stylr source pilot</title><style>body{font:16px system-ui;background:#f6f3ed;color:#242424;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:20px}img{width:100%;height:340px;object-fit:contain;background:white}article{min-width:0}select{font:inherit;padding:10px;margin-bottom:20px}small{overflow-wrap:anywhere}</style><h1>Stylr source pilot</h1><p>Candidate intake, separate from the live catalog. Body labels and outfit suitability require visual review.</p><label>Source <select id="source"><option value="all">All sources</option>' + ''.join(f'<option>{source}</option>' for source in sorted({record['source'] for record in records})) + '</select></label><main>' + cards + '</main><script>document.querySelector("select").onchange=event=>document.querySelectorAll("article").forEach(card=>card.hidden=event.target.value!=="all"&&card.dataset.source!==event.target.value)</script></html>')


def galleries():
    (ROOT / 'images').mkdir(exist_ok=True)
    targets = {'kirrinfinch': [7483605876807, 7454828724295], 'universalstandard': [7647484084270, 7647484215342]}
    records = []
    for source, product_ids in targets.items():
        payload = json.loads((ROOT / f'raw/{source}.json').read_text())
        for product in payload['products']:
            if product['id'] not in product_ids:
                continue
            parent = f'{source}-{product["id"]}'
            for index, photo in enumerate(product['images'][:8]):
                records.append({'id': f'{parent}-gallery-{index}', 'parentCandidate': parent, 'source': source, 'imageUrl': photo['src'], 'galleryIndex': index, 'reviewStatus': 'unreviewed'})
    with ThreadPoolExecutor(max_workers=4) as executor:
        downloaded = list(executor.map(download, records))
    save('gallery-probe.json', downloaded)
    for parent in sorted({record['parentCandidate'] for record in downloaded}):
        group = [record for record in downloaded if record['parentCandidate'] == parent and 'localPath' in record]
        sheet = Image.new('RGB', (1200, 800), 'white')
        draw = ImageDraw.Draw(sheet)
        for index, record in enumerate(group):
            with Image.open(ROOT / record['localPath']) as original:
                thumb = ImageOps.contain(original, (290, 365))
                left, top = index % 4 * 300, index // 4 * 400
                sheet.paste(thumb, (left + (300 - thumb.width) // 2, top))
                draw.text((left + 5, top + 370), f'Gallery image {record["galleryIndex"]}', fill='black')
        sheet.save(ROOT / f'{parent}-gallery.jpg', quality=92)
    print(f'Gallery probe: {sum("localPath" in record for record in downloaded)}/{len(downloaded)} assets.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Read-only live-catalog audit and bounded external photo-source pilot. Writes only beside this script.')
    parser.add_argument('command', choices=['audit', 'collect', 'download', 'browse', 'galleries'])
    parser.add_argument('--per-source', type=int, default=60)
    args = parser.parse_args()
    if not 1 <= args.per_source <= 100:
        parser.error('--per-source must be between 1 and 100')
    if args.command == 'audit':
        audit()
    elif args.command == 'collect':
        collect(args.per_source)
    elif args.command == 'download':
        browse(assets())
    elif args.command == 'galleries':
        galleries()
    else:
        browse([record for record in json.loads((ROOT / 'candidates.json').read_text()) if 'localPath' in record])
