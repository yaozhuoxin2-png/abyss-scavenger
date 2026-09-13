from collections import deque
from pathlib import Path

from PIL import Image


def is_background(pixel):
    red, green, blue, alpha = pixel
    spread = max(red, green, blue) - min(red, green, blue)
    light = (red + green + blue) / 3
    return alpha < 8 or (spread < 20 and light > 118)


def cut_out_connected_backdrop(image):
    image = image.convert("RGBA")
    pixels = image.load()
    width, height = image.size
    queue = deque()
    seen = bytearray(width * height)
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(1, height - 1):
        queue.append((0, y))
        queue.append((width - 1, y))
    while queue:
        x, y = queue.popleft()
        index = y * width + x
        if seen[index] or not is_background(pixels[x, y]):
            continue
        seen[index] = 1
        red, green, blue, _ = pixels[x, y]
        pixels[x, y] = red, green, blue, 0
        if x:
            queue.append((x - 1, y))
        if x + 1 < width:
            queue.append((x + 1, y))
        if y:
            queue.append((x, y - 1))
        if y + 1 < height:
            queue.append((x, y + 1))
    return image


for asset in sorted(Path.cwd().glob("hero-walk-*-v8.png")):
    source = cut_out_connected_backdrop(Image.open(asset))
    resized = source.resize((source.width // 2, source.height // 2), Image.Resampling.LANCZOS)
    resized.save(asset, optimize=True)
    print(f"{asset.name}: {resized.width}x{resized.height}")
