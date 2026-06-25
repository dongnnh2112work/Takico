#!/bin/bash
# Package macOS → macos/Play Takico.app + macos/GUIDE.md
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/macos"
RELEASE="$ROOT/release"
APP="$OUT/Play Takico.app"
GAME="$APP/Contents/Resources/game"
MANIFEST="$ROOT/assets/packs/honda-2026/manifest.json"
BUILD_AT="$(date '+%Y-%m-%d %H:%M:%S')"

echo "==> Package macOS"
echo "    Output: $OUT/"
echo ""

"$ROOT/scripts/sync-opt-assets.sh"
"$ROOT/scripts/build-server.sh"

LOGO="$ROOT/assets/logo-takico.png"
if [[ ! -f "$LOGO" ]]; then
  LOGO="$ROOT/release/logo-square.png"
fi
if [[ ! -f "$LOGO" ]] && [[ -f "$ROOT/assets/opt/thumb.webp" ]]; then
  python3 -c "
from PIL import Image
from pathlib import Path
p = Path('$ROOT/release/logo-square.png')
p.parent.mkdir(parents=True, exist_ok=True)
Image.open('$ROOT/assets/opt/thumb.webp').convert('RGBA').save(p)
" 2>/dev/null || true
fi
LOGO="${LOGO:-$ROOT/release/logo-square.png}" "$ROOT/scripts/build-app-icon.sh" 2>/dev/null || true

rm -rf "$OUT"
mkdir -p "$OUT"

"$ROOT/scripts/make-macos-app.sh" "$APP"
mkdir -p "$GAME/bin"

"$ROOT/scripts/stage-game-data.sh" "$GAME"

cp "$RELEASE/bin/takico-server" "$GAME/bin/"
chmod +x "$GAME/bin/takico-server" "$GAME/takico-start.sh" "$GAME/stop-launcher.sh"

"$ROOT/scripts/sign-macos-app.sh" "$APP"

cp "$RELEASE/GUIDE-macos.md" "$OUT/GUIDE.md"

STAGES="$(python3 -c "import json; print(json.load(open('$MANIFEST'))['game']['totalStages'])" 2>/dev/null || echo '?')"
cat > "$OUT/VERSION.txt" <<EOF
DI CUNG TAKICO — macOS package
Build: $BUILD_AT
Stages: $STAGES
Backgrounds: stage 1←round1, 2←round4, 3←round5 (Background V2)
EOF

xattr -cr "$OUT" 2>/dev/null || true

"$ROOT/scripts/make-macos-app.sh" "$RELEASE/Play Takico.app"
"$ROOT/scripts/sign-macos-app.sh" "$RELEASE/Play Takico.app"

echo ""
echo "✓ macOS package: $OUT"
ls -1 "$OUT" | sed 's/^/    /'
du -sh "$OUT" | awk '{print "    Size:", $1}'
