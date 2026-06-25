#!/bin/bash
# Tạo applet.icns từ logo Takico cho Chơi Takico.app
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGO="${LOGO:-$ROOT/assets/logo-takico.png}"
SQUARE="$ROOT/release/logo-square.png"
ICONSET="$ROOT/release/AppIcon.iconset"
ICNS="$ROOT/release/applet.icns"

echo "==> Tạo icon app từ logo Takico"

if [[ ! -f "$LOGO" ]]; then
  if [[ -f "$SQUARE" ]]; then
    echo "    Dùng logo-square.png có sẵn"
  elif [[ -f "$ROOT/assets/opt/thumb.webp" ]]; then
    python3 -c "from PIL import Image; Image.open('$ROOT/assets/opt/thumb.webp').convert('RGBA').save('$SQUARE')"
    echo "    Tạo logo từ thumb.webp"
  else
    echo "    Bỏ qua — không tìm thấy logo"
    exit 0
  fi
else
export LOGO SQUARE
python3 <<'PY'
import os
from PIL import Image
from pathlib import Path
logo = Path(os.environ["LOGO"])
square = Path(os.environ["SQUARE"])
im = Image.open(logo).convert("RGBA")
w, h = im.size
s = max(w, h)
canvas = Image.new("RGBA", (s, s), (255, 255, 255, 0))
canvas.paste(im, ((s - w) // 2, (s - h) // 2), im)
# Bo góc nhẹ cho đẹp trên Dock (macOS tự mask tròn, giữ vuông đủ)
canvas.save(square, "PNG")
print(f"    {w}x{h} -> {s}x{s} (vuông, nền trong suốt)")
PY
fi

if [[ ! -f "$SQUARE" ]]; then
  exit 0
fi

rm -rf "$ICONSET"
mkdir -p "$ICONSET"

make_icon() {
  local size=$1 name=$2
  sips -z "$size" "$size" "$SQUARE" --out "$ICONSET/$name" >/dev/null
}

make_icon 16  icon_16x16.png
make_icon 32  icon_16x16@2x.png
make_icon 32  icon_32x32.png
make_icon 64  icon_32x32@2x.png
make_icon 128 icon_128x128.png
make_icon 256 icon_128x128@2x.png
make_icon 256 icon_256x256.png
make_icon 512 icon_256x256@2x.png
make_icon 512 icon_512x512.png
make_icon 1024 icon_512x512@2x.png

iconutil -c icns "$ICONSET" -o "$ICNS"
rm -rf "$ICONSET"
ls -lh "$ICNS"
echo "✓ Icon: $ICNS"
