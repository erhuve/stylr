import argparse
import hashlib
import html
import json
import os
from pathlib import Path

os.environ.setdefault('OMP_NUM_THREADS', '2')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '2')
import numpy as np
from PIL import Image, ImageDraw, ImageOps
from sklearn.cluster import KMeans
from sklearn.metrics import adjusted_rand_score, silhouette_score
from sklearn.preprocessing import RobustScaler

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parents[1]
AXES = ['shoulder/torso', 'hip/torso', 'shoulder/hip', 'leg/torso']


def extract():
    import mediapipe as mp
    entries = json.loads((SOURCE / 'data/body-references/labels.v1.json').read_text())['labels']
    options = mp.tasks.vision.PoseLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(ROOT / 'pose_landmarker_full.task')),
        num_poses=2, output_segmentation_masks=True)
    records = []
    (ROOT / 'previews').mkdir(exist_ok=True)
    with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
        for index, entry in enumerate(entries):
            photo_id = entry['photoId']
            path = SOURCE / 'public/photos' / (photo_id + '.webp')
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest != entry['assetSha256']:
                raise ValueError('Source digest mismatch: ' + photo_id)
            original = Image.open(path).convert('RGB')
            original.thumbnail((900, 1100))
            pixels = np.asarray(original)
            height, width = pixels.shape[:2]
            result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=pixels))
            record = dict(photoId=photo_id, sourceUrl=entry['sourceUrl'], sha256=digest, reasons=[])
            if len(result.pose_landmarks) != 1:
                record['reasons'] = ['no-pose' if not result.pose_landmarks else 'multiple-poses']
                records.append(record)
                continue
            landmarks = result.pose_landmarks[0]
            points = np.array([[point.x * width, point.y * height] for point in landmarks])
            record['landmarks'] = [[point.x, point.y, point.visibility, point.presence] for point in landmarks]
            selected = [11, 12, 23, 24, 25, 26, 27, 28]
            if min(min(landmarks[number].visibility, landmarks[number].presence) for number in selected) < .65:
                record['reasons'].append('low-landmark-confidence')
            if any(not (.01 < landmarks[number].x < .99 and .01 < landmarks[number].y < .99) for number in selected):
                record['reasons'].append('cropped-landmarks')
            shoulder = (points[11] + points[12]) / 2
            hip = (points[23] + points[24]) / 2
            torso = float(np.linalg.norm(shoulder - hip))
            shoulder_width = float(np.linalg.norm(points[11] - points[12]))
            hip_width = float(np.linalg.norm(points[23] - points[24]))
            leg = float(np.mean([np.linalg.norm(points[upper] - points[knee]) + np.linalg.norm(points[knee] - points[ankle]) for upper, knee, ankle in [(23, 25, 27), (24, 26, 28)]]))
            if torso < 30 or hip_width < 10 or hip[1] <= shoulder[1]:
                record['reasons'].append('degenerate-pose')
            else:
                record['pose'] = [shoulder_width / torso, hip_width / torso, shoulder_width / hip_width, leg / torso]
                if shoulder_width / torso < .45 or abs(shoulder[0] - hip[0]) / torso > .35:
                    record['reasons'].append('turned-or-leaning')
                mask = np.squeeze(result.segmentation_masks[0].numpy_view()) > .5
                widths = []
                for fraction in np.linspace(.15, 1.0, 8):
                    center = shoulder * (1 - fraction) + hip * fraction
                    row = int(np.clip(center[1], 0, height - 1))
                    column = int(np.clip(center[0], 0, width - 1))
                    left = right = column
                    if not mask[row, column]:
                        widths.append(0.0)
                        continue
                    while left > 0 and mask[row, left - 1]:
                        left -= 1
                    while right < width - 1 and mask[row, right + 1]:
                        right += 1
                    widths.append((right - left + 1) / torso)
                record['silhouette'] = widths
                if min(widths) <= 0:
                    record['reasons'].append('missing-torso-mask')
                isolated = np.full_like(pixels, 238)
                isolated[mask] = pixels[mask]
                head_bottom = int(np.clip(min(points[11, 1], points[12, 1]), 0, height))
                isolated[:head_bottom] = 238
                preview = Image.fromarray(isolated)
                canvas = ImageDraw.Draw(preview)
                for start, end in [(11, 12), (11, 23), (12, 24), (23, 24), (23, 25), (25, 27), (24, 26), (26, 28)]:
                    canvas.line([tuple(points[start]), tuple(points[end])], fill='#00cdb4', width=3)
                preview.thumbnail((220, 300))
                preview.save(ROOT / 'previews' / (photo_id + '.jpg'))
            records.append(record)
            if index % 25 == 0:
                print(f'Processed {index + 1}/{len(entries)}', flush=True)
    (ROOT / 'features.json').write_text(json.dumps(records, indent=2))
    print('Extraction complete', len(records), flush=True)


