"""Small fixture checks for byte totals, exclusions, links and safe HTML data."""
import json
import os
from pathlib import Path
import tempfile
import unittest

from scan import render, scan


class ScanCheck(unittest.TestCase):
    def test_real_totals_and_self_exclusion(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'nested').mkdir()
            (root / 'nested' / '中文.txt').write_bytes(b'abcde')
            (root / '.hidden').write_bytes(b'xyz')
            (root / 'zero').write_bytes(b'')
            (root / 'empty').mkdir()
            output = root / 'output' / 'report'
            output.mkdir(parents=True)
            (output / 'old-report.html').write_bytes(b'x' * 1000)
            data = scan(root, output)
            self.assertEqual((data['tree']['s'], data['tree']['f'], data['tree']['d']), (8, 3, 3))
            self.assertEqual(data['issues'], [])
            render(data, output)
            again = scan(root, output)
            self.assertEqual((again['tree']['s'], again['tree']['f']), (8, 3))

    def test_link_not_followed(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'original').write_bytes(b'123')
            try:
                os.symlink(root / 'original', root / 'link')
            except OSError:
                self.skipTest('此账户无法建立符号链接')
            data = scan(root, root / 'report')
            self.assertEqual((data['tree']['s'], data['tree']['f']), (3, 1))
            self.assertEqual(len(data['issues']), 1)

    def test_inline_json_cannot_close_script(self):
        with tempfile.TemporaryDirectory() as folder:
            output = Path(folder)
            data = {'root': 'demo', 'tree': {'n': '</script><script>alert(1)</script>', 's': 0, 'f': 0, 'd': 0, 'c': []}}
            render(data, output)
            html = (output / 'index.html').read_text(encoding='utf-8')
            encoded = html.split('<script id="snapshot" type="application/json">')[1].split('</script>')[0]
            self.assertNotIn('<', encoded)
            self.assertEqual(json.loads(encoded), data)
            self.assertNotIn('/* EXPLORER_', html)

    def test_non_directory_root_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'file'
            root.touch()
            with self.assertRaises(ValueError):
                scan(root, Path(folder) / 'report')


if __name__ == '__main__':
    unittest.main()
