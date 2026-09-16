import json
from pathlib import Path
import numpy as np
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import RobustScaler

ROOT = Path(__file__).resolve().parent


def main():
    old = {row['photoId']: row for row in json.loads((ROOT.parent / 'features.json').read_text())}
    train_ids = json.loads((ROOT / 'calibration-ids.json').read_text())
    train = {train_ids[row[0]]: row[1] for row in json.loads((ROOT / 'visual-review.json').read_text())['rows'] if row[1] is not None and 'pose' in old[train_ids[row[0]]]}
    fitted = make_pipeline(RobustScaler(), KNeighborsRegressor(n_neighbors=5, weights='distance')).fit(np.array([old[photo]['pose'] for photo in train]), list(train.values()))
    holdout_ids = json.loads((ROOT / 'holdout-ids.json').read_text())
    assert not set(holdout_ids) & set(train_ids)
    predictions = {row['photoId']: row['estimatedBuild'] for row in json.loads((ROOT / 'embedding-ranked.json').read_text())}
    observations = json.loads((ROOT / 'holdout-review.json').read_text())['rows']
    rows = []
    for row in observations:
        photo = holdout_ids[row[0]]
        if row[1] is not None and photo in predictions and 'pose' in old[photo]:
            rows.append(dict(photoId=photo, target=row[1], constant=1.5, old_pose=float(fitted.predict([old[photo]['pose']])[0]), calibrated_embedding=predictions[photo]))
    result = dict(sampled=48, labeled=sum(row[1] is not None for row in observations), common=len(rows), rows=rows, results={})
    for name in ['constant', 'old_pose', 'calibrated_embedding']:
        errors = [abs(row[name] - row['target']) for row in rows]
        classes = sorted(set(row['target'] for row in rows))
        pairs = [(left, right) for left in rows for right in rows if left['target'] + 1 <= right['target']]
        result['results'][name] = dict(mae=float(np.mean(errors)), macroMAE=float(np.mean([np.mean([abs(row[name] - row['target']) for row in rows if row['target'] == value]) for value in classes])), clearPairOrdering=float(np.mean([1 if left[name] < right[name] else .5 if left[name] == right[name] else 0 for left, right in pairs])), clearPairs=len(pairs))
    (ROOT / 'holdout-evaluation.json').write_text(json.dumps(result, indent=2, allow_nan=False))
    print(json.dumps({key: value for key, value in result.items() if key != 'rows'}, indent=2))


if __name__ == '__main__':
    main()
