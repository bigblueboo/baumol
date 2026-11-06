"""Trim generated building art, find where it meets the ground, and export WebP sprites.

Usage: python3 scripts/sprites.py [--frame-of FIRST] art/sprites/*.png

--frame-of crops every file to FIRST's bounding box, so stages edited from one image stack exactly.
Writes src/scene/iso/sprites/<name>.webp and prints each sprite's size and ground anchor
(the lowest solid pixel: the corner of the footprint nearest the reader).
"""
import json
import sys
from pathlib import Path

from PIL import Image

OUT = Path("src/scene/iso/sprites")
SOLID = 200  # alpha above this is building, not soft contact shadow
MAX_W = 520


def bbox(im: Image.Image) -> tuple[int, int, int, int]:
    return im.getchannel("A").point(lambda a: 255 if a > 8 else 0).getbbox()


def process(path: Path, box: tuple[int, int, int, int] | None) -> dict:
    im = Image.open(path).convert("RGBA")
    im = im.crop(box or bbox(im))
    if im.width > MAX_W:
        im = im.resize((MAX_W, round(im.height * MAX_W / im.width)), Image.LANCZOS)
    a = im.getchannel("A").load()
    w, h = im.size
    for y in range(h - 1, -1, -1):
        xs = [x for x in range(w) if a[x, y] > SOLID]
        if xs:
            anchor = {"x": round(sum(xs) / len(xs)), "y": y}
            break
    OUT.mkdir(parents=True, exist_ok=True)
    im.save(OUT / f"{path.stem}.webp", "WEBP", quality=84, method=6)
    return {"name": path.stem, "w": w, "h": h, "anchor": anchor}


if __name__ == "__main__":
    args = sys.argv[1:]
    box = None
    if args[:1] == ["--frame-of"]:
        box = bbox(Image.open(args[1]).convert("RGBA"))
        args = args[2:]
    print(json.dumps([process(Path(p), box) for p in args], indent=1))
