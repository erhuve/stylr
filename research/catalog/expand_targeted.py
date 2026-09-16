import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

from PIL import Image, ImageDraw, ImageOps

import expand_catalog
import pilot


REPO = Path(__file__).resolve().parents[2]
SOURCES = ['forestink', 'snag', 'shinybynature', 'foxblood', 'midnighthour']


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + '\n')


def source_key(url):
    parsed = urlsplit(url)
    return parsed.netloc.removeprefix('www.') + parsed.path.rstrip('/')


def collect(output, products, sources):
    if (output / 'intake.json').exists():
        raise ValueError('Intake already exists; use sheets or a new batch directory')
    prior = json.loads((REPO / 'data/catalog-review/intake.json').read_text())
    prior += json.loads((REPO / 'data/catalog-review/baseline.json').read_text())
    for manifest in sorted(pilot.ROOT.glob('expansion-*/intake.json')):
        prior += json.loads(manifest.read_text())
    used = {source_key(row['sourceUrl']) for row in prior}
    hashes = {row['sha256'] for row in prior if row.get('sha256')}
    records, statuses = [], []
    (pilot.ROOT / 'images').mkdir(parents=True, exist_ok=True)
    for source in sources:
        host, direction = expand_catalog.SOURCES[source]
        selected = []
        status = {'source': source, 'pages': [], 'errors': []}
        for page in range(1, 4):
            url = f'https://{host}/products.json?limit=250&page={page}'
            try:
                payload = json.loads(pilot.fetch(url))
                save(output / 'raw' / f'{source}-{page}.json', payload)
                status['pages'].append({'url': url, 'products': len(payload['products'])})
                for product in payload['products']:
                    address = f'https://{host}/products/{product["handle"]}'
                    description = product['title'] + ' ' + (product.get('product_type') or '')
                    if source_key(address) in used or expand_catalog.EXCLUDED.search(description) or not expand_catalog.APPAREL.search(description):
                        continue
                    photos = product.get('images', [])
                    if not photos:
                        continue
                    used.add(source_key(address))
                    for index in sorted({0, min(2, len(photos) - 1)}):
                        photo = photos[index]
                        selected.append({'id': f'{source}-{product["id"]}-image-{photo["id"]}', 'source': source, 'sourceUrl': address, 'imageUrl': photo['src'], 'title': product['title'], 'sourceDirection': direction, 'galleryIndex': index, 'outfitGroup': f'{source}-{product["id"]}', 'body': None, 'reviewStatus': 'unreviewed'})
                    if len({row['sourceUrl'] for row in selected}) >= products:
                        break
                if len({row['sourceUrl'] for row in selected}) >= products or len(payload['products']) < 250:
                    break
            except Exception as error:
                status['errors'].append({'url': url, 'error': str(error)})
                break
        with ThreadPoolExecutor(max_workers=4) as executor:
            for row in executor.map(pilot.download, selected):
                if row.get('downloadError'):
                    status['errors'].append({'id': row['id'], 'error': row['downloadError']})
                elif row['sha256'] not in hashes:
                    hashes.add(row['sha256'])
                    records.append(row)
        status['downloadedUnique'] = sum(row['source'] == source for row in records)
        statuses.append(status)
        save(output / 'download-progress.json', records)
        print(json.dumps(status), flush=True)
    save(output / 'intake.json', records)
    save(output / 'sources.json', {'retrievedAt': datetime.now(timezone.utc).isoformat(), 'scope': f'{len(sources)} sources, at most three pages of 250 products each and {products} previously unseen product pages per source; first and third gallery photos. Source descriptions do not become body labels.', 'sources': statuses})
    sheets(output)


def sheets(output):
    records = json.loads((output / 'intake.json').read_text())
    folder = output / 'sheets'
    folder.mkdir(exist_ok=True)
    for start in range(0, len(records), 12):
        sheet = Image.new('RGB', (1200, 1530), 'white')
        draw = ImageDraw.Draw(sheet)
        for offset, row in enumerate(records[start:start + 12]):
            path = pilot.ROOT / row['localPath']
            if hashlib.sha256(path.read_bytes()).hexdigest() != row['sha256']:
                raise ValueError('Image binding changed: ' + row['id'])
            photo = ImageOps.contain(Image.open(path).convert('RGB'), (295, 470))
            left, top = (offset % 4) * 300, (offset // 4) * 510
            sheet.paste(photo, (left + (300 - photo.width) // 2, top + 30))
            draw.text((left + 5, top + 5), f'{start + offset}: {row["source"]}', fill='black')
        sheet.save(folder / f'{start // 12:02}.jpg', quality=94)
    print(f'{len(records)} image-bound candidates; sheets: {folder}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Bounded new-source-page intake; never reuses reviewed pages or creates body labels.')
    parser.add_argument('command', choices=['collect', 'sheets'])
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--products', type=int, choices=range(1, 31), default=12)
    parser.add_argument('--sources', nargs='+', choices=SOURCES, default=SOURCES)
    args = parser.parse_args()
    collect(args.output, args.products, args.sources) if args.command == 'collect' else sheets(args.output)
