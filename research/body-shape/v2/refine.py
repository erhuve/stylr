import argparse
import hashlib
import json
import os
from pathlib import Path

os.environ.setdefault('OMP_NUM_THREADS', '2')
os.environ.setdefault('OPENBLAS_NUM_THREADS', '2')
import numpy as np
from PIL import Image
from sklearn.ensemble import ExtraTreesRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import KFold
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import RobustScaler

ROOT = Path(__file__).resolve().parent
BASE = ROOT.parent
SOURCE = ROOT.parents[2] / 'public/photos'
NAMES = ['shoulder_torso', 'hip_torso', 'shoulder_hip', 'leg_torso']
NAMES += [f'torso_{number}' for number in range(5)]
NAMES += ['waist_upper', 'waist_hip', 'arm_width', 'calf_width']


def section_width(mask, center, perpendicular, extent):
    offsets = np.linspace(-extent, extent, 161)
    locations = np.rint(center[None, :] + offsets[:, None] * perpendicular[None, :]).astype(int)
    height, width = mask.shape
    inside = (locations[:, 0] >= 0) & (locations[:, 0] < width) & (locations[:, 1] >= 0) & (locations[:, 1] < height)
    values = np.zeros(161, dtype=bool)
    values[inside] = mask[locations[inside, 1], locations[inside, 0]]
    if not values[80]:
        return np.nan
    left = right = 80
    while left > 0 and values[left - 1]:
        left -= 1
    while right < 160 and values[right + 1]:
        right += 1
    if left == 0 or right == 160:
        return np.nan
    return 2 * min(80 - left, right - 80) * extent / 80


def infer(detector, pixels, mp):
    height, width = pixels.shape[:2]
    result = detector.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(pixels)))
    if not result.pose_landmarks:
        return None, 'no-pose'
    sizes = []
    for landmarks in result.pose_landmarks:
        horizontal = [point.x for point in landmarks[:29]]
        vertical = [point.y for point in landmarks[:29]]
        sizes.append((max(horizontal) - min(horizontal)) * (max(vertical) - min(vertical)))
    selected = int(np.argmax(sizes))
    if len(sizes) > 1 and sorted(sizes)[-1] < 2.5 * sorted(sizes)[-2]:
        return None, 'ambiguous-main-person'
    landmarks = result.pose_landmarks[selected]
    points = np.array([[point.x * width, point.y * height] for point in landmarks])
    confidence = np.array([min(point.visibility, point.presence) for point in landmarks])
    if min(confidence[[11, 12, 23, 24]]) < .5:
        return None, 'uncertain-torso-joints'
    shoulder = np.mean(points[[11, 12]], axis=0)
    hip = np.mean(points[[23, 24]], axis=0)
    torso = np.linalg.norm(hip - shoulder)
    shoulder_span = np.linalg.norm(points[11] - points[12])
    hip_span = np.linalg.norm(points[23] - points[24])
    if torso < 30 or hip_span < 10 or hip[1] <= shoulder[1] or shoulder_span / torso < .35:
        return None, 'degenerate-or-side-pose'
    axis = (hip - shoulder) / torso
    perpendicular = np.array([axis[1], -axis[0]])
    mask = np.squeeze(result.segmentation_masks[selected].numpy_view()) > .5
    contours = [section_width(mask, shoulder * (1 - fraction) + hip * fraction, perpendicular, torso) / torso for fraction in [.2, .4, .6, .8, 1.0]]
    legs = []
    for upper, knee, ankle in [(23, 25, 27), (24, 26, 28)]:
        if min(confidence[[upper, knee, ankle]]) >= .65 and 0 < landmarks[ankle].y < .99:
            legs.append((np.linalg.norm(points[upper] - points[knee]) + np.linalg.norm(points[knee] - points[ankle])) / torso)
    limbs = []
    for pairs in [[(11, 13), (12, 14)], [(25, 27), (26, 28)]]:
        estimates = []
        for start, end in pairs:
            if min(confidence[[start, end]]) < .65:
                continue
            direction = points[end] - points[start]
            length = np.linalg.norm(direction)
            if length < 15:
                continue
            normal = np.array([direction[1], -direction[0]]) / length
            for fraction in [.4, .6]:
                center = points[start] * (1 - fraction) + points[end] * fraction
                if start in [11, 12]:
                    relative = center - shoulder
                    if 0 < np.dot(relative, axis) < torso and abs(np.dot(relative, perpendicular)) < shoulder_span * .48:
                        continue
                value = section_width(mask, center, normal, length * .45) / torso
                if np.isfinite(value) and .025 < value < .45:
                    estimates.append(value)
        limbs.append(float(np.median(estimates)) if estimates else np.nan)
    waist = np.nanmin(contours[1:4]) if np.isfinite(contours[1:4]).any() else np.nan
    ratios = [waist / contours[0] if contours[0] > .05 else np.nan, waist / contours[4] if contours[4] > .05 else np.nan]
    features = [shoulder_span / torso, hip_span / torso, shoulder_span / hip_span, float(np.mean(legs)) if legs else np.nan] + contours + ratios + limbs
    return np.array(features), None


