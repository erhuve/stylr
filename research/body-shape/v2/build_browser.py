import base64
import io
import json
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parents[2] / 'public/photos'


def main():
    annotations = {}
    for ids_name, review_name in [('calibration-ids.json', 'visual-review.json'), ('holdout-ids.json', 'holdout-review.json')]:
        ids = json.loads((ROOT / ids_name).read_text())
        for row in json.loads((ROOT / review_name).read_text())['rows']:
            annotations[ids[row[0]]] = dict(build=row[1], shoulderHip=row[2], waist=row[3], evidence=row[5])
    estimates = {row['photoId']: row['estimatedBuild'] for row in json.loads((ROOT / 'embedding-ranked.json').read_text())}
    records = []
    for source in json.loads((ROOT.parent / 'features.json').read_text()):
        photo_id = source['photoId']
        image = ImageOps.contain(Image.open(SOURCE / f'{photo_id}.webp').convert('RGB'), (300, 420))
        buffer = io.BytesIO()
        image.save(buffer, format='JPEG', quality=84)
        observation = annotations.get(photo_id, dict(build=None, shoulderHip=None, waist=None, evidence=''))
        records.append(dict(id=photo_id, source=source['sourceUrl'], reviewed=photo_id in annotations, estimate=estimates.get(photo_id), image='data:image/jpeg;base64,' + base64.b64encode(buffer.getvalue()).decode(), **observation))
    payload = json.dumps(records, separators=(',', ':')).replace('<', '\\u003c')
    template = (ROOT / 'browser-template.html').read_text()
    (ROOT / 'body-reference-browser.html').write_text(template.replace('__DATA__', payload))
    print(ROOT / 'body-reference-browser.html')


if __name__ == '__main__':
    main()
