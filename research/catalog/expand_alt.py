import argparse
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import re

from bs4 import BeautifulSoup
import pilot

import os

ROOT = Path(os.environ['STYLR_INTAKE_ROOT']).resolve()
SOURCES = {
    'midnighthour': ('www.midnighthour.com', 'Dark romantic / gothic'),
    'myviolet': ('shopmyviolet.com', 'Pastel / playful layering'),
    'mochipan': ('mochipan.com', 'Whimsical / illustrated knitwear'),
    'disturbia': ('www.disturbia.co.uk', 'Dark everyday / punk-inspired'),
    'lucyandyak': ('www.lucyandyak.com', 'Colorful / print / workwear'),
}


def collect():
    records = []
    statuses = []
    for source, (host, direction) in SOURCES.items():
        url = f'https://{host}/products.json?limit=250'
        try:
            payload = json.loads(pilot.fetch(url))
            pilot.save(f'raw/alt-{source}.json', payload)
            groups = defaultdict(list)
            for product in payload['products']:
                title = product['title']
                category = product['product_type']
                if re.search(r'accessor|home|decor|package|return|event|re-yak pack|interest check|tree skirt|stocking|warmers|headdress|headbow', category + ' ' + title, re.I) and not category.startswith('Apparel & Accessories > Clothing'):
                    continue
                if not re.search(r'dress|shirt|top|cardigan|bottom|coat|jacket|skirt|blazer|bloomer|camisole|hoodie|pant|short|overall|pajama|romper|shrug|suit|sweater|blouse|bodysuit|corset|gilet|jean|jogger|jumper|legging|dungaree|fleece|skort|vest|sweatshirt|tee|trouser', category or title, re.I):
                    continue
                if re.search(r'gift|sock|tights|glasses|sneaker|shoes?|boots?|bags?|tote|case|wallet|hat|caps?\b|scarf|scarves|jewel|earring|necklace|ring\b|pin\b|patch|sticker|belt|harness|underwear|boxer|bra\b|swim|bikini|fabric|swatch|scrunch|clip|keychain|plush|print only|pattern pdf', category + ' ' + title, re.I):
                    continue
                if product['images']:
                    groups[category or 'uncategorized'].append(product)
            selected = []
            while any(groups.values()) and len(selected) < 24:
                for category in sorted(groups):
                    if groups[category] and len(selected) < 24:
                        selected.append(groups[category].pop(0))
            for product in selected:
                for position, photo in enumerate(product['images'][:2]):
                    records.append({
                        'id': f'{source}-{product["id"]}-view-{position}',
                        'source': source,
                        'sourceUrl': f'https://{host}/products/{product["handle"]}',
                        'imageUrl': photo['src'],
                        'title': product['title'],
                        'productType': product['product_type'],
                        'sourceText': BeautifulSoup(product.get('body_html') or '', 'html.parser').get_text(' ', strip=True),
                        'sourceImageAlt': photo.get('alt'),
                        'outfitGroup': f'{source}-{product["id"]}',
                        'galleryIndex': position,
                        'sourceDirection': direction,
                        'personGroup': None,
                        'body': None,
                        'reviewStatus': 'unreviewed',
                    })
            statuses.append({'source': source, 'url': url, 'productsFetched': len(payload['products']), 'productsSelected': len(selected), 'direction': direction, 'scope': 'First page only; category round robin; first two gallery images. Source direction is a sourcing hypothesis, not an image label.'})
        except Exception as error:
            statuses.append({'source': source, 'url': url, 'error': str(error)})
    pilot.save('alt-candidates.json', records)
    pilot.save('alt-sources.json', {'retrievedAt': datetime.now(timezone.utc).isoformat(), 'sources': statuses})
    print(json.dumps(statuses), flush=True)


