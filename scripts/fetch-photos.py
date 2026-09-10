import concurrent.futures
import io
import json
from pathlib import Path
import urllib.request
from PIL import Image, ImageOps

root = Path(__file__).resolve().parent.parent
assets = json.loads((root / 'scripts/photo-assets.json').read_text())
output = root / 'public/photos'
output.mkdir(parents=True, exist_ok=True)

def fetch(asset):
    dest = output / f"{asset['id']}.webp"
    if dest.exists():
        with Image.open(dest) as image:
            image.verify()
        return asset['id']
    req = urllib.request.Request(asset['url'], headers={'User-Agent': 'Stylr/1.0'})
    with urllib.request.urlopen(req, timeout=60) as response:
        data = response.read(24 * 1024 * 1024 + 1)
    if len(data) > 24 * 1024 * 1024:
        raise ValueError('Photo exceeds download limit')
    image = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGB')
    image.thumbnail((1100, 1400))
    tmp = dest.with_suffix('.tmp')
    image.save(tmp, format='WEBP', quality=84)
    tmp.replace(dest)
    return asset['id']

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    for photo_id in executor.map(fetch, assets):
        print(photo_id)
print(f'{len(assets)} credited assets available at {output}')
