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
collector = importlib.import_module('collect_street_batch')


class StreetSourceTracking(unittest.TestCase):
    def run_collection(self, root, source, raw, prior=None, limit=2, account_limit=3):
        collector.save(root / 'data/catalog-review/baseline.json', prior or [])
        collector.save(root / 'data/catalog-review/intake.json', [])
        output = root / 'batch'

        def fetch(address):
            if '-coordinate/' in address or '/wp-json/' in address:
                return raw
            return b'<img src="https://images.wear2.jp/coordinate/full_1000.jpg">'

        def download(row):
            if row['id'].endswith('103'):
                return {**row, 'downloadError': 'fixture download failure'}
            return {**row, 'sha256': 'prior' if row['id'].endswith('102') else row['id']}

        with patch.object(collector, 'REPO', root), patch.object(collector.pilot, 'ROOT', root), patch.object(collector.pilot, 'fetch', side_effect=fetch), patch.object(collector.pilot, 'download', side_effect=download), patch.object(collector, 'sheets'):
            collector.collect(output, source, [1], limit, account_limit)
        return output

    def test_tokyo_records_prior_missing_deferred_duplicates_and_failures(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            posts = [{'id': identity, 'link': f'https://tokyofashion.com/{identity}/', 'title': {'rendered': f'Outfit {identity}'}, 'content': {'rendered': '' if identity == 101 else f'<a href="https://tokyofashion.com/wp-content/uploads/{identity}.jpg">photo</a>'}} for identity in range(100, 106)]
            output = self.run_collection(root, 'tokyofashion', json.dumps(posts).encode(), [{'sourceUrl': 'https://tokyofashion.com/100/', 'sha256': 'prior'}], limit=3)
            decisions = [row['decision'] for row in json.loads((output / 'searches.json').read_text())]
            self.assertEqual(decisions, ['previously-sampled', 'no-images', 'selected', 'selected', 'selected', 'eligible-deferred'])
            status = json.loads((output / 'sources.json').read_text())['sources'][0]
            self.assertEqual([row['outcome'] for row in status['images']], ['exact-duplicate', 'download-error', 'downloaded-unique'])
            self.assertEqual(len(status['pages'][0]['snapshotSha256']), 64)
            self.assertEqual([row['id'] for row in json.loads((output / 'intake.json').read_text())], ['tokyo-archive-104'])

    def test_wear_caps_explicit_accounts_without_assigning_body_labels(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            raw = ''.join(f'<a href="/{account}/{identity}/"><img src="https://images.wear2.jp/coordinate/{identity}.jpg"></a>' for account, identity in [('capped', 100001), ('fresh', 100002), ('fresh', 100004)]).encode()
            output = self.run_collection(root, 'wear-men', raw, [{'sourceUrl': 'https://wear.jp/capped/999999/', 'sha256': 'old'}], account_limit=1)
            self.assertEqual([row['decision'] for row in json.loads((output / 'searches.json').read_text())], ['account-cap-deferred', 'selected', 'account-cap-deferred'])
            rows = json.loads((output / 'intake.json').read_text())
            self.assertEqual(len(rows), 1)
            self.assertIsNone(rows[0]['body'])
            self.assertEqual(rows[0]['reviewStatus'], 'unreviewed')
            self.assertEqual(rows[0]['imageUrl'], 'https://images.wear2.jp/coordinate/full_1000.jpg')
            self.assertEqual(len(rows[0]['detailSnapshotSha256']), 64)
            self.assertTrue((root / 'images').is_dir())

    def test_regional_block_is_not_an_empty_successful_listing(self):
        with tempfile.TemporaryDirectory() as directory:
            output = self.run_collection(Path(directory), 'wear-men', b'This service is not available')
            status = json.loads((output / 'sources.json').read_text())['sources'][0]
            self.assertEqual(status['pages'], [])
            self.assertIn('regional-unavailability', status['errors'][0]['error'])
            self.assertEqual(len(status['errors'][0]['snapshotSha256']), 64)
            self.assertEqual(json.loads((output / 'intake.json').read_text()), [])

    def test_existing_batch_is_not_overwritten(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            (output / 'progress.json').write_text('[]')
            with self.assertRaisesRegex(ValueError, 'new empty batch'):
                collector.collect(output, 'tokyofashion', [1], 1, 1)


if __name__ == '__main__':
    unittest.main()