def download():
    records = json.loads((ROOT / 'alt-candidates.json').read_text())
    with ThreadPoolExecutor(max_workers=4) as executor:
        records = list(executor.map(pilot.download, records))
    pilot.save('alt-candidates.json', records)
    original = json.loads((ROOT / 'candidates.json').read_text())
    seen = {}
    unique = []
    duplicates = []
    for record in original + records:
        if 'sha256' not in record or record.get('downloadError'):
            continue
        if record['sha256'] in seen:
            duplicates.append({'id': record['id'], 'sameAs': seen[record['sha256']]})
        else:
            seen[record['sha256']] = record['id']
            unique.append(record)
    pilot.save('alt-exact-duplicates.json', duplicates)
    pilot.save('combined-candidates.json', unique)
    pilot.browse(unique)
    print(json.dumps({'newDownloaded': sum('sha256' in record for record in records), 'combinedUniqueImages': len(unique), 'exactDuplicates': len(duplicates)}), flush=True)


def reviewed_browser():
    decisions = json.loads((ROOT / 'alt-visual-decisions.json').read_text())
    mapping = json.loads((ROOT / 'alt-review-mapping.json').read_text())
    candidates = json.loads((ROOT / 'alt-candidates.json').read_text())
    by_id = {record['id']: record for record in candidates}
    assert len(mapping) == len(by_id) == 240
    assert {row['id'] for row in mapping} == set(by_id)
    reviewed = []
    for row in mapping:
        source_decisions = decisions['sources'][row['source']]
        matches = [key for key, numbers in source_decisions.items() if isinstance(numbers, list) and row['number'] in numbers]
        assert len(matches) <= 1
        status = matches[0] if matches else decisions['default']
        reviewed.append({**row, 'sha256': by_id[row['id']]['sha256'], 'view': status, 'body': None})
    pilot.save('alt-visual-review.json', {'rubric': decisions['rubric'], 'reviewer': decisions['reviewer'], 'rows': reviewed})
    views = {row['id']: row['view'] for row in reviewed}
    combined = json.loads((ROOT / 'combined-candidates.json').read_text())
    excluded = {'product-only', 'promotional-composite', 'multiple-people'}
    visible = [{**record, 'viewReview': views[record['id']]} for record in combined if record['id'] in views and views[record['id']] not in excluded]
    visible.sort(key=lambda record: (record['viewReview'] != 'full', record['source']))
    original = [record for record in combined if record['id'] not in views]
    pilot.browse(visible + original)
    soup = BeautifulSoup((ROOT / 'index.html').read_text(), 'html.parser')
    soup.h1.string = 'Stylr: alternative-fashion source pilot'
    soup.find('p').string = 'New alternative-style candidates first, followed by the initial pilot. View framing is reviewed; body matching labels are still pending. Different views may show the same outfit.'
    full_ids = {record['id'] for record in visible if record['viewReview'] == 'full'}
    for article, record in zip(soup.find_all('article'), visible + original):
        article['data-photo-id'] = record['id']
        status = record.get('viewReview')
        if status:
            article.small.string = f'{record["id"]} · {status.replace("-", " ")} view reviewed · Body labels pending'
    (ROOT / 'index.html').write_text(str(soup))
    for article in list(soup.find_all('article')):
        if article['data-photo-id'] not in full_ids:
            article.decompose()
    full_sources = {article['data-source'] for article in soup.find_all('article')}
    for option in list(soup.find_all('option')):
        if option.get('value') != 'all' and option.get_text() not in full_sources:
            option.decompose()
    soup.h1.string = 'Stylr: reviewed full-outfit views'
    soup.find('p').string = 'Alternative and colorful outfits with visible footwear. Framing review only; body labels and outfit-level deduplication are pending. Original photographs are embedded.'
    (ROOT / 'alt-outfits.html').write_text(str(soup))
    summary = {'reviewedImageRecords': len(reviewed), 'reviewedSheets': len({row['sheet'] for row in mapping}), 'fullViewRecords': sum(row['view'] == 'full' for row in reviewed), 'fullViewsAfterExactDedup': len(full_ids), 'newVisibleCandidates': len(visible), 'combinedVisibleCandidates': len(visible) + len(original), 'excludedViewRecords': sum(row['view'] in excluded for row in reviewed)}
    pilot.save('alt-summary.json', summary)
    print(json.dumps(summary))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Bounded alternative-fashion intake; preserves the initial source pilot and all live app data.')
    parser.add_argument('command', choices=['collect', 'download', 'browse'])
    args = parser.parse_args()
    if args.command == 'collect':
        collect()
    elif args.command == 'download':
        download()
    else:
        reviewed_browser()
