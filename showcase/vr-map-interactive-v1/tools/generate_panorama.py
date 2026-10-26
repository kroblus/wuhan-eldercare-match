"""Original synthetic geometry, not a photograph. One 360x180 equirectangular scene."""
from pathlib import Path
import hashlib
import json
import numpy as np
from PIL import Image

W, H = 2048, 1024
theta = ((np.arange(W, dtype=np.float32) + .5) / W - .5) * (2 * np.pi)
phi = (.5 - (np.arange(H, dtype=np.float32) + .5) / H) * np.pi
dx = np.broadcast_to(np.cos(phi)[:, None] * np.sin(theta)[None, :], (H, W))
dy = np.broadcast_to(np.sin(phi)[:, None], (H, W))
dz = np.broadcast_to(-np.cos(phi)[:, None] * np.cos(theta)[None, :], (H, W))
rays = [dx, dy, dz]
origin = [0, 1.6, 0]
nearest = np.full((H, W), np.inf, np.float32)
plane = np.zeros((H, W), np.uint8)
for index, (axis, value) in enumerate([(0, -5), (0, 5), (1, 0), (1, 3.6), (2, -6), (2, 6)]):
    with np.errstate(divide='ignore', invalid='ignore'):
        distance = (value - origin[axis]) / rays[axis]
    take = (distance > 1e-5) & (distance < nearest)
    nearest[take] = distance[take]
    plane[take] = index
x, y, z = dx * nearest, 1.6 + dy * nearest, dz * nearest
rgb = np.zeros((H, W, 3), np.float32)
palette = [(224, 217, 199), (237, 231, 216), (174, 143, 109), (247, 244, 233), (236, 229, 212), (221, 226, 214)]
for index, color in enumerate(palette):
    rgb[plane == index] = color
floor = plane == 2
checker = ((np.floor((x + 6) * .8) + np.floor((z + 7) * .8)).astype(int) % 2) == 0
rgb[floor & checker] += 9
rgb[floor & ((x * x / 6 + z * z / 12) < 1)] = (205, 190, 157)
for side, accent in [(0, (57, 85, 98)), (1, (180, 148, 76)), (4, (189, 91, 55)), (5, (85, 117, 103))]:
    horizontal = z if side < 2 else x
    wall = plane == side
    frame = wall & (abs(horizontal) < 2.5) & (y > .7) & (y < 2.9)
    rgb[frame] = (75, 71, 62)
    panel = wall & (abs(horizontal) < 2.35) & (y > .82) & (y < 2.78)
    rgb[panel] = accent
    # Repeated geometric motifs drawn on the plane, with correct spherical projection.
    circle = panel & (((horizontal + .7) ** 2 + (y - 1.85) ** 2) < .48)
    rgb[circle] = (231, 219, 187)
    stripe = panel & (horizontal > .5) & (horizontal < 1.4) & (y > 1.1) & (y < 2.4)
    rgb[stripe] = (235, 228, 207)
    skirting = wall & (y < .16)
    rgb[skirting] = (115, 99, 78)
shade = np.clip(1.06 - nearest * .018, .77, 1.0)
rgb = np.clip(rgb * shade[:, :, None], 0, 255).astype(np.uint8)
target = Path(__file__).resolve().parents[1] / 'miniprogram' / 'assets' / 'teaching-room-360.png'
target.parent.mkdir(parents=True, exist_ok=True)
Image.fromarray(rgb).save(target, optimize=True)
metadata = {
    'id': 'original-teaching-room-360', 'file': target.name,
    'width': W, 'height': H, 'projection': 'equirectangular',
    'horizontalDegrees': 360, 'verticalDegrees': 180,
    'generator': 'tools/generate_panorama.py',
    'source': 'Original ray/box intersection and geometric plane motifs; no imported photograph or third-party panorama',
    'provenance': 'ORIGINAL_PROCEDURAL_SYNTHETIC', 'institutionId': None,
    'sha256': hashlib.sha256(target.read_bytes()).hexdigest(),
    'bytes': target.stat().st_size,
    'disclosure': '合成教学空间，非机构实景，不证明设施或空间条件已核验'
}
(target.parent / 'provenance.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(metadata, ensure_ascii=True))
