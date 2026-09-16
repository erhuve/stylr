import argparse
import csv
import hashlib
import json
from pathlib import Path


AXES = {'build': {1, 1.5, 2, 2.5, 3}, 'shoulderHip': {-1, 0, 1}, 'waist': {0, 1, 2}}


def compile_batch(batch, image_root):
    intake = json.loads((batch / 'intake.json').read_text())
    observations = list(csv.DictReader((batch / 'observations.tsv').open(), delimiter='\t'))
    ordinals = [int(row['ordinal']) for row in observations]
    if sorted(ordinals) != list(range(len(intake))):
        raise ValueError('Missing or duplicate authored observations')
    labels = []
    for observation in observations:
        asset = intake[int(observation['ordinal'])]
        original = (image_root / asset['localPath']).resolve()
        if not original.is_relative_to(image_root.resolve()) or hashlib.sha256(original.read_bytes()).hexdigest() != asset['sha256']:
            raise ValueError('Image binding mismatch: ' + asset['id'])
        body = {axis: None if observation[axis] == '?' else float(observation[axis]) for axis in AXES}
        if any(value is not None and value not in AXES[axis] for axis, value in body.items()):
            raise ValueError('Invalid body observation')
        if observation['view'] not in {'full', 'partial', 'seated', 'back', 'detail', 'reject'} or not observation['evidence'].strip():
            raise ValueError('Missing framing or evidence')
        labels.append({**{key: asset[key] for key in ['id', 'source', 'sourceUrl', 'localPath', 'sha256']}, 'ordinal': int(observation['ordinal']), 'view': observation['view'], 'body': body, 'evidence': observation['evidence'], 'reviewer': 'primary-assistant-direct-visual'})
    (batch / 'labels.json').write_text(json.dumps(labels, indent=2) + '\n')
    print(f'{len(labels)} observations validated against original image digests')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compile authored visual observations without estimating or propagating labels.')
    parser.add_argument('--batch', type=Path, required=True)
    parser.add_argument('--image-root', type=Path, required=True)
    args = parser.parse_args()
    compile_batch(args.batch, args.image_root)
