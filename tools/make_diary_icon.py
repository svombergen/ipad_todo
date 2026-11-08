"""Regenerates the Dagboek app icon: python tools/make_diary_icon.py (needs Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw

S = 2048  # draw at 2x, downsample for anti-aliasing
OUT = Path(__file__).resolve().parent.parent / "diary/ios/Kiosk/Assets.xcassets/AppIcon.appiconset/icon.png"

top, bottom = (84, 160, 255), (43, 100, 235)
img = Image.new("RGB", (S, S))
px = img.load()
for y in range(S):
    c = tuple(round(a + (b - a) * y / (S - 1)) for a, b in zip(top, bottom))
    for x in range(S):
        px[x, y] = c
d = ImageDraw.Draw(img)

# White droplet: circle + tip.
cx, cy, r = 1024, 1280, 420
d.ellipse((cx - r, cy - r, cx + r, cy + r), fill="white")
d.polygon([(cx, 380), (cx - 372, cy - 170), (cx + 372, cy - 170)], fill="white")
# Small blue check inside.
d.line([(840, 1290), (980, 1430), (1220, 1130)], fill=(43, 100, 235), width=110, joint="curve")
for p in [(840, 1290), (1220, 1130)]:
    d.ellipse((p[0] - 55, p[1] - 55, p[0] + 55, p[1] + 55), fill=(43, 100, 235))

img.resize((1024, 1024), Image.LANCZOS).save(OUT)
print("wrote", OUT)
