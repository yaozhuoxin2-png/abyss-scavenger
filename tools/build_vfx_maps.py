from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance


ROOT = Path(__file__).resolve().parents[1]


def normalize_atlas(name: str) -> None:
    path = ROOT / name
    image = Image.open(path).convert("RGBA")
    image.resize((1776, 888), Image.Resampling.LANCZOS).save(path, optimize=True)


def build_flow_maps(source_name: str, normal_name: str, distortion_name: str) -> None:
    source_path = ROOT / source_name
    source = Image.open(source_path).convert("L").resize((512, 512), Image.Resampling.LANCZOS)
    source = ImageEnhance.Contrast(source).enhance(1.28)
    source.save(source_path, optimize=True)

    height = np.asarray(source, dtype=np.float32) / 255.0
    gx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 2.8
    gy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 2.8

    nz = np.ones_like(height)
    length = np.sqrt(gx * gx + gy * gy + nz * nz)
    normal = np.dstack((-gx / length, -gy / length, nz / length))
    normal = np.clip((normal * 0.5 + 0.5) * 255.0, 0, 255).astype(np.uint8)
    Image.fromarray(normal, "RGB").save(ROOT / normal_name, optimize=True)

    distortion = np.dstack((
        np.clip(128.0 + gx * 145.0, 0, 255),
        np.clip(128.0 + gy * 145.0, 0, 255),
        np.full_like(height, 128.0),
    )).astype(np.uint8)
    Image.fromarray(distortion, "RGB").save(ROOT / distortion_name, optimize=True)


if __name__ == "__main__":
    normalize_atlas("vfx-sword-slash-atlas-v8.png")
    normalize_atlas("vfx-sword-sparks-atlas-v8.png")
    build_flow_maps("vfx-sword-flow-v8.png", "vfx-sword-normal-v8.png", "vfx-sword-distortion-v8.png")
    normalize_atlas("vfx-staff-eclipse-atlas-v8.png")
    normalize_atlas("vfx-staff-collapse-atlas-v8.png")
    build_flow_maps("vfx-staff-flow-v8.png", "vfx-staff-normal-v8.png", "vfx-staff-distortion-v8.png")
