"""Render the Cairn PNG icons from the same shapes as cairn-app-icon.svg.

    python scripts/cairn-icons.py

Writes to resources/images/:
  cairn-apple-touch-icon.png  180x180, full-bleed (iOS rounds the corners itself)
  cairn-icon-192.png / -512.png  web app manifest icons, rounded like the SVG

Needs Pillow. Shapes are drawn 4x oversize and scaled down for smooth edges.
"""
from pathlib import Path

from PIL import Image, ImageDraw

SLATE = (0x1F, 0x2A, 0x2E)
MIST = (0xED, 0xF0, 0xEE)
LICHEN = (0x8F, 0xA3, 0x5D)
OUT = Path(__file__).resolve().parent.parent / "resources" / "images"


def icon(size, rounded):
    s = 4 * size
    k = s / 1024  # the SVG is 1024 units square
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, s - 1, s - 1], radius=228 * k if rounded else 0, fill=SLATE)

    # The mark: translate(152 142) scale(7.2) on a 100-unit grid.
    def at(x, y):
        return ((152 + 7.2 * x) * k, (142 + 7.2 * y) * k)

    for x, y, w, h in [(14, 70, 72, 18), (24, 50, 52, 17), (30, 32, 36, 15)]:
        (x0, y0), (x1, y1) = at(x, y), at(x + w, y + h)
        d.rounded_rectangle([x0, y0, x1, y1], radius=7.2 * k * h / 2, fill=MIST)
    (cx, cy), r = at(50, 20), 7.2 * 8 * k
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=LICHEN)
    out = img.resize((size, size), Image.LANCZOS)
    return out.convert("RGB") if not rounded else out


icon(180, rounded=False).save(OUT / "cairn-apple-touch-icon.png", optimize=True)
icon(192, rounded=True).save(OUT / "cairn-icon-192.png", optimize=True)
icon(512, rounded=True).save(OUT / "cairn-icon-512.png", optimize=True)
print("wrote icons to", OUT)
