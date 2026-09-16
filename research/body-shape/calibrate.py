import json
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parents[1] / 'public/photos'


def main():
    folder = ROOT / 'v2'
    folder.mkdir(exist_ok=True)
    records = json.loads((ROOT / 'features.json').read_text())
    selected = random.Random(20260914).sample(sorted(record['photoId'] for record in records), 96)
    (folder / 'calibration-ids.json').write_text(json.dumps(selected, indent=2))
    for offset in range(0, len(selected), 12):
        sheet = Image.new('RGB', (1200, 1230), '#eeeae3')
        drawing = ImageDraw.Draw(sheet)
        for position, photo_id in enumerate(selected[offset:offset + 12]):
            picture = Image.open(SOURCE / (photo_id + '.webp')).convert('RGB')
            thumbnail = ImageOps.contain(picture, (290, 370))
            left, top = position % 4 * 300, position // 4 * 410
            sheet.paste(thumbnail, (left + (300 - thumbnail.width) // 2, top))
            drawing.text((left + 6, top + 376), f'{offset + position:02d} {photo_id}', fill='black')
        sheet.save(folder / f'calibration-{offset // 12}.jpg', quality=94)


if __name__ == '__main__':
    main()
