import argparse
import concurrent.futures
import hashlib
import io
import json
import re
import tempfile
import urllib.request
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from pathlib import Path
from zipfile import ZipFile

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
MANIFESTS = ('photo-assets.json', 'fashionpedia-assets.json', 'streetstyle-assets.json', 'reviewed-assets.json')
MAX_IMAGE_BYTES = 24 * 1024 * 1024
MAX_ARCHIVE_BYTES = 350 * 1024 * 1024


def download(url, limit):
    if not url.startswith('https://'):
        raise ValueError(f'Expected an HTTPS source: {url}')
    request = urllib.request.Request(url, headers={'User-Agent': 'Stylr-personal-study/1.0'})
    with urllib.request.urlopen(request, timeout=90) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError('Source exceeds download limit')
    return data


def main():
    parser = argparse.ArgumentParser(description='Restore or verify locally optimized Stylr outfit photos from committed source manifests.')
    parser.add_argument('--check', action='store_true', help='Verify every expected local WebP without making network requests or writing images.')
    parser.add_argument('--archive-cache', type=Path, help='Reuse downloaded Fashionpedia ZIP archives in this directory; otherwise use temporary storage.')
    args = parser.parse_args()
    assets = [asset for name in MANIFESTS for asset in json.loads((ROOT / 'scripts' / name).read_text())]
    if len({asset['id'] for asset in assets}) != len(assets):
        raise ValueError('Duplicate asset IDs')
    if any(not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]*', asset['id']) for asset in assets):
        raise ValueError('Invalid asset ID')
    output = ROOT / 'public/photos'
    if not args.check:
        output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='stylr-photos-') as temporary:
        cache = args.archive_cache or Path(temporary)
        archives = {}
        for asset in assets:
            archive = asset.get('archive')
            if not archive or args.check or (output / f"{asset['id']}.webp").exists():
                continue
            url = archive['url']
            if url in archives:
                continue
            cache.mkdir(parents=True, exist_ok=True)
            target = cache / (hashlib.sha256(url.encode()).hexdigest()[:16] + '.zip')
            if not target.exists():
                data = download(url, MAX_ARCHIVE_BYTES)
                with ZipFile(io.BytesIO(data)):
                    pass
                pending = target.with_suffix('.pending')
                pending.write_bytes(data)
                pending.replace(target)
            archives[url] = target

        def fetch(asset):
            destination = output / f"{asset['id']}.webp"
            reviewed = 'reviewedView' in asset
            if destination.exists():
                if reviewed and hashlib.sha256(destination.read_bytes()).hexdigest() != asset['sha256']:
                    raise ValueError(f"Reviewed asset checksum mismatch: {asset['id']}")
                with Image.open(destination) as image:
                    if image.format != 'WEBP' or image.width < 1 or image.height < 1:
                        raise ValueError(f"Invalid WebP: {asset['id']}")
                    image.verify()
                return
            if args.check:
                raise FileNotFoundError(f"Missing photo: {asset['id']}")
            archive = asset.get('archive')
            if archive:
                with ZipFile(archives[archive['url']]) as zipped:
                    info = zipped.getinfo(archive['member'])
                    if info.file_size > MAX_IMAGE_BYTES:
                        raise ValueError('Archive image exceeds download limit')
                    data = zipped.read(info)
                if hashlib.sha256(data).hexdigest() != archive['sha256']:
                    raise ValueError(f"Archive source checksum mismatch: {asset['id']}")
            else:
                url = asset['url']
                if reviewed and 'cdn.shopify.com/' in url:
                    parsed = urlsplit(url)
                    query = dict(parse_qsl(parsed.query))
                    query['width'] = '720'
                    url = urlunsplit(parsed._replace(query=urlencode(query)))
                data = download(url, MAX_IMAGE_BYTES)
            image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB')
            image.thumbnail((720, 1000) if reviewed else (1100, 1400))
            pending = destination.with_suffix('.pending')
            image.save(pending, format='WEBP', quality=85 if reviewed else 84)
            if reviewed and hashlib.sha256(pending.read_bytes()).hexdigest() != asset['sha256']:
                pending.unlink()
                raise ValueError(f"Reviewed source or encoder changed; restore the original corpus asset: {asset['id']}")
            pending.replace(destination)

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            list(executor.map(fetch, assets))
    print(f'{len(assets)} source-linked WebP assets verified at {output}')


if __name__ == '__main__':
    main()