def extract():
    import mediapipe as mp
    originals = json.loads((BASE / 'features.json').read_text())
    options = mp.tasks.vision.PoseLandmarkerOptions(base_options=mp.tasks.BaseOptions(model_asset_path=str(BASE / 'pose_landmarker_full.task')), num_poses=2, output_segmentation_masks=True)
    records = []
    with mp.tasks.vision.PoseLandmarker.create_from_options(options) as detector:
        for index, original in enumerate(originals):
            photo_id = original['photoId']
            image_path = SOURCE / f'{photo_id}.webp'
            if hashlib.sha256(image_path.read_bytes()).hexdigest() != original['sha256']:
                raise ValueError('Image changed: ' + photo_id)
            picture = Image.open(image_path).convert('RGB')
            picture.thumbnail((900, 1100))
            values, reason = infer(detector, np.asarray(picture), mp)
            mirrored, mirror_reason = infer(detector, np.asarray(picture)[:, ::-1], mp)
            record = dict(photoId=photo_id, sha256=original['sha256'], reason=reason, mirrorReason=mirror_reason)
            if values is not None and mirrored is not None:
                relative_change = np.abs(values - mirrored) / np.maximum(np.abs(values), .05)
                unstable = relative_change > .25
                fused = np.nanmean(np.stack([values, mirrored]), axis=0)
                fused[unstable] = np.nan
                record['unstableFeatures'] = [NAMES[position] for position in np.flatnonzero(unstable)]
                record['features'] = [float(value) if np.isfinite(value) else None for value in fused]
            elif values is not None:
                record['features'] = [float(value) if np.isfinite(value) else None for value in values]
                record['unstableFeatures'] = []
            if 'features' in record:
                record['needsReview'] = mirror_reason is not None or len(record['unstableFeatures']) > 3
            records.append(record)
            if index % 25 == 0:
                print(f'{index + 1}/385', flush=True)
    (ROOT / 'features.json').write_text(json.dumps(dict(names=NAMES, records=records), indent=2, allow_nan=False))


def evaluate():
    original = {record['photoId']: record for record in json.loads((BASE / 'features.json').read_text())}
    features = json.loads((ROOT / 'features.json').read_text())
    current = {record['photoId']: record for record in features['records'] if 'features' in record}
    ids = json.loads((ROOT / 'calibration-ids.json').read_text())
    rows = json.loads((ROOT / 'visual-review.json').read_text())['rows']
    targets = {ids[row[0]]: row[1] for row in rows if row[1] is not None}
    common = sorted(photo_id for photo_id in targets if photo_id in current and 'pose' in original[photo_id] and 'silhouette' in original[photo_id])
    target = np.array([targets[photo_id] for photo_id in common])
    old = np.array([original[photo_id]['pose'] for photo_id in common])
    new = np.array([current[photo_id]['features'] for photo_id in common], dtype=float)
    predictions = {name: np.zeros(len(common)) for name in ['constant', 'old_pose', 'new_contours', 'calibrated_contours']}
    folds = list(KFold(n_splits=5, shuffle=True, random_state=20260915).split(common))
    fold_records = []
    for train, test in folds:
        predictions['constant'][test] = np.median(target[train])
        for name, values, model in [
            ('old_pose', old, KNeighborsRegressor(n_neighbors=5, weights='distance')),
            ('new_contours', new, KNeighborsRegressor(n_neighbors=5, weights='distance')),
            ('calibrated_contours', new, ExtraTreesRegressor(n_estimators=250, max_depth=5, min_samples_leaf=3, random_state=42, n_jobs=2))]:
            pipeline = make_pipeline(SimpleImputer(strategy='median', add_indicator=True), RobustScaler(), model)
            pipeline.fit(values[train], target[train])
            predictions[name][test] = pipeline.predict(values[test])
        fold_records.append(dict(train=[common[number] for number in train], test=[common[number] for number in test]))
    results = {}
    for name, prediction in predictions.items():
        errors = np.abs(prediction - target)
        groups = {str(value): float(np.mean(errors[target == value])) for value in sorted(set(target))}
        results[name] = dict(mae=float(mean_absolute_error(target, prediction)), withinHalfStep=float(np.mean(errors <= .5)), macroMAE=float(np.mean(list(groups.values()))), classMAE=groups)
    all_known = sorted(photo_id for photo_id in targets if photo_id in current)
    fitted = make_pipeline(SimpleImputer(strategy='median', add_indicator=True), RobustScaler(), ExtraTreesRegressor(n_estimators=250, max_depth=5, min_samples_leaf=3, random_state=42, n_jobs=2))
    fitted.fit(np.array([current[photo_id]['features'] for photo_id in all_known], dtype=float), [targets[photo_id] for photo_id in all_known])
    all_ids = sorted(current)
    projected = fitted.predict(np.array([current[photo_id]['features'] for photo_id in all_ids], dtype=float))
    ranked = [dict(photoId=photo_id, estimatedBuild=float(estimate), reviewedBuild=targets.get(photo_id), needsReview=current[photo_id]['needsReview']) for photo_id, estimate in zip(all_ids, projected)]
    summary = dict(reviewed=96, visualBuildTargets=len(targets), featureCoverage=len(current), calibrationWithFeatures=len(all_known), sharedEvaluation=len(common), results=results,
        targetCounts={str(value): int(np.sum(target == value)) for value in sorted(set(target))}, folds=fold_records,
        outOfFold=[dict(photoId=photo_id, target=float(target[number]), **{name: float(prediction[number]) for name, prediction in predictions.items()}) for number, photo_id in enumerate(common)])
    (ROOT / 'evaluation.json').write_text(json.dumps(summary, indent=2, allow_nan=False))
    (ROOT / 'ranked.json').write_text(json.dumps(ranked, indent=2, allow_nan=False))
    print(json.dumps({key: value for key, value in summary.items() if key not in ['folds', 'outOfFold']}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Pose-aligned contour extraction, mirrored stability checks and held-out visual calibration.')
    parser.add_argument('stage', choices=['extract', 'evaluate', 'all'])
    args = parser.parse_args()
    if args.stage in ['extract', 'all']:
        extract()
    if args.stage in ['evaluate', 'all']:
        evaluate()
