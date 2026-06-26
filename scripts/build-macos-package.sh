#!/bin/bash
# Package macOS — Play Takico.command + _takico/ (mirror Windows layout)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/macos"
DATA="$OUT/_takico"
RELEASE="$ROOT/release"
MANIFEST="$ROOT/assets/packs/honda-2026/manifest.json"
BUILD_AT="$(date '+%Y-%m-%d %H:%M:%S')"

echo "==> Package macOS"
echo "    Output: $OUT/"
echo "    Layout: Play Takico.command + _takico/"
echo ""

"$ROOT/scripts/sync-opt-assets.sh"
"$ROOT/scripts/build-server.sh"

rm -rf "$OUT"
mkdir -p "$DATA/bin"

"$ROOT/scripts/stage-game-data.sh" "$DATA"

cp "$RELEASE/bin/takico-server" "$DATA/bin/"
chmod +x "$DATA/bin/takico-server" "$DATA/takico-start.sh" "$DATA/stop-launcher.sh"

cp "$RELEASE/GUIDE-macos.md" "$DATA/GUIDE.md"
cp "$RELEASE/README-FIRST-macos.txt" "$DATA/README-FIRST.txt"

STAGES="$(python3 -c "import json; print(json.load(open('$MANIFEST'))['game']['totalStages'])" 2>/dev/null || echo '?')"
cat > "$DATA/VERSION.txt" <<EOF
DI CUNG TAKICO — macOS package
Build: $BUILD_AT
Stages: $STAGES
Backgrounds: stage 1←round1, 2←round4, 3←round5 (Background V2)
EOF

cp "$RELEASE/play-takico.command" "$OUT/Play Takico.command"
cp "$RELEASE/MACOS-DOWNLOAD-HELP.txt" "$OUT/0 - DOC TRUOC KHI CHOI.txt"
chmod +x "$OUT/Play Takico.command"

chflags hidden "$DATA" 2>/dev/null || true
xattr -cr "$OUT" 2>/dev/null || true

ZIP="$ROOT/macos.zip"
rm -f "$ZIP"
ditto -c -k --sequesterRsrc --keepParent "$OUT" "$ZIP"
echo "    Zip: $ZIP ($(du -sh "$ZIP" | awk '{print $1}'))"

echo ""
echo "✓ macOS package: $OUT"
echo "    (user: Play Takico.command + 0 - DOC TRUOC KHI CHOI.txt)"
ls -1 "$OUT" | sed 's/^/    /'
du -sh "$OUT" | awk '{print "    Size:", $1}'
