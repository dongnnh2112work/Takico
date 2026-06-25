#!/bin/bash
# Verify macos/ and windows/ run standalone (no repo dependency)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MACOS="$ROOT/macos"
WINDOWS="$ROOT/windows"
MAC_GAME="$MACOS/Play Takico.app/Contents/Resources/game"
WIN_GAME="$WINDOWS/_game"
FAIL=0

check() {
  if [[ -f "$1" ]] || [[ -x "$1" ]]; then
    echo "    ✓ $2"
  else
    echo "    ✗ MISSING: $2 ($1)"
    FAIL=1
  fi
}

echo "==> Verify standalone packages"

echo "  macos/"
check "$MACOS/Play Takico.app/Contents/MacOS/launcher" "Play Takico.app launcher"
check "$MAC_GAME/index.html" "index.html"
check "$MAC_GAME/bin/takico-server" "takico-server"
check "$MAC_GAME/vendor/babel.min.js" "vendor (offline)"
check "$MAC_GAME/assets/packs/honda-2026/manifest.json" "manifest"
check "$MAC_GAME/assets/opt/round5_red.webp" "round5 background"
check "$MACOS/GUIDE.md" "GUIDE.md"

echo "  windows/"
check "$WINDOWS/Play Takico.bat" "Play Takico.bat"
check "$WINDOWS/Stop Takico.bat" "Stop Takico.bat"
check "$WIN_GAME/bin/takico-server.exe" "takico-server.exe"
check "$WIN_GAME/index.html" "index.html"
check "$WIN_GAME/vendor/babel.min.js" "vendor (offline)"
check "$WIN_GAME/assets/packs/honda-2026/manifest.json" "manifest"
check "$WINDOWS/GUIDE.md" "GUIDE.md"

# Smoke test: copy macos to temp and start server
TMP="$(mktemp -d)"
trap 'lsof -ti :8765 2>/dev/null | xargs kill -9 2>/dev/null || true; rm -rf "$TMP"' EXIT
cp -R "$MAC_GAME" "$TMP/game"
( cd "$TMP/game" && ./bin/takico-server ) &
sleep 2
if curl -sf "http://127.0.0.1:8765/" >/dev/null; then
  echo "    ✓ macOS server smoke test (copied outside repo)"
else
  echo "    ✗ macOS server smoke test FAILED"
  FAIL=1
fi

if [[ "$FAIL" -eq 0 ]]; then
  echo "✓ Both packages are self-contained — copy macos/ or windows/ anywhere to run."
else
  echo "✗ Package verification failed"
  exit 1
fi
