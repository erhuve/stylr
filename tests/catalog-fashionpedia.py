import hashlib
import importlib
import importlib.util
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from zipfile import BadZipFile, ZipFile

from PIL import Image


REPO = Path(__file__).resolve().parents[1]
os.environ.setdefault('STYLR_INTAKE_ROOT', str(REPO / '.cache/intake-test'))
sys.path.insert(0, str(REPO / 'research/catalog'))
collector = importlib.import_module('collect_fashionpedia_batch')
inventory = importlib.import_module('source_inventory')
spec = importlib.util.spec_from_file_location('fetcher', REPO / 'scripts/fetch-photos.py')
fetcher = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fetcher)


class ArchiveSourcing(unittest.TestCase):
    def test_archive_decisions_and_unreviewed_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / 'batch'
            raw = output / 'raw'
            raw.mkdir(parents=True)
            (root / 'images').mkdir()
            collector.save(root / 'scripts/reviewed-assets.json', [{'id': 'archive-1', 'sha256': 'prior'}])
            collector.save(root / 'data/catalog-review/batches/fixture/pending-intake.json', [{'id': 'fashionpedia-expansion-5', 'sha256': 'pending'}])
            candidates = [{'id': identity, 'file_name': f'{identity}.jpg', 'original_url': f'https://live.staticflickr.com/1/{identity}_abc.jpg', 'license': 1} for identity in range(1, 7)]
            candidates[1]['original_url'] = 'https://example.com/no-photo-id.jpg'
            metadata = {'images': candidates, 'licenses': [{'id': 1, 'name': 'fixture license'}]}
            collector.save(raw / 'info_test2020.json', metadata)
            collector.save(raw / 'instances_attributes_val2020.json', {**metadata, 'images': []})
            with ZipFile(raw / 'val_test2020.zip', 'w') as archive:
                for identity in [4, 5, 6]:
                    buffer = io.BytesIO()
                    Image.new('RGB', (48, 64), (identity * 20, 80, 120)).save(buffer, format='JPEG')
                    archive.writestr(f'test/{identity}.jpg', buffer.getvalue())
            with patch.object(collector, 'REPO', root), patch.object(collector.pilot, 'ROOT', root), patch.object(collector, 'sheets'), patch.object(collector.pilot, 'fetch', side_effect=AssertionError('Unexpected network')):
                collector.collect(output, 1)
                with self.assertRaisesRegex(ValueError, 'new output batch'):
                    collector.collect(output, 1)
            searches = json.loads((output / 'searches.json').read_text())
            self.assertEqual([row['decision'] for row in searches], ['previously-sampled', 'unresolved-photo-source', 'missing-archive-member', 'selected', 'previously-sampled', 'eligible-deferred'])
            records = json.loads((output / 'intake.json').read_text())
            self.assertEqual(len(records), 1)
            self.assertIsNone(records[0]['body'])
            self.assertEqual(records[0]['reviewStatus'], 'unreviewed')
            self.assertEqual(records[0]['sourceUrl'], collector.flickr_link(4))
            self.assertEqual(records[0]['archive']['member'], 'test/4.jpg')
            self.assertEqual(records[0]['sourceLicense'], metadata['licenses'][0])
            self.assertEqual(records[0]['sha256'], hashlib.sha256((root / records[0]['localPath']).read_bytes()).hexdigest())

    def test_resumed_pending_photos_have_individual_reviews(self):
        batch = REPO / 'data/catalog-review/batches/2026-09-17T0320-fashionpedia'
        pending = json.loads((batch / 'pending-intake.json').read_text())
        admitted = {row['id'] for row in json.loads((REPO / 'scripts/reviewed-assets.json').read_text())}
        reviewed = {row['id'] for row in json.loads((batch / 'labels.json').read_text())}
        self.assertEqual(len(pending), 0)
        self.assertFalse({row['id'] for row in pending} & (admitted | reviewed))
        resumed = REPO / 'data/catalog-review/batches/2026-09-17T0520-archive'
        candidates = json.loads((resumed / 'intake.json').read_text())
        labels = json.loads((resumed / 'labels.json').read_text())
        self.assertEqual(len(candidates), 831)
        self.assertEqual({row['id']: row['sha256'] for row in candidates}, {row['id']: row['sha256'] for row in labels})
        self.assertFalse({row['id'] for row in candidates} & reviewed)
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory)
            with patch.object(inventory, 'OUTPUT', output), patch.object(inventory.subprocess, 'run'):
                inventory.inventory()
            pages = {row['sourceUrl']: row for row in json.loads((output / 'pages.json').read_text())}
            for candidate in candidates:
                page = pages[candidate['sourceUrl']]
                self.assertIn(candidate['id'], page['candidateIds'])
                self.assertGreaterEqual(page['reviewedCandidates'], 1)

    def test_training_split_preserves_archive_and_individual_source(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / 'batch'
            raw = output / 'raw'
            raw.mkdir(parents=True)
            metadata = {'images': [{'id': 7, 'file_name': '7.jpg', 'original_url': 'https://live.staticflickr.com/1/7_abc.jpg', 'license': 1}], 'licenses': [{'id': 1, 'name': 'fixture'}]}
            collector.save(raw / 'attributes_train2020.json', metadata)
            buffer = io.BytesIO()
            Image.new('RGB', (48, 64), (90, 120, 180)).save(buffer, format='JPEG')
            with ZipFile(raw / 'train2020.zip', 'w') as archive:
                archive.writestr('train/7.jpg', buffer.getvalue())
            with patch.object(collector, 'REPO', root), patch.object(collector.pilot, 'ROOT', root), patch.object(collector, 'sheets'), patch.object(collector.pilot, 'fetch', side_effect=AssertionError('Unexpected network')):
                collector.collect(output, 1, 'training')
                with self.assertRaisesRegex(ValueError, 'Unknown archive split'):
                    collector.collect(root / 'invalid', 1, 'invalid')
            record = json.loads((output / 'intake.json').read_text())[0]
            self.assertEqual(record['archive']['url'], 'https://s3.amazonaws.com/ifashionist-dataset/images/train2020.zip')
            self.assertEqual(record['archive']['member'], 'train/7.jpg')
            self.assertEqual(record['sourceUrl'], collector.flickr_link(7))
            self.assertIsNone(record['body'])
            self.assertEqual(record['reviewStatus'], 'unreviewed')

    def test_reviewed_archive_restores_exact_bytes_and_rejects_changed_member(self):
        raw = io.BytesIO()
        Image.new('RGB', (80, 120), (60, 90, 180)).save(raw, format='JPEG')
        original = raw.getvalue()
        expected = io.BytesIO()
        Image.open(io.BytesIO(original)).convert('RGB').save(expected, format='WEBP', quality=85)
        zipped = io.BytesIO()
        with ZipFile(zipped, 'w') as archive:
            archive.writestr('test/photo.jpg', original)
        asset = {'id': 'fixture', 'reviewedView': 'full', 'sha256': hashlib.sha256(expected.getvalue()).hexdigest(), 'archive': {'url': 'https://example.com/photos.zip', 'member': 'test/photo.jpg', 'sha256': hashlib.sha256(original).hexdigest()}}
        for changed in [False, True]:
            with self.subTest(changed=changed), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                (root / 'scripts').mkdir()
                record = {**asset, 'archive': {**asset['archive'], **({'sha256': 'changed'} if changed else {})}}
                for name in fetcher.MANIFESTS:
                    (root / 'scripts' / name).write_text(json.dumps([record] if name == 'reviewed-assets.json' else []))
                with patch.object(fetcher, 'ROOT', root), patch.object(fetcher, 'download_archive', side_effect=lambda url, target: target.write_bytes(zipped.getvalue())) as download, patch('sys.argv', ['fetch-photos.py']):
                    if changed:
                        with self.assertRaisesRegex(ValueError, 'Archive source checksum mismatch'):
                            fetcher.main()
                        self.assertEqual(list((root / 'public/photos').iterdir()), [])
                    else:
                        fetcher.main()
                        self.assertEqual((root / 'public/photos/fixture.webp').read_bytes(), expected.getvalue())
                    download.assert_called_once()
                    self.assertEqual(download.call_args.args[0], asset['archive']['url'])

    def test_archive_streaming_limit_and_atomic_cleanup(self):
        zipped = io.BytesIO()
        with ZipFile(zipped, 'w') as archive:
            archive.writestr('fixture', b'content')
        for limit, data, fails in [(1000, zipped.getvalue(), False), (10, zipped.getvalue(), True), (1000, b'not a zip', True)]:
            with self.subTest(limit=limit, fails=fails), tempfile.TemporaryDirectory() as directory:
                target = Path(directory) / 'archive.zip'
                with patch.object(fetcher, 'MAX_ARCHIVE_BYTES', limit), patch.object(fetcher.urllib.request, 'urlopen', return_value=io.BytesIO(data)):
                    if fails:
                        with self.assertRaises((ValueError, BadZipFile)):
                            fetcher.download_archive('https://example.com/archive.zip', target)
                        self.assertFalse(target.exists())
                    else:
                        fetcher.download_archive('https://example.com/archive.zip', target)
                        self.assertEqual(target.read_bytes(), data)
                self.assertFalse(target.with_suffix('.pending').exists())

    def test_import_retains_archive_restore_metadata(self):
        batch = REPO / 'data/catalog-review/batches/2026-09-17T0320-fashionpedia'
        originals = {row['id']: row for row in json.loads((batch / 'intake.json').read_text())}
        assets = json.loads((REPO / 'scripts/reviewed-assets.json').read_text())
        restored = [row for row in assets if row['id'] in originals]
        self.assertEqual(len(restored), 1499)
        for row in restored:
            self.assertEqual(row['archive'], originals[row['id']]['archive'])


if __name__ == '__main__':
    unittest.main()
