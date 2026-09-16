import argparse
import base64
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import html
import io
import json
from pathlib import Path
import re
from urllib.parse import urlsplit, urlunsplit

from bs4 import BeautifulSoup
from PIL import Image, ImageDraw, ImageOps
import pilot


import os

ROOT = Path(os.environ['STYLR_INTAKE_ROOT']).resolve()
BATCH = ROOT / 'expansion-2026-09-15'
SOURCES = {
    'foxblood': ('foxblood.com', 'Dark everyday / draped layers'),
    'forestink': ('forestinkclothing.com', 'Goth / punk / dark romantic'),
    'trippnyc': ('trippnyc.com', 'Punk / industrial / wide silhouettes'),
    'punkrave': ('punkrave.ch', 'Gothic tailoring / experimental layers'),
    'acdcrag': ('acdcrag.com', 'Colorful Japanese streetwear / punk'),
    'shinybynature': ('shinybynature.com', 'Colorful casual / broader-build source'),
    'wildfang': ('www.wildfang.com', 'Tailoring / workwear / printed suits'),
    'snag': ('snagtights.com', 'Broader-build casual / dark and colorful'),
    'morningwitch': ('www.morningwitch.com', 'Botanical prints / colorful layers'),
    'pettilia': ('pettilia.com', 'Extended-size Lolita source'),
    'myviolet': ('shopmyviolet.com', 'Pastel / playful layering'),
    'mochipan': ('mochipan.com', 'Whimsical / romantic / illustrated'),
    'midnighthour': ('www.midnighthour.com', 'Dark romantic / gothic'),
    'bigbudpress': ('bigbudpress.com', 'Colorful workwear / broader-build source'),
    'kirrinfinch': ('kirrinfinch.com', 'Tailoring / formal and everyday'),
}
APPAREL = re.compile(r'dress|shirt|top\b|tops\b|cardigan|bottom|coat|jacket|skirt|blazer|bloomer|camisole|hoodie|pant|short|overall|pajama|romper|shrug|suit|sweater|blouse|bodysuit|corset|gilet|jean|jogger|jumper|legging|dungaree|fleece|skort|vest|sweatshirt|tee\b|trouser|cloak|kilt|シャツ|パンツ|ワンピース|スカート|パーカー|ブラウス|ジャケット|キモノ|ロンT|スカジャン|ベスト', re.I)
EXCLUDED = re.compile(r'\b(accessor\w*|gift|socks?|tights|glasses|sneakers?|shoes?|boots?|bags?|totes?|case|wallet|hats?|caps?|scarves|scarf|jewel\w*|earrings?|necklace|ring|pins?|patch|sticker|belt|harness|underwear|boxer|bra|swim\w*|bikini|fabric|swatch|scrunch\w*|clip|keychain|plush|towel|pet|pets|insurance|decor\w*|homeware\w*|leggings bundle)\b|interest check|pattern pdf|print only|tree skirt|ネクタイ|レッグウォーマー|アクセサリー|バッグ|アームカーバー|ソックス|キャップ', re.I)


def save(name, value):
    path = BATCH / name
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(path)


def canonical_image(url):
    parsed = urlsplit(url)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, '', ''))


def prior_records():
    return json.loads((ROOT / 'candidates.json').read_text()) + json.loads((ROOT / 'alt-candidates.json').read_text())


def cached_json(name, url):
    path = BATCH / 'raw' / name
    if path.exists():
        return json.loads(path.read_text())
    payload = json.loads(pilot.fetch(url))
    save('raw/' + name, payload)
    return payload


