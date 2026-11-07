"""Regenerates the app icon: python tools/make_icon.py (needs Pillow)."""
import math
from pathlib import Path
from PIL import Image, ImageDraw

S = 2048  # draw at 2x, downsample for anti-aliasing
OUT = Path(__file__).resolve().parent.parent / "ios/Kiosk/Assets.xcassets/AppIcon.appiconset/icon.png"


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


# Diagonal gradient, same palette as the app background.
stops = [(255, 233, 168), (255, 198, 217), (201, 216, 255)]
grad = Image.new("RGB", (S, S))
px = grad.load()
for y in range(S):
    for x in range(S):
        t = (x + y) / (2 * S - 2)
        px[x, y] = lerp(stops[0], stops[1], t * 2) if t < 0.5 else lerp(stops[1], stops[2], t * 2 - 1)
img = grad
d = ImageDraw.Draw(img)

# Card with soft drop shadow.
card = (420, 520, 1628, 1728)
d.rounded_rectangle((card[0], card[1] + 50, card[2], card[3] + 50), 220, fill=(225, 190, 210))
d.rounded_rectangle(card, 220, fill=(255, 255, 255))

# Green check.
d.line([(700, 1140), (930, 1380), (1360, 880)], fill=(47, 199, 119), width=190, joint="curve")
for p in [(700, 1140), (1360, 880)]:
    d.ellipse((p[0] - 95, p[1] - 95, p[0] + 95, p[1] + 95), fill=(47, 199, 119))

# Yellow star, top-right of the card.
cx, cy, ro, ri = 1580, 520, 330, 140
star = [
    (cx + (ro if i % 2 == 0 else ri) * math.sin(i * math.pi / 5), cy - (ro if i % 2 == 0 else ri) * math.cos(i * math.pi / 5))
    for i in range(10)
]
d.polygon(star, fill=(255, 196, 0), outline=(240, 160, 0), width=24)

img.resize((1024, 1024), Image.LANCZOS).save(OUT)  # RGB, no alpha (App Store-style icons must be opaque)
print("wrote", OUT)
