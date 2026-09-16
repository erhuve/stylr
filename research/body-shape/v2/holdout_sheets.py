import json
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parents[2] / 'public/photos'


def main():
    prior = set(json.loads((ROOT / 'calibration-ids.json').read_text()))
    available = sorted(record['photoId'] for record in json.loads((ROOT.parent / 'features.json').read_text()) if record['photoId'] not in prior)
    ids = random.Random(20260916).sample(available, 48)
    (ROOT / 'holdout-ids.json').write_text(json.dumps(ids, indent=2))
    for offset in range(0, len(ids), 12):
        sheet = Image.new('RGB', (1200, 1230), '#eeeae3')
        drawing = ImageDraw.Draw(sheet)
        for position, photo_id in enumerate(ids[offset:offset + 12]):
            image = ImageOps.contain(Image.open(SOURCE / f'{photo_id}.webp').convert('RGB'), (290, 370))
            left, top = position % 4 * 300, position // 4 * 410
            sheet.paste(image, (left + (300 - image.width) // 2, top))
            drawing.text((left + 5, top + 376), f'{offset + position:02d} {photo_id}', fill='black')
        sheet.save(ROOT / f'holdout-{offset // 12}.jpg', quality=94)


if __name__ == '__main__':
    main()
