import json
from pathlib import Path
import mediapipe as mp
import numpy as np
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parents[2] / 'public/photos'


def main():
    folder = ROOT / 'normalized'
    folder.mkdir(exist_ok=True)
    options = mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(ROOT.parent / 'pose_landmarker_full.task')), num_poses=2, output_segmentation_masks=True)
    metadata = []
    with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
        for index, record in enumerate(json.loads((ROOT.parent / 'features.json').read_text())):
            photo_id = record['photoId']
            picture = Image.open(SOURCE / f'{photo_id}.webp').convert('RGB')
            picture.thumbnail((900, 1100))
            pixels = np.asarray(picture)
            result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=pixels))
            if not result.pose_landmarks:
                continue
            areas = [float(np.sum(np.squeeze(mask.numpy_view()) > .5)) for mask in result.segmentation_masks]
            selected = int(np.argmax(areas))
            if len(areas) > 1 and sorted(areas)[-1] < 2.5 * sorted(areas)[-2]:
                continue
            mask = np.squeeze(result.segmentation_masks[selected].numpy_view()) > .5
            landmarks = result.pose_landmarks[selected]
            head_cut = int(np.clip(min(landmarks[11].y, landmarks[12].y) * pixels.shape[0], 0, pixels.shape[0]))
            mask[:head_cut] = False
            vertical, horizontal = np.where(mask)
            if len(horizontal) < 100:
                continue
            gray = np.asarray(ImageOps.grayscale(picture))
            normalized = np.full_like(gray, 238)
            normalized[mask] = gray[mask]
            cropped = Image.fromarray(normalized).crop((int(horizontal.min()), head_cut, int(horizontal.max()) + 1, int(vertical.max()) + 1))
            cropped.thumbnail((280, 420))
            cropped.convert('RGB').save(folder / f'{photo_id}.jpg', quality=94)
            metadata.append(dict(photoId=photo_id, headCut=head_cut, originalWidth=pixels.shape[1], originalHeight=pixels.shape[0]))
            if index % 40 == 0:
                print(index + 1, flush=True)
    (ROOT / 'crop-metadata.json').write_text(json.dumps(metadata, indent=2))
    print('Crops', len(metadata), flush=True)


if __name__ == '__main__':
    main()
