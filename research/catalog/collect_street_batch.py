import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re

from bs4 import BeautifulSoup

import pilot
from expand_targeted import REPO, save, sheets, source_key


def collect(output, source, pages, limit, account_limit):
    if output.exists() and any(output.iterdir()):
        raise ValueError('Use a new empty batch directory')
    manifests = [REPO / 'data/catalog-review/baseline.json', REPO / 'data/catalog-review/intake.json']
    manifests += sorted((REPO / 'data/catalog-review/batches').glob('*/intake.json'))
    manifests += sorted(pilot.ROOT.glob('expansion-*/intake.json'))
    prior = [row for manifest in manifests for row in json.loads(manifest.read_text())]
    used = {source_key(row['sourceUrl']) for row in prior}
    hashes = {row['sha256'] for row in prior if row.get('sha256')}
    accounts = Counter()
    for address in used:
        if address.startswith('wear.jp/'):
            accounts[address.split('/')[1]] += 1
    status = {'source': 'wear' if source.startswith('wear-') else source, 'pages': [], 'errors': [], 'images': []}
    records, searches = [], []
    (pilot.ROOT / 'images').mkdir(parents=True, exist_ok=True)
    for page in pages:
        url = (f'https://wear.jp/{source[5:]}-coordinate/?pageno={page}' if source.startswith('wear-')
               else f'https://tokyofashion.com/wp-json/wp/v2/posts?per_page=20&page={page}')
        selected = []
        raw = None
        try:
            raw = pilot.fetch(url)
            raw_path = output / 'raw' / f'{source}-{page}.html'
            raw_path.parent.mkdir(parents=True, exist_ok=True)
            raw_path.write_bytes(raw)
            if b'This service is not available' in raw:
                raise ValueError('Source returned a regional-unavailability page; no listing was inspected')
            candidates = []
            if source.startswith('wear-'):
                soup = BeautifulSoup(raw, 'html.parser')
                seen = set()
                for anchor in soup.find_all('a', href=True):
                    match = re.fullmatch(r'/([^/]+)/(\d{6,})/', anchor['href'])
                    photo = anchor.find('img')
                    if not match or photo is None or anchor['href'] in seen:
                        continue
                    image_url = photo.get('src', '')
                    if not image_url.startswith('https://images.wear2.jp/coordinate/'):
                        continue
                    seen.add(anchor['href'])
                    candidates.append({'id': f'wear-{match[2]}', 'source': 'wear', 'sourceUrl': 'https://wear.jp' + anchor['href'], 'imageUrl': image_url, 'title': photo.get('alt') or 'Street-style outfit', 'account': match[1], 'personGroup': 'wear-account:' + match[1], 'personGroupBasis': 'Explicit posting account, not verified person identity.'})
            else:
                for post in json.loads(raw):
                    soup = BeautifulSoup(post['content']['rendered'], 'html.parser')
                    images = [anchor['href'] for anchor in soup.select('a[href]') if 'tokyofashion.com/wp-content/uploads/' in anchor['href'] and re.search(r'\.(jpg|jpeg|png)$', anchor['href'], re.I)]
                    if not images:
                        images = [photo['src'] for photo in soup.select('img[src]') if 'tokyofashion.com/wp-content/uploads/' in photo['src']]
                    candidates.append({'id': f'tokyo-archive-{post["id"]}', 'source': 'tokyofashion', 'sourceUrl': post['link'].replace('http:', 'https:', 1), 'imageUrl': images[0].replace('http:', 'https:', 1) if images else None, 'title': BeautifulSoup(post['title']['rendered'], 'html.parser').get_text()})
            status['pages'].append({'url': url, 'products': len(candidates), 'retrievedAt': datetime.now(timezone.utc).isoformat(), 'snapshotSha256': hashlib.sha256(raw).hexdigest()})
            for row in candidates:
                address = source_key(row['sourceUrl'])
                if address in used:
                    decision = 'previously-sampled'
                elif not row['imageUrl']:
                    decision = 'no-images'
                elif row.get('account') and accounts[row['account']] >= account_limit:
                    decision = 'account-cap-deferred'
                elif len(records) + len(selected) >= limit:
                    decision = 'eligible-deferred'
                else:
                    decision = 'selected'
                searches.append({'source': row['source'], 'sourceUrl': row['sourceUrl'], 'title': row['title'], 'listingUrl': url, 'decision': decision, 'account': row.get('account')})
                if decision != 'selected':
                    continue
                used.add(address)
                if row.get('account'):
                    accounts[row['account']] += 1
                selected.append({**row, 'body': None, 'reviewStatus': 'unreviewed', 'sourceDirection': source})
            def retrieve(row):
                if row.get('account'):
                    try:
                        detail = pilot.fetch(row['sourceUrl'])
                        detail_path = output / 'raw' / f'{row["id"]}.html'
                        detail_path.write_bytes(detail)
                        soup = BeautifulSoup(detail, 'html.parser')
                        images = [photo['src'] for photo in soup.select('img[src]') if photo['src'].startswith('https://images.wear2.jp/coordinate/') and '_1000.' in photo['src']]
                        if not images:
                            raise ValueError('No full-resolution outfit image found')
                        row = {**row, 'imageUrl': images[0], 'detailSnapshotSha256': hashlib.sha256(detail).hexdigest()}
                    except Exception as error:
                        return {**row, 'downloadError': str(error)}
                return pilot.download(row)
            with ThreadPoolExecutor(max_workers=4) as executor:
                for row in executor.map(retrieve, selected):
                    outcome = 'download-error' if row.get('downloadError') else 'exact-duplicate' if row['sha256'] in hashes else 'downloaded-unique'
                    status['images'].append({key: row[key] for key in ['id', 'sourceUrl', 'imageUrl', 'sha256', 'detailSnapshotSha256', 'downloadError'] if key in row} | {'outcome': outcome})
                    if outcome == 'downloaded-unique':
                        records.append(row)
                        hashes.add(row['sha256'])
        except Exception as error:
            failure = {'url': url, 'error': str(error)}
            if raw is not None:
                failure['snapshotSha256'] = hashlib.sha256(raw).hexdigest()
            status['errors'].append(failure)
        save(output / 'intake.json', records)
        save(output / 'searches.json', searches)
        save(output / 'sources.json', {'retrievedAt': datetime.now(timezone.utc).isoformat(), 'scope': f'{source}, requested pages {pages}, limit {limit}; one image per post, WEAR account cap {account_limit} across prior sampled pages. Listing category is a sourcing lead only, never a presentation or body label.', 'sources': [status]})
        print(json.dumps({'url': url, 'downloaded': len(records), 'errors': status['errors']}), flush=True)
    sheets(output)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Collect bounded street-style snapshots; visual review remains required.')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--source', choices=['wear-men', 'wear-women', 'tokyofashion'], required=True)
    parser.add_argument('--pages', type=int, nargs='+', required=True)
    parser.add_argument('--limit', type=int, default=200)
    parser.add_argument('--account-limit', type=int, default=3)
    args = parser.parse_args()
    if args.limit < 1 or args.account_limit < 1 or any(page < 1 for page in args.pages):
        parser.error('Limits and pages must be positive')
    collect(args.output, args.source, args.pages, args.limit, args.account_limit)
