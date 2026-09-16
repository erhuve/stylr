import json
from pathlib import Path
import numpy as np
from sklearn.linear_model import RidgeCV
from sklearn.metrics import mean_absolute_error
from sklearn.neighbors import KNeighborsRegressor
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent


def main():
    data = np.load(ROOT / 'embeddings.npz')
    embeddings = dict(zip(data['ids'].tolist(), data['values']))
    original = json.loads((ROOT / 'evaluation.json').read_text())
    targets = {entry['photoId']: entry['target'] for entry in original['outOfFold']}
    missing = set(targets) - set(embeddings)
    if missing:
        raise ValueError(f'Cannot compare exact original folds: {sorted(missing)}')
    predictions = {name: {} for name in ['embedding_neighbors', 'calibrated_embedding']}
    for fold in original['folds']:
        train, test = fold['train'], fold['test']
        train_values = np.array([embeddings[photo_id] for photo_id in train])
        test_values = np.array([embeddings[photo_id] for photo_id in test])
        train_targets = np.array([targets[photo_id] for photo_id in train])
        for name, estimator in [
            ('embedding_neighbors', KNeighborsRegressor(n_neighbors=5, metric='cosine', weights='distance')),
            ('calibrated_embedding', make_pipeline(StandardScaler(), RidgeCV(alphas=[10, 100, 1000, 10000])))]:
            estimator.fit(train_values, train_targets)
            predicted = np.clip(estimator.predict(test_values), 1, 3)
            predictions[name].update(zip(test, predicted.tolist()))
    rows = original['outOfFold']
    expected = np.array([row['target'] for row in rows])
    for name, by_id in predictions.items():
        values = np.array([by_id[row['photoId']] for row in rows])
        errors = np.abs(expected - values)
        class_errors = {str(value): float(np.mean(errors[expected == value])) for value in sorted(set(expected))}
        original['results'][name] = dict(mae=float(mean_absolute_error(expected, values)), withinHalfStep=float(np.mean(errors <= .5)), macroMAE=float(np.mean(list(class_errors.values()))), classMAE=class_errors)
        for row in rows:
            row[name] = by_id[row['photoId']]
    for name in original['results']:
        clear_pairs = [(left, right) for left in range(len(rows)) for right in range(left + 1, len(rows)) if abs(expected[left] - expected[right]) >= 1]
        predicted = np.array([row[name] for row in rows])
        agreements = [float(np.sign(predicted[left] - predicted[right]) == np.sign(expected[left] - expected[right])) if predicted[left] != predicted[right] else .5 for left, right in clear_pairs]
        original['results'][name]['clearPairOrdering'] = float(np.mean(agreements))
        original['results'][name]['clearPairs'] = len(clear_pairs)
    full_ids = json.loads((ROOT / 'calibration-ids.json').read_text())
    review = json.loads((ROOT / 'visual-review.json').read_text())['rows']
    all_targets = {full_ids[row[0]]: row[1] for row in review if row[1] is not None and full_ids[row[0]] in embeddings}
    fitted = make_pipeline(StandardScaler(), RidgeCV(alphas=[10, 100, 1000, 10000]))
    fitted.fit(np.array([embeddings[photo_id] for photo_id in all_targets]), list(all_targets.values()))
    estimated = np.clip(fitted.predict(data['values']), 1, 3)
    ranked = [dict(photoId=photo_id, estimatedBuild=float(value), reviewedBuild=all_targets.get(photo_id)) for photo_id, value in zip(data['ids'].tolist(), estimated)]
    original['embeddingCoverage'] = len(embeddings)
    original['embeddingCalibration'] = len(all_targets)
    (ROOT / 'embedding-evaluation.json').write_text(json.dumps(original, indent=2, allow_nan=False))
    (ROOT / 'embedding-ranked.json').write_text(json.dumps(ranked, indent=2, allow_nan=False))
    print(json.dumps(original['results'], indent=2))


if __name__ == '__main__':
    main()
