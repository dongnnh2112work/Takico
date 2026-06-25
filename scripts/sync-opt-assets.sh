#!/bin/bash
# Đồng bộ nền round + idle → assets/opt/*.webp
#   round 1, 4  ← assets/backround/*.png
#   round 5     ← assets/Background V2/round5_*.jpeg
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QUALITY=86

echo "==> Sync nền round → opt WebP"

python3 <<PY
from pathlib import Path
from PIL import Image

root = Path("$ROOT")
backround = root / "assets" / "backround"
bv2 = root / "assets" / "Background V2"
out = root / "assets" / "opt"
out.mkdir(parents=True, exist_ok=True)
quality = $QUALITY

def to_webp(src: Path, dst: Path) -> None:
    im = Image.open(src).convert("RGBA")
    rgb = Image.new("RGB", im.size, (255, 255, 255))
    rgb.paste(im, mask=im.split()[3] if im.mode == "RGBA" else None)
    rgb.save(dst, "WEBP", quality=quality, method=6)
    print(f"    {src.relative_to(root)} → {dst.name} ({dst.stat().st_size // 1024} KB)")

entries = [
    (backround / "thumb.png", out / "thumb.webp"),
]
for n in (1, 4):
    entries += [
        (backround / f"round{n}_red.png", out / f"round{n}_red.webp"),
        (backround / f"round{n}_green.png", out / f"round{n}_green.webp"),
    ]
entries += [
    (bv2 / "round5_red.jpeg", out / "round5_red.webp"),
    (bv2 / "round5_green.jpeg", out / "round5_green.webp"),
]

for sp, dp in entries:
    if not sp.exists():
        print(f"    SKIP (thiếu): {sp.relative_to(root)}")
        continue
    to_webp(sp, dp)

print("✓ opt/ — chặng 1·4·5 (round5 từ Background V2)")
PY
