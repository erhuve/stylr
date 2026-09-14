import argparse
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description='Verify original image identity while allowing harmless image re-encoding.')
    parser.add_argument('--directory', type=Path, default=ROOT / 'public')
    args = parser.parse_args()
    references = json.loads((ROOT / 'tests/fixtures/photo-original-visual.json').read_text())
    failures = []
    for reference in references:
        with Image.open(args.directory / reference['src'].lstrip('/')) as image:
            aspect = image.width / image.height
            pixels = list(image.convert('RGB').resize((8, 8), Image.Resampling.LANCZOS).getdata())
        differences = [abs(a - b) for pixel, expected in zip(pixels, reference['pixels']) for a, b in zip(pixel, expected)]
        if abs(aspect - reference['aspect']) > 0.003 or max(differences) > 16 or sum(differences) / len(differences) > 2:
            failures.append(reference['id'])
    if failures:
        raise ValueError(f'Original image identity changed: {failures}')
    print(f'{len(references)} original photographs retain their visual identity')


if __name__ == '__main__':
    main()
