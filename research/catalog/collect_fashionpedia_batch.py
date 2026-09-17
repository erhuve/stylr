import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
from zipfile import ZipFile

from PIL import Image, ImageOps

import pilot
from expand_targeted import REPO, save, sheets


def flickr_link(photo_id):
    alphabet = '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
    encoded = ''
    number = int(photo_id)
    while number:
        number, remainder = divmod(number, 58)
        encoded = alphabet[remainder] + encoded
    return 'https://flic.kr/p/' + encoded


def collect(output, limit, split='validation-test'):
    if split not in {'validation-test', 'training'}:
        raise ValueError('Unknown archive split')
    if (output / 'intake.json').exists():
        raise ValueError('Use a new output batch')
    raw = output / 'raw'
    archive_name = 'train2020.zip' if split == 'training' else 'val_test2020.zip'
    archive_url = 'https://s3.amazonaws.com/ifashionist-dataset/images/' + archive_name
    archive_path = raw / archive_name
    metadata_files = ['attributes_train2020.json'] if split == 'training' else ['info_test2020.json', 'instances_attributes_val2020.json']
    manifests = list((REPO / 'scripts').glob('*assets.json'))
    manifests += sorted((REPO / 'data/catalog-review/batches').glob('*/intake.json'))
    manifests += sorted((REPO / 'data/catalog-review/batches').glob('*/pending-intake.json'))
    manifests += sorted(pilot.ROOT.glob('expansion-*/intake.json'))
    prior = [row for manifest in manifests for row in json.loads(manifest.read_text())]
    used_ids = {row['id'] for row in prior}
    used_photos = set()
    for row in prior:
        for field in ['url', 'imageUrl', 'sourceUrl']:
            match = re.search(r'/(\d+)_[a-zA-Z0-9]+', row.get(field, ''))
            if match:
                used_photos.add(match[1])
    hashes = {row['sha256'] for row in prior if row.get('sha256')}
    records, searches, statuses = [], [], []
    (pilot.ROOT / 'images').mkdir(parents=True, exist_ok=True)
    with ZipFile(archive_path) as archive:
        members = {Path(member).name: member for member in archive.namelist() if member.endswith('.jpg')}
        for filename in metadata_files:
            metadata_path = raw / filename
            metadata = json.loads(metadata_path.read_text())
            listing = 'https://s3.amazonaws.com/ifashionist-dataset/annotations/' + filename
            statuses.append({'url': listing, 'products': len(metadata['images']), 'snapshotSha256': hashlib.sha256(metadata_path.read_bytes()).hexdigest()})
            licenses = {row['id']: row for row in metadata['licenses']}
            for candidate in metadata['images']:
                original = candidate.get('original_url', '').replace('http:', 'https:', 1)
                match = re.search(r'/(\d+)_[a-zA-Z0-9]+', original) if 'staticflickr.com/' in original else None
                identifier = f'fashionpedia-expansion-{candidate["id"]}'
                source_url = flickr_link(match[1]) if match else listing
                decision = ('unresolved-photo-source' if not match else
                            'previously-sampled' if match[1] in used_photos or f'archive-{candidate["id"]}' in used_ids or identifier in used_ids else
                            'eligible-deferred' if len(records) >= limit else 'selected')
                search = {'source': 'fashionpedia', 'sourceUrl': source_url, 'listingUrl': listing, 'title': f'Fashionpedia photo {candidate["id"]}', 'decision': decision, 'datasetImageId': candidate['id']}
                searches.append(search)
                if decision != 'selected':
                    continue
                used_photos.add(match[1])
                member = members.get(candidate['file_name'])
                if member is None:
                    search['decision'] = 'missing-archive-member'
                    continue
                data = archive.read(member)
                image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB')
                image.thumbnail((720, 1000))
                path = pilot.ROOT / 'images' / f'{identifier}.webp'
                image.save(path, 'WEBP', quality=85)
                record = pilot.download({'id': identifier, 'source': 'fashionpedia', 'sourceUrl': source_url, 'imageUrl': original, 'title': search['title'], 'body': None, 'reviewStatus': 'unreviewed', 'datasetImageId': candidate['id'], 'sourceLicense': licenses[candidate['license']], 'archive': {'url': archive_url, 'member': member, 'sha256': hashlib.sha256(data).hexdigest()}})
                if record['sha256'] in hashes:
                    search['decision'] = 'exact-duplicate'
                    continue
                hashes.add(record['sha256'])
                records.append(record)
    save(output / 'intake.json', records)
    save(output / 'searches.json', searches)
    with archive_path.open('rb') as archive_stream:
        archive_digest = hashlib.file_digest(archive_stream, 'sha256').hexdigest()
    save(output / 'sources.json', {'retrievedAt': datetime.now(timezone.utc).isoformat(), 'scope': f'Official Fashionpedia {split} archive; only individually identified Flickr photos. Existing dataset IDs and Flickr IDs excluded. Dataset attributes never converted into reviewed labels.', 'sources': [{'source': 'fashionpedia', 'pages': statuses, 'archiveUrl': archive_url, 'archiveSha256': archive_digest, 'errors': []}]})
    sheets(output)
    print(f'{len(records)} unique unreviewed archive candidates')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Prepare individually sourced Fashionpedia photos for direct visual review from downloaded official metadata and val_test2020.zip in OUTPUT/raw.')
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--limit', type=int, default=2800)
    parser.add_argument('--split', choices=['validation-test', 'training'], default='validation-test')
    args = parser.parse_args()
    if args.limit < 1:
        parser.error('Limit must be positive')
    collect(args.output, args.limit, args.split)
