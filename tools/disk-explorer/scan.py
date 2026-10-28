"""Generate a private, offline directory-size report; never read file contents."""
import argparse
from datetime import datetime, timezone, timedelta
import json
import os
from pathlib import Path
import stat
import time


def scan(root, excluded):
    root = root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError('扫描目标必须是目录')
    excluded = excluded.resolve()
    issues = []
    started = time.perf_counter()

    def walk(path, name):
        node = {'n': name, 's': 0, 'f': 0, 'd': 0, 'c': []}
        try:
            with os.scandir(path) as entries:
                for entry in entries:
                    child_path = Path(entry.path)
                    if child_path == excluded:
                        continue
                    try:
                        info = entry.stat(follow_symlinks=False)
                        if stat.S_ISLNK(info.st_mode) or getattr(info, 'st_file_attributes', 0) & getattr(stat, 'FILE_ATTRIBUTE_REPARSE_POINT', 0):
                            issues.append({'path': str(child_path.relative_to(root)), 'reason': '链接或重解析点，未跟随'})
                            continue
                        if stat.S_ISDIR(info.st_mode):
                            child = walk(child_path, entry.name)
                            child['m'] = info.st_mtime
                            node['d'] += child['d'] + 1
                        elif stat.S_ISREG(info.st_mode):
                            child = {'n': entry.name, 's': info.st_size, 'f': 1, 'd': 0, 'm': info.st_mtime}
                        else:
                            issues.append({'path': str(child_path.relative_to(root)), 'reason': '非常规文件，未统计'})
                            continue
                        node['c'].append(child)
                        node['s'] += child['s']
                        node['f'] += child['f']
                    except OSError as error:
                        issues.append({'path': str(child_path.relative_to(root)), 'reason': f'无法读取元数据：{error.strerror}'})
        except OSError as error:
            issues.append({'path': str(path.relative_to(root)), 'reason': f'无法枚举目录：{error.strerror}'})
        node['c'].sort(key=lambda child: (-child['s'], child['n'].casefold()))
        return node

    # Extended Windows paths keep deeply nested dependency/Java filenames visible.
    scan_root = Path('\\\\?\\' + str(root)) if os.name == 'nt' and not str(root).startswith('\\\\?\\') else root
    scan_excluded = Path('\\\\?\\' + str(excluded)) if os.name == 'nt' and not str(excluded).startswith('\\\\?\\') else excluded
    display_root = root
    root, excluded = scan_root, scan_excluded
    tree = walk(root, display_root.name)
    return {'root': str(display_root), 'generated': datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds'),
            'seconds': round(time.perf_counter() - started, 2), 'excluded': str(excluded.relative_to(root)) if excluded.is_relative_to(root) else str(excluded),
            'issues': issues, 'tree': tree}


def render(data, destination):
    source = Path(__file__).parent
    # Inline JSON is data, including any unusual local filename; it cannot end a script element.
    payload = json.dumps(data, ensure_ascii=False, separators=(',', ':')).replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')
    page = (source / 'index.html').read_text(encoding='utf-8')
    page = page.replace('/* EXPLORER_STYLE */', (source / 'style.css').read_text(encoding='utf-8'))
    page = page.replace('/* EXPLORER_APP */', (source / 'app.js').read_text(encoding='utf-8'))
    page = page.replace('/* EXPLORER_DATA */', payload)
    destination.mkdir(parents=True, exist_ok=True)
    (destination / 'index.html').write_text(page, encoding='utf-8')
    (destination / 'snapshot.json').write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    output = (args.output or args.root / 'output/disk-explorer').resolve()
    if output == args.root.resolve():
        parser.error('报告输出不能覆盖扫描根目录')
    snapshot = scan(args.root, output)
    render(snapshot, output)
    print(json.dumps({'page': str(output / 'index.html'), 'bytes': snapshot['tree']['s'], 'files': snapshot['tree']['f'], 'directories': snapshot['tree']['d'], 'skipped': len(snapshot['issues']), 'seconds': snapshot['seconds']}, ensure_ascii=False))
