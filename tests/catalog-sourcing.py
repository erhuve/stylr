import importlib
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


REPO = Path(__file__).resolve().parents[1]
os.environ.setdefault('STYLR_INTAKE_ROOT', str(REPO / '.cache/intake-test'))
sys.path.insert(0, str(REPO / 'research/catalog'))
collector = importlib.import_module('expand_targeted')


class SourceTracking(unittest.TestCase):
    def test_committed_history_excluded_and_every_listing_decision_saved(self):
        (REPO / '.cache').mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=REPO / '.cache') as directory:
            root = Path(directory)
            data = root / 'data/catalog-review'
            collector.save(data / 'intake.json', [])
            collector.save(data / 'baseline.json', [])
            collector.save(data / 'batches/old/intake.json', [{'sourceUrl': 'https://www.forestinkclothing.com/products/old/', 'sha256': 'prior'}])
            products = [{'id': index, 'handle': handle, 'title': title, 'images': [{'id': index, 'src': f'https://example.com/{index}.jpg'}] if handle != 'empty' else []} for index, (handle, title) in enumerate([('old', 'Old shirt'), ('bag', 'Bag'), ('empty', 'Empty shirt'), ('new', 'New shirt'), ('later', 'Later shirt')])]
            for product in products:
                product['product_type'] = 'Apparel & Accessories > Clothing > Shirts & Tops'
            products.append({'id': 6, 'handle': 'intimate', 'title': 'Support top', 'product_type': 'Apparel & Accessories > Clothing > Underwear', 'images': [{'id': 6, 'src': 'https://example.com/6.jpg'}]})
            output = root / 'new-batch'
            with patch.object(collector, 'REPO', root), patch.object(collector.pilot, 'ROOT', root), patch.object(collector.pilot, 'fetch', return_value=json.dumps({'products': products}).encode()), patch.object(collector.pilot, 'download', side_effect=lambda row: {**row, 'sha256': 'prior'}), patch.object(collector, 'sheets'):
                collector.collect(output, 1, ['forestink'])
            decisions = {row['title']: row['decision'] for row in json.loads((output / 'searches.json').read_text())}
            self.assertEqual(decisions, {'Old shirt': 'previously-sampled', 'Bag': 'text-filtered', 'Empty shirt': 'no-images', 'New shirt': 'selected', 'Later shirt': 'eligible-deferred', 'Support top': 'text-filtered'})
            status = json.loads((output / 'sources.json').read_text())['sources'][0]
            self.assertEqual(status['images'][0]['outcome'], 'exact-duplicate')
            self.assertEqual(json.loads((output / 'intake.json').read_text()), [])
            self.assertEqual(len(status['pages'][0]['snapshotSha256']), 64)

    def test_existing_partial_run_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / 'download-progress.json').write_text('[]')
            with self.assertRaisesRegex(ValueError, 'already contains data'):
                collector.collect(output, 1, ['forestink'])

    def test_network_failures_are_durable(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            collector.save(root / 'data/catalog-review/intake.json', [])
            collector.save(root / 'data/catalog-review/baseline.json', [])
            with patch.object(collector, 'REPO', root), patch.object(collector.pilot, 'ROOT', root), patch.object(collector.pilot, 'fetch', side_effect=RuntimeError('unavailable')), patch.object(collector, 'sheets'):
                collector.collect(root / 'batch', 1, ['forestink'])
            status = json.loads((root / 'batch/sources.json').read_text())['sources'][0]
            self.assertEqual(status['errors'][0]['error'], 'unavailable')
            self.assertEqual(status['pages'], [])


if __name__ == '__main__':
    unittest.main()
