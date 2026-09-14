#!/usr/bin/env python3
"""Import reviewed TokyoFashion references without touching the legacy catalog.

Requires Pillow; archive discovery additionally requires beautifulsoup4.
Discovery only creates candidates. Admission requires human visual review and
explicit records in streetstyle-photos.json and streetstyle-assets.json.
"""

import argparse
import concurrent.futures
import copy
import hashlib
import io
import json
from pathlib import Path
import re
import tempfile
import unittest
import urllib.parse
import urllib.request

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parent.parent
FEATURES = set('relaxed fitted layered minimal pattern texture bright muted tailored sporty utility romantic edgy vintage'.split())
FAMILIES = set('everyday tailoring sport utility expressive soft'.split())
GROUPS = set('silhouette surface palette styling references context function comfort'.split())
GARMENTS = set('skirt shorts heels boots'.split())
MAX_BYTES = 24 * 1024 * 1024
HEADERS = {'User-Agent': 'Stylr personal photo study/1.0'}


def load(path):
    return json.loads(Path(path).read_text())


def write_json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def is_url(value):
    if not isinstance(value, str):
        return False
    parsed = urllib.parse.urlsplit(value)
    return parsed.scheme == 'https' and bool(parsed.hostname) and not parsed.username and not parsed.password


def validate(photos, assets):
    if not isinstance(photos, list) or not isinstance(assets, list) or not photos:
        raise ValueError('Nonempty Photo and asset arrays required')
    seen_ids, seen_sources, asset_ids, seen_urls = set(), set(), set(), set()
    for p in photos:
        if not isinstance(p, dict):
            raise ValueError('Photo must be an object')
        photo_id = p.get('id', '')
        if not isinstance(photo_id, str) or not re.fullmatch(r'street-tokyo-[0-9]+', photo_id) or photo_id in seen_ids:
            raise ValueError(f'Invalid or duplicate id: {photo_id}')
        seen_ids.add(photo_id)
        for key in ['title', 'description', 'creator', 'shoot', 'sourceLabel']:
            if not isinstance(p.get(key), str) or not p[key].strip():
                raise ValueError(f'{photo_id}: missing {key}')
        if p.get('src') != f'/photos/{photo_id}.webp':
            raise ValueError(f'{photo_id}: invalid local src')
        for key in ['sourceUrl', 'creatorUrl', 'licenseUrl']:
            if not is_url(p.get(key)):
                raise ValueError(f'{photo_id}: invalid {key}')
        source = p['sourceUrl'].rstrip('/')
        if source in seen_sources:
            raise ValueError(f'{photo_id}: duplicate outfit/post')
        seen_sources.add(source)
        if p.get('collection') not in ['women', 'men', 'unclassified'] or p.get('frame') not in ['smaller', 'mid', 'fuller', 'unknown']:
            raise ValueError(f'{photo_id}: invalid collection/frame')
        if p.get('family') not in FAMILIES or p.get('view') not in ['full', 'detail']:
            raise ValueError(f'{photo_id}: invalid family/view')
        if p.get('metadataBasis') not in ['visual-review', 'source-description']:
            raise ValueError(f'{photo_id}: review basis required')
        for key, allowed in [('features', FEATURES), ('garments', GARMENTS)]:
            values = p.get(key)
            if not isinstance(values, list) or any(not isinstance(v, str) for v in values) or not set(values) <= allowed or len(set(values)) != len(values):
                raise ValueError(f'{photo_id}: invalid {key}')
        if not p['features']:
            raise ValueError(f'{photo_id}: features required')
        if any(type(p.get(key)) is not bool for key in ['shoesKnown', 'bottomKnown']):
            raise ValueError(f'{photo_id}: visibility must be boolean')
        if set(p['garments']) & {'skirt', 'shorts'} and not p['bottomKnown']:
            raise ValueError(f'{photo_id}: bottom garment contradicts visibility')
        if set(p['garments']) & {'heels', 'boots'} and not p['shoesKnown']:
            raise ValueError(f'{photo_id}: footwear contradicts visibility')
        dimensions = p.get('dimensions', {})
        if not isinstance(dimensions, dict) or not set(dimensions) <= GROUPS:
            raise ValueError(f'{photo_id}: invalid dimension groups')
        for group, values in dimensions.items():
            if not isinstance(values, list) or not values or any(not isinstance(v, str) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', v) or len(v) > 60 for v in values) or len(set(values)) != len(values):
                raise ValueError(f'{photo_id}: invalid {group} values')
    for asset in assets:
        if not isinstance(asset, dict) or set(asset) != {'id', 'url'}:
            raise ValueError('Asset must contain only id and url')
        if not isinstance(asset['id'], str) or asset['id'] in asset_ids or asset['id'] not in seen_ids or not is_url(asset['url']):
            raise ValueError('Invalid/duplicate/orphan asset')
        if asset['url'] in seen_urls:
            raise ValueError('Duplicate source image URL')
        asset_ids.add(asset['id'])
        seen_urls.add(asset['url'])
    if asset_ids != seen_ids:
        raise ValueError('Photo/asset IDs differ')
    return len(photos)


def get_bytes(url):
    if not is_url(url) or urllib.parse.urlsplit(url).hostname not in {'tokyofashion.com', 'www.tokyofashion.com'}:
        raise ValueError('Only public TokyoFashion HTTPS URLs are supported')
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as response:
        if urllib.parse.urlsplit(response.url).hostname not in {'tokyofashion.com', 'www.tokyofashion.com'}:
            raise ValueError('Unexpected redirect host')
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError('Download exceeds 24 MiB limit')
    return data


def optimize(data, dest):
    with Image.open(io.BytesIO(data)) as source:
        image = ImageOps.exif_transpose(source).convert('RGB')
        image.thumbnail((1100, 1400), Image.Resampling.LANCZOS)
        dest = Path(dest)
        dest.parent.mkdir(parents=True, exist_ok=True)
        tmp = dest.with_suffix('.tmp')
        try:
            image.save(tmp, format='WEBP', quality=84, method=6)
            tmp.replace(dest)
        finally:
            tmp.unlink(missing_ok=True)
    return image.size


def image_info(path):
    with Image.open(path) as image:
        image.load()
        if image.format != 'WEBP' or image.mode != 'RGB' or image.width > 1100 or image.height > 1400 or min(image.size) < 300:
            raise ValueError(f'Invalid optimized asset: {path}')
        return {'width': image.width, 'height': image.height, 'pixels': hashlib.sha256(image.tobytes()).hexdigest(), 'bytes': Path(path).stat().st_size}


def download_asset(asset, directory):
    dest = Path(directory) / f"{asset['id']}.webp"
    if dest.exists():
        image_info(dest)
    else:
        optimize(get_bytes(asset['url']), dest)
        image_info(dest)
    return asset['id']


def discover(args):
    from bs4 import BeautifulSoup
    cache = Path(args.cache_dir)
    cache.mkdir(parents=True, exist_ok=True)
    links = {}
    for start in args.starts:
        url = f'https://tokyofashion.com/photos/?location=Harajuku&start={start}'
        path = cache / f'archive-{start}.html'
        if not path.exists():
            path.write_bytes(get_bytes(url))
        soup = BeautifulSoup(path.read_text(), 'html.parser')
        for a in soup.select('a[title]'):
            img = a.find('img')
            if img and '/wp-content/uploads/' in img.get('src', ''):
                links[a['href']] = a.get('title', '')
    candidates, errors = [], []
    for index, (url, title) in enumerate(links.items(), 1):
        try:
            path = cache / (hashlib.sha256(url.encode()).hexdigest()[:16] + '.html')
            if not path.exists():
                path.write_bytes(get_bytes(url))
            soup = BeautifulSoup(path.read_text(), 'html.parser')
            short = soup.select_one('link[rel="shortlink"]')
            match = re.search(r'[?&]p=(\d+)', short.get('href', '') if short else '')
            entry = soup.select_one('.entry-content, .post-content')
            if not match or not entry:
                raise ValueError('Missing post ID or entry content')
            images = []
            for a in entry.select('a[href]'):
                href = a['href'].replace('http://tokyofashion.com/', 'https://tokyofashion.com/')
                if a.find('img') and re.search(r'\.(jpg|jpeg|png)$', href, re.I) and '/wp-content/uploads/' in href and href not in images:
                    images.append(href)
            if not images:
                raise ValueError('Missing linked full-resolution photo')
            text = entry.get_text(' ', strip=True)
            candidates.append({'number': len(candidates) + 1, 'id': f'street-tokyo-{match[1]}', 'sourceUrl': url, 'title': title, 'url': images[0], 'images': images, 'sourceText': text, 'cacheHtml': str(path)})
            print(f'{index}/{len(links)} {match[1]}', flush=True)
        except Exception as error:
            errors.append({'sourceUrl': url, 'error': str(error)})
    write_json(cache / 'candidates.json', candidates)
    write_json(cache / 'discovery-errors.json', errors)
    print(f'{len(candidates)} unreviewed candidates; {len(errors)} errors')


def contacts(records, image_dir, output):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    font_path = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
    font = ImageFont.truetype(font_path, 17) if Path(font_path).exists() else ImageFont.load_default()
    mapping = []
    for start in range(0, len(records), 12):
        sheet = Image.new('RGB', (1280, 1500), '#ecebe7')
        draw = ImageDraw.Draw(sheet)
        batch = records[start:start + 12]
        for offset, record in enumerate(batch):
            number = record.get('number', start + offset + 1)
            x, y = offset % 4 * 320, offset // 4 * 500
            path = Path(image_dir) / f"{record['id']}.webp"
            with Image.open(path) as image:
                tile = ImageOps.contain(image, (312, 460))
                sheet.paste(tile, (x + (320 - tile.width) // 2, y + (460 - tile.height) // 2))
            label = f"{number:03d}  {record['id'].replace('street-tokyo-', '')}"
            draw.text((x + 8, y + 467), label, font=font, fill='#151515')
            mapping.append({'number': number, 'sheet': f'contact-{start // 12 + 1:02d}.jpg', 'id': record['id'], 'sourceUrl': record['sourceUrl']})
        path = output / f'contact-{start // 12 + 1:02d}.jpg'
        sheet.save(path, quality=92)
        print(path)
    write_json(output / 'mapping.json', mapping)


class ImportTests(unittest.TestCase):
    def setUp(self):
        self.p = {'id': 'street-tokyo-1', 'title': 'Wide trousers', 'description': 'Black wide trousers and a blue jacket.', 'src': '/photos/street-tokyo-1.webp', 'sourceUrl': 'https://tokyofashion.com/example/', 'creator': 'TokyoFashion', 'creatorUrl': 'https://tokyofashion.com/', 'licenseUrl': 'https://tokyofashion.com/example/', 'collection': 'unclassified', 'frame': 'unknown', 'features': ['relaxed'], 'family': 'everyday', 'shoot': 'TokyoFashion', 'view': 'full', 'garments': [], 'shoesKnown': True, 'bottomKnown': True, 'dimensions': {'silhouette': ['wide-leg']}, 'metadataBasis': 'visual-review', 'sourceLabel': 'TokyoFashion'}
        self.a = {'id': 'street-tokyo-1', 'url': 'https://tokyofashion.com/wp-content/uploads/example.jpg'}

    def test_valid_and_optional_dimensions(self):
        self.assertEqual(validate([self.p], [self.a]), 1)
        del self.p['dimensions']
        self.assertEqual(validate([self.p], [self.a]), 1)

    def test_duplicate_post_rejected(self):
        other = copy.deepcopy(self.p)
        other.update(id='street-tokyo-2', src='/photos/street-tokyo-2.webp')
        with self.assertRaisesRegex(ValueError, 'duplicate outfit'):
            validate([self.p, other], [self.a])

    def test_duplicate_ids_rejected(self):
        with self.assertRaisesRegex(ValueError, 'duplicate id'):
            validate([self.p, self.p], [self.a])

    def test_invalid_schema_rejected(self):
        mutations = {'id': '../escape', 'src': '/photos/original.webp', 'features': ['invented'], 'collection': 'female', 'frame': 'thin', 'family': 'unknown', 'shoesKnown': 'true', 'creator': '', 'metadataBasis': 'legacy-tags', 'dimensions': {'comfort': ['Soft Feel']}, 'creatorUrl': 'javascript:alert(1)'}
        for key, value in mutations.items():
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate([{**self.p, key: value}], [self.a])

    def test_visibility_consistency(self):
        with self.assertRaisesRegex(ValueError, 'contradicts visibility'):
            validate([{**self.p, 'garments': ['boots'], 'shoesKnown': False}], [self.a])

    def test_asset_bijection_and_duplicate_url(self):
        for assets in [[], [self.a, self.a], [{**self.a, 'id': 'street-tokyo-2'}]]:
            with self.subTest(assets=assets), self.assertRaises(ValueError):
                validate([self.p], assets)
        other = {**self.p, 'id': 'street-tokyo-2', 'src': '/photos/street-tokyo-2.webp', 'sourceUrl': 'https://tokyofashion.com/second/'}
        with self.assertRaisesRegex(ValueError, 'Duplicate source image'):
            validate([self.p, other], [self.a, {**self.a, 'id': 'street-tokyo-2'}])

    def test_exif_proportions_and_bounds(self):
        with tempfile.TemporaryDirectory() as directory:
            image = Image.new('RGB', (1800, 1200), '#bd356a')
            exif = Image.Exif()
            exif[274] = 6
            data = io.BytesIO()
            image.save(data, 'JPEG', exif=exif)
            dest = Path(directory) / 'photo.webp'
            self.assertEqual(optimize(data.getvalue(), dest), (933, 1400))
            self.assertEqual(image_info(dest)['height'], 1400)

    def test_invalid_image_and_cached_corruption_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'street-tokyo-1.webp'
            path.write_bytes(b'not an image')
            with self.assertRaises(Exception):
                download_asset(self.a, directory)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--photos', type=Path, default=ROOT / 'scripts/streetstyle-photos.json')
    parser.add_argument('--assets', type=Path, default=ROOT / 'scripts/streetstyle-assets.json')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('self-test', help='Run offline schema, deduplication and image regression tests')
    d = sub.add_parser('discover', help='Cache public archive HTML and candidates; never admits metadata')
    d.add_argument('--cache-dir', type=Path, required=True)
    d.add_argument('--starts', type=int, nargs='+', default=[0, 40, 80, 200])
    fetch = sub.add_parser('download', help='Fetch only the reviewed manifest into public/photos')
    fetch.add_argument('--workers', type=int, choices=range(1, 5), default=3)
    v = sub.add_parser('validate', help='Validate metadata, manifests and optional existing assets')
    v.add_argument('--check-images', action='store_true')
    c = sub.add_parser('contacts', help='Numbered review sheets with an exact source/ID mapping')
    c.add_argument('--output', type=Path, required=True)
    c.add_argument('--candidates', type=Path)
    c.add_argument('--image-dir', type=Path, default=ROOT / 'public/photos')
    args = parser.parse_args()
    if args.command == 'self-test':
        result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(ImportTests))
        raise SystemExit(not result.wasSuccessful())
    if args.command == 'discover':
        discover(args)
        return
    if args.command == 'contacts':
        contacts(load(args.candidates or args.photos), args.image_dir, args.output)
        return
    photos, assets = load(args.photos), load(args.assets)
    count = validate(photos, assets)
    if args.command == 'download':
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            for photo_id in pool.map(lambda asset: download_asset(asset, ROOT / 'public/photos'), assets):
                print(photo_id, flush=True)
    if args.command == 'download' or args.check_images:
        hashes, total = {}, 0
        for asset in assets:
            info = image_info(ROOT / 'public/photos' / f"{asset['id']}.webp")
            if info['pixels'] in hashes:
                raise ValueError(f"Duplicate decoded image: {asset['id']}, {hashes[info['pixels']]}")
            hashes[info['pixels']] = asset['id']
            total += info['bytes']
        print(f'{count} valid local RGB WebP assets; {total:,} bytes; no exact decoded duplicates')
    print(f'{count} valid reviewed Photo records and matching unique asset sources')


if __name__ == '__main__':
    main()
