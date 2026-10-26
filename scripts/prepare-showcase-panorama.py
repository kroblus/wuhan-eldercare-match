"""Local-only derivative, never upload/copy an original into the repository.

Usage: python prepare-showcase-panorama.py --input <outside-repo.jpg>
  --owner-authorized --privacy-reviewed --full-sphere-equirectangular
Pillow is a workstation tool dependency, not a Mini Program dependency.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
from PIL import Image


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, required=True)
    for flag in ['owner-authorized', 'privacy-reviewed', 'full-sphere-equirectangular']:
        parser.add_argument('--' + flag, action='store_true', required=True)
    args = parser.parse_args()
    repository = Path(__file__).resolve().parents[1]
    source = args.input.resolve(strict=True)
    if source == repository or repository in source.parents:
        parser.error('Keep original private photos outside the repository.')
    if not os.environ.get('LOCALAPPDATA'):
        parser.error('LOCALAPPDATA is required for the controlled external directory.')
    target_dir = (Path(os.environ['LOCALAPPDATA']) / 'WuhanEldercareShowcase' / 'panoramas').resolve()
    if target_dir == repository or repository in target_dir.parents:
        parser.error('Keep the resolved output directory outside the repository, including symlink targets.')
    target_dir.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as original:
        original.load()
        w, h = original.size
        if w != h * 2 or w < 512 or original.getexif().get(274, 1) != 1:
            parser.error('Require a correctly oriented full-sphere 2:1 source; a ratio alone is not proof of projection.')
        exif_present = bool(original.getexif())
        gps_present = 34853 in original.getexif()
        # Fresh pixels discard EXIF, GPS, XMP, comments, thumbnails and device data.
        clean = Image.new('RGB', original.size)
        clean.paste(original.convert('RGB'))
        if w > 4096:
            clean = clean.resize((4096, 2048), Image.Resampling.LANCZOS)
        source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
        target = target_dir / ('panorama-' + source_hash[:16] + '.jpg')
        if target.exists():
            parser.error('Derivative already exists. Preserve it and inspect rather than overwrite.')
        clean.save(target, 'JPEG', quality=86, optimize=True, progressive=False)
    with Image.open(target) as check:
        if check.getexif() or set(check.info) - {'jfif', 'jfif_version', 'jfif_unit', 'jfif_density'}:
            target.unlink()
            parser.error('Derivative still contains unexpected metadata; rejected.')
        dimensions = list(check.size)
    manifest = {
        'provenance': 'OWNER_AUTHORIZED_HOME_TECHNICAL_DEMO_ONLY',
        'institutionId': None,
        'projection': 'OWNER_DECLARED_FULL_SPHERE_EQUIRECTANGULAR',
        'projectionIndependentlyVerified': False,
        'privacyReviewedByOwner': True,
        'authorizationEvidence': 'OPERATOR_ATTESTATION_NOT_INDEPENDENT_VERIFICATION',
        'originalExifPresent': exif_present,
        'originalGpsPresent': gps_present,
        'derivativeMetadataRemoved': True,
        'dimensions': dimensions,
        'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
        'networkUpload': False,
    }
    target.with_suffix('.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    print('Created a local derivative and provenance manifest outside Git.')
    print('Dimensions:', dimensions, 'EXIF/GPS removed. Review the derivative visually before selecting it.')


if __name__ == '__main__':
    main()