def cluster():
    records = json.loads((ROOT / 'features.json').read_text())
    eligible = [record for record in records if not record['reasons']]
    summary = dict(total=len(records), eligible=len(eligible), excluded=len(records) - len(eligible), experiments={})
    assignments = {}
    for mode in ['pose', 'silhouette', 'combined']:
        values = np.array([record['pose'] if mode == 'pose' else record['silhouette'] if mode == 'silhouette' else record['pose'] + record['silhouette'] for record in eligible])
        scaled = np.clip(RobustScaler().fit_transform(values), -4, 4)
        trials = []
        for count in range(3, 9):
            fitted = KMeans(n_clusters=count, n_init=20, random_state=42).fit(scaled)
            trials.append((silhouette_score(scaled, fitted.labels_), count, fitted))
        score, count, fitted = max(trials, key=lambda trial: trial[0])
        seeds = [KMeans(n_clusters=count, n_init=10, random_state=seed).fit_predict(scaled) for seed in range(5)]
        stability = float(np.mean([adjusted_rand_score(fitted.labels_, labels) for labels in seeds]))
        summary['experiments'][mode] = dict(clusters=count, silhouette=float(score), seedAgreementARI=stability,
            candidateScores={str(trial[1]): float(trial[0]) for trial in trials})
        assignments[mode] = {}
        sections = []
        for group in range(count):
            indices = np.flatnonzero(fitted.labels_ == group)
            ordered = sorted(indices, key=lambda number: float(np.linalg.norm(scaled[number] - fitted.cluster_centers_[group])))
            members = [eligible[number] for number in ordered]
            assignments[mode][str(group)] = [member['photoId'] for member in members]
            sheet = Image.new('RGB', (1200, 760), '#f5f3ee')
            drawing = ImageDraw.Draw(sheet)
            drawing.text((12, 8), f'{mode} group {group} | {len(members)} photos | nearest 12 to center', fill='black')
            cards = []
            for rank, member in enumerate(members):
                photo_id = member['photoId']
                original = Image.open(SOURCE / 'public/photos' / (photo_id + '.webp')).convert('RGB')
                thumb = ImageOps.contain(original, (190, 325))
                if rank < 12:
                    left, top = (rank % 6) * 200, 35 + (rank // 6) * 360
                    sheet.paste(thumb, (left + (200 - thumb.width) // 2, top))
                    drawing.text((left + 5, top + 330), photo_id, fill='black')
                (ROOT / 'photos').mkdir(exist_ok=True)
                thumb.save(ROOT / 'photos' / (photo_id + '.jpg'))
                cards.append(f'<figure><div><img src="photos/{photo_id}.jpg"><img src="previews/{photo_id}.jpg"></div><figcaption><a href="{html.escape(member["sourceUrl"], quote=True)}">{photo_id}</a></figcaption></figure>')
            sheet.save(ROOT / f'{mode}-{group}.jpg')
            sections.append(f'<h2>{mode} group {group}: {len(members)} photographs</h2><section>{"".join(cards)}</section>')
        (ROOT / f'{mode}.html').write_text('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Stylr shape experiment</title><style>body{font:16px system-ui;background:#f5f3ee;margin:24px}section{display:flex;flex-wrap:wrap}figure{margin:8px}img{height:240px;max-width:180px;object-fit:contain}a{color:#245c55}</style><h1>Experimental ' + mode + ' groups</h1><p>Original and masked pose overlay. Ordered nearest cluster center first. These are algorithmic groups, not body-size labels.</p>' + ''.join(sections))
    summary['crossRepresentationARI'] = adjusted_rand_score(
        [next(group for group, ids in assignments['pose'].items() if record['photoId'] in ids) for record in eligible],
        [next(group for group, ids in assignments['silhouette'].items() if record['photoId'] in ids) for record in eligible])
    (ROOT / 'assignments.json').write_text(json.dumps(assignments, indent=2))
    (ROOT / 'summary.json').write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Offline Stylr pose/silhouette clustering experiment; leaves source photos and labels unchanged.')
    parser.add_argument('stage', choices=['extract', 'cluster', 'all'])
    args = parser.parse_args()
    if args.stage in ['extract', 'all']:
        extract()
    if args.stage in ['cluster', 'all']:
        cluster()
