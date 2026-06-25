#!/bin/bash
# Ký ad-hoc + gỡ quarantine để macOS cho phép chạy .app offline
#   ./scripts/sign-macos-app.sh /path/to/Chơi\ Takico.app
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <path/to/Play Takico.app>"
  exit 1
fi

APP="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
SERVER="$APP/Contents/Resources/game/bin/takico-server"

if [[ ! -d "$APP" ]]; then
  echo "ERROR: Không tìm thấy $APP"
  exit 1
fi

xattr -cr "$APP" 2>/dev/null || true

if [[ -x "$SERVER" ]]; then
  codesign -s - --force "$SERVER" 2>/dev/null || true
fi

LAUNCHER="$APP/Contents/MacOS/launcher"
if [[ -x "$LAUNCHER" ]]; then
  codesign -s - --force "$LAUNCHER" 2>/dev/null || true
fi

# Ký toàn bộ bundle
codesign -s - --force --deep "$APP" 2>/dev/null || {
  echo "WARN: codesign --deep thất bại — thử ký từng phần..."
  [[ -x "$APP/Contents/MacOS/applet" ]] && codesign -s - --force "$APP/Contents/MacOS/applet" 2>/dev/null || true
  [[ -x "$LAUNCHER" ]] && codesign -s - --force "$LAUNCHER" 2>/dev/null || true
}

echo "✓ Signed: $APP"
codesign -dv "$APP" 2>&1 | grep -E 'Identifier|Signature|TeamIdentifier' || true
