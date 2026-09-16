import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('admission', ROOT / 'scripts/import-reviewed-catalog.py')
admission = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(admission)
FETCH_SPEC = importlib.util.spec_from_file_location('fetcher', ROOT / 'scripts/fetch-photos.py')
fetcher = importlib.util.module_from_spec(FETCH_SPEC)
FETCH_SPEC.loader.exec_module(fetcher)


class BatchValidation(unittest.TestCase):
    def test_restore_rejects_changed_bytes_without_publishing(self):
        asset = admission.read(ROOT / 'scripts/reviewed-assets.json')[0]
        source = (ROOT / 'public' / asset['src'].lstrip('/')).read_bytes()
        (ROOT / '.cache').mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as directory:
            temporary = Path(directory)
            (temporary / 'scripts').mkdir()
            for name in fetcher.MANIFESTS:
                (temporary / 'scripts' / name).write_text(json.dumps([{**asset, 'sha256': 'changed'}] if name == 'reviewed-assets.json' else []))
            with patch.object(fetcher, 'ROOT', temporary), patch.object(fetcher, 'download', return_value=source), patch('sys.argv', ['fetch-photos.py']):
                with self.assertRaisesRegex(ValueError, 'Reviewed source or encoder changed'):
                    fetcher.main()
                self.assertEqual(list((temporary / 'public/photos').iterdir()), [])
                destination = temporary / 'public' / asset['src'].lstrip('/')
                destination.write_bytes(b'corrupt original')
                with self.assertRaisesRegex(ValueError, 'Reviewed asset checksum mismatch'):
                    fetcher.main()
                self.assertEqual(destination.read_bytes(), b'corrupt original')

    def test_corrupt_batches_are_rejected(self):
        original_read = admission.read
        cases = [
            ('labels.json', lambda rows: rows.pop(), 'Incomplete batch review'),
            ('labels.json', lambda rows: rows.__setitem__(1, rows[0]), 'Incomplete batch review'),
            ('intake.json', lambda rows: rows.append(rows[0]), 'Duplicate batch intake IDs'),
            ('labels.json', lambda rows: rows[0].__setitem__('sha256', 'invalid'), 'Stale image binding'),
            ('labels.json', lambda rows: rows[0]['body'].__setitem__('build', True), 'Invalid axes'),
            ('labels.json', lambda rows: rows[0].__setitem__('evidence', ''), 'Missing visual review'),
            ('intake.json', lambda rows: rows[0].__setitem__('sourceUrl', original_read(admission.DATA / 'baseline.json')[0]['sourceUrl']), 'Batch reuses an earlier source page'),
        ]
        for filename, corrupt, error in cases:
            def modified_read(path):
                value = original_read(path)
                if path.parent.name == '2026-09-16-snag' and path.name == filename:
                    corrupt(value)
                return value
            with self.subTest(error=error), patch.object(admission, 'read', modified_read):
                with self.assertRaisesRegex(ValueError, error):
                    admission.assemble(check=True)


if __name__ == '__main__':
    unittest.main()
