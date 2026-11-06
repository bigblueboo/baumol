"""Cut character sheets into townsperson sprites.

Usage: python3 scripts/people.py art/people/char-*.png

Each sheet shows one character in two rows of four: overalls (standing, three walk frames), then
scrubs (the same). Every figure from a sheet is scaled by one factor and padded to a common
height, bottom-aligned, so the frames stack without jitter and the person keeps their size.
Writes src/scene/iso/sprites/people/<sheet>-<job>-<n>.webp.
"""
import sys
from pathlib import Path

from PIL import Image

OUT = Path("src/scene/iso/sprites/people")
HEIGHT = 150
ALPHA = 112  # below this is background haze or soft shadow, dropped from the sprite
SPECK = 4  # a row or column with fewer solid pixels than this counts as a gap
JOBS = ("goods", "service")


def runs(profile: list[int], min_len: int) -> list[tuple[int, int]]:
    """Spans where the profile is solid, ignoring stray specks and slivers shorter than min_len."""
    spans, start = [], None
    for i, v in enumerate(profile + [0]):
        v = v > SPECK
        if v and start is None:
            start = i
        elif not v and start is not None:
            if i - start >= min_len:
                spans.append((start, i))
            start = None
    return spans


def figures(im: Image.Image) -> list[list[Image.Image]]:
    mask = im.getchannel("A").point(lambda a: 255 if a > ALPHA else 0)
    w, h = mask.size
    px = mask.load()
    rows = runs([sum(1 for x in range(w) if px[x, y]) for y in range(h)], h // 8)
    if len(rows) != 2:
        raise SystemExit(f"expected 2 rows, found {len(rows)}")
    out = []
    for y0, y1 in rows:
        cols = runs([sum(1 for y in range(y0, y1) if px[x, y]) for x in range(w)], w // 40)
        if len(cols) != 4:
            raise SystemExit(f"expected 4 figures in a row, found {len(cols)}")
        out.append([im.crop((x0, y0, x1, y1)) for x0, x1 in cols])
    return [[f.crop(f.getchannel("A").point(lambda a: 255 if a > ALPHA else 0).getbbox()) for f in row] for row in out]


def main(paths: list[str]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for path in map(Path, paths):
        im = Image.open(path).convert("RGBA")
        im.putalpha(im.getchannel("A").point(lambda a: a if a > ALPHA else 0))
        rows = figures(im)
        scale = HEIGHT / max(f.height for row in rows for f in row)
        for job, row in zip(JOBS, rows):
            for n, f in enumerate(row):
                f = f.resize((round(f.width * scale), round(f.height * scale)), Image.LANCZOS)
                canvas = Image.new("RGBA", (f.width, HEIGHT))
                canvas.alpha_composite(f, (0, HEIGHT - f.height))
                canvas.save(OUT / f"{path.stem}-{job}-{n}.webp", "WEBP", quality=84, method=6)
        print(path.stem, "ok")


if __name__ == "__main__":
    main(sys.argv[1:])
