from collections import deque
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
KINDS = ("sword", "bow", "staff", "armor", "ring")
TIERS = ("standard", "epic", "supreme")


def is_checker_background(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    light = (red + green + blue) / 3
    spread = max(red, green, blue) - min(red, green, blue)
    return alpha < 18 or (spread < 30 and light > 62)


def cut_out(image: Image.Image) -> Image.Image:
    native_alpha = image.mode == "RGBA" and image.getchannel("A").getextrema()[0] < 250
    image = image.convert("RGBA")
    limit = 768
    scale = min(1.0, limit / max(image.size))
    if scale < 1:
        image = image.resize(
            (round(image.width * scale), round(image.height * scale)),
            Image.Resampling.LANCZOS,
        )
    if native_alpha:
        return image
    pixels = image.load()
    width, height = image.size
    seen = bytearray(width * height)
    queue: deque[tuple[int, int]] = deque()
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(1, height - 1):
        queue.append((0, y))
        queue.append((width - 1, y))
    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if seen[index] or not is_checker_background(pixels[x, y]):
            continue
        seen[index] = 1
        red, green, blue, _ = pixels[x, y]
        pixels[x, y] = (red, green, blue, 0)
        if x:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))
    return image


def normalize(path: Path, kind: str) -> None:
    image = cut_out(Image.open(path))
    alpha = image.getchannel("A")
    bounds = alpha.point(lambda value: 255 if value > 18 else 0).getbbox()
    if not bounds:
        raise RuntimeError(f"No visible object found in {path.name}")
    image = image.crop(bounds)
    canvas_size = (768, 512) if kind in {"sword", "bow", "staff"} else (640, 640)
    margin = 28
    fit = min(
        (canvas_size[0] - margin * 2) / image.width,
        (canvas_size[1] - margin * 2) / image.height,
    )
    image = image.resize(
        (max(1, round(image.width * fit)), max(1, round(image.height * fit))),
        Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    canvas.alpha_composite(
        image,
        ((canvas.width - image.width) // 2, (canvas.height - image.height) // 2),
    )
    canvas.save(path, optimize=True)
    visible = sum(value > 18 for value in canvas.getchannel("A").getdata())
    coverage = visible / (canvas.width * canvas.height)
    if not 0.003 < coverage < 0.72:
        raise RuntimeError(f"Suspicious alpha coverage in {path.name}: {coverage:.3f}")
    print(f"{path.name}: {canvas.width}x{canvas.height}, coverage={coverage:.3f}")


if __name__ == "__main__":
    for equipment in KINDS:
        for tier in TIERS:
            normalize(ROOT / f"loot-{equipment}-{tier}-v8.png", equipment)