def collect_source(source, limit, max_pages=2):
    host, direction = SOURCES[source]
    products = {}
    pages = []
    errors = []
    for page in range(1, max_pages + 1):
        url = f'https://{host}/products.json?limit=250&page={page}'
        try:
            payload = cached_json(f'{source}-{page}.json', url)
            fetched = payload['products']
            before = len(products)
            products.update({product['id']: product for product in fetched})
            pages.append({'url': url, 'records': len(fetched), 'newProducts': len(products) - before})
            if len(fetched) < 250 or len(products) == before:
                break
        except Exception as error:
            errors.append({'url': url, 'error': str(error)})
            break
    previous = {canonical_image(record['imageUrl']) for record in prior_records()}
    groups = defaultdict(list)
    for product in products.values():
        title = product['title']
        category = product.get('product_type') or ''
        category_filter = category.replace('Apparel & Accessories', 'Apparel')
        if EXCLUDED.search(category_filter) or EXCLUDED.search(title) or not APPAREL.search(category + ' ' + title):
            continue
        available = [(index, photo) for index, photo in enumerate(product.get('images', [])) if canonical_image(photo['src']) not in previous]
        if available:
            groups[category or 'uncategorized'].append((product, available))
    for group in groups.values():
        group.sort(key=lambda item: hashlib.sha256(str(item[0]['id']).encode()).hexdigest())
    selected = []
    families = Counter()
    while any(groups.values()) and len(selected) < limit:
        for category in sorted(groups):
            if not groups[category] or len(selected) >= limit:
                continue
            product, available = groups[category].pop(0)
            family = re.split(r'\s[-–|]\s', product['title'])[0].lower()
            if families[family] >= 2:
                continue
            families[family] += 1
            selected.append((product, available))
    records = []
    for product, available in selected:
        indices = sorted({0, min(len(available) - 1, max(2, len(available) // 2))})
        for selected_index in indices:
            position, photo = available[selected_index]
            records.append({
                'id': f'{source}-{product["id"]}-image-{photo["id"]}',
                'source': source,
                'sourceUrl': f'https://{host}/products/{product["handle"]}',
                'imageUrl': photo['src'], 'title': product['title'],
                'productType': product.get('product_type'),
                'sourceText': BeautifulSoup(product.get('body_html') or '', 'html.parser').get_text(' ', strip=True),
                'sourceImageAlt': photo.get('alt'),
                'outfitGroup': f'{source}-{product["id"]}',
                'galleryIndex': position, 'sourceDirection': direction,
                'personGroup': None, 'body': None, 'reviewStatus': 'unreviewed',
            })
    status = {'source': source, 'pages': pages, 'errors': errors, 'productsFetched': len(products), 'productsSelected': len(selected), 'candidates': len(records), 'direction': direction}
    return records, status


def collect(limit):
    manifest = BATCH / 'candidates.json'
    if manifest.exists():
        raise SystemExit('Batch manifest already exists; use download to resume. Preserve reviewed snapshots.')
    records = []
    statuses = []
    with ThreadPoolExecutor(max_workers=3) as executor:
        for source, (chosen, status) in zip(SOURCES, executor.map(lambda source: collect_source(source, limit), SOURCES)):
            records.extend(chosen)
            statuses.append(status)
            print(json.dumps({'source': source, 'selected': len(chosen), 'errors': status['errors']}), flush=True)
    save('candidates.json', records)
    save('sources.json', {'retrievedAt': datetime.now(timezone.utc).isoformat(), 'scope': 'Up to two public product pages per source, 250 products/page. Category round robin over deterministic product hashes; up to two title-family variants, first unused and mid-gallery image. Product/source direction is not a reviewed style/body label.', 'sources': statuses})


def streets():
    existing = json.loads((BATCH / 'candidates.json').read_text())
    records = {record['id']: record for record in existing}
    statuses = []
    for term in ['decora', 'punk', 'gothic', 'kimono', 'vintage', 'minimalist', 'genderless', 'cyber']:
        url = f'https://tokyofashion.com/wp-json/wp/v2/posts?per_page=12&search={term}'
        try:
            posts = cached_json(f'tokyofashion-{term}.json', url)
            count = 0
            for post in posts:
                soup = BeautifulSoup(post['content']['rendered'], 'html.parser')
                images = []
                for anchor in soup.select('a[href]'):
                    address = anchor['href']
                    if 'tokyofashion.com/wp-content/uploads/' in address and re.search(r'\.(jpg|jpeg|png)$', address, re.I) and address not in images:
                        images.append(address)
                if not images:
                    for photo in soup.select('img[src]'):
                        address = photo['src']
                        if 'tokyofashion.com/wp-content/uploads/' in address and address not in images:
                            images.append(address)
                for address in images[:2]:
                    digest = hashlib.sha256(address.encode()).hexdigest()[:12]
                    identity = f'tokyofashion-{post["id"]}-{digest}'
                    if identity in records:
                        records[identity].setdefault('sourceQueries', []).append(term)
                        continue
                    records[identity] = {'id': identity, 'source': 'tokyofashion', 'sourceUrl': post['link'], 'imageUrl': address, 'title': BeautifulSoup(post['title']['rendered'], 'html.parser').get_text(), 'sourceText': soup.get_text(' ', strip=True), 'sourceDirection': 'Japanese street snaps / ' + term, 'sourceQueries': [term], 'outfitGroup': f'tokyofashion-{post["id"]}', 'personGroup': None, 'body': None, 'reviewStatus': 'unreviewed'}
                    count += 1
            statuses.append({'url': url, 'posts': len(posts), 'newImages': count})
        except Exception as error:
            statuses.append({'url': url, 'error': str(error)})
        print(json.dumps(statuses[-1]), flush=True)
    save('candidates.json', list(records.values()))
    save('street-sources.json', {'retrievedAt': datetime.now(timezone.utc).isoformat(), 'scope': 'Eight keyword queries, first twelve posts each, first two linked photo assets per post; overlapping results deduplicated by source image URL. No person identity transfer.', 'sources': statuses})


def recover():
    candidates = json.loads((BATCH / 'candidates.json').read_text())
    existing = {record['id'] for record in candidates}
    statuses = []
    for source in ['myviolet', 'mochipan', 'midnighthour', 'bigbudpress', 'kirrinfinch']:
        original = ROOT / 'raw' / (f'alt-{source}.json' if source in ['myviolet', 'mochipan', 'midnighthour'] else f'{source}.json')
        if not original.exists():
            continue
        cached = BATCH / 'raw' / f'{source}-1.json'
        if not cached.exists():
            save(f'raw/{source}-1.json', json.loads(original.read_text()))
        payload = json.loads(cached.read_text())
        chosen, status = collect_source(source, 36, max_pages=1)
        new = [record for record in chosen if record['id'] not in existing]
        candidates.extend(new)
        existing.update(record['id'] for record in new)
        statuses.append({'source': source, 'sourceSnapshot': str(original), 'sourceSnapshotMtime': datetime.fromtimestamp(original.stat().st_mtime, timezone.utc).isoformat(), 'newImages': len(new), 'productsInSnapshot': len(payload['products']), 'scope': 'Previously saved first page only; no network retry after rate limit; later unused gallery views included. Further pages not fetched.'})
    save('candidates.json', candidates)
    save('recovered-sources.json', statuses)
    print(json.dumps(statuses), flush=True)


def community():
    payload = json.loads((BATCH / 'chubstr-browser.json').read_text())
    if not payload.get('success'):
        raise ValueError('Browser extraction failed')
    result = payload['data']['result']
    if isinstance(result, str):
        result = json.loads(result)
    records = {record['id']: record for record in json.loads((BATCH / 'candidates.json').read_text())}
    before = len(records)
    for post in result['results']:
        if post.get('status') != 200:
            continue
        group = hashlib.sha256(post['url'].encode()).hexdigest()[:12]
        for photo in post.get('photos', []):
            digest = hashlib.sha256(photo['src'].encode()).hexdigest()[:12]
            identity = 'chubstr-' + digest
            records.setdefault(identity, {'id': identity, 'source': 'chubstr', 'sourceUrl': post['url'], 'imageUrl': photo['src'], 'title': post['title'].replace(' | Chubstr', ''), 'sourceImageAlt': photo['alt'], 'sourceDirection': 'Broader-build reader outfits / tailoring / casual', 'outfitGroup': 'chubstr-post-' + group, 'personGroup': None, 'body': None, 'reviewStatus': 'unreviewed'})
    save('candidates.json', list(records.values()))
    print(f'Added {len(records) - before} community image candidates')


def download():
    candidates = json.loads((BATCH / 'candidates.json').read_text())
    (ROOT / 'images').mkdir(exist_ok=True)
    records = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        for record in executor.map(pilot.download, candidates):
            records.append(record)
            if len(records) % 50 == 0:
                save('download-progress.json', records)
                print(f'Downloaded/checked {len(records)}/{len(candidates)}', flush=True)
    save('candidates.json', records)
    seen = {record['sha256']: record['id'] for record in prior_records() if record.get('sha256')}
    unique = []
    duplicates = []
    for record in records:
        if record.get('downloadError') or not record.get('sha256'):
            continue
        if record['sha256'] in seen:
            duplicates.append({'id': record['id'], 'sameAs': seen[record['sha256']]})
        else:
            seen[record['sha256']] = record['id']
            unique.append(record)
    save('unique.json', unique)
    save('exact-duplicates.json', duplicates)
    print(json.dumps({'candidates': len(records), 'valid': sum(not record.get('downloadError') for record in records), 'newUnique': len(unique), 'duplicates': len(duplicates)}), flush=True)


def sheets():
    records = json.loads((BATCH / 'unique.json').read_text())
    mapping = []
    for source in sorted({record['source'] for record in records}):
        group = [record for record in records if record['source'] == source]
        for start in range(0, len(group), 20):
            chosen = group[start:start + 20]
            name = f'sheets/{source}-{start // 20 + 1:02}.jpg'
            canvas = Image.new('RGB', (1500, 1600), 'white')
            draw = ImageDraw.Draw(canvas)
            for position, record in enumerate(chosen):
                with Image.open(ROOT / record['localPath']) as original:
                    thumb = ImageOps.contain(original, (294, 365))
                    left = position % 5 * 300
                    top = position // 5 * 400
                    canvas.paste(thumb, (left + (300 - thumb.width) // 2, top))
                number = start + position + 1
                draw.text((left + 5, top + 368), f'{source} #{number} / view {record.get("galleryIndex", "post")}', fill='black')
                draw.text((left + 5, top + 382), record['title'][:42].encode('ascii', 'replace').decode(), fill='black')
                mapping.append({'id': record['id'], 'sha256': record['sha256'], 'source': source, 'number': number, 'sheet': name, 'position': position + 1})
            (BATCH / 'sheets').mkdir(exist_ok=True)
            canvas.save(BATCH / name, quality=92)
    path = BATCH / 'review-mapping.json'
    if path.exists() and json.loads(path.read_text()) != mapping:
        raise SystemExit('Review mapping changed; do not reuse ordinal decisions.')
    save('review-mapping.json', mapping)
    print(f'{len(mapping)} images in {len(set(row["sheet"] for row in mapping))} sheets')


def browse():
    records = json.loads((BATCH / 'unique.json').read_text())
    mapping = json.loads((BATCH / 'review-mapping.json').read_text())
    decisions = json.loads((BATCH / 'visual-decisions.json').read_text())
    continuation = json.loads((BATCH / 'visual-decisions-continuation.json').read_text())
    for source, additions in continuation['sources'].items():
        if additions.get('add'):
            target = decisions['sources'][source]
            for key, value in additions.items():
                if key not in ('add', 'sheets', 'notes'):
                    target[key] = sorted(set(target.get(key, []) + value))
            target.update({key: additions[key] for key in ('sheets', 'notes')})
        else:
            decisions['sources'][source] = additions
    by_id = {record['id']: record for record in records}
    if len(by_id) != len(records) or {row['id'] for row in mapping} != set(by_id):
        raise ValueError('Review mapping does not cover unique records exactly')
    categories = {}
    for source, decision in decisions['sources'].items():
        source_rows = [row for row in mapping if row['source'] == source]
        actual_sheets = {int(Path(row['sheet']).stem.rsplit('-', 1)[1]) for row in source_rows}
        if actual_sheets != set(decision['sheets']):
            raise ValueError(f'Incomplete sheets: {source}')
        valid_numbers = {row['number'] for row in source_rows}
        for view, numbers in decision.items():
            if view in ('sheets', 'notes', 'add'):
                continue
            for number in numbers:
                key = (source, number)
                if number not in valid_numbers or key in categories:
                    raise ValueError(f'Invalid or duplicate decision: {key}')
                categories[key] = view
    reviewed = []
    def image_hash(record):
        return record['id'], hashlib.sha256((ROOT / record['localPath']).read_bytes()).hexdigest()

    with ThreadPoolExecutor(max_workers=8) as executor:
        image_hashes = dict(executor.map(image_hash, records))
    for row in mapping:
        record = by_id[row['id']]
        if row['sha256'] != record['sha256'] or row['source'] not in decisions['sources']:
            raise ValueError(f'Stale review: {row["id"]}')
        if image_hashes[row['id']] != row['sha256']:
            raise ValueError(f'Changed image: {row["id"]}')
        reviewed.append({**row, 'view': categories.get((row['source'], row['number']), 'partial'), 'body': None})
    save('visual-review.json', {'rubric': decisions['rubric'], 'reviewer': 'Primary assistant, direct contact-sheet pixels', 'rows': reviewed})
    views = {row['id']: row['view'] for row in reviewed}
    earlier_views = {row['id']: row['view'] for row in json.loads((ROOT / 'alt-visual-review.json').read_text())['rows']}
    combined = []
    seen = set()
    for record in prior_records() + records:
        if record.get('downloadError') or not record.get('sha256') or record['sha256'] in seen:
            continue
        seen.add(record['sha256'])
        combined.append({**record, 'viewReview': views.get(record['id'], earlier_views.get(record['id'], 'unreviewed')), 'batch': 'expanded' if record['id'] in by_id else 'earlier'})
    save('combined-reviewed.json', combined)
    groups = defaultdict(list)
    for record in combined:
        groups[record['source']].append(record)
    for group in groups.values():
        group.sort(key=lambda record: record['viewReview'] != 'full')
    ordered = []
    while any(groups.values()):
        for source in sorted(groups):
            if groups[source]:
                ordered.append(groups[source].pop(0))
    def browser_record(record):
        if urlsplit(record['sourceUrl']).scheme != 'https':
            raise ValueError('Non-HTTPS source link')
        with Image.open(ROOT / record['localPath']) as original:
            preview = ImageOps.contain(original.convert('RGB'), (560, 760))
            buffer = io.BytesIO()
            preview.save(buffer, format='WEBP', quality=72)
        return {
            'id': record['id'], 'source': record['source'], 'sourceUrl': record['sourceUrl'],
            'title': record['title'], 'view': record['viewReview'], 'batch': record['batch'],
            'group': record.get('outfitGroup') or record['sourceUrl'],
            'direction': record.get('sourceDirection', SOURCES.get(record['source'], ('', ''))[1]),
            'image': 'data:image/webp;base64,' + base64.b64encode(buffer.getvalue()).decode(),
        }
    with ThreadPoolExecutor(max_workers=8) as executor:
        browser_records = list(executor.map(browser_record, ordered))
    template = (ROOT / 'expansion-browser.html').read_text()
    for filename, selection in [('index.html', browser_records), ('expanded-outfits.html', [record for record in browser_records if record['view'] == 'full'])]:
        payload = json.dumps(selection, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c')
        destination = ROOT / filename
        temporary = destination.with_suffix('.tmp')
        temporary.write_text(template.replace('__CATALOG_DATA__', payload))
        temporary.replace(destination)
    summary = {
        'newExactUnique': len(records), 'reviewedSheets': len({row['sheet'] for row in mapping}),
        'newViews': dict(Counter(row['view'] for row in reviewed)),
        'combinedExactUnique': len(combined),
        'combinedFullPhotos': sum(record['view'] == 'full' for record in browser_records),
        'combinedFullSourceGroups': len({record['group'] for record in browser_records if record['view'] == 'full'}),
        'sources': {source: {'images': len([row for row in reviewed if row['source'] == source]), 'views': dict(Counter(row['view'] for row in reviewed if row['source'] == source)), 'notes': decision.get('notes', '')} for source, decision in decisions['sources'].items()},
    }
    save('review-summary.json', summary)
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Resumable Stylr expansion snapshot; keeps prior pilot and live catalog unchanged.')
    parser.add_argument('command', choices=['collect', 'streets', 'recover', 'community', 'download', 'sheets', 'browse'])
    parser.add_argument('--products', type=int, default=36)
    args = parser.parse_args()
    if not 1 <= args.products <= 100:
        parser.error('--products must be between 1 and 100')
    {'collect': lambda: collect(args.products), 'streets': streets, 'recover': recover, 'community': community, 'download': download, 'sheets': sheets, 'browse': browse}[args.command]()
