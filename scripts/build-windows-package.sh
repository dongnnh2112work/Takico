#!/bin/bash
# Package Windows — Play Takico.bat + Stop Takico.bat + GUIDE.md + VERSION.txt
# Game data in _game/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/windows"
GAME="$OUT/_game"
RELEASE="$ROOT/release"
MANIFEST="$ROOT/assets/packs/honda-2026/manifest.json"
BUILD_AT="$(date '+%Y-%m-%d %H:%M:%S')"

echo "==> Package Windows"
echo "    Output: $OUT/"
echo ""

"$ROOT/scripts/sync-opt-assets.sh"
"$ROOT/scripts/build-server.sh"

STAGES="$(python3 -c "import json; print(json.load(open('$MANIFEST'))['game']['totalStages'])" 2>/dev/null || echo '?')"

rm -rf "$OUT"
mkdir -p "$GAME/bin"

"$ROOT/scripts/stage-game-data.sh" "$GAME"

cp "$RELEASE/bin/takico-server.exe" "$GAME/bin/"
cp "$RELEASE/play-takico.bat" "$OUT/Play Takico.bat"
cp "$RELEASE/stop-takico.bat" "$OUT/Stop Takico.bat"
"$ROOT/scripts/fix-bat-crlf.sh" "$OUT/Play Takico.bat" "$OUT/Stop Takico.bat"
cp "$RELEASE/GUIDE-windows.md" "$OUT/GUIDE.md"

cat > "$OUT/VERSION.txt" <<EOF
DI CUNG TAKICO — Windows package
Build: $BUILD_AT
Stages: $STAGES
Backgrounds: stage 1←round1, 2←round4, 3←round5 (Background V2)
EOF

echo ""
echo "✓ Windows package: $OUT"
ls -1 "$OUT" | sed 's/^/    /'
du -sh "$OUT" | awk '{print "    Size:", $1}'
